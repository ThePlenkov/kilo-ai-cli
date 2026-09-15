import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getUsageBreakdown,
  getUsageSummary,
  getUsageTable,
  getUsageTimeseries,
} from '../../src/api/usage-analytics.ts'
import { mockResponse, setupFetchMock } from './helpers.ts'

const FILTERS = {
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-31T00:00:00Z',
  granularity: 'day' as const,
}

const SUMMARY = {
  costMicrodollars: 10346942,
  requestCount: 500,
  inputTokens: 80000,
  outputTokens: 20000,
  cacheWriteTokens: 0,
  cacheHitTokens: 0,
  errorCount: 2,
  cancelledCount: 0,
  freeRequestCount: 10,
  byokRequestCount: 0,
  totalLatencyMs: 125000,
  totalGenerationTimeMs: 125000,
  latencyCount: 500,
  generationTimeCount: 500,
  totalTokens: 100000,
  distinctUsers: 1,
  errorRate: 0.004,
  avgLatencyMs: 250,
  avgGenerationTimeMs: 250,
  costPerRequest: 20693,
  tokensPerRequest: 200,
  cacheHitRatio: 0,
  outputInputRatio: 0.25,
  effectiveGranularity: 'day',
}

describe('usage-analytics API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('getUsageSummary calls usageAnalytics.getSummary', async () => {
    fetchMock.mockResolvedValue(mockResponse(SUMMARY))
    const result = await getUsageSummary('tok', FILTERS)
    expect(result.costMicrodollars).toBe(10346942)
    expect(fetchMock.mock.calls[0]![0]).toContain('usageAnalytics.getSummary')
  })

  it('getUsageTimeseries unwraps { timeseries }', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ timeseries: [{ datetime: '2024-01-01T00:00:00Z', value: 5000 }] }),
    )
    const result = await getUsageTimeseries('tok', { ...FILTERS, metric: 'cost' })
    expect(result).toHaveLength(1)
    expect(result[0]!.value).toBe(5000)
    expect(fetchMock.mock.calls[0]![0]).toContain('usageAnalytics.getTimeseries')
  })

  it('getUsageBreakdown unwraps { breakdown }', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ breakdown: [{ key: 'gpt-4', label: 'gpt-4', value: 80, percentage: 80 }] }),
    )
    const result = await getUsageBreakdown('tok', {
      ...FILTERS,
      dimension: 'model',
      metric: 'cost',
    })
    expect(result[0]!.label).toBe('gpt-4')
    expect(fetchMock.mock.calls[0]![0]).toContain('usageAnalytics.getBreakdown')
  })

  it('getUsageTable unwraps { rows }', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        rows: [
          {
            datetime: '2024-01-01T00:00:00Z',
            dimensions: { model: 'gpt-4' },
            costMicrodollars: 10000000,
            requestCount: 50,
            inputTokens: 4000,
            outputTokens: 1000,
            cacheWriteTokens: 0,
            cacheHitTokens: 0,
            errorCount: 0,
          },
        ],
      }),
    )
    const result = await getUsageTable('tok', { ...FILTERS, groupBy: ['model'] })
    expect(result[0]!.dimensions.model).toBe('gpt-4')
    expect(fetchMock.mock.calls[0]![0]).toContain('usageAnalytics.getTable')
  })

  it('passes filters as input', async () => {
    fetchMock.mockResolvedValue(mockResponse(SUMMARY))
    await getUsageSummary('tok', { ...FILTERS, organizationId: 'o1' })
    const url = fetchMock.mock.calls[0]![0] as string
    const input = JSON.parse(decodeURIComponent(url.split('input=')[1]!))
    expect(input.startDate).toBe('2024-01-01T00:00:00Z')
    expect(input.granularity).toBe('day')
    expect(input.organizationId).toBe('o1')
  })
})
