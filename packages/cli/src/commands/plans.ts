/**
 * Coding plan and BYOK CLI command handlers.
 */

import { defineCommand } from 'citty'

import { fetchByokEntries, fetchCodingPlanSubscriptions, fetchCodingPlanUsage } from '../api/trpc.ts'
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
    console.table(
      subs.map((s) => ({
        ID: s.id,
        Plan: s.planName,
        Provider: s.providerName,
        Status: s.status,
        'Cancel at period end': s.cancelAtPeriodEnd ? 'yes' : 'no',
      })),
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
    console.table(
      usage.subscription.windows.map((w) => ({
        ID: w.id,
        'Remaining %': w.remainingPercent.toFixed(1),
        'Resets at': w.resetsAt,
        Period: `${w.period.value} ${w.period.unit}(s)`,
      })),
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
    console.table(
      entries.map((e) => ({
        ID: e.id,
        'Provider ID': e.provider_id,
        Source: e.management_source,
        Enabled: e.is_enabled ? 'yes' : 'no',
      })),
    )
  },
})
