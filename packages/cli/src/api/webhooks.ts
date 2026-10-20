/**
 * Webhook triggers — inbound webhooks and cron schedules that start agents.
 * Source: Kilo-Org/cloud apps/web/src/routers/webhook-triggers-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { WebhookTrigger } from './types.ts'

const WebhookTriggerSchema: z.ZodType<WebhookTrigger> = z
  .object({
    id: z.string(),
    triggerId: z.string().optional(),
    name: z.string().nullish(),
    targetType: z.string().optional(),
    activationMode: z.string().optional(),
    githubRepo: z.string().nullish(),
    promptTemplate: z.string().optional(),
    enabled: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough() as z.ZodType<WebhookTrigger>

/** webhookTriggers.list */
export async function listWebhookTriggers(
  token: string,
  options: {
    organizationId?: string
    targetType?: 'cloud_agent' | 'kiloclaw_chat'
    activationMode?: 'webhook' | 'scheduled'
  } = {},
): Promise<WebhookTrigger[]> {
  return trpcQuery('webhookTriggers.list', token, z.array(WebhookTriggerSchema), options)
}

/** webhookTriggers.get */
export async function getWebhookTrigger(
  token: string,
  id: string,
  organizationId?: string,
): Promise<WebhookTrigger> {
  return trpcQuery('webhookTriggers.get', token, WebhookTriggerSchema, { id, organizationId })
}

/** webhookTriggers.capabilities — what the account may configure. */
export async function getWebhookCapabilities(
  token: string,
  organizationId?: string,
): Promise<Record<string, unknown>> {
  return trpcQuery('webhookTriggers.capabilities', token, z.record(z.string(), z.unknown()), {
    organizationId,
  })
}

/** webhookTriggers.create */
export async function createWebhookTrigger(
  token: string,
  input: {
    triggerId: string
    organizationId?: string
    targetType?: 'cloud_agent' | 'kiloclaw_chat'
    githubRepo?: string
    mode?: 'architect' | 'code' | 'ask' | 'debug' | 'orchestrator'
    model?: string
    variant?: string
    profileId?: string
    promptTemplate: string
    autoCommit?: boolean
    webhookAuth?: { header: string; secret: string }
    activationMode?: 'webhook' | 'scheduled'
    cronExpression?: string
    cronTimezone?: string
  },
): Promise<WebhookTrigger> {
  return trpcMutate('webhookTriggers.create', token, WebhookTriggerSchema, input)
}

/** webhookTriggers.update */
export async function updateWebhookTrigger(
  token: string,
  input: {
    id: string
    organizationId?: string
    promptTemplate?: string
    enabled?: boolean
    model?: string
    mode?: string
    autoCommit?: boolean
    cronExpression?: string
  },
): Promise<WebhookTrigger> {
  return trpcMutate('webhookTriggers.update', token, WebhookTriggerSchema, input)
}

/** webhookTriggers.invoke — fire a trigger manually. */
export async function invokeWebhookTrigger(
  token: string,
  input: { id: string; organizationId?: string; payload?: Record<string, unknown> },
): Promise<unknown> {
  return trpcMutate('webhookTriggers.invoke', token, z.unknown(), input)
}

/** webhookTriggers.delete */
export async function deleteWebhookTrigger(
  token: string,
  id: string,
  organizationId?: string,
): Promise<void> {
  await trpcMutate('webhookTriggers.delete', token, z.unknown(), { id, organizationId })
}

/** webhookTriggers.listRequests — recent deliveries. */
export async function listWebhookRequests(
  token: string,
  input: { id: string; organizationId?: string; limit?: number; cursor?: string },
): Promise<Record<string, unknown>[]> {
  const result = await trpcQuery(
    'webhookTriggers.listRequests',
    token,
    z.object({ requests: z.array(z.record(z.string(), z.unknown())) }),
    input,
  )
  return result.requests
}
