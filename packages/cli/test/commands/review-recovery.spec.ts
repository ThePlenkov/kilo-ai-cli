import { describe, expect, it, vi } from 'vitest'

import type { CodeReview, CodeReviewDetail } from '../../src/api/types.ts'
import {
  isRetriggerableStatus,
  isStaleInFlight,
  type RecoveryDeps,
  recoverCodeReviews,
  upsertModelOverride,
} from '../../src/commands/review-recovery.ts'

function makeReview(overrides: Partial<CodeReview> = {}): CodeReview {
  return {
    id: 'cr1',
    status: 'failed',
    platform: 'github',
    repo_full_name: 'user/repo',
    pr_number: 42,
    pr_title: 'fix: thing',
    created_at: '2026-09-21T10:00:00Z',
    updated_at: '2026-09-21T10:05:00Z',
    ...overrides,
  }
}

function makeDeps(overrides: Partial<RecoveryDeps> = {}): RecoveryDeps {
  return {
    listReviews: vi.fn(async () => [makeReview()]),
    getReview: vi.fn(
      async (): Promise<CodeReviewDetail> => ({
        review: makeReview({ status: 'completed' }),
        attempts: [],
      }),
    ),
    retrigger: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    getConfig: vi.fn(async () => ({ isEnabled: true, modelSlug: 'anthropic/claude' })),
    saveConfig: vi.fn(async () => {}),
    prState: vi.fn(async () => 'open' as const),
    resolveRepoId: vi.fn(async () => 12345),
    sleep: vi.fn(async () => {}),
    now: vi.fn(() => Date.parse('2026-09-21T11:00:00Z')),
    ...overrides,
  }
}

describe('isRetriggerableStatus', () => {
  it('accepts failed, cancelled, interrupted', () => {
    for (const s of ['failed', 'cancelled', 'interrupted']) {
      expect(isRetriggerableStatus(s)).toBe(true)
    }
  })
  it('rejects in-flight and completed', () => {
    for (const s of ['pending', 'queued', 'running', 'completed']) {
      expect(isRetriggerableStatus(s)).toBe(false)
    }
  })
})

describe('isStaleInFlight', () => {
  const now = Date.parse('2026-09-21T11:00:00Z')
  it('marks old pending/queued reviews as stale', () => {
    const review = makeReview({
      status: 'pending',
      created_at: '2026-09-21T09:00:00Z',
      updated_at: '2026-09-21T09:00:00Z',
    })
    expect(isStaleInFlight(review, 75 * 60_000, now)).toBe(true)
  })
  it('ignores fresh pending reviews', () => {
    const review = makeReview({
      status: 'pending',
      created_at: '2026-09-21T10:59:00Z',
      updated_at: '2026-09-21T10:59:00Z',
    })
    expect(isStaleInFlight(review, 75 * 60_000, now)).toBe(false)
  })
  it('never marks a running review as stale', () => {
    const review = makeReview({
      status: 'running',
      created_at: '2026-09-21T08:00:00Z',
      updated_at: '2026-09-21T08:00:00Z',
    })
    expect(isStaleInFlight(review, 75 * 60_000, now)).toBe(false)
  })
  it('measures inactivity from updated_at, not created_at', () => {
    const review = makeReview({
      status: 'pending',
      created_at: '2026-09-21T08:00:00Z',
      updated_at: '2026-09-21T10:55:00Z',
    })
    expect(isStaleInFlight(review, 75 * 60_000, now)).toBe(false)
  })
  it('ignores terminal statuses', () => {
    const review = makeReview({ status: 'failed', created_at: '2026-09-21T09:00:00Z' })
    expect(isStaleInFlight(review, 75 * 60_000, now)).toBe(false)
  })
})

describe('upsertModelOverride', () => {
  it('appends a new override', () => {
    const result = upsertModelOverride(undefined, {
      repositoryId: 1,
      repoFullName: 'a/b',
      modelSlug: 'kilo-auto/free',
    })
    expect(result).toEqual([{ repositoryId: 1, repoFullName: 'a/b', modelSlug: 'kilo-auto/free' }])
  })
  it('replaces an existing override for the same repo', () => {
    const existing = [{ repositoryId: 1, repoFullName: 'a/b', modelSlug: 'old/model' }]
    const result = upsertModelOverride(existing, {
      repositoryId: 1,
      repoFullName: 'a/b',
      modelSlug: 'kilo-auto/free',
    })
    expect(result).toEqual([{ repositoryId: 1, repoFullName: 'a/b', modelSlug: 'kilo-auto/free' }])
  })
  it('keeps overrides for other repos', () => {
    const existing = [{ repositoryId: 2, repoFullName: 'c/d', modelSlug: 'old/model' }]
    const result = upsertModelOverride(existing, {
      repositoryId: 1,
      repoFullName: 'a/b',
      modelSlug: 'kilo-auto/free',
    })
    expect(result).toHaveLength(2)
  })
  it('matches on repoFullName when repositoryId differs', () => {
    const existing = [{ repositoryId: 99, repoFullName: 'a/b', modelSlug: 'old/model' }]
    const result = upsertModelOverride(existing, {
      repositoryId: 1,
      repoFullName: 'a/b',
      modelSlug: 'kilo-auto/free',
    })
    expect(result).toEqual([{ repositoryId: 1, repoFullName: 'a/b', modelSlug: 'kilo-auto/free' }])
  })
})

describe('recoverCodeReviews', () => {
  it('retriggers a failed review and reports recovered when it completes', async () => {
    const deps = makeDeps()
    const results = await recoverCodeReviews('tok', {}, deps)
    expect(results).toHaveLength(1)
    expect(results[0]!.outcome).toBe('recovered')
    expect(deps.retrigger).toHaveBeenCalledWith('tok', 'cr1')
    expect(deps.saveConfig).not.toHaveBeenCalled()
  })

  it('skips reviews whose PR is closed', async () => {
    const deps = makeDeps({ prState: vi.fn(async () => 'closed' as const) })
    const results = await recoverCodeReviews('tok', {}, deps)
    expect(results[0]!.outcome).toBe('skipped-closed-pr')
    expect(deps.retrigger).not.toHaveBeenCalled()
  })

  it('skips when PR state cannot be verified', async () => {
    const deps = makeDeps({ prState: vi.fn(async () => 'unknown' as const) })
    const results = await recoverCodeReviews('tok', {}, deps)
    expect(results[0]!.outcome).toBe('skipped-unknown-pr')
    expect(deps.retrigger).not.toHaveBeenCalled()
  })

  it('retriggers an unverifiable PR when the check is disabled', async () => {
    const deps = makeDeps({ prState: vi.fn(async () => 'unknown' as const) })
    const results = await recoverCodeReviews('tok', { checkPr: false }, deps)
    expect(results[0]!.outcome).toBe('recovered')
    expect(deps.prState).not.toHaveBeenCalled()
  })

  it('skips reviews that are not in a failed state', async () => {
    const deps = makeDeps({
      listReviews: vi.fn(async () => [makeReview({ status: 'completed' })]),
    })
    const results = await recoverCodeReviews('tok', {}, deps)
    expect(results[0]!.outcome).toBe('skipped-status')
    expect(deps.retrigger).not.toHaveBeenCalled()
  })

  it('cancels then retriggers a stale pending review', async () => {
    const deps = makeDeps({
      listReviews: vi.fn(async () => [
        makeReview({
          status: 'pending',
          created_at: '2026-09-21T08:00:00Z',
          updated_at: '2026-09-21T08:00:00Z',
        }),
      ]),
    })
    const results = await recoverCodeReviews('tok', {}, deps)
    expect(deps.cancel).toHaveBeenCalledWith('tok', 'cr1')
    expect(deps.retrigger).toHaveBeenCalledWith('tok', 'cr1')
    expect(results[0]!.outcome).toBe('recovered')
  })

  it('switches model via per-repo override and retries when the review fails again', async () => {
    let calls = 0
    const deps = makeDeps({
      getReview: vi.fn(async (): Promise<CodeReviewDetail> => {
        calls++
        return {
          review: makeReview({ status: calls === 1 ? 'failed' : 'completed' }),
          attempts: [],
        }
      }),
    })
    const results = await recoverCodeReviews(
      'tok',
      { models: ['kilo-auto/free', 'minimax/minimax-m3:free'] },
      deps,
    )
    expect(results[0]!.outcome).toBe('recovered')
    expect(results[0]!.model).toBe('kilo-auto/free')
    expect(results[0]!.modelScope).toBe('repo')
    expect(deps.saveConfig).toHaveBeenCalledTimes(1)
    const saved = (deps.saveConfig as ReturnType<typeof vi.fn>).mock.calls[0]![2] as {
      repositoryModelOverrides?: { repositoryId: number; modelSlug: string }[]
    }
    expect(saved.repositoryModelOverrides).toEqual([
      { repositoryId: 12345, repoFullName: 'user/repo', modelSlug: 'kilo-auto/free' },
    ])
    expect(deps.retrigger).toHaveBeenCalledTimes(2)
  })

  it('falls back to global modelSlug when the repo id cannot be resolved', async () => {
    const deps = makeDeps({
      resolveRepoId: vi.fn(async () => undefined),
      getReview: vi.fn(
        async (): Promise<CodeReviewDetail> => ({
          review: makeReview({ status: 'completed' }),
          attempts: [],
        }),
      ),
    })
    // force a failure first so a model switch happens
    let calls = 0
    deps.getReview = vi.fn(async (): Promise<CodeReviewDetail> => {
      calls++
      return { review: makeReview({ status: calls === 1 ? 'failed' : 'completed' }), attempts: [] }
    })
    const results = await recoverCodeReviews('tok', { models: ['kilo-auto/free'] }, deps)
    const saved = (deps.saveConfig as ReturnType<typeof vi.fn>).mock.calls[0]![2] as {
      modelSlug?: string
    }
    expect(saved.modelSlug).toBe('kilo-auto/free')
    expect(results[0]!.modelScope).toBe('global')
  })

  it('reports exhausted after the model chain runs out', async () => {
    const deps = makeDeps({
      getReview: vi.fn(
        async (): Promise<CodeReviewDetail> => ({
          review: makeReview({ status: 'failed' }),
          attempts: [],
        }),
      ),
    })
    const results = await recoverCodeReviews('tok', { models: ['m1', 'm2'] }, deps)
    expect(results[0]!.outcome).toBe('exhausted')
    expect(deps.retrigger).toHaveBeenCalledTimes(3) // initial + 2 model retries
  })

  it('does not wait when wait is disabled', async () => {
    const deps = makeDeps()
    const results = await recoverCodeReviews('tok', { wait: false }, deps)
    expect(results[0]!.outcome).toBe('retriggered')
    expect(deps.getReview).not.toHaveBeenCalled()
  })

  it('reports dry-run without mutating anything', async () => {
    const deps = makeDeps()
    const results = await recoverCodeReviews('tok', { dryRun: true }, deps)
    expect(results[0]!.outcome).toBe('dry-run')
    expect(deps.retrigger).not.toHaveBeenCalled()
    expect(deps.saveConfig).not.toHaveBeenCalled()
  })

  it('records per-review errors and continues with the next review', async () => {
    const deps = makeDeps({
      listReviews: vi.fn(async () => [makeReview(), makeReview({ id: 'cr2' })]),
      retrigger: vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined),
    })
    const results = await recoverCodeReviews('tok', {}, deps)
    expect(results[0]!.outcome).toBe('error')
    expect(results[0]!.error).toContain('boom')
    expect(results[1]!.outcome).toBe('recovered')
  })

  it('uses the org id from the review row for config changes', async () => {
    let calls = 0
    const deps = makeDeps({
      listReviews: vi.fn(async () => [makeReview({ owned_by_organization_id: 'org-9' })]),
      getReview: vi.fn(async (): Promise<CodeReviewDetail> => {
        calls++
        return {
          review: makeReview({ status: calls === 1 ? 'failed' : 'completed' }),
          attempts: [],
        }
      }),
    })
    await recoverCodeReviews('tok', { models: ['kilo-auto/free'] }, deps)
    expect(deps.getConfig).toHaveBeenCalledWith('tok', 'org-9', 'github')
    expect((deps.saveConfig as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toBe('org-9')
  })
})
