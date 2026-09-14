/**
 * Usage Analytics tRPC procedures.
 * Source: Kilo-Org/cloud apps/web/src/routers/usage-analytics-router.ts
 *
 * Verified against live api.kilo.ai responses (see scripts/probe.ts):
 * - all procedures require { startDate, endDate } as ISO datetimes + granularity
 * - getTimeseries additionally requires `metric`
 * - getBreakdown additionally requires `dimension` + `metric` (cost|requests|tokens)
 * - getTable additionally requires `groupBy` (array of dimensions)
 */

import { z } from 'zod'
import { trpcQuery } from './client.ts'
import type {
  UsageAnalyticsBreakdownEntry,
  UsageAnalyticsFilters,
  UsageAnalyticsSummary,
  UsageAnalyticsTableRow,
  UsageAnalyticsTimeseriesPoint,
  UsageDimension,
  UsageMetric,
} from './types.ts'

// --- Schemas (verified against live responses) ---

const SummarySchema: z.ZodType<UsageAnalyticsSummary> = z
  .object({
    costMicrodollars: z.number(),
    requestCount: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheWriteTokens: z.number(),
    cacheHitTokens: z.number(),
    errorCount: z.number(),
    cancelledCount: z.number(),
    freeRequestCount: z.number(),
    byokRequestCount: z.number(),
    totalLatencyMs: z.number(),
    totalGenerationTimeMs: z.number(),
    latencyCount: z.number(),
    generationTimeCount: z.number(),
    totalTokens: z.number(),
    distinctUsers: z.number(),
    errorRate: z.number(),
    avgLatencyMs: z.number(),
    avgGenerationTimeMs: z.number(),
    costPerRequest: z.number(),
    tokensPerRequest: z.number(),
    cacheHitRatio: z.number(),
    outputInputRatio: z.number(),
    effectiveGranularity: z.string().optional(),
  })
  .passthrough() as z.ZodType<UsageAnalyticsSummary>

const TimeseriesResultSchema = z.object({
  timeseries: z.array(z.object({ datetime: z.string(), value: z.number() })),
})

const BreakdownResultSchema = z.object({
  breakdown: z.array(
    z.object({ key: z.string(), label: z.string(), value: z.number(), percentage: z.number() }),
  ),
})

const TableResultSchema = z.object({
  rows: z.array(
    z
      .object({
        datetime: z.string(),
        dimensions: z.record(z.string(), z.string()),
        costMicrodollars: z.number(),
        requestCount: z.number(),
        inputTokens: z.number(),
        outputTokens: z.number(),
        cacheWriteTokens: z.number(),
        cacheHitTokens: z.number(),
        errorCount: z.number(),
      })
      .passthrough(),
  ),
})

// --- Queries ---

/** usageAnalytics.getSummary — aggregated usage totals for the period. */
export async function getUsageSummary(
  token: string,
  filters: UsageAnalyticsFilters,
): Promise<UsageAnalyticsSummary> {
  return trpcQuery('usageAnalytics.getSummary', token, SummarySchema, filters)
}

/** usageAnalytics.getTimeseries — per-bucket values for one metric. */
export async function getUsageTimeseries(
  token: string,
  filters: UsageAnalyticsFilters & { metric: UsageMetric },
): Promise<UsageAnalyticsTimeseriesPoint[]> {
  const r = await trpcQuery('usageAnalytics.getTimeseries', token, TimeseriesResultSchema, filters)
  return r.timeseries
}

/** usageAnalytics.getBreakdown — metric split by a dimension. */
export async function getUsageBreakdown(
  token: string,
  filters: UsageAnalyticsFilters & { dimension: UsageDimension; metric: 'cost' | 'requests' | 'tokens' },
): Promise<UsageAnalyticsBreakdownEntry[]> {
  const r = await trpcQuery('usageAnalytics.getBreakdown', token, BreakdownResultSchema, filters)
  return r.breakdown
}

/** usageAnalytics.getTable — rows grouped by the given dimensions. */
export async function getUsageTable(
  token: string,
  filters: UsageAnalyticsFilters & { groupBy: UsageDimension[] },
): Promise<UsageAnalyticsTableRow[]> {
  const r = await trpcQuery('usageAnalytics.getTable', token, TableResultSchema, filters)
  return r.rows
}
