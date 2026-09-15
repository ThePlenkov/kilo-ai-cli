/**
 * REST API calls for profile, balance, and defaults.
 * Mirrors @kilocode/kilo-gateway/src/api/profile.ts
 */

import {
  DEFAULT_FREE_MODEL,
  DEFAULT_MODEL,
  HEADER_ORGANIZATIONID,
  KILO_API_BASE,
} from './constants.ts'
import type { KilocodeBalance, KilocodeProfile, Organization } from './types.ts'

/** Request timeout for REST profile calls. */
const REQUEST_TIMEOUT_MS = 5000

/** Parse the raw profile response shape returned by GET /api/profile. */
function parseProfile(data: {
  user?: { email?: string; name?: string }
  email?: string
  name?: string
  organizations?: Organization[]
  selectedOrganizationId?: string
  hasPersonalAccount?: boolean
}): KilocodeProfile {
  return {
    email: data.email ?? data.user?.email ?? '',
    name: data.name ?? data.user?.name,
    organizations: data.organizations,
    selectedOrganizationId: data.selectedOrganizationId,
    hasPersonalAccount: data.hasPersonalAccount,
  }
}

/** Fetch user profile from GET /api/profile. */
export async function fetchProfile(token: string, baseUrl?: string): Promise<KilocodeProfile> {
  const url = `${baseUrl ?? KILO_API_BASE}/api/profile`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.status}`)
  }
  const data = (await response.json()) as Parameters<typeof parseProfile>[0]
  return parseProfile(data)
}

/** Fetch balance from GET /api/profile/balance. Returns null on error. */
export async function fetchBalance(
  token: string,
  organizationId?: string,
  baseUrl?: string,
): Promise<KilocodeBalance | null> {
  const url = `${baseUrl ?? KILO_API_BASE}/api/profile/balance`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }
  if (organizationId) {
    headers[HEADER_ORGANIZATIONID] = organizationId
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const data = (await response.json()) as { balance?: number }
    return { balance: data.balance ?? 0 }
  } catch {
    return null
  }
}

/** Fetch profile and balance in parallel. `organizationId` overrides the profile-derived scope. */
export async function fetchProfileWithBalance(
  token: string,
  organizationId?: string,
  baseUrl?: string,
): Promise<{ profile: KilocodeProfile; balance: KilocodeBalance | null }> {
  const profile = await fetchProfile(token, baseUrl)
  const balance = await fetchBalance(
    token,
    organizationId ?? defaultOrganizationId(profile),
    baseUrl,
  )
  return { profile, balance }
}

/** Fetch default model from GET /api/defaults or GET /api/organizations/{id}/defaults. */
export async function fetchDefaultModel(
  token?: string,
  organizationId?: string,
  baseUrl?: string,
): Promise<string> {
  const base = baseUrl ?? KILO_API_BASE
  const url = organizationId
    ? `${base}/api/organizations/${organizationId}/defaults`
    : `${base}/api/defaults`

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      return token ? DEFAULT_MODEL : DEFAULT_FREE_MODEL
    }
    const data = (await response.json()) as { defaultModel?: string; defaultFreeModel?: string }
    if (token) {
      return data.defaultModel || DEFAULT_MODEL
    }
    return data.defaultFreeModel || DEFAULT_FREE_MODEL
  } catch {
    return token ? DEFAULT_MODEL : DEFAULT_FREE_MODEL
  }
}

/** Get the default organization ID from a profile. */
export function defaultOrganizationId(profile: KilocodeProfile): string | undefined {
  const orgs = profile.organizations ?? []
  if (profile.selectedOrganizationId && orgs.some((o) => o.id === profile.selectedOrganizationId)) {
    return profile.selectedOrganizationId
  }
  if (profile.hasPersonalAccount === false && orgs.length > 0) {
    return orgs[0]!.id
  }
  return undefined
}
