import { Box, Text, useInput } from 'ink'
import React, { useState } from 'react'
import type {
  UsageAnalyticsBreakdownEntry,
  UsageAnalyticsFilters,
  UsageAnalyticsTableRow,
} from '../../api/types.ts'
import {
  getUsageBreakdown,
  getUsageSummary,
  getUsageTable,
  getUsageTimeseries,
} from '../../api/usage-analytics.ts'
import { QueryListScreen, QueryRecordScreen } from '../components.tsx'
import { useQuery, useTermSize } from '../hooks.ts'
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

/** Usage → Timeseries: ASCII bar chart of cost per day (scrollable). */
export function AnalyticsTimeseriesScreen({ ctx, focused }: ScreenProps) {
  const { columns: termColumns, rows: termRows } = useTermSize()
  const width = Math.max(10, termColumns - 50)
  // Reserve: app chrome (6) + title + both scroll markers + footer (5).
  const maxVisible = Math.max(3, termRows - 11)
  const { data, error, loading } = useQuery(
    () => getUsageTimeseries(ctx.token, { ...defaultFilters(ctx), metric: 'cost' }),
    [ctx.token],
  )
  const [offset, setOffset] = useState(0)
  const rows = data ?? []
  useInput(
    (_i, key) => {
      if (key.escape) ctx.goBack()
      if (key.upArrow) setOffset((o) => Math.max(0, o - 1))
      if (key.downArrow) setOffset((o) => Math.min(Math.max(0, rows.length - maxVisible), o + 1))
      if (key.pageDown)
        setOffset((o) => Math.min(Math.max(0, rows.length - maxVisible), o + maxVisible))
      if (key.pageUp) setOffset((o) => Math.max(0, o - maxVisible))
    },
    { isActive: focused },
  )

  if (loading && !data) return <Text color="yellow">Loading timeseries…</Text>
  if (error) return <Text color="red">Error: {error}</Text>
  if (rows.length === 0) return <Text>No timeseries data.</Text>

  const max = Math.max(...rows.map((p) => p.value), 1)
  // Clamp after data shrinks — a refresh may return fewer rows than `offset`.
  const off = Math.min(offset, Math.max(0, rows.length - maxVisible))
  const visible = rows.slice(off, off + maxVisible)
  return (
    <Box flexDirection="column">
      <Text bold dimColor>
        Cost per day (last 30 days)
      </Text>
      {off > 0 ? <Text dimColor> ↑ {off} more</Text> : null}
      {visible.map((p, i) => {
        const len = Math.max(1, Math.round((p.value / max) * width))
        return (
          <Box key={off + i}>
            <Box width={12}>
              <Text dimColor>{p.datetime.slice(0, 10)}</Text>
            </Box>
            <Text color="cyan">{'█'.repeat(len)}</Text>
            <Text> ${(p.value / 1e6).toFixed(4)}</Text>
          </Box>
        )
      })}
      {off + maxVisible < rows.length ? (
        <Text dimColor> ↓ {rows.length - off - maxVisible} more</Text>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          [{off + 1}-{Math.min(off + maxVisible, rows.length)}/{rows.length}] ↑↓ scroll Esc=back
        </Text>
      </Box>
    </Box>
  )
}

/** Usage → Breakdown (cost by model). */
export function AnalyticsBreakdownScreen({ ctx, focused }: ScreenProps) {
  const { columns: termColumns } = useTermSize()
  const avail = Math.max(40, termColumns - 34)
  const barWidth = avail < 60 ? 10 : 20
  const modelWidth = Math.max(10, avail - barWidth - 30)
  return (
    <QueryListScreen<UsageAnalyticsBreakdownEntry>
      focused={focused}
      fetch={() =>
        getUsageBreakdown(ctx.token, { ...defaultFilters(ctx), dimension: 'model', metric: 'cost' })
      }
      columns={[
        { label: 'Model', width: modelWidth, value: (e) => e.label },
        {
          label: 'Cost',
          width: 12,
          align: 'right',
          value: (e) => `$${(e.value / 1e6).toFixed(4)}`,
        },
        {
          label: 'Share',
          width: barWidth + 10,
          value: (e) => {
            const pct = Math.min(100, Math.max(0, e.percentage))
            const filled = Math.round((pct / 100) * barWidth)
            return `${'█'.repeat(filled)}${'░'.repeat(barWidth - filled)} ${pct.toFixed(1)}%`
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
  const { columns: termColumns } = useTermSize()
  const avail = Math.max(40, termColumns - 34)
  // On narrow panes drop the trailing Tokens/Err columns so the table fits.
  const narrow = avail < 66
  const modelWidth = Math.max(10, avail - (narrow ? 36 : 54))
  const columns: {
    label: string
    width: number
    align?: 'left' | 'right'
    value: (r: UsageAnalyticsTableRow) => string
  }[] = [
    { label: 'Date', width: 10, value: (r) => r.datetime.slice(0, 10) },
    { label: 'Model', width: modelWidth, value: (r) => r.dimensions.model ?? '-' },
    {
      label: 'Cost',
      width: 10,
      align: 'right',
      value: (r) => `$${(r.costMicrodollars / 1e6).toFixed(4)}`,
    },
    { label: 'Req', width: 6, align: 'right', value: (r) => String(r.requestCount) },
  ]
  if (!narrow) {
    columns.push(
      {
        label: 'Tokens',
        width: 12,
        align: 'right',
        value: (r) => String(r.inputTokens + r.outputTokens),
      },
      { label: 'Err', width: 5, align: 'right', value: (r) => String(r.errorCount) },
    )
  }
  return (
    <QueryListScreen<UsageAnalyticsTableRow>
      focused={focused}
      fetch={() => getUsageTable(ctx.token, { ...defaultFilters(ctx), groupBy: ['model'] })}
      columns={columns}
      onBack={ctx.goBack}
      emptyText="No usage data."
    />
  )
}
