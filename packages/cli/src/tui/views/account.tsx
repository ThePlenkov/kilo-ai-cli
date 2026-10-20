import React from 'react'

import { getBalance, getContextBalance, getNotificationPreferences } from '../../api/account.ts'
import { listActiveSessions, listUnifiedSessions } from '../../api/sessions.ts'
import type { ActiveSession, UnifiedSession } from '../../api/types.ts'
import { type CursorEntry, createCursorStore } from '../../state/cursor-store.ts'
import { QueryListScreen, QueryRecordScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Account → Overview: balance, context budget and notification preferences. */
export function AccountScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async (): Promise<Record<string, unknown>> => {
        const [balance, context, notifications] = await Promise.all([
          getBalance(ctx.token),
          getContextBalance(ctx.token, ctx.organizationId),
          getNotificationPreferences(ctx.token),
        ])
        return {
          balance: `$${balance.toFixed(4)}`,
          context: context.balance.toFixed(4),
          depleted: context.isDepleted ? 'yes' : 'no',
          notifications,
        }
      }}
      onBack={ctx.goBack}
    />
  )
}

/** Cloud → Sessions → unified: v1 and v2 sessions in one feed. */
export function UnifiedSessionsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<UnifiedSession>
      focused={focused}
      fetch={async () =>
        (
          await listUnifiedSessions(ctx.token, {
            limit: 50,
            organizationId: ctx.organizationId,
          })
        ).cliSessions
      }
      columns={[
        { label: 'ID', width: 28, value: (s) => s.session_id },
        { label: 'Title', width: 36, value: (s) => s.title ?? '(untitled)' },
        { label: 'Platform', width: 14, value: (s) => s.created_on_platform ?? '-' },
        { label: 'Status', width: 10, value: (s) => s.status ?? '-' },
        { label: 'Updated', width: 20, value: (s) => s.updated_at.slice(0, 16).replace('T', ' ') },
      ]}
      onBack={ctx.goBack}
      emptyText="No sessions."
    />
  )
}

/** Cloud → Sessions → active: the sessions that are alive right now. */
export function ActiveSessionsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<ActiveSession>
      focused={focused}
      fetch={() => listActiveSessions(ctx.token, { organizationId: ctx.organizationId })}
      columns={[
        { label: 'ID', width: 28, value: (s) => s.sessionId ?? s.session_id ?? '-' },
        {
          label: 'Name',
          width: 28,
          value: (s) => s.name ?? s.projectName ?? s.project_name ?? '-',
        },
        { label: 'Kind', width: 10, value: (s) => s.kind ?? '-' },
        { label: 'Branch', width: 24, value: (s) => s.gitBranch ?? s.git_branch ?? '-' },
      ]}
      onBack={ctx.goBack}
      emptyText="No active sessions."
    />
  )
}

/** Account → Cursors: the stored "where was I" markers. */
export function CursorsScreen({ ctx, focused }: ScreenProps) {
  void ctx
  return (
    <QueryListScreen<CursorEntry & { name: string }>
      focused={focused}
      fetch={async () => {
        const cursors = await createCursorStore().list()
        return Object.entries(cursors).map(([name, entry]) => ({
          name,
          value: entry.value,
          updatedAt: entry.updatedAt,
        }))
      }}
      columns={[
        { label: 'Name', width: 24, value: (c) => c.name },
        { label: 'Value', width: 32, value: (c) => c.value },
        { label: 'Updated', width: 24, value: (c) => c.updatedAt || '-' },
      ]}
      onBack={ctx.goBack}
      emptyText="No cursors stored yet."
    />
  )
}
