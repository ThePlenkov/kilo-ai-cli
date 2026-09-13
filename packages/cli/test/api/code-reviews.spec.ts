import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getCodeReview,
  getReviewConfig,
  listCodeReviews,
  listCodeReviewsForUser,
  listGitLabRepositories,
  toggleReviewAgent,
} from '../../src/api/code-reviews.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('code-reviews API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('listCodeReviewsForUser unwraps { reviews } from codeReviews.listForUser', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        reviews: [
          {
            id: 'cr1',
            pr_title: 'fix: something',
            status: 'completed',
            platform: 'github',
            repo_full_name: 'user/repo',
            pr_number: 25,
            created_at: '2026-09-12',
            updated_at: '2026-09-12',
          },
        ],
      }),
    )
    const result = await listCodeReviewsForUser('tok')
    expect(result).toHaveLength(1)
    expect(result[0]!.repo_full_name).toBe('user/repo')
    expect(fetchMock.mock.calls[0]![0]).toContain('codeReviews.listForUser')
  })

  it('getCodeReview calls codeReviews.get with reviewId', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        review: { id: 'cr1', status: 'completed', created_at: '2026-09-12', updated_at: '2026-09-12' },
        attempts: [
          {
            id: 'a1',
            code_review_id: 'cr1',
            attempt_number: 1,
            status: 'completed',
            created_at: '2026-09-12',
            updated_at: '2026-09-12',
          },
        ],
        tokenUsage: { input: 0, output: 0, cached: 0 },
      }),
    )
    const result = await getCodeReview('tok', 'cr1')
    expect(result.review.id).toBe('cr1')
    expect(result.attempts).toHaveLength(1)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(JSON.parse(decodeURIComponent(url.split('input=')[1]!))).toEqual({ reviewId: 'cr1' })
  })

  it('listCodeReviews accepts { reviews } envelope', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ reviews: [{ id: 'cr1', status: 'open', created_at: '2024-01-01', updated_at: '2024-01-02' }] }),
    )
    const result = await listCodeReviews('tok', 'org1')
    expect(result).toHaveLength(1)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('codeReviews.listForOrganization')
    expect(decodeURIComponent(url.split('input=')[1]!)).toContain('org1')
  })

  it('listCodeReviews accepts a bare array', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ id: 'cr2', status: 'open', created_at: '2024-01-01', updated_at: '2024-01-02' }]),
    )
    const result = await listCodeReviews('tok', 'org1')
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('cr2')
  })

  it('listGitLabRepositories calls organizations.codeReviews.listGitLabRepositories', async () => {
    fetchMock.mockResolvedValue(mockResponse([{ id: 'r1', name: 'repo', url: 'https://gitlab.com/repo' }]))
    const result = await listGitLabRepositories('tok', 'org1', true)
    expect(result).toHaveLength(1)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('organizations.codeReviews.listGitLabRepositories')
  })

  it('getReviewConfig passes orgId and platform', async () => {
    fetchMock.mockResolvedValue(mockResponse({ isEnabled: true, platform: 'github' }))
    const result = await getReviewConfig('tok', 'org1', 'github')
    expect(result.isEnabled).toBe(true)
    expect(result.platform).toBe('github')
    const url = fetchMock.mock.calls[0]![0] as string
    expect(decodeURIComponent(url.split('input=')[1]!)).toContain('github')
  })

  it('toggleReviewAgent posts with orgId, platform, isEnabled', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse(null))
    await toggleReviewAgent('tok', 'org1', 'github', true)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('organizations.codeReviews.toggleReviewAgent')
    const init = fetchMock.mock.calls[0]![1] as { body: string }
    expect(JSON.parse(init.body)).toEqual({ '0': { organizationId: 'org1', platform: 'github', isEnabled: true } })
  })
})
