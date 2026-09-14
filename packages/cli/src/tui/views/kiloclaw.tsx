import React, { useRef, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'

import {
  getBillingHistory,
  getChangelog,
  getFileTree,
  getLatestVersion,
  getPersonalBillingSummary,
  getReferralRewardSummary,
  getServiceDegraded,
  listAgents,
  listAllInstances,
  listPersonalSubscriptions,
  readFile,
} from '../../api/kiloclaw.ts'
import type { KiloclawFileTreeNode } from '../../api/types.ts'
import { useQuery } from '../hooks.ts'
import { QueryListScreen, QueryRecordScreen, RecordView, TextScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

const STATUS_COLORS: Record<string, string> = {
  running: 'green',
  active: 'green',
  stopped: 'gray',
  error: 'red',
  failed: 'red',
}

/** KiloClaw → Instances. */
export function KiloclawInstancesScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen
      focused={focused}
      fetch={() => listAllInstances(ctx.token)}
      columns={[
        { label: 'ID', width: 14, value: (i: { id: string }) => i.id },
        { label: 'Name', width: 24, value: (i: { name: string }) => i.name },
        {
          label: 'Status',
          width: 12,
          value: (i: { status: string }) => i.status,
          color: (i: { status: string }) => STATUS_COLORS[i.status],
        },
        { label: 'Plan', width: 16, value: (i: { planName?: string }) => i.planName ?? '-' },
        { label: 'Image', width: 14, value: (i: { imageTag?: string }) => i.imageTag ?? '-' },
      ]}
      onBack={ctx.goBack}
      emptyText="No KiloClaw instances."
    />
  )
}

/** KiloClaw → Agents. */
export function KiloclawAgentsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen
      focused={focused}
      fetch={() => listAgents(ctx.token)}
      columns={[
        { label: 'ID', width: 14, value: (a: { id: string }) => a.id },
        { label: 'Name', width: 30, value: (a: { name: string }) => a.name },
        {
          label: 'Status',
          width: 12,
          value: (a: { status: string }) => a.status,
          color: (a: { status: string }) => STATUS_COLORS[a.status],
        },
        { label: 'Type', width: 14, value: (a: { type?: string }) => a.type ?? '-' },
      ]}
      onBack={ctx.goBack}
      emptyText="No agents."
    />
  )
}

/** KiloClaw → Subscription / billing summary. */
export function KiloclawBillingScreen({ ctx, focused }: ScreenProps) {
  const { data, error, loading, reload } = useQuery(async () => {
    const [billing, referral] = await Promise.all([
      getPersonalBillingSummary(ctx.token),
      getReferralRewardSummary(ctx.token).catch(() => null),
    ])
    return { ...billing, referralTotal: referral?.totalRewards, referralPending: referral?.pendingRewards }
  }, [ctx.token])

  useInput(
    (input, key) => {
      if (key.escape) ctx.goBack()
      if (input === 'r') reload()
    },
    { isActive: focused },
  )

  if (loading && !data) return <Text color="yellow">Loading billing…</Text>
  if (error) return <Text color="red">Error: {error}</Text>
  if (!data) return null
  return (
    <Box flexDirection="column">
      <RecordView
        data={{
          access: data.hasAccess ? 'yes' : `no${data.accessReason ? ` (${data.accessReason})` : ''}`,
          creditBalance:
            data.creditBalanceMicrodollars != null
              ? `$${(data.creditBalanceMicrodollars / 1e6).toFixed(2)}`
              : '-',
          currentSubscription: data.hasCurrentPersonalSubscription == null ? 'unknown' : data.hasCurrentPersonalSubscription ? 'yes' : 'no',
          trialEligible: data.trialEligible == null ? 'unknown' : data.trialEligible ? 'yes' : 'no',
          kiloPass: data.hasActiveKiloPass == null ? 'unknown' : data.hasActiveKiloPass ? 'active' : 'none',
          referralRewards: data.referralTotal,
          referralPending: data.referralPending,
        }}
      />
      <Box marginTop={1}>
        <Text dimColor>r=refresh Esc=back</Text>
      </Box>
    </Box>
  )
}

/** KiloClaw → Billing history for a chosen instance (route param `id`, or the first subscription). */
export function KiloclawHistoryScreen({ ctx, focused }: ScreenProps) {
  const { stdout } = useStdout()
  const paramId = ctx.route.params.id
  const [truncated, setTruncated] = useState(false)
  const seq = useRef(0)
  return (
    <QueryListScreen<Record<string, unknown>>
      focused={focused}
      fetch={async () => {
        const mine = ++seq.current
        const { subscriptions } = await listPersonalSubscriptions(ctx.token)
        const instanceId = paramId ?? subscriptions[0]?.instanceId
        if (!instanceId) throw new Error('No KiloClaw subscription — billing history needs an instance ID.')
        const entries: Record<string, unknown>[] = []
        let cursor: string | undefined
        let more = false
        // Follow cursor pagination until hasMore=false (bounded to 20 pages).
        for (let i = 0; i < 20; i++) {
          // eslint-disable-next-line no-await-in-loop -- cursor pagination is sequential
          const page = await getBillingHistory(ctx.token, instanceId, undefined, cursor)
          entries.push(...page.entries)
          more = page.hasMore && !!page.cursor
          if (!more) break
          cursor = page.cursor ?? undefined
        }
        if (mine === seq.current) setTruncated(more)
        return entries
      }}
      banner={() => (
        <Box flexDirection="column">
          <Text dimColor>instance: {paramId ?? 'first subscription'}</Text>
          {truncated ? <Text color="yellow">⚠ history continues past the 20-page cap — older entries not shown</Text> : null}
        </Box>
      )}
      columns={[
        {
          label: 'Entry',
          width: Math.max(30, (stdout?.columns ?? 80) - 38),
          value: (e) =>
            Object.entries(e)
              .map(([k, v]) => `${k}=${String(v)}`)
              .join(' '),
        },
      ]}
      onBack={ctx.goBack}
      emptyText="No billing history."
    />
  )
}

/** KiloClaw → Subscriptions. */
export function KiloclawSubscriptionsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen
      focused={focused}
      fetch={async () => (await listPersonalSubscriptions(ctx.token)).subscriptions}
      columns={[
        { label: 'Instance ID', width: 14, value: (s: { instanceId: string }) => s.instanceId },
        { label: 'Name', width: 22, value: (s: { instanceName?: string }) => s.instanceName ?? '-' },
        { label: 'Plan', width: 12, value: (s: { plan: string }) => s.plan },
        {
          label: 'Status',
          width: 12,
          value: (s: { status: string }) => s.status,
          color: (s: { status: string }) => STATUS_COLORS[s.status],
        },
        { label: 'Cancel@EOP', width: 10, value: (s: { cancelAtPeriodEnd: boolean }) => (s.cancelAtPeriodEnd ? 'yes' : 'no') },
      ]}
      onSelect={(s: { instanceId: string }) => ctx.navigate('kiloclaw-history', { id: s.instanceId })}
      onBack={ctx.goBack}
      emptyText="No KiloClaw subscriptions."
    />
  )
}

/** KiloClaw → What's New (changelog as scrollable text). */
export function KiloclawChangelogScreen({ ctx, focused }: ScreenProps) {
  return (
    <TextScreen
      focused={focused}
      fetch={async () =>
        (await getChangelog(ctx.token))
          .map((e) => `${e.date} [${e.category}]${e.deployHint ? ` (${e.deployHint})` : ''}\n  ${e.description}`)
          .join('\n\n')
      }
      onBack={ctx.goBack}
    />
  )
}

/** KiloClaw → Version + service health. */
export function KiloclawVersionScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async () => {
        const [version, degraded] = await Promise.all([
          getLatestVersion(ctx.token),
          getServiceDegraded(ctx.token).catch(() => null),
        ])
        return { ...version, serviceDegraded: degraded }
      }}
      onBack={ctx.goBack}
    />
  )
}

/** KiloClaw → Settings files: directory browser. Enter=open dir/file. */
export function KiloclawFilesScreen({ ctx, focused }: ScreenProps) {
  const path = ctx.route.params.path
  return (
    <QueryListScreen<KiloclawFileTreeNode>
      focused={focused}
      fetch={() => getFileTree(ctx.token, path)}
      columns={[
        {
          label: 'Name',
          width: 50,
          value: (n) => (n.type === 'directory' ? `${n.name}/` : n.name),
          color: (n) => (n.type === 'directory' ? 'cyan' : undefined),
        },
        { label: 'Type', width: 10, value: (n) => n.type },
      ]}
      banner={() => <Text dimColor>path: {path ?? '/'}</Text>}
      onSelect={(n) =>
        n.type === 'directory'
          ? ctx.navigate('kiloclaw-files', { path: n.path })
          : ctx.navigate('kiloclaw-file', { path: n.path })
      }
      onBack={ctx.goBack}
      emptyText="Empty directory."
    />
  )
}

/** KiloClaw → file content viewer. */
export function KiloclawFileScreen({ ctx, focused }: ScreenProps) {
  const path = ctx.route.params.path ?? ''
  return (
    <TextScreen
      focused={focused}
      fetch={async () => (await readFile(ctx.token, path)).content}
      onBack={ctx.goBack}
    />
  )
}
