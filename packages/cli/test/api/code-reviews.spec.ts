import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getReviewConfig,
  listCodeReviews,
  listGitLabRepositories,
  toggleReviewAgent,
} from '../../src/api/code-reviews.ts'

function mockResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(JSON.stringify({ result: { data: { json: data } } })),
    json: () => Promise.resolve({ result: { data: { json: data } } }),
  } as Response
}

function mockMutationResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(JSON.stringify([{ result: { data: { json: data } } }])),
    json: () => Promise.resolve([{ result: { data: { json: data } } }]),
  } as Response
}

describe('code-reviews API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => vi.restoreAllMocks())

  it('listCodeReviews calls codeReviews.listForOrganization with orgId', async () => {
    fetchMock.mockResolvedValue(mockResponse([{ id: 'cr1', title: 'review', status: 'open', platform: 'github', createdAt: '2024-01-01', updatedAt: '2024-01-02' }]))
    const result = await listCodeReviews('tok', 'org1')
    expect(result).toHaveLength(1)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('codeReviews.listForOrganization')
    expect(decodeURIComponent(url.split('input=')[1]!)).toContain('org1')
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
