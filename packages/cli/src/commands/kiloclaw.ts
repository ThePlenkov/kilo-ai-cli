/**
 * KiloClaw CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  getBillingHistory,
  getBillingStatus,
  getChangelog,
  getFileTree,
  getKiloCliRunStatus,
  getLatestVersion,
  getSubscriptionDetail,
  listAllInstances,
  listPersonalSubscriptions,
  removeMyPin,
  startKiloCliRun,
  cancelKiloCliRun,
} from '../api/kiloclaw.ts'
import { getToken } from './helpers.ts'

export const kiloclawInstancesCommand = defineCommand({
  meta: { name: 'instances', description: 'List all KiloClaw instances' },
  async run() {
    const { token } = await getToken()
    const instances = await listAllInstances(token)
    if (instances.length === 0) {
      console.log('No instances found.')
      return
    }
    console.table(instances.map((i) => ({ ID: i.id, Name: i.name, Status: i.status, Plan: i.planName ?? '-' })))
  },
})

export const kiloclawBillingCommand = defineCommand({
  meta: { name: 'billing', description: 'Show KiloClaw billing status' },
  async run() {
    const { token } = await getToken()
    const status = await getBillingStatus(token)
    console.log(`Balance: $${status.balance.toFixed(2)}`)
    console.log(`Active subscriptions: ${status.activeSubscriptions}`)
    console.log(`Current period usage: $${status.currentPeriodUsageUsd.toFixed(2)}`)
  },
})

export const kiloclawBillingHistoryCommand = defineCommand({
  meta: { name: 'billing-history', description: 'Show KiloClaw billing history' },
  args: { period: { type: 'string', description: 'Billing period' } },
  async run({ args }) {
    const { token } = await getToken()
    const history = await getBillingHistory(token, args.period)
    if (history.length === 0) {
      console.log('No billing history found.')
      return
    }
    console.table(history.map((h) => ({ ID: h.id, Date: h.date, Amount: h.amount, Description: h.description, Type: h.type })))
  },
})

export const kiloclawSubscriptionsCommand = defineCommand({
  meta: { name: 'subscriptions', description: 'List personal KiloClaw subscriptions' },
  async run() {
    const { token } = await getToken()
    const subs = await listPersonalSubscriptions(token)
    if (subs.length === 0) {
      console.log('No subscriptions found.')
      return
    }
    console.table(subs.map((s) => ({ ID: s.id, Plan: s.planName, Status: s.status, Provider: s.providerName, 'Cancel at period end': s.cancelAtPeriodEnd ? 'yes' : 'no' })))
  },
})

export const kiloclawSubscriptionDetailCommand = defineCommand({
  meta: { name: 'subscription', description: 'Get subscription detail' },
  args: { id: { type: 'positional', description: 'Instance ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const detail = await getSubscriptionDetail(token, args.id)
    console.log(`ID: ${detail.id}`)
    console.log(`Plan: ${detail.planName}`)
    console.log(`Status: ${detail.status}`)
    console.log(`Provider: ${detail.providerName}`)
    console.log(`Cancel at period end: ${detail.cancelAtPeriodEnd ? 'yes' : 'no'}`)
    if (detail.currentPeriodStart) console.log(`Current period start: ${detail.currentPeriodStart}`)
    if (detail.currentPeriodEnd) console.log(`Current period end: ${detail.currentPeriodEnd}`)
  },
})

export const kiloclawChangelogCommand = defineCommand({
  meta: { name: 'changelog', description: 'Show KiloClaw changelog' },
  async run() {
    const { token } = await getToken()
    const entries = await getChangelog(token)
    for (const entry of entries) {
      console.log(`\n## ${entry.version} (${entry.date})`)
      for (const change of entry.changes) {
        console.log(`  - ${change}`)
      }
    }
  },
})

export const kiloclawVersionCommand = defineCommand({
  meta: { name: 'version', description: 'Check latest KiloClaw version' },
  args: { current: { type: 'string', description: 'Current image tag' } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await getLatestVersion(token, args.current)
    console.log(`Latest version: ${result.latestVersion}`)
    console.log(`Up to date: ${result.isUpToDate ? 'yes' : 'no'}`)
  },
})

export const kiloclawFileTreeCommand = defineCommand({
  meta: { name: 'file-tree', description: 'List files in KiloClaw instance' },
  args: { path: { type: 'string', description: 'Path to list' } },
  async run({ args }) {
    const { token } = await getToken()
    const tree = await getFileTree(token, args.path)
    console.table(tree.map((n) => ({ Name: n.name, Path: n.path, Type: n.type })))
  },
})

export const kiloclawRunStartCommand = defineCommand({
  meta: { name: 'run-start', description: 'Start a Kilo CLI run' },
  args: { prompt: { type: 'positional', description: 'Prompt for the run', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await startKiloCliRun(token, args.prompt)
    console.log(`Started run: ${result.runId}`)
  },
})

export const kiloclawRunStatusCommand = defineCommand({
  meta: { name: 'run-status', description: 'Get Kilo CLI run status' },
  args: { id: { type: 'positional', description: 'Run ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const run = await getKiloCliRunStatus(token, args.id)
    console.log(`Run ID: ${run.runId}`)
    console.log(`Status: ${run.status}`)
    console.log(`Prompt: ${run.prompt}`)
    console.log(`Started: ${run.startedAt}`)
    if (run.completedAt) console.log(`Completed: ${run.completedAt}`)
    if (run.output) console.log(`Output: ${run.output}`)
  },
})

export const kiloclawRunCancelCommand = defineCommand({
  meta: { name: 'run-cancel', description: 'Cancel a Kilo CLI run' },
  args: { id: { type: 'positional', description: 'Run ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await cancelKiloCliRun(token, args.id)
    console.log(`Cancelled run: ${args.id}`)
  },
})

export const kiloclawUnpinCommand = defineCommand({
  meta: { name: 'unpin', description: 'Remove your pin from KiloClaw' },
  async run() {
    const { token } = await getToken()
    await removeMyPin(token)
    console.log('Pin removed.')
  },
})
