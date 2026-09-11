/**
 * Usage Analytics tRPC procedures.
 * Source: Kilo-Org/cloud apps/web/src/routers/usage-analytics-router.ts
 */

import { z } from 'zod'
import { trpcQuery } from './client.ts'
import type {
  UsageAnalyticsFilters,
} from './types.ts'

// --- Schemas ---

const SummarySchema = z.object({
  totalCreditsUsd: z.number().optional(),
  totalRequests: z.number().optional(),
  totalTokens: z.number().optional(),
  averageLatencyMs: z.number().optional(),
}).passthrough()

// --- Queries ---

/** usageAnalytics.getSummary */
export async function getUsageSummary(token: string, filters?: UsageAnalyticsFilters): Promise<unknown> {
  return trpcQuery('usageAnalytics.getSummary', token, SummarySchema, filters)
}

/** usageAnalytics.getTimeseries */
export async function getUsageTimeseries(token: string, filters?: UsageAnalyticsFilters): Promise<unknown[]> {
  const result = await trpcQuery('usageAnalytics.getTimeseries', token, z.object({ timeseries: z.array(z.unknown()).optional() }).passthrough(), filters)
  return result.timeseries ?? []
}

/** usageAnalytics.getBreakdown */
export async function getUsageBreakdown(token: string, filters?: UsageAnalyticsFilters): Promise<unknown> {
  return trpcQuery('usageAnalytics.getBreakdown', token, z.object({ breakdown: z.array(z.unknown()).optional() }).passthrough(), filters)
}

/** usageAnalytics.getTable */
export async function getUsageTable(token: string, filters?: UsageAnalyticsFilters): Promise<unknown[]> {
  const result = await trpcQuery('usageAnalytics.getTable', token, z.object({ rows: z.array(z.unknown()).optional() }).passthrough(), filters)
  return result.rows ?? []
}
