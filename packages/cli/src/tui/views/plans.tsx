import React from 'react'
import { Box, Text } from 'ink'

import { fetchCodingPlanSubscriptions, fetchCodingPlanUsage } from '../../api/trpc.ts'
import type { CodingPlanSubscription } from '../../api/types.ts'
import { useQuery, useTermSize } from '../hooks.ts'
import { DataTable, QueryListScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'
import { useInput } from 'ink'

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  past_due: 'yellow',
  canceled: 'gray',
}

/** Usage → Coding Plans: subscriptions list. */
export function PlansScreen({ ctx, focused }: ScreenProps) {
  const { columns: termColumns } = useTermSize()
  const avail = Math.max(40, termColumns - 34)
  // Below ~56 cols even the shrunken full column set overflows — drop extras.
  const narrow = avail < 56
  const columns = [
    { label: 'ID', width: 14, value: (s: CodingPlanSubscription) => s.id },
    { label: 'Plan', width: narrow ? avail - 30 : 22, value: (s: CodingPlanSubscription) => s.planName },
    { label: 'Provider', width: 14, value: (s: CodingPlanSubscription) => s.providerName },
    { label: 'Status', width: 10, value: (s: CodingPlanSubscription) => s.status, color: (s: CodingPlanSubscription) => STATUS_COLORS[s.status] },
    { label: 'BYOK', width: 5, value: (s: CodingPlanSubscription) => (s.hasInstalledByokKey ? 'yes' : 'no') },
    { label: 'Cancel@EOP', width: 10, value: (s: CodingPlanSubscription) => (s.cancelAtPeriodEnd ? 'yes' : 'no') },
    { label: 'Usage', width: 6, value: (s: CodingPlanSubscription) => (s.canQueryUsage ? 'yes' : '—') },
  ]
  const visible = narrow ? columns.filter((c) => ['ID', 'Plan', 'Status', 'Usage'].includes(c.label)) : columns
  return (
    <QueryListScreen<CodingPlanSubscription>
      focused={focused}
      fetch={() => fetchCodingPlanSubscriptions(ctx.token, ctx.organizationId)}
      columns={visible}
      // Usage queries are rejected by the API when canQueryUsage is false.
      onSelect={(s) => {
        if (s.canQueryUsage) ctx.navigate('plan-usage', { id: s.id })
      }}
      help="Enter=usage (subscriptions with usage access)"
      onBack={ctx.goBack}
      emptyText="No coding plan subscriptions."
    />
  )
}

/** Usage → Coding Plans → usage detail: quota windows table. */
export function PlanUsageScreen({ ctx, focused }: ScreenProps) {
  const id = ctx.route.params.id
  const { data, error, loading } = useQuery(
    () => fetchCodingPlanUsage(ctx.token, id, ctx.organizationId),
    [ctx.token, id],
  )
  useInput((_i, key) => {
    if (key.escape) ctx.goBack()
  }, { isActive: focused })

  if (loading && !data) return <Text color="yellow">Loading usage…</Text>
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Esc=back</Text>
      </Box>
    )
  }
  if (!data) return null

  return (
    <Box flexDirection="column">
      <Text bold>
        {data.subscription.planName} <Text dimColor>({data.subscription.providerName})</Text>
      </Text>
      <Text dimColor>fetched {data.fetchedAt}</Text>
      <Box marginTop={1}>
        <DataTable
          rows={data.subscription.windows}
          columns={[
            { label: 'Window', width: 14, value: (w) => `${w.period.value} ${w.period.unit}` },
            {
              label: 'Remaining',
              width: 30,
              value: (w) => {
                const pct = Math.min(100, Math.max(0, w.remainingPercent))
                const filled = Math.round((pct / 100) * 20)
                return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)} ${pct.toFixed(0)}%`
              },
              color: (w) => (w.remainingPercent < 20 ? 'red' : w.remainingPercent < 50 ? 'yellow' : 'green'),
            },
            { label: 'Resets', width: 24, value: (w) => w.resetsAt },
          ]}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Esc=back</Text>
      </Box>
    </Box>
  )
}
