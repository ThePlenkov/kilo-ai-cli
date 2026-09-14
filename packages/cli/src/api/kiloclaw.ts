/**
 * KiloClaw tRPC procedures — managed instance system.
 * Source: Kilo-Org/cloud apps/web/src/routers/kiloclaw-router.ts
 *
 * Schemas verified against live api.kilo.ai responses (see scripts/probe.ts).
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type {
  KiloclawAgent,
  KiloclawBillingHistoryPage,
  KiloclawBillingStatus,
  KiloclawChangelogEntry,
  KiloclawFileTreeNode,
  KiloclawInstance,
  KiloclawKiloCliRun,
  KiloclawLatestVersion,
  KiloclawSubscriptionDetail,
  KiloclawSubscriptionsResult,
} from './types.ts'

// --- Schemas ---

const KiloclawInstanceSchema: z.ZodType<KiloclawInstance> = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  planName: z.string().optional(),
  imageTag: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const ChangelogEntrySchema: z.ZodType<KiloclawChangelogEntry> = z.object({
  date: z.string(),
  description: z.string(),
  category: z.string(),
  deployHint: z.string().nullable(),
})

const AgentSchema: z.ZodType<KiloclawAgent> = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  type: z.string().optional(),
})

const FileTreeNodeSchema: z.ZodType<KiloclawFileTreeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.union([z.literal('file'), z.literal('directory')]),
    children: z.array(FileTreeNodeSchema).optional(),
  }),
)

const BillingStatusSchema: z.ZodType<KiloclawBillingStatus> = z
  .object({
    hasAccess: z.boolean(),
    accessReason: z.string().nullish(),
    hasExistingPersonalSubscription: z.boolean().optional(),
    hasCurrentPersonalSubscription: z.boolean().optional(),
    commitPlanAvailable: z.boolean().optional(),
    trialEligible: z.boolean().optional(),
    creditBalanceMicrodollars: z.number().optional(),
    creditIntroEligible: z.boolean().optional(),
    hasActiveKiloPass: z.boolean().optional(),
    intendedPriceVersion: z.string().optional(),
    intendedSelfServiceInstanceType: z.string().optional(),
  })
  .passthrough() as z.ZodType<KiloclawBillingStatus>

const BillingHistoryPageSchema: z.ZodType<KiloclawBillingHistoryPage> = z.object({
  entries: z.array(z.record(z.string(), z.unknown())),
  hasMore: z.boolean(),
  cursor: z.string().nullable(),
})

const SubscriptionDetailSchema: z.ZodType<KiloclawSubscriptionDetail> = z
  .object({
    instanceId: z.string(),
    sandboxId: z.string().optional(),
    instanceName: z.string().optional(),
    plan: z.string(),
    status: z.string(),
    activationState: z.string().optional(),
    priceVersion: z.string().optional(),
    selfServiceInstanceType: z.string().optional(),
    cancelAtPeriodEnd: z.boolean(),
    currentPeriodStart: z.string().nullish(),
    currentPeriodEnd: z.string().nullish(),
    destroyedAt: z.string().nullish(),
    suspendedAt: z.string().nullish(),
    trialStartedAt: z.string().nullish(),
    trialEndsAt: z.string().nullish(),
  })
  .passthrough() as z.ZodType<KiloclawSubscriptionDetail>

const SubscriptionsResultSchema: z.ZodType<KiloclawSubscriptionsResult> = z.object({
  commitPlanAvailable: z.boolean(),
  subscriptions: z.array(SubscriptionDetailSchema),
})

const LatestVersionSchema: z.ZodType<KiloclawLatestVersion> = z.object({
  openclawVersion: z.string(),
  variant: z.string(),
  imageTag: z.string(),
  imageDigest: z.string().optional(),
  publishedAt: z.string().optional(),
  rolloutPercent: z.number().optional(),
  isLatest: z.boolean(),
})

const KiloCliRunSchema: z.ZodType<KiloclawKiloCliRun> = z.object({
  runId: z.string(),
  status: z.string(),
  prompt: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  output: z.string().optional(),
})

// --- Queries ---

/** kiloclaw.getChangelog */
export async function getChangelog(token: string): Promise<KiloclawChangelogEntry[]> {
  return trpcQuery('kiloclaw.getChangelog', token, z.array(ChangelogEntrySchema))
}

/** kiloclaw.serviceDegraded */
export async function getServiceDegraded(token: string): Promise<boolean> {
  return trpcQuery('kiloclaw.serviceDegraded', token, z.boolean())
}

/** kiloclaw.latestVersion */
export async function getLatestVersion(token: string, currentImageTag?: string): Promise<KiloclawLatestVersion> {
  return trpcQuery('kiloclaw.latestVersion', token, LatestVersionSchema, currentImageTag ? { currentImageTag } : undefined)
}

/** kiloclaw.listAllInstances */
export async function listAllInstances(token: string): Promise<KiloclawInstance[]> {
  return trpcQuery('kiloclaw.listAllInstances', token, z.array(KiloclawInstanceSchema))
}

/** kiloclaw.fileTree — requires an active KiloClaw subscription (server-side 4xx otherwise). */
export async function getFileTree(token: string, path?: string): Promise<KiloclawFileTreeNode[]> {
  return trpcQuery('kiloclaw.fileTree', token, z.array(FileTreeNodeSchema), path ? { path } : undefined)
}

/** kiloclaw.readFile */
export async function readFile(token: string, path: string): Promise<{ content: string; etag: string }> {
  return trpcQuery('kiloclaw.readFile', token, z.object({ content: z.string(), etag: z.string() }), { path })
}

/** kiloclaw.listAgents */
export async function listAgents(token: string): Promise<KiloclawAgent[]> {
  return trpcQuery('kiloclaw.listAgents', token, z.array(AgentSchema))
}

/** kiloclaw.getAgent */
export async function getAgent(token: string, agentId: string): Promise<KiloclawAgent> {
  return trpcQuery('kiloclaw.getAgent', token, AgentSchema, { agentId })
}

/** kiloclaw.getKiloCliRunStatus */
export async function getKiloCliRunStatus(token: string, runId: string): Promise<KiloclawKiloCliRun> {
  return trpcQuery('kiloclaw.getKiloCliRunStatus', token, KiloCliRunSchema, { runId })
}

/** kiloclaw.getBillingStatus */
export async function getBillingStatus(token: string): Promise<KiloclawBillingStatus> {
  return trpcQuery('kiloclaw.getBillingStatus', token, BillingStatusSchema)
}

/** kiloclaw.getActivePersonalBillingStatus */
export async function getActivePersonalBillingStatus(token: string): Promise<KiloclawBillingStatus> {
  return trpcQuery('kiloclaw.getActivePersonalBillingStatus', token, BillingStatusSchema)
}

/** kiloclaw.getPersonalBillingSummary */
export async function getPersonalBillingSummary(token: string): Promise<KiloclawBillingStatus> {
  return trpcQuery('kiloclaw.getPersonalBillingSummary', token, BillingStatusSchema)
}

/** kiloclaw.getReferralRewardSummary */
export async function getReferralRewardSummary(token: string): Promise<{ totalRewards: number; pendingRewards: number }> {
  return trpcQuery('kiloclaw.getReferralRewardSummary', token, z.object({ totalRewards: z.number(), pendingRewards: z.number() }))
}

/** kiloclaw.listPersonalSubscriptions */
export async function listPersonalSubscriptions(token: string): Promise<KiloclawSubscriptionsResult> {
  return trpcQuery('kiloclaw.listPersonalSubscriptions', token, SubscriptionsResultSchema)
}

/** kiloclaw.getSubscriptionDetail */
export async function getSubscriptionDetail(token: string, instanceId: string): Promise<KiloclawSubscriptionDetail> {
  return trpcQuery('kiloclaw.getSubscriptionDetail', token, SubscriptionDetailSchema, { instanceId })
}

/** kiloclaw.getBillingHistory — requires an instanceId; pass `cursor` from the previous page for pagination. */
export async function getBillingHistory(token: string, instanceId: string, period?: string, cursor?: string): Promise<KiloclawBillingHistoryPage> {
  return trpcQuery('kiloclaw.getBillingHistory', token, BillingHistoryPageSchema, { instanceId, period, cursor })
}

// --- Mutations ---

/** kiloclaw.startKiloCliRun */
export async function startKiloCliRun(token: string, prompt: string): Promise<{ runId: string }> {
  return trpcMutate('kiloclaw.startKiloCliRun', token, z.object({ runId: z.string() }), { prompt })
}

/** kiloclaw.cancelKiloCliRun */
export async function cancelKiloCliRun(token: string, runId: string): Promise<void> {
  await trpcMutate('kiloclaw.cancelKiloCliRun', token, z.unknown(), { runId })
}

/** kiloclaw.removeMyPin */
export async function removeMyPin(token: string): Promise<void> {
  await trpcMutate('kiloclaw.removeMyPin', token, z.unknown(), undefined)
}

/** kiloclaw.writeFile */
export async function writeFile(token: string, path: string, content: string, etag: string, openclawValidation?: 'warn-before-write' | 'allow-invalid'): Promise<{ etag: string }> {
  return trpcMutate('kiloclaw.writeFile', token, z.object({ etag: z.string() }), { path, content, etag, openclawValidation })
}

/** kiloclaw.cancelSubscriptionAtInstance */
export async function cancelSubscriptionAtInstance(token: string, instanceId: string): Promise<void> {
  await trpcMutate('kiloclaw.cancelSubscriptionAtInstance', token, z.unknown(), { instanceId })
}

/** kiloclaw.continueCommitAsStandard */
export async function continueCommitAsStandard(token: string, instanceId: string): Promise<void> {
  await trpcMutate('kiloclaw.continueCommitAsStandard', token, z.unknown(), { instanceId })
}

/** kiloclaw.acceptConversionAtInstance */
export async function acceptConversionAtInstance(token: string, instanceId: string): Promise<void> {
  await trpcMutate('kiloclaw.acceptConversionAtInstance', token, z.unknown(), { instanceId })
}

/** kiloclaw.reactivateSubscriptionAtInstance */
export async function reactivateSubscriptionAtInstance(token: string, instanceId: string): Promise<void> {
  await trpcMutate('kiloclaw.reactivateSubscriptionAtInstance', token, z.unknown(), { instanceId })
}

/** kiloclaw.switchPlanAtInstance */
export async function switchPlanAtInstance(token: string, instanceId: string, planId: string): Promise<void> {
  await trpcMutate('kiloclaw.switchPlanAtInstance', token, z.unknown(), { instanceId, planId })
}
