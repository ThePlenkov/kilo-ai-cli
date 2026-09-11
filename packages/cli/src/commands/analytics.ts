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
import type { UsageAnalyticsFilters } from '../api/types.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

function parseFilters(args: { from?: string; to?: string; granularity?: string }): UsageAnalyticsFilters {
  // API requires ISO datetime format (e.g. 2024-01-01T00:00:00Z), not just date
  const now = new Date()
  const defaultEnd = now.toISOString()
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const toIso = (s: string): string => {
    // If just a date (YYYY-MM-DD), convert to ISO datetime
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00Z').toISOString()
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) {
      console.error(`Invalid date: ${s}`)
      process.exit(1)
    }
    return d.toISOString()
  }
  const filters: UsageAnalyticsFilters = {
    startDate: args.from ? toIso(args.from) : defaultStart,
    endDate: args.to ? toIso(args.to) : defaultEnd,
    granularity: (args.granularity as 'hour' | 'day' | 'week' | 'month') ?? 'day',
  }
  return filters
}

export const analyticsSummaryCommand = defineCommand({
  meta: { name: 'summary', description: 'Show usage analytics summary' },
  args: {
    from: { type: 'string', description: 'Start date (ISO, default: 30 days ago)' },
    to: { type: 'string', description: 'End date (ISO, default: today)' },
    granularity: { type: 'string', description: 'Granularity (hour/day/week/month, default: day)' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const filters = { ...parseFilters(args), organizationId }
    const summary = await getUsageSummary(token, filters) as { totalCreditsUsd?: number; totalRequests?: number; totalTokens?: number; averageLatencyMs?: number }
    console.log(`Total credits: $${(summary.totalCreditsUsd ?? 0).toFixed(2)}`)
    console.log(`Total requests: ${summary.totalRequests ?? 0}`)
    console.log(`Total tokens: ${summary.totalTokens ?? 0}`)
    console.log(`Average latency: ${(summary.averageLatencyMs ?? 0).toFixed(0)}ms`)
  },
})

export const analyticsTimeseriesCommand = defineCommand({
  meta: { name: 'timeseries', description: 'Show usage analytics timeseries' },
  args: {
    from: { type: 'string', description: 'Start date (ISO, default: 30 days ago)' },
    to: { type: 'string', description: 'End date (ISO, default: today)' },
    granularity: { type: 'string', description: 'Granularity (hour/day/week/month, default: day)' },
    metric: { type: 'string', description: 'Metric (cost/requests/tokens/..., default: cost)' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const filters = { ...parseFilters(args), organizationId, metric: (args.metric ?? 'cost') as UsageAnalyticsFilters['metric'] }
    const points = await getUsageTimeseries(token, filters) as Array<Record<string, unknown>>
    if (points.length === 0) {
      console.log('No timeseries data found.')
      return
    }
    printTable(
      points.map((p) => ({
        datetime: String(p.datetime ?? p.timestamp ?? '-'),
        value: p.value ?? 0,
      })),
      [
        { key: 'datetime', label: 'Datetime', width: 24 },
        { key: 'value', label: 'Value', width: 12, align: 'right' },
      ],
    )
  },
})

export const analyticsBreakdownCommand = defineCommand({
  meta: { name: 'breakdown', description: 'Show usage analytics breakdown' },
  args: {
    from: { type: 'string', description: 'Start date (ISO, default: 30 days ago)' },
    to: { type: 'string', description: 'End date (ISO, default: today)' },
    granularity: { type: 'string', description: 'Granularity (hour/day/week/month, default: day)' },
    dimension: { type: 'string', description: 'Dimension (feature/model/mode/user/provider/project/organization, default: model)' },
    metric: { type: 'string', description: 'Metric (cost/requests/tokens, default: cost)' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const filters = { ...parseFilters(args), organizationId, dimension: (args.dimension ?? 'model') as UsageAnalyticsFilters['dimension'], metric: (args.metric ?? 'cost') as UsageAnalyticsFilters['metric'] }
    const result = await getUsageBreakdown(token, filters) as { breakdown?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>
    const entries = Array.isArray(result) ? result : (result.breakdown ?? [])
    if (entries.length === 0) {
      console.log('No breakdown data found.')
      return
    }
    printTable(
      entries.map((e) => ({
        label: String(e.label ?? e.key ?? '-'),
        value: e.value ?? 0,
        percentage: `${Number(e.percentage ?? 0).toFixed(1)}%`,
      })),
      [
        { key: 'label', label: 'Label', width: 30 },
        { key: 'value', label: 'Value', width: 12, align: 'right' },
        { key: 'percentage', label: 'Percentage', width: 12, align: 'right' },
      ],
    )
  },
})

export const analyticsTableCommand = defineCommand({
  meta: { name: 'table', description: 'Show usage analytics as a table' },
  args: {
    from: { type: 'string', description: 'Start date (ISO, default: 30 days ago)' },
    to: { type: 'string', description: 'End date (ISO, default: today)' },
    granularity: { type: 'string', description: 'Granularity (hour/day/week/month, default: day)' },
    groupBy: { type: 'string', description: 'Group by (feature/model/mode/user/provider/project, default: model)' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const groupBy = args.groupBy ? args.groupBy.split(',').map(s => s.trim()) : ['model']
    const filters = { ...parseFilters(args), organizationId, groupBy }
    const rows = await getUsageTable(token, filters) as Array<Record<string, unknown>>
    if (rows.length === 0) {
      console.log('No usage data found.')
      return
    }
    const cols = Object.keys(rows[0] ?? {}).slice(0, 6)
    printTable(
      rows.map((r) => {
        const row: Record<string, string | number> = {}
        for (const c of cols) {
          const v = r[c]
          if (typeof v === 'number') row[c] = v
          else if (v !== null && typeof v === 'object') row[c] = JSON.stringify(v)
          else row[c] = String(v ?? '-')
        }
        return row
      }),
      cols.map((c) => ({ key: c, label: c, width: 18 })),
    )
  },
})
