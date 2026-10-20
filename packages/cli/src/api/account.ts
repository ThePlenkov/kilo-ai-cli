/**
 * Account-level procedures: balance, context budget, device sessions,
 * notification preferences and spend alerts.
 * Source: Kilo-Org/cloud apps/web/src/routers/{user,spend-alert}-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { ContextBalance, DeviceSession, SpendAlertConfig, SpendAlertRule } from './types.ts'

const ContextBalanceSchema: z.ZodType<ContextBalance> = z
  .object({
    balance: z.number(),
    isDepleted: z.boolean(),
  })
  .passthrough() as z.ZodType<ContextBalance>

const DeviceSessionSchema: z.ZodType<DeviceSession> = z
  .object({
    id: z.string(),
    user_agent: z.string().nullish(),
    created_at: z.string().optional(),
    last_seen_at: z.string().optional(),
    isCurrent: z.boolean().optional(),
  })
  .passthrough() as z.ZodType<DeviceSession>

const SpendAlertRuleSchema: z.ZodType<SpendAlertRule> = z
  .object({
    kind: z.string(),
    enabled: z.boolean(),
    threshold: z.number().nullish(),
    windowHours: z.number().nullish(),
    multiplierBasisPoints: z.number().nullish(),
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    firing: z.boolean().optional(),
  })
  .passthrough() as z.ZodType<SpendAlertRule>

const SpendAlertSchema: z.ZodType<SpendAlertConfig> = z
  .object({
    scope: z.string(),
    scopeName: z.string().optional(),
    canManage: z.boolean().optional(),
    enabled: z.boolean(),
    rules: z.array(SpendAlertRuleSchema),
  })
  .passthrough() as z.ZodType<SpendAlertConfig>

/** user.getBalance — credit balance in USD. */
export async function getBalance(token: string): Promise<number> {
  const result = await trpcQuery('user.getBalance', token, z.looseObject({ balance: z.number() }))
  return result.balance
}

/** user.getContextBalance — the session context budget. */
export async function getContextBalance(
  token: string,
  organizationId?: string,
): Promise<ContextBalance> {
  return trpcQuery('user.getContextBalance', token, ContextBalanceSchema, { organizationId })
}

/** user.listDeviceSessions — active device sessions (not revoked). */
export async function listDeviceSessions(token: string): Promise<DeviceSession[]> {
  return trpcQuery('user.listDeviceSessions', token, z.array(DeviceSessionSchema))
}

/** user.revokeDeviceSessionById */
export async function revokeDeviceSession(token: string, sessionId: string): Promise<void> {
  await trpcMutate('user.revokeDeviceSessionById', token, z.unknown(), { sessionId })
}

/** user.revokeCurrentDeviceSession */
export async function revokeCurrentDeviceSession(token: string): Promise<void> {
  await trpcMutate('user.revokeCurrentDeviceSession', token, z.unknown(), {})
}

/** user.getNotificationPreferences */
export async function getNotificationPreferences(token: string): Promise<Record<string, unknown>> {
  return trpcQuery('user.getNotificationPreferences', token, z.record(z.string(), z.unknown()))
}

/** user.setNotificationPreferences */
export async function setNotificationPreferences(
  token: string,
  preferences: Record<string, boolean | string>,
): Promise<void> {
  await trpcMutate('user.setNotificationPreferences', token, z.unknown(), preferences)
}

/** user.getAutocompleteMetrics — accept-rate stats for the account. */
export async function getAutocompleteMetrics(
  token: string,
  viewType: 'personal' | 'all' | string = 'personal',
  period: string = '30d',
): Promise<Record<string, unknown>> {
  return trpcQuery('user.getAutocompleteMetrics', token, z.record(z.string(), z.unknown()), {
    viewType,
    period,
  })
}

/** user.getAutoTopUpPaymentMethod */
export async function getAutoTopUpPaymentMethod(token: string): Promise<Record<string, unknown>> {
  return trpcQuery('user.getAutoTopUpPaymentMethod', token, z.record(z.string(), z.unknown()))
}

/** user.updateAutoTopUpAmount */
export async function updateAutoTopUpAmount(token: string, amountCents: number): Promise<void> {
  await trpcMutate('user.updateAutoTopUpAmount', token, z.unknown(), { amountCents })
}

/** spendAlerts.get */
export async function getSpendAlertConfig(
  token: string,
  organizationId?: string,
): Promise<SpendAlertConfig> {
  return trpcQuery('spendAlerts.get', token, SpendAlertSchema, { organizationId })
}

/** spendAlerts.save */
export async function saveSpendAlertConfig(
  token: string,
  input: {
    organizationId?: string
    enabled?: boolean
    rules?: { kind: string; enabled: boolean; threshold?: number | null }[]
  },
): Promise<SpendAlertConfig> {
  return trpcMutate('spendAlerts.save', token, SpendAlertSchema, input)
}
