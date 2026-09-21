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
  date: string
  description: string
  category: string
  deployHint: string | null
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
  hasAccess: boolean
  accessReason?: string | null
  hasExistingPersonalSubscription?: boolean
  hasCurrentPersonalSubscription?: boolean
  commitPlanAvailable?: boolean
  trialEligible?: boolean
  creditBalanceMicrodollars?: number
  creditIntroEligible?: boolean
  hasActiveKiloPass?: boolean
  intendedPriceVersion?: string
  intendedSelfServiceInstanceType?: string
  [key: string]: unknown
}

export interface KiloclawBillingHistoryPage {
  entries: Record<string, unknown>[]
  hasMore: boolean
  cursor: string | null
}

export interface KiloclawSubscriptionDetail {
  instanceId: string
  sandboxId?: string
  instanceName?: string
  plan: string
  status: string
  activationState?: string
  priceVersion?: string
  selfServiceInstanceType?: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  destroyedAt?: string | null
  suspendedAt?: string | null
  trialStartedAt?: string | null
  trialEndsAt?: string | null
  [key: string]: unknown
}

export interface KiloclawSubscriptionsResult {
  commitPlanAvailable: boolean
  subscriptions: KiloclawSubscriptionDetail[]
}

export interface KiloclawLatestVersion {
  openclawVersion: string
  variant: string
  imageTag: string
  imageDigest?: string
  publishedAt?: string
  rolloutPercent?: number
  isLatest: boolean
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
  id: string | number
  name: string
  fullName: string
  url?: string
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

/** GitLab numeric project id arrives as number; some surfaces serialize it as string. */
export type PlatformProjectId = string | number | null

/** codeReviews.listForUser / codeReviews.get — snake_case server shape. */
export interface CodeReview {
  id: string
  owned_by_organization_id?: string | null
  owned_by_user_id?: string | null
  review_type?: string | null
  trigger_source?: string | null
  repo_full_name?: string | null
  pr_number?: number | null
  pr_url?: string | null
  pr_title?: string | null
  pr_author?: string | null
  base_ref?: string | null
  head_ref?: string | null
  head_sha?: string | null
  platform?: string | null
  platform_project_id?: PlatformProjectId
  session_id?: string | null
  cli_session_id?: string | null
  status: string
  error_message?: string | null
  terminal_reason?: string | null
  agent_version?: string | null
  model?: string | null
  total_tokens_in?: number | null
  total_tokens_out?: number | null
  total_cost_musd?: number | null
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface CodeReviewAttempt {
  id: string
  code_review_id: string
  attempt_number: number
  retry_of_attempt_id?: string | null
  retry_reason?: string | null
  session_id?: string | null
  cli_session_id?: string | null
  execution_id?: string | null
  status: string
  error_message?: string | null
  terminal_reason?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface CodeReviewDetail {
  review: CodeReview
  attempts: CodeReviewAttempt[]
  tokenUsage?: { input: number; output: number; cached: number }
  success?: boolean
}

export interface CodeReviewConfig {
  isEnabled: boolean
  platform: string
  repositoryName?: string
}

/** personalReviewAgent.getReviewConfig / organizations.reviewAgent.getReviewConfig — camelCase server shape. */
export interface ReviewAgentActionRequired {
  reason: string
  detectedAt?: string
  lastSeenAt?: string
  triggeringReviewId?: string
  lastErrorMessage?: string
  emailSentAt?: string
  [key: string]: unknown
}

export interface ReviewAgentConfig {
  isEnabled: boolean
  reviewStyle?: string
  focusAreas?: string[]
  customInstructions?: string | null
  modelSlug?: string
  thinkingEffort?: string | null
  gateThreshold?: string | null
  repositorySelectionMode?: string
  selectedRepositoryIds?: number[]
  manuallyAddedRepositories?: { id: number; name: string; full_name: string; private: boolean }[]
  repositoryModelOverrides?: RepositoryModelOverride[]
  disableReviewMd?: boolean
  skipBotPullRequests?: boolean
  reviewMemoryEnabled?: boolean
  council?: unknown
  councilEnabledRepositoryIds?: number[]
  actionRequired?: ReviewAgentActionRequired | null
  [key: string]: unknown
}

/** Per-repository model override entry (saveReviewConfig.repositoryModelOverrides). */
export interface RepositoryModelOverride {
  repositoryId: number
  repoFullName: string
  modelSlug: string
  thinkingEffort?: string | null
}

/** Filters accepted by codeReviews.listForUser / listForOrganization. */
export interface ListCodeReviewsOptions {
  limit?: number
  offset?: number
  status?: string
  repoFullName?: string
  platform?: string
}

/** Input for personalReviewAgent.saveReviewConfig / organizations.reviewAgent.saveReviewConfig. */
export interface SaveReviewConfigInput {
  platform: string
  reviewStyle: string
  focusAreas: string[]
  modelSlug: string
  customInstructions?: string
  thinkingEffort?: string | null
  repositorySelectionMode?: string
  selectedRepositoryIds?: number[]
  manuallyAddedRepositories?: { id: number; name: string; full_name: string; private: boolean }[]
  repositoryModelOverrides?: RepositoryModelOverride[]
  disableReviewMd?: boolean
  gateThreshold?: string
  autoConfigureWebhooks?: boolean
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
  totalCost: number
  totalRequestCount: number
  totalInputTokens: number
  totalOutputTokens: number
}

export interface CreditTransaction {
  id: string
  amount: number
  type: string
  description: string
  createdAt: string
}

export interface OrganizationSeats {
  totalSeats: number
  usedSeats: number
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
  /** When false the creator is not added as an owner — pass true so the org is usable. */
  autoAddCreator?: boolean
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
  description?: string
  isFree?: boolean
  contextLength?: number
}

// ============================================================================
// tRPC Types — Usage Analytics
// ============================================================================

export interface UsageAnalyticsSummary {
  costMicrodollars: number
  requestCount: number
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheHitTokens: number
  errorCount: number
  cancelledCount: number
  freeRequestCount: number
  byokRequestCount: number
  totalLatencyMs: number
  totalGenerationTimeMs: number
  latencyCount: number
  generationTimeCount: number
  totalTokens: number
  distinctUsers: number
  errorRate: number
  avgLatencyMs: number
  avgGenerationTimeMs: number
  costPerRequest: number
  tokensPerRequest: number
  cacheHitRatio: number
  outputInputRatio: number
  effectiveGranularity?: string
  [key: string]: unknown
}

export interface UsageAnalyticsTimeseriesPoint {
  datetime: string
  value: number
}

export interface UsageAnalyticsBreakdownEntry {
  key: string
  label: string
  value: number
  percentage: number
}

export interface UsageAnalyticsTableRow {
  datetime: string
  dimensions: Record<string, string>
  costMicrodollars: number
  requestCount: number
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheHitTokens: number
  errorCount: number
  [key: string]: unknown
}

export type UsageGranularity = 'hour' | 'day' | 'week' | 'month'

export type UsageMetric =
  | 'cost'
  | 'requests'
  | 'tokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'errorRate'
  | 'avgLatencyMs'
  | 'avgGenerationTimeMs'
  | 'costPerRequest'
  | 'tokensPerRequest'
  | 'cacheHitRatio'
  | 'outputInputRatio'

export type UsageDimension =
  | 'feature'
  | 'model'
  | 'mode'
  | 'user'
  | 'provider'
  | 'project'
  | 'organization'

/** All fields the usageAnalytics.* procedures require (server-side zod). */
export interface UsageAnalyticsFilters {
  /** ISO datetime, e.g. "2026-08-14T00:00:00Z" */
  startDate: string
  endDate: string
  granularity: UsageGranularity
  organizationId?: string
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
  isEligible: boolean
  balance: number
  minBalance: number
  accessLevel: string
}

// ============================================================================
// tRPC Types — Security Agent (personal + organization)
// ============================================================================

export interface SecurityAgentPermissionStatus {
  hasIntegration?: boolean
  hasPermissions?: boolean
  integrationId?: string | null
  reauthorizeUrl?: string | null
  authInvalidAt?: string | null
  authInvalidReason?: string | null
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
  repoFullName?: string | null
  repo_full_name?: string | null
  source?: string | null
  sourceId?: string | null
  source_id?: string | null
  severity: string
  title: string
  description?: string | null
  status: string
  packageName?: string | null
  package_name?: string | null
  packageEcosystem?: string | null
  package_ecosystem?: string | null
  vulnerableVersionRange?: string | null
  vulnerable_version_range?: string | null
  patchedVersion?: string | null
  patched_version?: string | null
  manifestPath?: string | null
  manifest_path?: string | null
  ghsaId?: string | null
  ghsa_id?: string | null
  cveId?: string | null
  cve_id?: string | null
  cvssScore?: number | string | null
  cvss_score?: number | string | null
  cweIds?: string[] | null
  cwe_ids?: string[] | null
  dependencyScope?: string | null
  dependency_scope?: string | null
  dependabotHtmlUrl?: string | null
  dependabot_html_url?: string | null
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
  remediationSummary?: string | RemediationSummary | null
  remediation_summary?: string | RemediationSummary | null
  remediationCapability?: RemediationCapability | null
  remediation_capability?: RemediationCapability | null
  firstDetectedAt?: string | null
  first_detected_at?: string | null
  lastSyncedAt?: string | null
  last_synced_at?: string | null
  createdAt?: string | null
  created_at?: string | null
  updatedAt?: string | null
  updated_at?: string | null
  [key: string]: unknown
}

export interface RemediationAttempt {
  id: string
  status?: string | null
  attemptNumber?: number | null
  branchName?: string | null
  prUrl?: string | null
  prNumber?: number | null
  failureCode?: string | null
  [key: string]: unknown
}

export interface RemediationSummary {
  id?: string
  status?: string | null
  latestAttemptId?: string | null
  prUrl?: string | null
  prNumber?: number | null
  outcomeSummary?: string | null
  latestAttempt?: RemediationAttempt | null
  [key: string]: unknown
}

export interface RemediationCapability {
  canStart?: boolean | null
  startReason?: string | null
  canRetry?: boolean | null
  retryReason?: string | null
  canCancel?: boolean | null
  cancelReason?: string | null
  cancelAttemptId?: string | null
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
  startedAt?: string | null
  started_at?: string | null
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
  startedAt?: string | null
  started_at?: string | null
  completedAt?: string | null
  completed_at?: string | null
  output?: string | null
  [key: string]: unknown
}

// ============================================================================
// Error Types
// ============================================================================

export type CloudTrpcErrorKind =
  | 'network'
  | 'http'
  | 'protocol'
  | 'procedure'
  | 'schema'
  | 'unauthorized'

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
