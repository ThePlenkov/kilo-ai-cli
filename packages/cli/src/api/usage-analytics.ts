/**
 * Usage Analytics tRPC procedures.
 * Source: Kilo-Org/cloud apps/web/src/routers/usage-analytics-router.ts
 */

import { z } from 'zod'
import { trpcQuery } from './client.ts'
import type {
  UsageAnalyticsBreakdownEntry,
  UsageAnalyticsFilters,
  UsageAnalyticsSummary,
  UsageAnalyticsTableRow,
  UsageAnalyticsTimeseriesPoint,
} from './types.ts'

// --- Schemas ---

const SummarySchema: z.ZodType<UsageAnalyticsSummary> = z.object({
  totalCreditsUsd: z.number(),
  totalRequests: z.number(),
  totalTokens: z.number(),
  averageLatencyMs: z.number(),
})

const TimeseriesPointSchema: z.ZodType<UsageAnalyticsTimeseriesPoint> = z.object({
  timestamp: z.string(),
  creditsUsd: z.number(),
  requests: z.number(),
  tokens: z.number(),
})

const BreakdownEntrySchema: z.ZodType<UsageAnalyticsBreakdownEntry> = z.object({
  label: z.string(),
  value: z.number(),
  percentage: z.number(),
})

const TableRowSchema: z.ZodType<UsageAnalyticsTableRow> = z.object({
  date: z.string(),
  model: z.string(),
  provider: z.string(),
  creditsUsd: z.number(),
  requests: z.number(),
  tokens: z.number(),
})

// --- Queries ---

/** usageAnalytics.getSummary */
export async function getUsageSummary(token: string, filters?: UsageAnalyticsFilters): Promise<UsageAnalyticsSummary> {
  return trpcQuery('usageAnalytics.getSummary', token, SummarySchema, filters)
}

/** usageAnalytics.getTimeseries */
export async function getUsageTimeseries(token: string, filters?: UsageAnalyticsFilters): Promise<UsageAnalyticsTimeseriesPoint[]> {
  return trpcQuery('usageAnalytics.getTimeseries', token, z.array(TimeseriesPointSchema), filters)
}

/** usageAnalytics.getBreakdown */
export async function getUsageBreakdown(token: string, filters?: UsageAnalyticsFilters): Promise<UsageAnalyticsBreakdownEntry[]> {
  return trpcQuery('usageAnalytics.getBreakdown', token, z.array(BreakdownEntrySchema), filters)
}

/** usageAnalytics.getTable */
export async function getUsageTable(token: string, filters?: UsageAnalyticsFilters): Promise<UsageAnalyticsTableRow[]> {
  return trpcQuery('usageAnalytics.getTable', token, z.array(TableRowSchema), filters)
}
