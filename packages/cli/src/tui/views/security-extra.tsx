import React from 'react'

import {
  getPermissionStatus,
  getSecurityConfig,
  getSecurityRepositories,
  listActiveCommands,
} from '../../api/security-agent.ts'
import type { SecurityAgentCommand, SecurityAgentRepository } from '../../api/types.ts'
import { QueryListScreen, QueryRecordScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Security → Permissions status. */
export function SecurityStatusScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async () => ({ ...(await getPermissionStatus(ctx.token)) })}
      onBack={ctx.goBack}
    />
  )
}

/** Security → Config. */
export function SecurityConfigScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async () => ({ ...(await getSecurityConfig(ctx.token)) })}
      onBack={ctx.goBack}
    />
  )
}

/** Security → Repositories. */
export function SecurityReposScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<SecurityAgentRepository>
      focused={focused}
      fetch={() => getSecurityRepositories(ctx.token)}
      columns={[
        { label: 'Repo', width: 44, value: (r) => r.full_name ?? r.fullName ?? r.name ?? '-' },
        {
          label: 'Findings',
          width: 9,
          align: 'right',
          value: (r) => String(r.findings_count ?? r.findingsCount ?? 0),
        },
        {
          label: 'Private',
          width: 8,
          value: (r) => (r.private == null ? '-' : r.private ? 'yes' : 'no'),
          color: (r) => (r.private ? 'yellow' : 'gray'),
        },
        { label: 'Last sync', width: 20, value: (r) => r.last_synced_at ?? r.lastSyncedAt ?? '-' },
      ]}
      onBack={ctx.goBack}
      emptyText="No repositories connected."
    />
  )
}

/** Security → Active commands (analyses/remediations). */
export function SecurityCommandsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<SecurityAgentCommand>
      focused={focused}
      fetch={() => listActiveCommands(ctx.token)}
      columns={[
        { label: 'ID', width: 14, value: (c) => c.id ?? '-' },
        { label: 'Type', width: 16, value: (c) => c.type ?? '-' },
        {
          label: 'Status',
          width: 12,
          value: (c) => c.status ?? '-',
          color: (c) =>
            c.status === 'completed' ? 'green' : c.status === 'failed' ? 'red' : 'yellow',
        },
        { label: 'Started', width: 22, value: (c) => c.started_at ?? c.startedAt ?? '-' },
      ]}
      onBack={ctx.goBack}
      emptyText="No active commands."
    />
  )
}
