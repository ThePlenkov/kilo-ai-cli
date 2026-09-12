import React from 'react'
import { Box, Text, useInput, useStdout } from 'ink'

import {
  getUsageBreakdown,
  getUsageSummary,
  getUsageTable,
  getUsageTimeseries,
} from '../../api/usage-analytics.ts'
import type {
  UsageAnalyticsBreakdownEntry,
  UsageAnalyticsFilters,
  UsageAnalyticsTableRow,
} from '../../api/types.ts'
import { useQuery } from '../hooks.ts'
import { QueryListScreen, QueryRecordScreen } from '../components.tsx'
import type { ScreenCtx, ScreenProps } from '../types.ts'

/** Default filter: last 30 days, daily granularity (server requires all fields). */
function defaultFilters(ctx: ScreenCtx): UsageAnalyticsFilters {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return {
    startDate: from.toISOString(),
    endDate: to.toISOString(),
    granularity: 'day',
    organizationId: ctx.organizationId,
  }
}

/** Usage → Summary. */
export function AnalyticsSummaryScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async () => {
        const s = await getUsageSummary(ctx.token, defaultFilters(ctx))
        return {
          cost: `$${(s.costMicrodollars / 1e6).toFixed(2)}`,
          requests: `${s.requestCount} (${s.errorCount} errors, ${(s.errorRate * 100).toFixed(1)}%)`,
          totalTokens: s.totalTokens,
          inputTokens: s.inputTokens,
          outputTokens: s.outputTokens,
          cacheHitTokens: s.cacheHitTokens,
          avgLatency: `${(s.avgLatencyMs / 1000).toFixed(1)}s`,
          freeRequests: s.freeRequestCount,
          byokRequests: s.byokRequestCount,
          period: 'last 30 days',
        }
      }}
      onBack={ctx.goBack}
    />
  )
}

/** Usage → Timeseries: ASCII bar chart of cost per day. */
export function AnalyticsTimeseriesScreen({ ctx, focused }: ScreenProps) {
  const { stdout } = useStdout()
  const width = Math.max(10, (stdout?.columns ?? 80) - 50)
  const { data, error, loading } = useQuery(
    () => getUsageTimeseries(ctx.token, { ...defaultFilters(ctx), metric: 'cost' }),
    [ctx.token],
  )
  useInput((_i, key) => {
    if (key.escape) ctx.goBack()
  }, { isActive: focused })

  if (loading && !data) return <Text color="yellow">Loading timeseries…</Text>
  if (error) return <Text color="red">Error: {error}</Text>
  if (!data || data.length === 0) return <Text>No timeseries data.</Text>

  const max = Math.max(...data.map((p) => p.value), 1)
  return (
    <Box flexDirection="column">
      <Text bold dimColor>
        Cost per day (last 30 days)
      </Text>
      {data.map((p, i) => {
        const len = Math.max(1, Math.round((p.value / max) * width))
        return (
          <Box key={i}>
            <Box width={12}>
              <Text dimColor>{p.datetime.slice(0, 10)}</Text>
            </Box>
            <Text color="cyan">{'█'.repeat(len)}</Text>
            <Text> ${(p.value / 1e6).toFixed(4)}</Text>
          </Box>
        )
      })}
      <Box marginTop={1}>
        <Text dimColor>Esc=back</Text>
      </Box>
    </Box>
  )
}

/** Usage → Breakdown (cost by model). */
export function AnalyticsBreakdownScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<UsageAnalyticsBreakdownEntry>
      focused={focused}
      fetch={() =>
        getUsageBreakdown(ctx.token, { ...defaultFilters(ctx), dimension: 'model', metric: 'cost' })
      }
      columns={[
        { label: 'Model', width: 36, value: (e) => e.label },
        { label: 'Cost', width: 12, align: 'right', value: (e) => `$${(e.value / 1e6).toFixed(4)}` },
        {
          label: 'Share',
          width: 30,
          value: (e) => {
            const filled = Math.round((e.percentage / 100) * 20)
            return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)} ${e.percentage.toFixed(1)}%`
          },
        },
      ]}
      onBack={ctx.goBack}
      emptyText="No breakdown data."
    />
  )
}

/** Usage → Table (grouped by model). */
export function AnalyticsTableScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<UsageAnalyticsTableRow>
      focused={focused}
      fetch={() => getUsageTable(ctx.token, { ...defaultFilters(ctx), groupBy: ['model'] })}
      columns={[
        { label: 'Date', width: 12, value: (r) => r.datetime.slice(0, 10) },
        { label: 'Model', width: 32, value: (r) => r.dimensions.model ?? '-' },
        { label: 'Cost', width: 10, align: 'right', value: (r) => `$${(r.costMicrodollars / 1e6).toFixed(4)}` },
        { label: 'Req', width: 8, align: 'right', value: (r) => String(r.requestCount) },
        { label: 'Tokens', width: 12, align: 'right', value: (r) => String(r.inputTokens + r.outputTokens) },
        { label: 'Err', width: 6, align: 'right', value: (r) => String(r.errorCount) },
      ]}
      onBack={ctx.goBack}
      emptyText="No usage data."
    />
  )
}
