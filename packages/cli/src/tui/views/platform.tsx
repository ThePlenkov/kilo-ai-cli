import React from 'react'

import { listBriefings } from '../../api/briefing.ts'
import { listIntegrationStatus } from '../../api/integrations.ts'
import type { BriefingReport, PlatformIntegrationStatus, WebhookTrigger } from '../../api/types.ts'
import { listWebhookTriggers } from '../../api/webhooks.ts'
import { QueryListScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Cloud → Briefing: the published agent briefings. */
export function BriefingScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<BriefingReport>
      focused={focused}
      fetch={async () => {
        // Follow nextCursor until the server stops paginating (bounded to 20 pages).
        const all: BriefingReport[] = []
        let cursor: string | undefined
        for (let i = 0; i < 20; i++) {
          // eslint-disable-next-line no-await-in-loop -- cursor pagination is sequential
          const page = await listBriefings(ctx.token, {
            organizationId: ctx.organizationId,
            cursor,
          })
          all.push(...page.reports)
          if (!page.nextCursor) break
          cursor = page.nextCursor
        }
        return all
      }}
      columns={[
        { label: 'Date', width: 12, value: (r) => r.localDate ?? '-' },
        {
          label: 'Read',
          width: 6,
          value: (r) => (r.readAt ? 'yes' : 'no'),
          color: (r) => (r.readAt ? 'gray' : 'yellow'),
        },
        {
          label: 'Dismissed',
          width: 10,
          value: (r) => (r.dismissedAt ? 'yes' : 'no'),
        },
        {
          label: 'Published',
          width: 20,
          value: (r) => r.publishedAt?.slice(0, 16).replace('T', ' ') ?? '-',
        },
      ]}
      onBack={ctx.goBack}
      emptyText="No briefings."
    />
  )
}

/** Account → Integrations: which platforms are connected. */
export function IntegrationsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<PlatformIntegrationStatus>
      focused={focused}
      fetch={() => listIntegrationStatus(ctx.token)}
      columns={[
        { label: 'Platform', width: 14, value: (s) => s.platform },
        {
          label: 'Installed',
          width: 10,
          value: (s) => (s.installed ? 'yes' : 'no'),
          color: (s) => (s.installed ? 'green' : 'gray'),
        },
        {
          label: 'Account',
          width: 32,
          value: (s) =>
            (s.installation as { accountLogin?: string } | null | undefined)?.accountLogin ?? '-',
        },
      ]}
      onBack={ctx.goBack}
      emptyText="No integrations."
    />
  )
}

/** Cloud → Webhooks: the configured webhook triggers. */
export function WebhooksScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<WebhookTrigger>
      focused={focused}
      fetch={() => listWebhookTriggers(ctx.token, { organizationId: ctx.organizationId })}
      columns={[
        { label: 'Trigger', width: 24, value: (t) => t.triggerId ?? t.id },
        { label: 'Target', width: 14, value: (t) => t.targetType ?? '-' },
        { label: 'Mode', width: 10, value: (t) => t.activationMode ?? '-' },
        { label: 'Repository', width: 32, value: (t) => t.githubRepo ?? '-' },
        {
          label: 'Enabled',
          width: 8,
          value: (t) => (t.enabled === false ? 'no' : 'yes'),
          color: (t) => (t.enabled === false ? 'gray' : 'green'),
        },
      ]}
      onBack={ctx.goBack}
      emptyText="No webhook triggers."
    />
  )
}
