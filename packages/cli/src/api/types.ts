/**
 * Shared API types for kilo.ai cloud.
 * Mirrors @kilocode/kilo-gateway/src/types.ts and @kilocode/trpc types.
 */

// ============================================================================
// Authentication Types
// ============================================================================

export interface DeviceAuthInitiateResponse {
  code: string
  verificationUrl: string
  expiresIn: number
}

export interface DeviceAuthPollResponse {
  status: 'pending' | 'approved' | 'denied' | 'expired'
  token?: string
  userEmail?: string
}

export type KiloAuth =
  | { type: 'api'; key: string }
  | {
      type: 'oauth'
      access: string
      refresh: string
      expires: number
      accountId?: string
    }
  | { type: 'wellknown'; key: string; token: string }

// ============================================================================
// Profile Types
// ============================================================================

export interface Organization {
  id: string
  name: string
  role: string
}

export interface KilocodeProfile {
  email: string
  name?: string
  organizations?: Organization[]
  selectedOrganizationId?: string
  hasPersonalAccount?: boolean
}

export interface KilocodeBalance {
  balance: number
}

export interface KiloPassState {
  currentPeriodBaseCreditsUsd: number
  currentPeriodUsageUsd: number
  currentPeriodBonusCreditsUsd: number
  nextBillingAt?: string | null
}

// ============================================================================
// tRPC Types — Coding Plans
// ============================================================================

export interface CodingPlanSubscription {
  id: string
  planId: string
  planName: string
  providerName: string
  providerId: string
  canQueryUsage: boolean
  hasInstalledByokKey: boolean
  status: 'active' | 'past_due' | 'canceled'
  cancelAtPeriodEnd: boolean
}

export interface CodingPlanQuotaWindow {
  id: string
  remainingPercent: number
  resetsAt: string
  startsAt?: string
  period: {
    unit: 'hour' | 'day' | 'week' | 'month'
    value: number
  }
}

export interface CodingPlanUsage {
  schemaVersion: 1
  fetchedAt: string
  subscription: {
    id: string
    planName: string
    providerId: string
    providerName: string
    windows: CodingPlanQuotaWindow[]
  }
}

// ============================================================================
// tRPC Types — BYOK
// ============================================================================

export interface ByokEntry {
  id: string
  provider_id: string
  management_source: 'user' | 'coding_plan'
  is_enabled: boolean
}

// ============================================================================
// tRPC Types — CLI Sessions
// ============================================================================

export interface CliSession {
  session_id: string
  title: string | null
  created_at: string
  updated_at: string
  version: number
}

export interface CloudSessionsResult {
  cliSessions: CliSession[]
  nextCursor: string | null
}

export interface CloudSessionsInput {
  cursor?: string
  limit?: number
  gitUrl?: string
}

// ============================================================================
// tRPC Types — KiloClaw (Managed Instance System)
// ============================================================================

export interface KiloclawInstance {
  id: string
  name: string
  status: string
  planName?: string
  imageTag?: string
  createdAt: string
  updatedAt: string
}

export interface KiloclawChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export interface KiloclawAgent {
  id: string
  name: string
  status: string
  type?: string
}

export interface KiloclawFileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: KiloclawFileTreeNode[]
}

export interface KiloclawBillingStatus {
  balance: number
  activeSubscriptions: number
  currentPeriodUsageUsd: number
}

export interface KiloclawBillingHistoryEntry {
  id: string
  date: string
  amount: number
  description: string
  type: string
}

export interface KiloclawSubscriptionDetail {
  id: string
  planName: string
  status: string
  providerName: string
  providerId: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart?: string
  currentPeriodEnd?: string
}

export interface KiloclawKiloCliRun {
  runId: string
  status: string
  prompt: string
  startedAt: string
  completedAt?: string
  output?: string
}

// ============================================================================
// tRPC Types — Cloud Agent Next
// ============================================================================

export interface CloudAgentSession {
  sessionId: string
  status: string
  gitUrl?: string
  branch?: string
  createdAt: string
  updatedAt: string
  cloudAgentSessionId?: string
}

export interface CloudAgentRepository {
  id: string
  name: string
  fullName: string
  url: string
  private: boolean
  defaultBranch?: string
}

export interface CloudAgentTerminal {
  terminalId: string
  ticket: string
}

// ============================================================================
// tRPC Types — Code Reviews
// ============================================================================

export interface CodeReview {
  id: string
  title: string
  status: string
  platform: string
  repositoryName?: string
  pullRequestNumber?: number
  createdAt: string
  updatedAt: string
}

export interface CodeReviewConfig {
  isEnabled: boolean
  platform: string
  repositoryName?: string
}

// ============================================================================
// tRPC Types — Organizations (extended)
// ============================================================================

export interface OrganizationMember {
  id: string
  email: string
  name?: string
  role: string
}

export interface OrganizationWithMembers extends Organization {
  members: OrganizationMember[]
}

export interface OrganizationUsageStats {
  totalCreditsUsed: number
  creditsUsedThisPeriod: number
  activeSessions: number
  totalMembers: number
}

export interface CreditTransaction {
  id: string
  amount: number
  type: string
  description: string
  createdAt: string
}

export interface OrganizationSeats {
  total: number
  used: number
}

export interface OrganizationInvoice {
  id: string
  date: string
  amount: number
  status: string
  url?: string
}

export interface OrganizationCreateInput {
  name: string
  companyDomain?: string | null
}

export interface OrganizationUpdateInput {
  organizationId: string
  name?: string
}

// ============================================================================
// tRPC Types — Organization Settings
// ============================================================================

export interface AvailableModel {
  id: string
  name: string
  provider: string
  isEnabled: boolean
}

// ============================================================================
// tRPC Types — Usage Analytics
// ============================================================================

export interface UsageAnalyticsSummary {
  totalCreditsUsd: number
  totalRequests: number
  totalTokens: number
  averageLatencyMs: number
}

export interface UsageAnalyticsTimeseriesPoint {
  timestamp: string
  creditsUsd: number
  requests: number
  tokens: number
}

export interface UsageAnalyticsBreakdownEntry {
  label: string
  value: number
  percentage: number
}

export interface UsageAnalyticsTableRow {
  date: string
  model: string
  provider: string
  creditsUsd: number
  requests: number
  tokens: number
}

export interface UsageAnalyticsFilters {
  startDate?: string
  endDate?: string
  organizationId?: string
  granularity?: 'hour' | 'day' | 'week' | 'month'
  metric?: 'cost' | 'requests' | 'tokens' | 'inputTokens' | 'outputTokens' | 'errorRate' | 'avgLatencyMs' | 'avgGenerationTimeMs' | 'costPerRequest' | 'tokensPerRequest' | 'cacheHitRatio' | 'outputInputRatio'
  dimension?: 'feature' | 'model' | 'mode' | 'user' | 'provider' | 'project' | 'organization'
  groupBy?: string[]
}

// ============================================================================
// tRPC Types — App Builder
// ============================================================================

export interface AppBuilderProject {
  id: string
  name: string
  status: string
  url?: string
  createdAt: string
  updatedAt: string
}

export interface AppBuilderEligibility {
  eligible: boolean
  reason?: string
}

// ============================================================================
// tRPC Types — Security Agent (personal + organization)
// ============================================================================

export interface SecurityAgentPermissionStatus {
  granted?: boolean
  permissions?: string[]
  pendingRequests?: number
  [key: string]: unknown
}

export interface SecurityAgentConfig {
  isEnabled?: boolean
  is_enabled?: boolean
  repositories?: string[]
  scanFrequency?: string
  scan_frequency?: string
  autoRemediate?: boolean
  auto_remediate?: boolean
  [key: string]: unknown
}

export interface SecurityAgentRepository {
  id?: string | number
  name?: string
  fullName?: string
  full_name?: string
  url?: string
  private?: boolean
  lastSyncedAt?: string | null
  last_synced_at?: string | null
  findingsCount?: number
  findings_count?: number
  [key: string]: unknown
}

export interface SecurityFinding {
  id: string
  repoFullName?: string
  repo_full_name?: string
  source?: string
  sourceId?: string
  source_id?: string
  severity: string
  title: string
  description?: string
  status: string
  packageName?: string
  package_name?: string
  packageEcosystem?: string
  package_ecosystem?: string
  vulnerableVersionRange?: string
  vulnerable_version_range?: string
  patchedVersion?: string
  patched_version?: string
  manifestPath?: string
  manifest_path?: string
  ghsaId?: string
  ghsa_id?: string
  cveId?: string
  cve_id?: string
  cvssScore?: number | string
  cvss_score?: number | string
  cweIds?: string[]
  cwe_ids?: string[]
  dependencyScope?: string
  dependency_scope?: string
  dependabotHtmlUrl?: string
  dependabot_html_url?: string
  ignoredReason?: string | null
  ignored_reason?: string | null
  fixedAt?: string | null
  fixed_at?: string | null
  slaDueAt?: string | null
  sla_due_at?: string | null
  analysisStatus?: string | null
  analysis_status?: string | null
  analysisStartedAt?: string | null
  analysis_started_at?: string | null
  analysisCompletedAt?: string | null
  analysis_completed_at?: string | null
  analysisError?: string | null
  analysis_error?: string | null
  remediationSummary?: string | null
  remediation_summary?: string | null
  remediationCapability?: Record<string, unknown>
  remediation_capability?: Record<string, unknown>
  firstDetectedAt?: string
  first_detected_at?: string
  lastSyncedAt?: string
  last_synced_at?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  [key: string]: unknown
}

export interface SecurityFindingsResult {
  findings: SecurityFinding[]
  totalCount?: number
  total_count?: number
  runningCount?: number
  running_count?: number
  concurrencyLimit?: number
  concurrency_limit?: number
  [key: string]: unknown
}

export interface SecurityFindingsInput {
  repoFullName?: string
  status?: string
  severity?: string
  outcomeFilter?: string
  overdue?: boolean
  sortBy?: 'severity_desc' | 'severity_asc' | 'sla_due_at_asc'
  limit?: number
  offset?: number
}

export interface SecurityAgentStats {
  [key: string]: unknown
}

export interface SecurityAgentDashboardStats {
  [key: string]: unknown
}

export interface SecurityAgentAnalysis {
  id?: string
  repositoryId?: string
  repository_id?: string
  status?: string
  startedAt?: string
  started_at?: string
  completedAt?: string | null
  completed_at?: string | null
  findingsCount?: number
  findings_count?: number
  [key: string]: unknown
}

export interface SecurityAgentCommand {
  id?: string
  type?: string
  status?: string
  repositoryId?: string
  repository_id?: string
  startedAt?: string
  started_at?: string
  completedAt?: string | null
  completed_at?: string | null
  output?: string | null
  [key: string]: unknown
}

// ============================================================================
// Error Types
// ============================================================================

export type CloudTrpcErrorKind = 'network' | 'http' | 'protocol' | 'procedure' | 'schema' | 'unauthorized'

export class CloudTrpcError extends Error {
  readonly kind: CloudTrpcErrorKind
  readonly status?: number
  readonly procedure?: string
  readonly detail?: string
  constructor(kind: CloudTrpcErrorKind, status?: number, procedure?: string, detail?: string) {
    const parts: string[] = []
    if (procedure) parts.push(`[${procedure}]`)
    if (kind === 'unauthorized') {
      parts.push('Not authenticated or token expired. Run `kilo-ai-cli auth login` to sign in.')
    } else if (kind === 'network') {
      parts.push('Network error — unable to reach kilo.ai. Check your connection.')
    } else if (kind === 'http') {
      parts.push(`HTTP ${status ?? '?'} — server returned an error.`)
    } else if (kind === 'protocol') {
      parts.push(`Protocol error (HTTP ${status ?? '?'}) — unexpected response format.`)
    } else if (kind === 'procedure') {
      parts.push(`Procedure error (HTTP ${status ?? '?'}) — the API rejected the request.`)
    } else if (kind === 'schema') {
      parts.push(`Schema error (HTTP ${status ?? '?'}) — response didn't match expected type.`)
    }
    if (detail) parts.push(`Detail: ${detail}`)
    super(parts.join(' '))
    this.name = 'CloudTrpcError'
    this.kind = kind
    this.status = status
    this.procedure = procedure
    this.detail = detail
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated with Kilo') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class GatewayError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'GatewayError'
    this.status = status
  }
}
