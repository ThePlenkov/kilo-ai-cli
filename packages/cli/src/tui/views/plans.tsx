import React from 'react'
import { Box, Text } from 'ink'

import { fetchCodingPlanSubscriptions, fetchCodingPlanUsage } from '../../api/trpc.ts'
import type { CodingPlanSubscription } from '../../api/types.ts'
import { useQuery } from '../hooks.ts'
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
  return (
    <QueryListScreen<CodingPlanSubscription>
      focused={focused}
      fetch={() => fetchCodingPlanSubscriptions(ctx.token, ctx.organizationId)}
      columns={[
        { label: 'ID', width: 14, value: (s) => s.id },
        { label: 'Plan', width: 22, value: (s) => s.planName },
        { label: 'Provider', width: 14, value: (s) => s.providerName },
        { label: 'Status', width: 10, value: (s) => s.status, color: (s) => STATUS_COLORS[s.status] },
        { label: 'BYOK', width: 5, value: (s) => (s.hasInstalledByokKey ? 'yes' : 'no') },
        { label: 'Cancel@EOP', width: 10, value: (s) => (s.cancelAtPeriodEnd ? 'yes' : 'no') },
      ]}
      onSelect={(s) => ctx.navigate('plan-usage', { id: s.id })}
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
                const filled = Math.round((w.remainingPercent / 100) * 20)
                return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)} ${w.remainingPercent.toFixed(0)}%`
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
