/**
 * Organizations tRPC procedures (extended).
 * Source: Kilo-Org/cloud apps/web/src/routers/organizations/organization-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import { OrganizationSchema } from './trpc.ts'
import type {
  AvailableModel,
  CreditTransaction,
  Organization,
  OrganizationCreateInput,
  OrganizationInvoice,
  OrganizationSeats,
  OrganizationUpdateInput,
  OrganizationUsageStats,
  OrganizationWithMembers,
  SecurityAgentPermissionStatus,
} from './types.ts'

// --- Schemas ---

const OrganizationMemberSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().optional(),
  role: z.string(),
})

const OrganizationWithMembersSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    callerRole: z.string(),
    members: z.array(OrganizationMemberSchema),
  })
  .transform(
    (o): OrganizationWithMembers => ({
      id: o.id,
      name: o.name,
      role: o.callerRole,
      members: o.members,
    }),
  )

const UsageStatsSchema: z.ZodType<OrganizationUsageStats> = z.object({
  totalCost: z.number(),
  totalRequestCount: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
})

const CreditTransactionSchema: z.ZodType<CreditTransaction> = z.object({
  id: z.string(),
  amount: z.number(),
  type: z.string(),
  description: z.string(),
  createdAt: z.string(),
})

const SeatsSchema: z.ZodType<OrganizationSeats> = z.object({
  totalSeats: z.number(),
  usedSeats: z.number(),
})

const InvoiceSchema: z.ZodType<OrganizationInvoice> = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number(),
  status: z.string(),
  url: z.string().optional(),
})

/** Response is `{ data: [...] }` — item field names come from the OpenRouter-style catalog. */
const AvailableModelsSchema = z
  .object({
    data: z.array(
      z.looseObject({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        isFree: z.boolean().optional(),
        context_length: z.number().nullish(),
      }),
    ),
  })
  .transform((r): AvailableModel[] =>
    r.data.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      isFree: m.isFree,
      contextLength: m.context_length ?? undefined,
    })),
  )

const SecurityAgentPermissionStatusSchema: z.ZodType<SecurityAgentPermissionStatus> = z.object({
  hasIntegration: z.boolean().optional(),
  hasPermissions: z.boolean().optional(),
  integrationId: z.string().nullish(),
  reauthorizeUrl: z.string().nullish(),
  authInvalidAt: z.string().nullish(),
  authInvalidReason: z.string().nullish(),
})

// --- Top-level queries ---

/** organizations.list returns UserOrganizationWithSeats — map to the flat Organization shape. */
const UserOrganizationSchema = z
  .object({
    organizationId: z.string(),
    organizationName: z.string(),
    role: z.string(),
  })
  .transform(
    (o): Organization => ({ id: o.organizationId, name: o.organizationName, role: o.role }),
  )

/** organizations.list */
export async function listOrganizations(token: string): Promise<Organization[]> {
  return trpcQuery('organizations.list', token, z.array(UserOrganizationSchema))
}

/** organizations.withMembers */
export async function getOrganizationWithMembers(
  token: string,
  organizationId: string,
): Promise<OrganizationWithMembers> {
  return trpcQuery('organizations.withMembers', token, OrganizationWithMembersSchema, {
    organizationId,
  })
}

/** organizations.childOrganizations */
export async function listChildOrganizations(
  token: string,
  organizationId: string,
): Promise<Organization[]> {
  return trpcQuery('organizations.childOrganizations', token, z.array(OrganizationSchema), {
    organizationId,
  })
}

/** organizations.usageStats */
export async function getOrganizationUsageStats(
  token: string,
  organizationId: string,
): Promise<OrganizationUsageStats> {
  return trpcQuery('organizations.usageStats', token, UsageStatsSchema, { organizationId })
}

/** organizations.creditTransactions */
export async function getCreditTransactions(
  token: string,
  organizationId: string,
): Promise<CreditTransaction[]> {
  return trpcQuery('organizations.creditTransactions', token, z.array(CreditTransactionSchema), {
    organizationId,
  })
}

/** organizations.getCreditBlocks */
export async function getCreditBlocks(token: string, organizationId: string): Promise<unknown[]> {
  return trpcQuery('organizations.getCreditBlocks', token, z.array(z.unknown()), { organizationId })
}

/** organizations.seats */
export async function getOrganizationSeats(
  token: string,
  organizationId: string,
): Promise<OrganizationSeats> {
  return trpcQuery('organizations.seats', token, SeatsSchema, { organizationId })
}

/** organizations.seatPurchases */
export async function getSeatPurchases(token: string, organizationId: string): Promise<unknown[]> {
  return trpcQuery('organizations.seatPurchases', token, z.array(z.unknown()), { organizationId })
}

/** organizations.invoices */
export async function getOrganizationInvoices(
  token: string,
  organizationId: string,
  period?: string,
): Promise<OrganizationInvoice[]> {
  return trpcQuery('organizations.invoices', token, z.array(InvoiceSchema), {
    organizationId,
    period,
  })
}

// --- Top-level mutations ---

/** create/update return `{ organization: {...} }` — unwrap to the flat Organization shape. */
const MutatedOrganizationSchema = z.object({
  organization: z.looseObject({
    id: z.string(),
    name: z.string(),
    role: z.string().optional(),
  }),
})

const CreatedOrganizationSchema = MutatedOrganizationSchema.transform(
  (r): Organization => ({
    id: r.organization.id,
    name: r.organization.name,
    role: r.organization.role ?? 'unknown',
  }),
)

const UpdatedOrganizationSchema = MutatedOrganizationSchema.transform(
  (r): Organization => ({
    id: r.organization.id,
    name: r.organization.name,
    // The update response doesn't carry the caller's role — don't claim 'owner'.
    role: r.organization.role ?? 'unknown',
  }),
)

/** organizations.create */
export async function createOrganization(
  token: string,
  input: OrganizationCreateInput,
): Promise<Organization> {
  const org = await trpcMutate('organizations.create', token, CreatedOrganizationSchema, input)
  // With autoAddCreator the caller becomes the owner — a safe default.
  return input.autoAddCreator && org.role === 'unknown' ? { ...org, role: 'owner' } : org
}

/** organizations.update */
export async function updateOrganization(
  token: string,
  input: OrganizationUpdateInput,
): Promise<Organization> {
  return trpcMutate('organizations.update', token, UpdatedOrganizationSchema, input)
}

/** organizations.updateCompanyDomain */
export async function updateCompanyDomain(
  token: string,
  organizationId: string,
  companyDomain: string | null,
): Promise<void> {
  await trpcMutate('organizations.updateCompanyDomain', token, z.unknown(), {
    organizationId,
    company_domain: companyDomain,
  })
}

// --- Organization settings sub-router ---

/** organizations.settings.listAvailableModels */
export async function listAvailableModels(
  token: string,
  organizationId: string,
): Promise<AvailableModel[]> {
  return trpcQuery('organizations.settings.listAvailableModels', token, AvailableModelsSchema, {
    organizationId,
  })
}

/** organizations.settings.updateAllowLists */
export async function updateAllowLists(
  token: string,
  input: Record<string, unknown>,
): Promise<void> {
  await trpcMutate('organizations.settings.updateAllowLists', token, z.unknown(), input)
}

/** organizations.settings.updateMinimumBalanceAlert */
export async function updateMinimumBalanceAlert(
  token: string,
  input: Record<string, unknown>,
): Promise<void> {
  await trpcMutate('organizations.settings.updateMinimumBalanceAlert', token, z.unknown(), input)
}

// --- Organization security agent sub-router ---

/** organizations.securityAgent.getPermissionStatus */
export async function getSecurityAgentPermissionStatus(
  token: string,
  organizationId: string,
): Promise<SecurityAgentPermissionStatus> {
  return trpcQuery(
    'organizations.securityAgent.getPermissionStatus',
    token,
    SecurityAgentPermissionStatusSchema,
    { organizationId },
  )
}

/** organizations.securityAgent.trackUiInteraction */
export async function trackSecurityAgentUiInteraction(
  token: string,
  input: Record<string, unknown>,
): Promise<void> {
  await trpcMutate('organizations.securityAgent.trackUiInteraction', token, z.unknown(), input)
}

// --- Organization cloud agent next sub-router ---

/** organizations.cloudAgentNext.prepareSession */
export async function prepareOrgCloudAgentSession(
  token: string,
  input: Record<string, unknown>,
): Promise<{ preparedSessionId: string }> {
  return trpcMutate(
    'organizations.cloudAgentNext.prepareSession',
    token,
    z.object({ preparedSessionId: z.string() }),
    input,
  )
}

/** organizations.cloudAgentNext.listBitbucketRepositories */
export async function listBitbucketRepositories(
  token: string,
  input: Record<string, unknown>,
): Promise<{ id: string; name: string; url: string }[]> {
  return trpcQuery(
    'organizations.cloudAgentNext.listBitbucketRepositories',
    token,
    z.array(z.object({ id: z.string(), name: z.string(), url: z.string() })),
    input,
  )
}
