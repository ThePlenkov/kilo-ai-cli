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
  SecurityFindingsInput,
  SecurityFindingsResult,
} from './types.ts'

// --- Schemas ---

const PermissionStatusSchema = z.object({
  granted: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  pendingRequests: z.number().optional(),
}).passthrough()

const ConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
  repositories: z.array(z.string()).optional(),
  scanFrequency: z.string().optional(),
  scan_frequency: z.string().optional(),
  autoRemediate: z.boolean().optional(),
  auto_remediate: z.boolean().optional(),
}).passthrough()

const RepositorySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  full_name: z.string().optional(),
  fullName: z.string().optional(),
  url: z.string().optional(),
  private: z.boolean().optional(),
  lastSyncedAt: z.string().nullable().optional(),
  last_synced_at: z.string().nullable().optional(),
  findingsCount: z.number().optional(),
  findings_count: z.number().optional(),
}).passthrough()

const FindingSchema: z.ZodType<SecurityFinding> = z.object({
  id: z.string(),
  repoFullName: z.string().optional(),
  repo_full_name: z.string().optional(),
  source: z.string().optional(),
  sourceId: z.string().optional(),
  source_id: z.string().optional(),
  severity: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  packageName: z.string().optional(),
  package_name: z.string().optional(),
  packageEcosystem: z.string().optional(),
  package_ecosystem: z.string().optional(),
  vulnerableVersionRange: z.string().optional(),
  vulnerable_version_range: z.string().optional(),
  patchedVersion: z.string().optional(),
  patched_version: z.string().optional(),
  manifestPath: z.string().optional(),
  manifest_path: z.string().optional(),
  ghsaId: z.string().optional(),
  ghsa_id: z.string().optional(),
  cveId: z.string().optional(),
  cve_id: z.string().optional(),
  cvssScore: z.union([z.number(), z.string()]).optional(),
  cvss_score: z.union([z.number(), z.string()]).optional(),
  cweIds: z.array(z.string()).optional(),
  cwe_ids: z.array(z.string()).optional(),
  dependencyScope: z.string().optional(),
  dependency_scope: z.string().optional(),
  dependabotHtmlUrl: z.string().optional(),
  dependabot_html_url: z.string().optional(),
  ignoredReason: z.string().nullable().optional(),
  ignored_reason: z.string().nullable().optional(),
  fixedAt: z.string().nullable().optional(),
  fixed_at: z.string().nullable().optional(),
  slaDueAt: z.string().nullable().optional(),
  sla_due_at: z.string().nullable().optional(),
  analysisStatus: z.string().nullable().optional(),
  analysis_status: z.string().nullable().optional(),
  analysisStartedAt: z.string().nullable().optional(),
  analysis_started_at: z.string().nullable().optional(),
  analysisCompletedAt: z.string().nullable().optional(),
  analysis_completed_at: z.string().nullable().optional(),
  analysisError: z.string().nullable().optional(),
  analysis_error: z.string().nullable().optional(),
  remediationSummary: z.string().nullable().optional(),
  remediation_summary: z.string().nullable().optional(),
  remediationCapability: z.record(z.string(), z.unknown()).optional(),
  remediation_capability: z.record(z.string(), z.unknown()).optional(),
  firstDetectedAt: z.string().optional(),
  first_detected_at: z.string().optional(),
  lastSyncedAt: z.string().optional(),
  last_synced_at: z.string().optional(),
  createdAt: z.string().optional(),
  created_at: z.string().optional(),
  updatedAt: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough() as z.ZodType<SecurityFinding>

const FindingsResultSchema = z.object({
  findings: z.array(z.unknown()),
  totalCount: z.number().optional(),
  total_count: z.number().optional(),
  runningCount: z.number().optional(),
  running_count: z.number().optional(),
  concurrencyLimit: z.number().optional(),
  concurrency_limit: z.number().optional(),
}).passthrough()

const StatsSchema = z.object({}).passthrough()

const DashboardStatsSchema = z.object({}).passthrough()

const AnalysisSchema = z.object({
  id: z.string().optional(),
  repositoryId: z.string().optional(),
  repository_id: z.string().optional(),
  status: z.string().optional(),
  startedAt: z.string().optional(),
  started_at: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  findingsCount: z.number().optional(),
  findings_count: z.number().optional(),
}).passthrough()

const CommandSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  repositoryId: z.string().optional(),
  repository_id: z.string().optional(),
  startedAt: z.string().optional(),
  started_at: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  output: z.string().nullable().optional(),
}).passthrough()

// --- Queries (personal level — no organizationId needed) ---

/** securityAgent.getPermissionStatus */
export async function getPermissionStatus(token: string): Promise<SecurityAgentPermissionStatus> {
  return trpcQuery('securityAgent.getPermissionStatus', token, PermissionStatusSchema, {})
}

/** securityAgent.getConfig */
export async function getSecurityConfig(token: string): Promise<SecurityAgentConfig> {
  return trpcQuery('securityAgent.getConfig', token, ConfigSchema, {})
}

/** securityAgent.getRepositories */
export async function getSecurityRepositories(token: string): Promise<SecurityAgentRepository[]> {
  return trpcQuery('securityAgent.getRepositories', token, z.array(RepositorySchema), {})
}

/** securityAgent.listFindings — paginated, returns { findings, totalCount, runningCount, concurrencyLimit } */
export async function listFindings(token: string, input?: SecurityFindingsInput): Promise<SecurityFindingsResult> {
  const result = await trpcQuery('securityAgent.listFindings', token, FindingsResultSchema, input)
  return { ...result, findings: result.findings as SecurityFinding[] }
}

/** securityAgent.getFinding */
export async function getFinding(token: string, findingId: string): Promise<SecurityFinding> {
  return trpcQuery('securityAgent.getFinding', token, FindingSchema, { id: findingId })
}

/** securityAgent.getStats */
export async function getSecurityStats(token: string): Promise<SecurityAgentStats> {
  return trpcQuery('securityAgent.getStats', token, StatsSchema, {})
}

/** securityAgent.getDashboardStats */
export async function getDashboardStats(token: string, input?: { startDate?: string; endDate?: string }): Promise<SecurityAgentDashboardStats> {
  return trpcQuery('securityAgent.getDashboardStats', token, DashboardStatsSchema, input ?? {})
}

/** securityAgent.getLastSyncTime */
export async function getLastSyncTime(token: string, input?: { repositoryId?: string }): Promise<{ lastSyncTime?: string | null; last_sync_time?: string | null; [key: string]: unknown }> {
  return trpcQuery('securityAgent.getLastSyncTime', token, z.object({ lastSyncTime: z.string().nullable().optional(), last_sync_time: z.string().nullable().optional() }).passthrough(), input ?? {})
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
  return trpcQuery('securityAgent.listActiveCommands', token, z.array(CommandSchema), {})
}

/** securityAgent.getOrphanedRepositories */
export async function getOrphanedRepositories(token: string): Promise<SecurityAgentRepository[]> {
  return trpcQuery('securityAgent.getOrphanedRepositories', token, z.array(RepositorySchema), {})
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

/** securityAgent.deleteFindingsByRepository — deletes ALL findings for a repo */
export async function deleteFindingsByRepository(token: string, repoFullName: string): Promise<void> {
  await trpcMutate('securityAgent.deleteFindingsByRepository', token, z.unknown(), { repoFullName })
}

/** Filters for bulk dismiss/delete operations. */
export interface BulkFindingFilters {
  repoFullName?: string
  severity?: string
  status?: string
  /** ISO date string — only findings created after this date */
  createdAfter?: string
  /** ISO date string — only findings created before this date */
  createdBefore?: string
}

/**
 * Dismiss (close/ignore) findings matching the given filters.
 * Fetches findings in pages, dismisses each one individually.
 * Returns { dismissed, errors, totalMatched }.
 */
export async function dismissFindingsBulk(
  token: string,
  filters: BulkFindingFilters,
  reason: string,
): Promise<{ dismissed: number; totalMatched: number; errors: string[] }> {
  const errors: string[] = []
  let dismissed = 0
  let totalMatched = 0
  let offset = 0
  const limit = 100

  for (;;) {
    const result = await listFindings(token, {
      repoFullName: filters.repoFullName,
      severity: filters.severity,
      status: filters.status ?? 'open',
      limit,
      offset,
    })
    totalMatched = result.totalCount ?? result.total_count ?? 0

    // Filter by date client-side (API may not support date filters directly)
    let findings = result.findings
    if (filters.createdAfter || filters.createdBefore) {
      findings = findings.filter((f) => {
        const created = f.createdAt ?? f.created_at ?? ''
        if (filters.createdAfter && created < filters.createdAfter) return false
        if (filters.createdBefore && created > filters.createdBefore) return false
        return true
      })
    }

    if (findings.length === 0) {
      if (result.findings.length < limit) break
      offset += limit
      continue
    }

    for (const f of findings) {
      try {
        await dismissFinding(token, f.id, reason)
        dismissed++
      } catch (e) {
        errors.push(`${f.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (result.findings.length < limit) break
    offset += limit
  }

  return { dismissed, totalMatched, errors }
}

/**
 * Delete ALL findings for a repository (uses server-side bulk delete).
 * This removes findings from the database entirely.
 */
export async function deleteFindingsBulk(
  token: string,
  repoFullName: string,
): Promise<void> {
  await deleteFindingsByRepository(token, repoFullName)
}

/** securityAgent.trackUiInteraction */
export async function trackUiInteraction(token: string, input: Record<string, unknown>): Promise<void> {
  await trpcMutate('securityAgent.trackUiInteraction', token, z.unknown(), input)
}
