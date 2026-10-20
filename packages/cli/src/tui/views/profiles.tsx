import React from 'react'

import { getAgentProfile, listAgentProfiles } from '../../api/profiles.ts'
import type { AgentProfile, AgentProfileSummary } from '../../api/types.ts'
import { QueryListScreen, QueryRecordScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Cloud → Profiles: the agent profiles of the account. */
export function ProfilesScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<AgentProfileSummary>
      focused={focused}
      fetch={() => listAgentProfiles(ctx.token, ctx.organizationId)}
      columns={[
        { label: 'Name', width: 24, value: (p) => p.name },
        {
          label: 'Default',
          width: 8,
          value: (p) => (p.isDefault ? 'yes' : 'no'),
          color: (p) => (p.isDefault ? 'green' : 'gray'),
        },
        { label: 'Vars', width: 6, align: 'right', value: (p) => String(p.varCount ?? 0) },
        { label: 'Cmds', width: 6, align: 'right', value: (p) => String(p.commandCount ?? 0) },
        { label: 'MCPs', width: 6, align: 'right', value: (p) => String(p.mcpServerCount ?? 0) },
        { label: 'Skills', width: 7, align: 'right', value: (p) => String(p.skillCount ?? 0) },
        { label: 'Agents', width: 7, align: 'right', value: (p) => String(p.agentCount ?? 0) },
      ]}
      onSelect={(p) => ctx.navigate('agent-profile', { id: p.id })}
      onBack={ctx.goBack}
      emptyText="No agent profiles."
    />
  )
}

/** Cloud → Profiles → detail. */
export function ProfileDetailScreen({ ctx, focused }: ScreenProps) {
  const id = ctx.route.params.id ?? ''
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async (): Promise<Record<string, unknown>> => {
        const profile: AgentProfile = await getAgentProfile(ctx.token, id, ctx.organizationId)
        return {
          id: profile.id,
          name: profile.name,
          description: profile.description ?? '-',
          default: profile.isDefault ? 'yes' : 'no',
          variables: profile.variables ?? {},
          repositories: profile.repoBindings ?? [],
        }
      }}
      onBack={ctx.goBack}
      emptyText="Profile not found."
    />
  )
}
