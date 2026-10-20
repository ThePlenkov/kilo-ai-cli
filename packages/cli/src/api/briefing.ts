/**
 * Agent briefing — the daily digest the cloud agent publishes.
 * Source: Kilo-Org/cloud apps/web/src/routers/agent-briefing-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { BriefingReport } from './types.ts'

const BriefingReportSchema: z.ZodType<BriefingReport> = z
  .object({
    id: z.string(),
    title: z.string().nullish(),
    summary: z.string().nullish(),
    context: z.unknown().optional(),
    localDate: z.string().optional(),
    publishedAt: z.string().nullish(),
    updatedAt: z.string().optional(),
    readAt: z.string().nullish(),
    dismissedAt: z.string().nullish(),
    revision: z.number().optional(),
    scorecard: z.unknown().optional(),
    coverage: z.unknown().optional(),
    sessions: z.array(z.unknown()).optional(),
  })
  .passthrough() as z.ZodType<BriefingReport>

/** agentBriefing.preferences */
export async function getBriefingPreferences(
  token: string,
  timezone?: string,
  language?: string,
): Promise<Record<string, unknown>> {
  return trpcQuery('agentBriefing.preferences', token, z.record(z.string(), z.unknown()), {
    timezone,
    language,
  })
}

/** agentBriefing.updatePreferences */
export async function updateBriefingPreferences(
  token: string,
  changes: {
    timezone?: string
    language?: string
    notificationsEnabled?: boolean
    contextPreferences?: Record<string, unknown>
  },
): Promise<Record<string, unknown>> {
  return trpcMutate(
    'agentBriefing.updatePreferences',
    token,
    z.record(z.string(), z.unknown()),
    changes,
  )
}

/** agentBriefing.list — published briefings, newest first. */
export async function listBriefings(
  token: string,
  options: {
    scope?: 'all' | 'personal' | 'organization'
    organizationId?: string
    cursor?: string
    limit?: number
    currentOnly?: boolean
  } = {},
): Promise<{ reports: BriefingReport[]; nextCursor?: string | null }> {
  return trpcQuery(
    'agentBriefing.list',
    token,
    z.object({ reports: z.array(BriefingReportSchema), nextCursor: z.string().nullish() }),
    options,
  )
}

/** agentBriefing.get */
export async function getBriefing(token: string, reportId: string): Promise<BriefingReport> {
  return trpcQuery('agentBriefing.get', token, BriefingReportSchema, { reportId })
}

/** agentBriefing.read — mark a briefing as read. */
export async function markBriefingRead(token: string, reportId: string): Promise<BriefingReport> {
  return trpcMutate('agentBriefing.read', token, BriefingReportSchema, { reportId })
}

/** agentBriefing.dismiss — hide a briefing. */
export async function dismissBriefing(token: string, reportId: string): Promise<BriefingReport> {
  return trpcMutate('agentBriefing.dismiss', token, BriefingReportSchema, { reportId })
}

/** agentBriefing.generateSummary — ask the cloud to build the summary. */
export async function generateBriefingSummary(
  token: string,
  reportId: string,
  estimateToken: string,
): Promise<unknown> {
  return trpcMutate('agentBriefing.generateSummary', token, z.unknown(), {
    reportId,
    estimateToken,
  })
}
