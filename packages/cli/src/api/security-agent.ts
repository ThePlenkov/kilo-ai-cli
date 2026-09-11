/**
 * Security Agent tRPC procedures — personal level (no organization required).
 * Also supports organization-scoped operations via organizations.securityAgent.
 * Source: Kilo-Org/cloud apps/web/src/routers/security-agent-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type {
  SecurityAgentAnalysis,
  SecurityAgentCommand,
  SecurityAgentConfig,
  SecurityAgentDashboardStats,
  SecurityAgentPermissionStatus,
  SecurityAgentRepository,
  SecurityAgentStats,
  SecurityFinding,
} from './types.ts'

// --- Schemas ---

const PermissionStatusSchema: z.ZodType<SecurityAgentPermissionStatus> = z.object({
  granted: z.boolean(),
  permissions: z.array(z.string()),
  pendingRequests: z.number(),
})

const ConfigSchema: z.ZodType<SecurityAgentConfig> = z.object({
  isEnabled: z.boolean(),
  repositories: z.array(z.string()),
  scanFrequency: z.string().optional(),
  autoRemediate: z.boolean().optional(),
})

const RepositorySchema: z.ZodType<SecurityAgentRepository> = z.object({
  id: z.string(),
  name: z.string(),
  fullName: z.string(),
  url: z.string(),
  private: z.boolean(),
  lastSyncedAt: z.string().optional(),
  findingsCount: z.number().optional(),
})

const FindingSchema: z.ZodType<SecurityFinding> = z.object({
  id: z.string(),
  repositoryId: z.string(),
  repositoryName: z.string(),
  severity: z.union([z.literal('critical'), z.literal('high'), z.literal('medium'), z.literal('low'), z.literal('info')]),
  title: z.string(),
  description: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  status: z.union([z.literal('open'), z.literal('dismissed'), z.literal('remediated'), z.literal('in_progress')]),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const StatsSchema: z.ZodType<SecurityAgentStats> = z.object({
  totalFindings: z.number(),
  criticalFindings: z.number(),
  highFindings: z.number(),
  mediumFindings: z.number(),
  lowFindings: z.number(),
  openFindings: z.number(),
  remediatedFindings: z.number(),
  dismissedFindings: z.number(),
})

const DashboardStatsSchema: z.ZodType<SecurityAgentDashboardStats> = z.object({
  totalRepositories: z.number(),
  totalFindings: z.number(),
  findingsTrend: z.array(z.object({ date: z.string(), count: z.number() })),
  topRepositories: z.array(z.object({ name: z.string(), findings: z.number() })),
})

const AnalysisSchema: z.ZodType<SecurityAgentAnalysis> = z.object({
  id: z.string(),
  repositoryId: z.string(),
  status: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  findingsCount: z.number(),
})

const CommandSchema: z.ZodType<SecurityAgentCommand> = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  repositoryId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  output: z.string().optional(),
})

// --- Queries (personal level — no organizationId needed) ---

/** securityAgent.getPermissionStatus */
export async function getPermissionStatus(token: string): Promise<SecurityAgentPermissionStatus> {
  return trpcQuery('securityAgent.getPermissionStatus', token, PermissionStatusSchema)
}

/** securityAgent.getConfig */
export async function getSecurityConfig(token: string): Promise<SecurityAgentConfig> {
  return trpcQuery('securityAgent.getConfig', token, ConfigSchema)
}

/** securityAgent.getRepositories */
export async function getSecurityRepositories(token: string): Promise<SecurityAgentRepository[]> {
  return trpcQuery('securityAgent.getRepositories', token, z.array(RepositorySchema))
}

/** securityAgent.listFindings */
export async function listFindings(token: string, input?: { repositoryId?: string; severity?: string; status?: string; limit?: number }): Promise<SecurityFinding[]> {
  return trpcQuery('securityAgent.listFindings', token, z.array(FindingSchema), input)
}

/** securityAgent.getFinding */
export async function getFinding(token: string, findingId: string): Promise<SecurityFinding> {
  return trpcQuery('securityAgent.getFinding', token, FindingSchema, { findingId })
}

/** securityAgent.getStats */
export async function getSecurityStats(token: string): Promise<SecurityAgentStats> {
  return trpcQuery('securityAgent.getStats', token, StatsSchema)
}

/** securityAgent.getDashboardStats */
export async function getDashboardStats(token: string, input?: { startDate?: string; endDate?: string }): Promise<SecurityAgentDashboardStats> {
  return trpcQuery('securityAgent.getDashboardStats', token, DashboardStatsSchema, input)
}

/** securityAgent.getLastSyncTime */
export async function getLastSyncTime(token: string, input?: { repositoryId?: string }): Promise<{ lastSyncTime: string | null }> {
  return trpcQuery('securityAgent.getLastSyncTime', token, z.object({ lastSyncTime: z.string().nullable() }), input)
}

/** securityAgent.getAnalysis */
export async function getAnalysis(token: string, analysisId: string): Promise<SecurityAgentAnalysis> {
  return trpcQuery('securityAgent.getAnalysis', token, AnalysisSchema, { analysisId })
}

/** securityAgent.getCommandStatus */
export async function getCommandStatus(token: string, commandId: string): Promise<SecurityAgentCommand> {
  return trpcQuery('securityAgent.getCommandStatus', token, CommandSchema, { commandId })
}

/** securityAgent.listActiveCommands */
export async function listActiveCommands(token: string): Promise<SecurityAgentCommand[]> {
  return trpcQuery('securityAgent.listActiveCommands', token, z.array(CommandSchema))
}

/** securityAgent.getOrphanedRepositories */
export async function getOrphanedRepositories(token: string): Promise<SecurityAgentRepository[]> {
  return trpcQuery('securityAgent.getOrphanedRepositories', token, z.array(RepositorySchema))
}

// --- Mutations (personal level) ---

/** securityAgent.saveConfig */
export async function saveSecurityConfig(token: string, input: Record<string, unknown>): Promise<void> {
  await trpcMutate('securityAgent.saveConfig', token, z.unknown(), input)
}

/** securityAgent.setEnabled */
export async function setSecurityEnabled(token: string, isEnabled: boolean): Promise<void> {
  await trpcMutate('securityAgent.setEnabled', token, z.unknown(), { isEnabled })
}

/** securityAgent.triggerSync */
export async function triggerSync(token: string, input?: { repositoryId?: string }): Promise<void> {
  await trpcMutate('securityAgent.triggerSync', token, z.unknown(), input ?? {})
}

/** securityAgent.dismissFinding */
export async function dismissFinding(token: string, findingId: string, reason?: string): Promise<void> {
  await trpcMutate('securityAgent.dismissFinding', token, z.unknown(), { findingId, reason })
}

/** securityAgent.startAnalysis */
export async function startAnalysis(token: string, repositoryId: string): Promise<{ analysisId: string }> {
  return trpcMutate('securityAgent.startAnalysis', token, z.object({ analysisId: z.string() }), { repositoryId })
}

/** securityAgent.startRemediation */
export async function startRemediation(token: string, findingId: string): Promise<{ commandId: string }> {
  return trpcMutate('securityAgent.startRemediation', token, z.object({ commandId: z.string() }), { findingId })
}

/** securityAgent.retryRemediation */
export async function retryRemediation(token: string, commandId: string): Promise<void> {
  await trpcMutate('securityAgent.retryRemediation', token, z.unknown(), { commandId })
}

/** securityAgent.cancelRemediation */
export async function cancelRemediation(token: string, commandId: string): Promise<void> {
  await trpcMutate('securityAgent.cancelRemediation', token, z.unknown(), { commandId })
}

/** securityAgent.deleteFindingsByRepository */
export async function deleteFindingsByRepository(token: string, repositoryId: string): Promise<void> {
  await trpcMutate('securityAgent.deleteFindingsByRepository', token, z.unknown(), { repositoryId })
}

/** securityAgent.trackUiInteraction */
export async function trackUiInteraction(token: string, input: Record<string, unknown>): Promise<void> {
  await trpcMutate('securityAgent.trackUiInteraction', token, z.unknown(), input)
}
