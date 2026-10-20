/**
 * Account CLI command handlers — balance, devices, notifications, spend alerts.
 */

import { defineCommand } from 'citty'

import {
  getAutoTopUpPaymentMethod,
  getBalance,
  getContextBalance,
  getNotificationPreferences,
  getSpendAlertConfig,
  listDeviceSessions,
  revokeCurrentDeviceSession,
  revokeDeviceSession,
  setNotificationPreferences,
  updateAutoTopUpAmount,
} from '../api/account.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const accountBalanceCommand = defineCommand({
  meta: { name: 'balance', description: 'Show the credit balance and context budget' },
  async run() {
    const { token } = await getToken()
    const balance = await getBalance(token)
    const context = await getContextBalance(token)
    console.log(`  balance: $${balance.toFixed(4)}`)
    console.log(`  context: ${context.balance.toFixed(4)}`)
    console.log(`  depleted: ${context.isDepleted ? 'yes' : 'no'}`)
  },
})

export const accountDevicesCommand = defineCommand({
  meta: { name: 'devices', description: 'List active device sessions' },
  async run() {
    const { token } = await getToken()
    const devices = await listDeviceSessions(token)
    if (devices.length === 0) {
      console.log('No device sessions.')
      return
    }
    printTable(
      devices.map((d) => ({
        id: d.id,
        agent: d.user_agent ?? d.userAgent ?? '-',
        lastSeen: d.last_seen_at ?? d.lastUsedAt ?? '-',
        current: d.isCurrent ? 'yes' : 'no',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'agent', label: 'User agent', width: 44 },
        { key: 'lastSeen', label: 'Last seen', width: 24 },
        { key: 'current', label: 'Current', width: 8 },
      ],
    )
  },
})

export const accountRevokeDeviceCommand = defineCommand({
  meta: { name: 'revoke-device', description: 'Revoke one device session' },
  args: { id: { type: 'positional', description: 'Device session ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await revokeDeviceSession(token, args.id)
    console.log(`Revoked device session ${args.id}`)
  },
})

export const accountRevokeCurrentCommand = defineCommand({
  meta: { name: 'revoke-current', description: 'Revoke the current device session' },
  async run() {
    const { token } = await getToken()
    await revokeCurrentDeviceSession(token)
    console.log('Revoked the current device session.')
  },
})

export const accountNotificationsCommand = defineCommand({
  meta: { name: 'notifications', description: 'Show notification preferences' },
  async run() {
    const { token } = await getToken()
    const prefs = await getNotificationPreferences(token)
    for (const [key, value] of Object.entries(prefs)) {
      if (key === 'capabilities') continue
      console.log(`  ${key}: ${String(value)}`)
    }
  },
})

export const accountSetNotificationsCommand = defineCommand({
  meta: { name: 'set-notifications', description: 'Change notification preferences' },
  args: {
    'chat-messages': { type: 'boolean', description: 'Chat message notifications' },
    'agent-attention': { type: 'boolean', description: 'Agent needs attention' },
    'session-status': { type: 'boolean', description: 'Session status changes' },
    'balance-alerts': { type: 'boolean', description: 'Low balance alerts' },
    'spend-alerts': { type: 'boolean', description: 'Spend alerts' },
    'security-findings': { type: 'boolean', description: 'Security findings' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const changes: Record<string, boolean> = {}
    if (args['chat-messages'] !== undefined) changes.chatMessages = args['chat-messages']
    if (args['agent-attention'] !== undefined) changes.agentAttention = args['agent-attention']
    if (args['session-status'] !== undefined) changes.sessionStatus = args['session-status']
    if (args['balance-alerts'] !== undefined) changes.balanceAlerts = args['balance-alerts']
    if (args['spend-alerts'] !== undefined) changes.spendAlerts = args['spend-alerts']
    if (args['security-findings'] !== undefined)
      changes.securityFindings = args['security-findings']
    if (Object.keys(changes).length === 0) {
      throw new Error('Provide at least one preference to change.')
    }
    await setNotificationPreferences(token, changes)
    console.log(`Updated ${Object.keys(changes).length} notification preference(s).`)
  },
})

export const accountSpendAlertsCommand = defineCommand({
  meta: { name: 'spend-alerts', description: 'Show the spend alert configuration' },
  args: { org: { type: 'string', description: 'Organization ID' } },
  async run({ args }) {
    const { token } = await getToken()
    const config = await getSpendAlertConfig(token, args.org)
    console.log(`  scope: ${config.scope}`)
    console.log(`  enabled: ${config.enabled ? 'yes' : 'no'}`)
    for (const rule of config.rules) {
      console.log(
        `  - ${rule.kind}: ${rule.enabled ? 'enabled' : 'disabled'}` +
          (rule.threshold != null ? ` threshold=${rule.threshold}` : ''),
      )
    }
  },
})

export const accountTopUpCommand = defineCommand({
  meta: { name: 'top-up', description: 'Show the auto top-up configuration' },
  args: {
    amount: { type: 'string', description: 'Set the auto top-up amount (in cents)' },
  },
  async run({ args }) {
    const { token } = await getToken()
    if (args.amount) {
      // Strict parsing: `parseInt` would accept "125oops" and truncate "1.9".
      const amountCents = Number(args.amount)
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new Error('Amount must be a positive whole number of cents.')
      }
      await updateAutoTopUpAmount(token, amountCents)
      console.log(`Auto top-up amount set to ${amountCents} cents.`)
      return
    }
    const config = await getAutoTopUpPaymentMethod(token)
    for (const [key, value] of Object.entries(config)) {
      console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    }
  },
})
