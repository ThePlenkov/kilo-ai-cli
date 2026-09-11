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
