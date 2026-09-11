import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getUsageBreakdown,
  getUsageSummary,
  getUsageTable,
  getUsageTimeseries,
} from '../../src/api/usage-analytics.ts'

function mockResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(JSON.stringify({ result: { data: { json: data } } })),
    json: () => Promise.resolve({ result: { data: { json: data } } }),
  } as Response
}

describe('usage-analytics API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => vi.restoreAllMocks())

  it('getUsageSummary calls usageAnalytics.getSummary', async () => {
    fetchMock.mockResolvedValue(mockResponse({ totalCreditsUsd: 100, totalRequests: 500, totalTokens: 100000, averageLatencyMs: 250 }))
    const result = await getUsageSummary('tok', { startDate: '2024-01-01' })
    expect(result.totalCreditsUsd).toBe(100)
    expect(fetchMock.mock.calls[0]![0]).toContain('usageAnalytics.getSummary')
  })

  it('getUsageTimeseries calls usageAnalytics.getTimeseries', async () => {
    fetchMock.mockResolvedValue(mockResponse([{ timestamp: '2024-01-01', creditsUsd: 10, requests: 50, tokens: 5000 }]))
    const result = await getUsageTimeseries('tok')
    expect(result).toHaveLength(1)
    expect(fetchMock.mock.calls[0]![0]).toContain('usageAnalytics.getTimeseries')
  })

  it('getUsageBreakdown calls usageAnalytics.getBreakdown', async () => {
    fetchMock.mockResolvedValue(mockResponse([{ label: 'gpt-4', value: 80, percentage: 80 }]))
    const result = await getUsageBreakdown('tok')
    expect(result[0]!.label).toBe('gpt-4')
    expect(fetchMock.mock.calls[0]![0]).toContain('usageAnalytics.getBreakdown')
  })

  it('getUsageTable calls usageAnalytics.getTable', async () => {
    fetchMock.mockResolvedValue(mockResponse([{ date: '2024-01-01', model: 'gpt-4', provider: 'openai', creditsUsd: 10, requests: 50, tokens: 5000 }]))
    const result = await getUsageTable('tok')
    expect(result[0]!.model).toBe('gpt-4')
    expect(fetchMock.mock.calls[0]![0]).toContain('usageAnalytics.getTable')
  })

  it('passes filters as input', async () => {
    fetchMock.mockResolvedValue(mockResponse({ totalCreditsUsd: 0, totalRequests: 0, totalTokens: 0, averageLatencyMs: 0 }))
    await getUsageSummary('tok', { startDate: '2024-01-01', endDate: '2024-01-31', organizationId: 'o1' })
    const url = fetchMock.mock.calls[0]![0] as string
    const input = JSON.parse(decodeURIComponent(url.split('input=')[1]!))
    expect(input.startDate).toBe('2024-01-01')
    expect(input.endDate).toBe('2024-01-31')
    expect(input.organizationId).toBe('o1')
  })
})
