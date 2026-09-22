/**
 * `reviews recover` — re-run failed/stuck code reviews on open PRs,
 * switching the model (per-repo override when possible) after each failure.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { defineCommand } from 'citty'

import {
  cancelCodeReview,
  getCodeReview,
  getOrgReviewAgentConfig,
  getPersonalReviewConfig,
  listCodeReviews,
  listCodeReviewsForUser,
  retriggerCodeReview,
  saveOrgReviewConfig,
  savePersonalReviewConfig,
  toSaveReviewConfigInput,
} from '../api/code-reviews.ts'
import type {
  CodeReview,
  RepositoryModelOverride,
  ReviewAgentConfig,
  SaveReviewConfigInput,
} from '../api/types.ts'
import { printTable, sanitize } from './format.ts'
import { getToken } from './helpers.ts'

const execFileAsync = promisify(execFile)

const RETRIGGERABLE_STATUSES = new Set(['failed', 'cancelled', 'interrupted'])
const STALE_CANDIDATE_STATUSES = new Set(['pending', 'queued'])
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'interrupted'])

export const DEFAULT_FALLBACK_MODELS = [
  'kilo-auto/free',
  'orcarouter/z-ai/glm-5.3-flash-free',
]

export type PrState = 'open' | 'closed' | 'unknown'

export interface RecoveryDeps {
  listReviews: (token: string, orgId: string | undefined) => Promise<CodeReview[]>
  getReview: (token: string, id: string) => Promise<{ review: CodeReview }>
  retrigger: (token: string, id: string) => Promise<void>
  cancel: (token: string, id: string) => Promise<void>
  getConfig: (
    token: string,
    orgId: string | undefined,
    platform: string,
  ) => Promise<ReviewAgentConfig>
  saveConfig: (
    token: string,
    orgId: string | undefined,
    input: SaveReviewConfigInput,
  ) => Promise<void>
  prState: (review: CodeReview) => Promise<PrState>
  resolveRepoId: (review: CodeReview) => Promise<number | undefined>
  sleep: (ms: number) => Promise<void>
  now: () => number
}

export interface RecoverOptions {
  limit?: number
  platform?: string
  repo?: string
  orgId?: string
  models?: string[]
  wait?: boolean
  timeoutMs?: number
  pollMs?: number
  staleMinutes?: number
  checkPr?: boolean
  dryRun?: boolean
}

export type RecoveryOutcome =
  | 'recovered'
  | 'retriggered'
  | 'exhausted'
  | 'timeout'
  | 'skipped-closed-pr'
  | 'skipped-unknown-pr'
  | 'skipped-status'
  | 'dry-run'
  | 'error'

export interface RecoveryResult {
  reviewId: string
  repo: string
  pr?: number
  title?: string
  status: string
  outcome: RecoveryOutcome
  model?: string
  modelScope?: 'repo' | 'global'
  error?: string
}

export function isRetriggerableStatus(status: string): boolean {
  return RETRIGGERABLE_STATUSES.has(status)
}

export function isStaleInFlight(review: CodeReview, staleMs: number, now: number): boolean {
  if (!STALE_CANDIDATE_STATUSES.has(review.status)) return false
  const touched = Date.parse(review.updated_at ?? review.created_at)
  return Number.isNaN(touched) ? false : now - touched > staleMs
}

/** Replace or append a per-repo model override (first-match wins server-side, so dedupe). */
export function upsertModelOverride(
  overrides: RepositoryModelOverride[] | undefined,
  override: RepositoryModelOverride,
): RepositoryModelOverride[] {
  const kept = (overrides ?? []).filter(
    (o) =>
      o && o.repositoryId !== override.repositoryId && o.repoFullName !== override.repoFullName,
  )
  return [...kept, override]
}

async function runJson(bin: string, args: string[]): Promise<unknown> {
  const { stdout } = await execFileAsync(bin, args, { timeout: 20_000 })
  return JSON.parse(stdout)
}

/** Check whether the review's PR/MR is still open via gh/glab. */
export async function checkPrOpenState(review: CodeReview): Promise<PrState> {
  if (!review.repo_full_name || review.pr_number == null) return 'unknown'
  try {
    if (review.platform === 'gitlab') {
      const project = encodeURIComponent(review.repo_full_name)
      const mr = (await runJson('glab', [
        'api',
        `projects/${project}/merge_requests/${review.pr_number}`,
      ])) as { state?: string }
      return mr.state === 'opened' ? 'open' : 'closed'
    }
    const pr = (await runJson('gh', [
      'api',
      `repos/${review.repo_full_name}/pulls/${review.pr_number}`,
    ])) as { state?: string }
    return pr.state === 'open' ? 'open' : 'closed'
  } catch {
    return 'unknown'
  }
}

/** Numeric platform repository id for repositoryModelOverrides. */
export async function resolveRepositoryId(review: CodeReview): Promise<number | undefined> {
  const projectId = review.platform_project_id
  if (typeof projectId === 'number') return projectId
  if (typeof projectId === 'string' && /^\d+$/.test(projectId)) return Number(projectId)
  if (!review.repo_full_name) return undefined
  try {
    if (review.platform === 'gitlab') {
      const project = encodeURIComponent(review.repo_full_name)
      const data = (await runJson('glab', ['api', `projects/${project}`])) as { id?: number }
      return typeof data.id === 'number' ? data.id : undefined
    }
    const data = (await runJson('gh', ['api', `repos/${review.repo_full_name}`])) as {
      id?: number
    }
    return typeof data.id === 'number' ? data.id : undefined
  } catch {
    return undefined
  }
}

async function setModelForReview(
  token: string,
  review: CodeReview,
  modelSlug: string,
  orgId: string | undefined,
  deps: RecoveryDeps,
): Promise<'repo' | 'global'> {
  const platform = review.platform ?? 'github'
  const config = await deps.getConfig(token, orgId, platform)
  const repoId = await deps.resolveRepoId(review)
  let input: SaveReviewConfigInput
  let scope: 'repo' | 'global'
  if (repoId != null && review.repo_full_name) {
    input = toSaveReviewConfigInput(platform, config, {
      repositoryModelOverrides: upsertModelOverride(config.repositoryModelOverrides, {
        repositoryId: repoId,
        repoFullName: review.repo_full_name,
        modelSlug,
      }),
    })
    scope = 'repo'
  } else {
    input = toSaveReviewConfigInput(platform, config, { modelSlug })
    scope = 'global'
  }
  await deps.saveConfig(token, orgId, input)
  return scope
}

async function pollUntilTerminal(
  token: string,
  reviewId: string,
  deadline: number,
  pollMs: number,
  deps: RecoveryDeps,
): Promise<string> {
  while (deps.now() < deadline) {
    const { review } = await deps.getReview(token, reviewId)
    if (TERMINAL_STATUSES.has(review.status)) return review.status
    await deps.sleep(pollMs)
  }
  return 'timeout'
}

async function recoverOne(
  token: string,
  review: CodeReview,
  opts: Required<Pick<RecoverOptions, 'wait' | 'timeoutMs' | 'pollMs'>> & RecoverOptions,
  deps: RecoveryDeps,
): Promise<RecoveryResult> {
  const base = {
    reviewId: review.id,
    repo: review.repo_full_name ?? '-',
    pr: review.pr_number ?? undefined,
    title: review.pr_title ?? undefined,
    status: review.status,
  }
  if (opts.checkPr !== false) {
    const state = await deps.prState(review)
    if (state === 'closed') return { ...base, outcome: 'skipped-closed-pr' }
    if (state === 'unknown') return { ...base, outcome: 'skipped-unknown-pr' }
  }
  if (opts.dryRun) return { ...base, outcome: 'dry-run' }

  if (STALE_CANDIDATE_STATUSES.has(review.status)) {
    await deps.cancel(token, review.id)
  }
  await deps.retrigger(token, review.id)
  if (!opts.wait) return { ...base, outcome: 'retriggered' }

  const models = opts.models ?? DEFAULT_FALLBACK_MODELS
  let modelIdx = -1
  let lastModel: string | undefined
  let lastScope: 'repo' | 'global' | undefined
  for (;;) {
    const status = await pollUntilTerminal(
      token,
      review.id,
      deps.now() + opts.timeoutMs,
      opts.pollMs,
      deps,
    )
    if (status === 'completed') {
      return { ...base, outcome: 'recovered', model: lastModel, modelScope: lastScope }
    }
    if (status === 'timeout') {
      return { ...base, outcome: 'timeout', model: lastModel, modelScope: lastScope }
    }
    modelIdx++
    if (modelIdx >= models.length) {
      return { ...base, outcome: 'exhausted', model: lastModel, modelScope: lastScope }
    }
    const orgId = review.owned_by_organization_id ?? opts.orgId
    lastModel = models[modelIdx]
    lastScope = await setModelForReview(token, review, lastModel!, orgId, deps)
    await deps.retrigger(token, review.id)
  }
}

/** Recover the most recent failed/stuck reviews; switch models on repeat failures. */
export async function recoverCodeReviews(
  token: string,
  opts: RecoverOptions,
  deps: RecoveryDeps,
): Promise<RecoveryResult[]> {
  const reviews = await deps.listReviews(token, opts.orgId)
  const staleMs = (opts.staleMinutes ?? 75) * 60_000
  const now = deps.now()
  const results: RecoveryResult[] = []
  for (const review of reviews) {
    const stale = isStaleInFlight(review, staleMs, now)
    if (!isRetriggerableStatus(review.status) && !stale) {
      results.push({
        reviewId: review.id,
        repo: review.repo_full_name ?? '-',
        pr: review.pr_number ?? undefined,
        title: review.pr_title ?? undefined,
        status: review.status,
        outcome: 'skipped-status',
      })
      continue
    }
    try {
      results.push(
        await recoverOne(
          token,
          review,
          {
            ...opts,
            wait: opts.wait ?? true,
            timeoutMs: opts.timeoutMs ?? 600_000,
            pollMs: opts.pollMs ?? 15_000,
          },
          deps,
        ),
      )
    } catch (err) {
      results.push({
        reviewId: review.id,
        repo: review.repo_full_name ?? '-',
        pr: review.pr_number ?? undefined,
        title: review.pr_title ?? undefined,
        status: review.status,
        outcome: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}

function parsePositiveInt(value: string | undefined, flag: string, fallback: number): number {
  if (value === undefined) return fallback
  const trimmed = value.trim()
  const parsed = /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : Number.NaN
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${flag} must be a positive integer, got "${value}"`)
  }
  return parsed
}

export const reviewsRecoverCommand = defineCommand({
  meta: {
    name: 'recover',
    description:
      'Re-run failed/stuck code reviews on open PRs; switches model (per-repo override) on repeat failures',
  },
  args: {
    limit: { type: 'string', description: 'How many recent reviews to scan (default 10)' },
    platform: { type: 'string', description: 'Filter by platform (github/gitlab)' },
    repo: { type: 'string', description: 'Filter by repository full name (owner/name)' },
    org: { type: 'string', description: 'Organization ID (omit for personal reviews)' },
    models: {
      type: 'string',
      description: `Comma-separated fallback model chain (default: ${DEFAULT_FALLBACK_MODELS.join(',')})`,
    },
    wait: { type: 'boolean', description: 'Poll until each review finishes (default true)' },
    timeout: { type: 'string', description: 'Per-attempt wait timeout in seconds (default 600)' },
    'poll-interval': { type: 'string', description: 'Poll interval in seconds (default 15)' },
    'stale-minutes': {
      type: 'string',
      description: 'Treat pending/queued reviews older than this as stuck (default 75)',
    },
    'pr-check': {
      type: 'boolean',
      description: 'Verify the PR/MR is still open via gh/glab (default true)',
    },
    'dry-run': { type: 'boolean', description: 'List candidates without mutating anything' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const limit = parsePositiveInt(args.limit, 'limit', 10)
    const opts: RecoverOptions = {
      limit,
      platform: args.platform,
      repo: args.repo,
      orgId: args.org,
      models: args.models
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      wait: args.wait !== false,
      timeoutMs: parsePositiveInt(args.timeout, 'timeout', 600) * 1000,
      pollMs: parsePositiveInt(args['poll-interval'], 'poll-interval', 15) * 1000,
      staleMinutes: parsePositiveInt(args['stale-minutes'], 'stale-minutes', 75),
      checkPr: args['pr-check'] !== false,
      dryRun: args['dry-run'] === true,
    }
    const deps: RecoveryDeps = {
      listReviews: (t, orgId) =>
        orgId
          ? listCodeReviews(t, orgId, {
              limit: opts.limit,
              platform: opts.platform,
              repoFullName: opts.repo,
            })
          : listCodeReviewsForUser(t, {
              limit: opts.limit,
              platform: opts.platform,
              repoFullName: opts.repo,
            }),
      getReview: getCodeReview,
      retrigger: retriggerCodeReview,
      cancel: cancelCodeReview,
      getConfig: (t, orgId, platform) =>
        orgId ? getOrgReviewAgentConfig(t, orgId, platform) : getPersonalReviewConfig(t, platform),
      saveConfig: (t, orgId, input) =>
        orgId ? saveOrgReviewConfig(t, orgId, input) : savePersonalReviewConfig(t, input),
      prState: checkPrOpenState,
      resolveRepoId: resolveRepositoryId,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
    }
    const results = await recoverCodeReviews(token, opts, deps)
    printTable(
      results.map((r) => ({
        id: r.reviewId,
        repo: r.repo,
        pr: r.pr ?? '-',
        status: r.status,
        outcome: r.outcome,
        model: r.model ? `${r.model} (${r.modelScope ?? ''})` : '-',
        error: r.error ? sanitize(r.error) : '-',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'repo', label: 'Repo', width: 26 },
        { key: 'pr', label: 'PR', width: 6, align: 'right' },
        { key: 'status', label: 'Was', width: 12 },
        { key: 'outcome', label: 'Outcome', width: 18 },
        { key: 'model', label: 'Model', width: 32 },
        { key: 'error', label: 'Error', width: 30 },
      ],
    )
    const failed = results.filter((r) =>
      ['exhausted', 'error', 'timeout'].includes(r.outcome),
    ).length
    if (failed > 0) process.exitCode = 1
  },
})
