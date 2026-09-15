import { Box, Text, useInput } from 'ink'
import SelectInput from 'ink-select-input'
import React from 'react'

import {
  getCreditTransactions,
  getOrganizationInvoices,
  getOrganizationSeats,
  getOrganizationUsageStats,
  getOrganizationWithMembers,
  getSecurityAgentPermissionStatus,
  listAvailableModels,
  listOrganizations,
} from '../../api/organizations.ts'
import type { Organization } from '../../api/types.ts'
import { QueryListScreen, QueryRecordScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Organizations → list. */
export function OrgsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<Organization>
      focused={focused}
      fetch={() => listOrganizations(ctx.token)}
      columns={[
        { label: 'ID', width: 38, value: (o) => o.id },
        { label: 'Name', width: 30, value: (o) => o.name },
        { label: 'Role', width: 12, value: (o) => o.role },
      ]}
      onSelect={(o) => ctx.navigate('org', { id: o.id, name: o.name })}
      onBack={ctx.goBack}
      emptyText="No organizations. Create one: kilo-ai-cli org create <name>"
    />
  )
}

const ORG_SECTIONS = [
  { label: 'Members', value: 'org-members' },
  { label: 'Usage stats', value: 'org-usage' },
  { label: 'Credit transactions', value: 'org-credits' },
  { label: 'Seats', value: 'org-seats' },
  { label: 'Invoices', value: 'org-invoices' },
  { label: 'Available models', value: 'org-models' },
  { label: 'Security agent permissions', value: 'org-security' },
] as const

/** Organizations → detail: section picker for one org. */
export function OrgDetailScreen({ ctx, focused }: ScreenProps) {
  const { id, name } = ctx.route.params
  return (
    <Box flexDirection="column">
      <Text bold>
        {name ?? 'Organization'} <Text dimColor>({id})</Text>
      </Text>
      <Box marginTop={1}>
        {focused ? (
          <SelectInput
            items={[...ORG_SECTIONS]}
            onSelect={(item) => ctx.navigate(item.value, { id, name: name ?? '' })}
          />
        ) : (
          ORG_SECTIONS.map((s) => (
            <Text key={s.value} dimColor>
              {' '}
              {s.label}
            </Text>
          ))
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓ choose section Enter=open Esc=back</Text>
      </Box>
      <EscBack focused={focused} onBack={ctx.goBack} />
    </Box>
  )
}

function EscBack({ focused, onBack }: { focused: boolean; onBack: () => void }) {
  // SelectInput consumes arrows+enter; we only need Esc here.
  useInput(
    (_i, key) => {
      if (key.escape) onBack()
    },
    { isActive: focused },
  )
  return null
}

function orgId(ctx: { route: { params: Record<string, string> } }): string {
  return ctx.route.params.id ?? ''
}

export function OrgMembersScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen
      focused={focused}
      fetch={async () => (await getOrganizationWithMembers(ctx.token, orgId(ctx))).members}
      columns={[
        { label: 'Email', width: 34, value: (m: { email: string }) => m.email },
        { label: 'Name', width: 24, value: (m: { name?: string }) => m.name ?? '-' },
        { label: 'Role', width: 12, value: (m: { role: string }) => m.role },
      ]}
      onBack={ctx.goBack}
      emptyText="No members."
    />
  )
}

export function OrgUsageScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async () => {
        const s = await getOrganizationUsageStats(ctx.token, orgId(ctx))
        return { ...s }
      }}
      onBack={ctx.goBack}
    />
  )
}

export function OrgCreditsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen
      focused={focused}
      fetch={() => getCreditTransactions(ctx.token, orgId(ctx))}
      columns={[
        { label: 'Date', width: 22, value: (t: { createdAt: string }) => t.createdAt },
        {
          label: 'Amount',
          width: 10,
          align: 'right',
          value: (t: { amount: number }) => String(t.amount),
        },
        { label: 'Type', width: 16, value: (t: { type: string }) => t.type },
        { label: 'Description', width: 40, value: (t: { description: string }) => t.description },
      ]}
      onBack={ctx.goBack}
      emptyText="No credit transactions."
    />
  )
}

export function OrgSeatsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async () => ({ ...(await getOrganizationSeats(ctx.token, orgId(ctx))) })}
      onBack={ctx.goBack}
    />
  )
}

export function OrgInvoicesScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen
      focused={focused}
      fetch={() => getOrganizationInvoices(ctx.token, orgId(ctx))}
      columns={[
        { label: 'Date', width: 14, value: (i: { date: string }) => i.date },
        {
          label: 'Amount',
          width: 10,
          align: 'right',
          value: (i: { amount: number }) => `$${i.amount.toFixed(2)}`,
        },
        {
          label: 'Status',
          width: 10,
          value: (i: { status: string }) => i.status,
          color: (i: { status: string }) => (i.status === 'paid' ? 'green' : 'yellow'),
        },
        { label: 'URL', width: 40, value: (i: { url?: string }) => i.url ?? '-' },
      ]}
      onBack={ctx.goBack}
      emptyText="No invoices."
    />
  )
}

export function OrgModelsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen
      focused={focused}
      fetch={() => listAvailableModels(ctx.token, orgId(ctx))}
      columns={[
        { label: 'ID', width: 36, value: (m: { id: string }) => m.id },
        { label: 'Name', width: 28, value: (m: { name: string }) => m.name },
        {
          label: 'Free',
          width: 6,
          value: (m: { isFree?: boolean }) => (m.isFree ? 'yes' : 'no'),
          color: (m: { isFree?: boolean }) => (m.isFree ? 'green' : 'gray'),
        },
        {
          label: 'Context',
          width: 10,
          value: (m: { contextLength?: number }) => String(m.contextLength ?? '-'),
        },
      ]}
      onBack={ctx.goBack}
      emptyText="No models."
    />
  )
}

export function OrgSecurityScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async () => ({ ...(await getSecurityAgentPermissionStatus(ctx.token, orgId(ctx))) })}
      onBack={ctx.goBack}
    />
  )
}
