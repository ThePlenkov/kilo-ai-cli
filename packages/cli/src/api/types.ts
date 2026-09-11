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
// tRPC Types — Security Agent
// ============================================================================

export interface SecurityAgentPermissionStatus {
  granted: boolean
  permissions: string[]
  pendingRequests: number
}

// ============================================================================
// Error Types
// ============================================================================

export type CloudTrpcErrorKind = 'network' | 'http' | 'protocol' | 'procedure' | 'schema'

export class CloudTrpcError extends Error {
  readonly kind: CloudTrpcErrorKind
  readonly status?: number
  constructor(kind: CloudTrpcErrorKind, status?: number) {
    super('Kilo Cloud data is temporarily unavailable.')
    this.name = 'CloudTrpcError'
    this.kind = kind
    this.status = status
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
