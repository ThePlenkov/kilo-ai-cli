/**
 * Usage Analytics CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  getUsageBreakdown,
  getUsageSummary,
  getUsageTable,
  getUsageTimeseries,
} from '../api/usage-analytics.ts'
import type {
  UsageAnalyticsFilters,
  UsageDimension,
  UsageGranularity,
  UsageMetric,
} from '../api/types.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

const GRANULARITIES: UsageGranularity[] = ['hour', 'day', 'week', 'month']
const DIMENSIONS: UsageDimension[] = ['feature', 'model', 'mode', 'user', 'provider', 'project', 'organization']

/** Coerce a date ("2026-08-14") or datetime into a full ISO datetime. */
function toIsoDatetime(s: string): string {
  return s.includes('T') ? s : `${s}T00:00:00Z`
}

interface FilterArgs {
  from?: string
  to?: string
  granularity?: string
}

function parseFilters(args: FilterArgs, organizationId?: string): UsageAnalyticsFilters {
  const now = new Date()
  const from = args.from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const to = args.to ?? now.toISOString()
  const granularity = (args.granularity ?? 'day') as UsageGranularity
  if (!GRANULARITIES.includes(granularity)) {
    throw new Error(`Invalid --granularity "${args.granularity}" (expected: ${GRANULARITIES.join('|')})`)
  }
  return {
    startDate: toIsoDatetime(from),
    endDate: toIsoDatetime(to),
    granularity,
    organizationId,
  }
}

const filterArgs = {
  from: { type: 'string', description: 'Start date (ISO date or datetime, default: 30 days ago)' },
  to: { type: 'string', description: 'End date (default: now)' },
  granularity: { type: 'string', description: 'hour|day|week|month (default: day)' },
} as const

export const analyticsSummaryCommand = defineCommand({
  meta: { name: 'summary', description: 'Show usage analytics summary' },
  args: { ...filterArgs },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const s = await getUsageSummary(token, parseFilters(args, organizationId))
    console.log(`Cost: $${(s.costMicrodollars / 1e6).toFixed(2)}`)
    console.log(`Requests: ${s.requestCount} (${s.errorCount} errors, ${(s.errorRate * 100).toFixed(1)}%)`)
    console.log(`Tokens: ${s.totalTokens} (in ${s.inputTokens} / out ${s.outputTokens} / cache-hit ${s.cacheHitTokens})`)
    console.log(`Avg latency: ${(s.avgLatencyMs / 1000).toFixed(1)}s`)
    console.log(`Free requests: ${s.freeRequestCount}  |  BYOK: ${s.byokRequestCount}`)
  },
})

export const analyticsTimeseriesCommand = defineCommand({
  meta: { name: 'timeseries', description: 'Show usage analytics timeseries' },
  args: {
    ...filterArgs,
    metric: { type: 'string', description: 'Metric (default: cost)', default: 'cost' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const metric = args.metric as UsageMetric
    const points = await getUsageTimeseries(token, { ...parseFilters(args, organizationId), metric })
    if (points.length === 0) {
      console.log('No timeseries data found.')
      return
    }
    const isCost = metric === 'cost' || metric === 'costPerRequest'
    printTable(
      points.map((p) => ({
        datetime: p.datetime,
        value: isCost ? `$${(p.value / 1e6).toFixed(4)}` : String(p.value),
      })),
      [
        { key: 'datetime', label: 'Datetime', width: 24 },
        { key: 'value', label: metric, width: 14, align: 'right' },
      ],
    )
  },
})

export const analyticsBreakdownCommand = defineCommand({
  meta: { name: 'breakdown', description: 'Show usage analytics breakdown' },
  args: {
    ...filterArgs,
    dimension: { type: 'string', description: `Dimension (${DIMENSIONS.join('|')})`, default: 'model' },
    metric: { type: 'string', description: 'cost|requests|tokens', default: 'cost' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const entries = await getUsageBreakdown(token, {
      ...parseFilters(args, organizationId),
      dimension: args.dimension as UsageDimension,
      metric: args.metric as 'cost' | 'requests' | 'tokens',
    })
    if (entries.length === 0) {
      console.log('No breakdown data found.')
      return
    }
    printTable(
      entries.map((e) => ({
        label: e.label,
        value: args.metric === 'cost' ? `$${(e.value / 1e6).toFixed(4)}` : String(e.value),
        percentage: `${e.percentage.toFixed(1)}%`,
      })),
      [
        { key: 'label', label: 'Label', width: 40 },
        { key: 'value', label: 'Value', width: 12, align: 'right' },
        { key: 'percentage', label: 'Share', width: 10, align: 'right' },
      ],
    )
  },
})

export const analyticsTableCommand = defineCommand({
  meta: { name: 'table', description: 'Show usage analytics as a table' },
  args: {
    ...filterArgs,
    'group-by': { type: 'string', description: 'Comma-separated dimensions (default: model)', default: 'model' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const groupBy = args['group-by'].split(',').map((s) => s.trim()) as UsageDimension[]
    const rows = await getUsageTable(token, { ...parseFilters(args, organizationId), groupBy })
    if (rows.length === 0) {
      console.log('No usage data found.')
      return
    }
    const dimCols = groupBy.map((d) => ({ key: `dim_${d}`, label: d, width: 28 }))
    const mapped = rows.map((r) => {
      const row: Record<string, string | number> = {
        datetime: r.datetime,
        credits: `$${(r.costMicrodollars / 1e6).toFixed(4)}`,
        requests: r.requestCount,
        tokens: r.inputTokens + r.outputTokens,
        errors: r.errorCount,
      }
      for (const d of groupBy) row[`dim_${d}`] = r.dimensions[d] ?? '-'
      return row
    })
    printTable(mapped,
      [
        { key: 'datetime', label: 'Date', width: 12 },
        ...dimCols,
        { key: 'credits', label: 'Cost', width: 10, align: 'right' },
        { key: 'requests', label: 'Requests', width: 10, align: 'right' },
        { key: 'tokens', label: 'Tokens', width: 12, align: 'right' },
        { key: 'errors', label: 'Errors', width: 8, align: 'right' },
      ],
    )
  },
})
