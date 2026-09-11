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
import { getToken } from './helpers.ts'

function parseFilters(args: { from?: string; to?: string }): UsageAnalyticsFilters {
  const filters: UsageAnalyticsFilters = {}
  if (args.from) filters.startDate = args.from
  if (args.to) filters.endDate = args.to
  return filters
}

export const analyticsSummaryCommand = defineCommand({
  meta: { name: 'summary', description: 'Show usage analytics summary' },
  args: {
    from: { type: 'string', description: 'Start date (ISO)' },
    to: { type: 'string', description: 'End date (ISO)' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const filters = { ...parseFilters(args), organizationId }
    const summary = await getUsageSummary(token, filters)
    console.log(`Total credits: $${summary.totalCreditsUsd.toFixed(2)}`)
    console.log(`Total requests: ${summary.totalRequests}`)
    console.log(`Total tokens: ${summary.totalTokens}`)
    console.log(`Average latency: ${summary.averageLatencyMs.toFixed(0)}ms`)
  },
})

export const analyticsTimeseriesCommand = defineCommand({
  meta: { name: 'timeseries', description: 'Show usage analytics timeseries' },
  args: {
    from: { type: 'string', description: 'Start date (ISO)' },
    to: { type: 'string', description: 'End date (ISO)' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const filters = { ...parseFilters(args), organizationId }
    const points = await getUsageTimeseries(token, filters)
    if (points.length === 0) {
      console.log('No timeseries data found.')
      return
    }
    console.table(points.map((p) => ({
      Timestamp: p.timestamp,
      Credits: `$${p.creditsUsd.toFixed(2)}`,
      Requests: p.requests,
      Tokens: p.tokens,
    })))
  },
})

export const analyticsBreakdownCommand = defineCommand({
  meta: { name: 'breakdown', description: 'Show usage analytics breakdown' },
  args: {
    from: { type: 'string', description: 'Start date (ISO)' },
    to: { type: 'string', description: 'End date (ISO)' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const filters = { ...parseFilters(args), organizationId }
    const entries = await getUsageBreakdown(token, filters)
    if (entries.length === 0) {
      console.log('No breakdown data found.')
      return
    }
    console.table(entries.map((e) => ({
      Label: e.label,
      Value: e.value,
      Percentage: `${e.percentage.toFixed(1)}%`,
    })))
  },
})

export const analyticsTableCommand = defineCommand({
  meta: { name: 'table', description: 'Show usage analytics as a table' },
  args: {
    from: { type: 'string', description: 'Start date (ISO)' },
    to: { type: 'string', description: 'End date (ISO)' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const filters = { ...parseFilters(args), organizationId }
    const rows = await getUsageTable(token, filters)
    if (rows.length === 0) {
      console.log('No usage data found.')
      return
    }
    console.table(rows.map((r) => ({
      Date: r.date,
      Model: r.model,
      Provider: r.provider,
      Credits: `$${r.creditsUsd.toFixed(2)}`,
      Requests: r.requests,
      Tokens: r.tokens,
    })))
  },
})
