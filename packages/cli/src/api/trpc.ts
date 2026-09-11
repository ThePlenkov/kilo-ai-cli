/**
 * tRPC procedure wrappers built on top of `trpcQuery` / `trpcMutate`.
 * Mirrors @kilocode/kilo-gateway/src/api/trpc.ts procedure calls.
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type {
  ByokEntry,
  CliSession,
  CloudSessionsInput,
  CloudSessionsResult,
  CodingPlanSubscription,
  CodingPlanUsage,
  Organization,
} from './types.ts'

// ---------------------------------------------------------------------------
// Zod schemas mirroring the types in ./types.ts
// ---------------------------------------------------------------------------

export const OrganizationSchema: z.ZodType<Organization> = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
})

export const CodingPlanSubscriptionSchema: z.ZodType<CodingPlanSubscription> = z.object({
  id: z.string(),
  planId: z.string(),
  planName: z.string(),
  providerName: z.string(),
  providerId: z.string(),
  canQueryUsage: z.boolean(),
  hasInstalledByokKey: z.boolean(),
  status: z.union([z.literal('active'), z.literal('past_due'), z.literal('canceled')]),
  cancelAtPeriodEnd: z.boolean(),
})

export const CodingPlanQuotaWindowSchema = z.object({
  id: z.string(),
  remainingPercent: z.number(),
  resetsAt: z.string(),
  startsAt: z.string().optional(),
  period: z.object({
    unit: z.union([z.literal('hour'), z.literal('day'), z.literal('week'), z.literal('month')]),
    value: z.number(),
  }),
})

export const CodingPlanUsageSchema: z.ZodType<CodingPlanUsage> = z.object({
  schemaVersion: z.literal(1),
  fetchedAt: z.string(),
  subscription: z.object({
    id: z.string(),
    planName: z.string(),
    providerId: z.string(),
    providerName: z.string(),
    windows: z.array(CodingPlanQuotaWindowSchema),
  }),
})

export const ByokEntrySchema: z.ZodType<ByokEntry> = z.object({
  id: z.string(),
  provider_id: z.string(),
  management_source: z.union([z.literal('user'), z.literal('coding_plan')]),
  is_enabled: z.boolean(),
})

export const CliSessionSchema: z.ZodType<CliSession> = z.object({
  session_id: z.string(),
  title: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number(),
})

export const CloudSessionsResultSchema: z.ZodType<CloudSessionsResult> = z.object({
  cliSessions: z.array(CliSessionSchema),
  nextCursor: z.string().nullable(),
})

// ---------------------------------------------------------------------------
// Procedure wrappers
// ---------------------------------------------------------------------------

/** List coding plan subscriptions via tRPC: codingPlans.listSubscriptions */
export async function fetchCodingPlanSubscriptions(
  token: string,
  organizationId?: string,
): Promise<CodingPlanSubscription[]> {
  return trpcQuery(
    'codingPlans.listSubscriptions',
    token,
    z.array(CodingPlanSubscriptionSchema),
    undefined,
    { organizationId },
  )
}

/** Get coding plan usage via tRPC: codingPlans.getUsage */
export async function fetchCodingPlanUsage(
  token: string,
  subscriptionId: string,
  organizationId?: string,
): Promise<CodingPlanUsage> {
  return trpcQuery('codingPlans.getUsage', token, CodingPlanUsageSchema, { subscriptionId }, {
    organizationId,
  })
}

/** List BYOK entries via tRPC: byok.list */
export async function fetchByokEntries(
  token: string,
  organizationId?: string,
): Promise<ByokEntry[]> {
  return trpcQuery('byok.list', token, z.array(ByokEntrySchema), {}, { organizationId })
}

/** List CLI sessions via tRPC: cliSessionsV2.list */
export async function fetchCloudSessions(
  token: string,
  input: CloudSessionsInput,
  organizationId?: string,
): Promise<CloudSessionsResult> {
  return trpcQuery('cliSessionsV2.list', token, CloudSessionsResultSchema, input, {
    organizationId,
  })
}

/** Get a single CLI session via tRPC: cliSessionsV2.get */
export async function fetchCloudSession(
  token: string,
  sessionId: string,
  organizationId?: string,
): Promise<CliSession> {
  return trpcQuery('cliSessionsV2.get', token, CliSessionSchema, { session_id: sessionId }, {
    organizationId,
  })
}

/** Rename a CLI session via tRPC mutation: cliSessionsV2.rename */
export async function renameCloudSession(
  token: string,
  sessionId: string,
  title: string,
  organizationId?: string,
): Promise<void> {
  await trpcMutate(
    'cliSessionsV2.rename',
    token,
    z.unknown(),
    { session_id: sessionId, title },
    { organizationId },
  )
}

/** List organizations via tRPC: organizations.list */
export async function fetchOrganizations(token: string): Promise<Organization[]> {
  return trpcQuery('organizations.list', token, z.array(OrganizationSchema))
}
