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
const METRICS: UsageMetric[] = [
  'cost',
  'requests',
  'tokens',
  'inputTokens',
  'outputTokens',
  'errorRate',
  'avgLatencyMs',
  'avgGenerationTimeMs',
  'costPerRequest',
  'tokensPerRequest',
  'cacheHitRatio',
  'outputInputRatio',
]

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Reject values whose calendar date is not real (e.g. 2026-02-30[…]). */
function assertValidDateOnly(s: string, flag: string): void {
  // Validate the calendar part of both date-only and ISO datetime values —
  // `new Date()` normalizes impossible dates instead of failing.
  const datePart = s.split('T')[0]!
  if (!DATE_ONLY.test(datePart)) return
  const d = new Date(`${datePart}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== datePart) {
    throw new Error(`Invalid ${flag} value "${s}" — not a real calendar date`)
  }
}

/** Parse a date ("2026-08-14") or ISO datetime; date-only values map to start of day. */
function parseDateStart(s: string, flag: string): string {
  assertValidDateOnly(s, flag)
  const d = new Date(s.includes('T') ? s : `${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${flag} value "${s}" — expected ISO date or datetime`)
  return d.toISOString()
}

/** Date-only --to values include the whole day (end-of-day). */
function parseDateEnd(s: string, flag: string): string {
  assertValidDateOnly(s, flag)
  const d = new Date(s.includes('T') ? s : `${s}T23:59:59.999Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${flag} value "${s}" — expected ISO date or datetime`)
  return d.toISOString()
}

interface FilterArgs {
  from?: string
  to?: string
  granularity?: string
}

function parseFilters(args: FilterArgs, organizationId?: string): UsageAnalyticsFilters {
  const now = new Date()
  const granularity = (args.granularity ?? 'day') as UsageGranularity
  if (!GRANULARITIES.includes(granularity)) {
    throw new Error(`Invalid --granularity "${args.granularity}" (expected: ${GRANULARITIES.join('|')})`)
  }
  return {
    startDate: args.from ? parseDateStart(args.from, '--from') : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: args.to ? parseDateEnd(args.to, '--to') : now.toISOString(),
    granularity,
    organizationId,
  }
}

function parseMetric(s: string | undefined): UsageMetric {
  const m = (s ?? 'cost') as UsageMetric
  if (!METRICS.includes(m)) throw new Error(`Invalid --metric "${s}" (expected: ${METRICS.join('|')})`)
  return m
}

const BREAKDOWN_METRICS = ['cost', 'requests', 'tokens'] as const

function parseBreakdownMetric(s: string | undefined): 'cost' | 'requests' | 'tokens' {
  const m = (s ?? 'cost') as 'cost' | 'requests' | 'tokens'
  if (!BREAKDOWN_METRICS.includes(m)) {
    throw new Error(`Invalid --metric "${s}" (expected: ${BREAKDOWN_METRICS.join('|')})`)
  }
  return m
}

function parseDimension(s: string | undefined): UsageDimension {
  const d = (s ?? 'model') as UsageDimension
  if (!DIMENSIONS.includes(d)) throw new Error(`Invalid --dimension "${s}" (expected: ${DIMENSIONS.join('|')})`)
  return d
}

function parseGroupBy(s: string): UsageDimension[] {
  return s.split(',').map((raw) => {
    const d = raw.trim()
    if (!DIMENSIONS.includes(d as UsageDimension)) {
      throw new Error(`Invalid --group-by entry "${d}" (expected: ${DIMENSIONS.join('|')})`)
    }
    return d as UsageDimension
  })
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
    const metric = parseMetric(args.metric)
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
      dimension: parseDimension(args.dimension),
      metric: parseBreakdownMetric(args.metric),
    })
    if (entries.length === 0) {
      console.log('No breakdown data found.')
      return
    }
    printTable(
      entries.map((e) => ({
        label: e.label,
        value: (args.metric ?? 'cost') === 'cost' ? `$${(e.value / 1e6).toFixed(4)}` : String(e.value),
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
    const groupBy = parseGroupBy(args['group-by'])
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
        { key: 'datetime', label: 'Datetime', width: 24 },
        ...dimCols,
        { key: 'credits', label: 'Cost', width: 10, align: 'right' },
        { key: 'requests', label: 'Requests', width: 10, align: 'right' },
        { key: 'tokens', label: 'Tokens', width: 12, align: 'right' },
        { key: 'errors', label: 'Errors', width: 8, align: 'right' },
      ],
    )
  },
})
