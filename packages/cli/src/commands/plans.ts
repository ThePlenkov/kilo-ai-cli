/**
 * Coding plan and BYOK CLI command handlers.
 */

import { defineCommand } from 'citty'

import { fetchByokEntries, fetchCodingPlanSubscriptions, fetchCodingPlanUsage } from '../api/trpc.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const plansListCommand = defineCommand({
  meta: { name: 'list', description: 'List coding plan subscriptions' },
  async run() {
    const { token, organizationId } = await getToken()
    const subs = await fetchCodingPlanSubscriptions(token, organizationId)
    if (subs.length === 0) {
      console.log('No coding plan subscriptions found.')
      return
    }
    printTable(
      subs.map((s) => ({
        id: s.id,
        plan: s.planName,
        provider: s.providerName,
        status: s.status,
        cancel: s.cancelAtPeriodEnd ? 'yes' : 'no',
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'plan', label: 'Plan', width: 20 },
        { key: 'provider', label: 'Provider', width: 14 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'cancel', label: 'Cancel at EOP', width: 14 },
      ],
    )
  },
})

export const plansUsageCommand = defineCommand({
  meta: { name: 'usage', description: 'Show usage for a coding plan subscription' },
  args: {
    id: { type: 'positional', description: 'Subscription ID', required: true },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const usage = await fetchCodingPlanUsage(token, args.id, organizationId)
    console.log(`Plan: ${usage.subscription.planName}`)
    console.log(`Provider: ${usage.subscription.providerName}`)
    console.log(`Fetched at: ${usage.fetchedAt}`)
    console.log('\nQuota windows:')
    printTable(
      usage.subscription.windows.map((w) => ({
        id: w.id,
        remaining: w.remainingPercent.toFixed(1),
        resets: w.resetsAt,
        period: `${w.period.value} ${w.period.unit}(s)`,
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'remaining', label: 'Remaining %', width: 12, align: 'right' },
        { key: 'resets', label: 'Resets at', width: 24 },
        { key: 'period', label: 'Period', width: 16 },
      ],
    )
  },
})

export const byokListCommand = defineCommand({
  meta: { name: 'list', description: 'List BYOK (bring your own key) entries' },
  async run() {
    const { token, organizationId } = await getToken()
    const entries = await fetchByokEntries(token, organizationId)
    if (entries.length === 0) {
      console.log('No BYOK entries found.')
      return
    }
    printTable(
      entries.map((e) => ({
        id: e.id,
        provider: e.provider_id,
        source: e.management_source,
        enabled: e.is_enabled ? 'yes' : 'no',
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'provider', label: 'Provider ID', width: 14 },
        { key: 'source', label: 'Source', width: 16 },
        { key: 'enabled', label: 'Enabled', width: 8 },
      ],
    )
  },
})
