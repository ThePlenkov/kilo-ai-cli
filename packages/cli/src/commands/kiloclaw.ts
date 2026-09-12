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
import { printTable } from './format.ts'
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
    printTable(
      instances.map((i) => ({ id: i.id, name: i.name, status: i.status, plan: i.planName ?? '-' })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'name', label: 'Name', width: 30 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'plan', label: 'Plan', width: 20 },
      ],
    )
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
    printTable(
      history.map((h) => ({
        id: h.id,
        date: h.date,
        amount: h.amount,
        description: h.description,
        type: h.type,
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'date', label: 'Date', width: 12 },
        { key: 'amount', label: 'Amount', width: 10, align: 'right' },
        { key: 'description', label: 'Description', width: 40 },
        { key: 'type', label: 'Type', width: 10 },
      ],
    )
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
    printTable(
      subs.map((s) => ({
        id: s.id,
        plan: s.planName,
        status: s.status,
        provider: s.providerName,
        cancel: s.cancelAtPeriodEnd ? 'yes' : 'no',
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'plan', label: 'Plan', width: 20 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'provider', label: 'Provider', width: 14 },
        { key: 'cancel', label: 'Cancel at EOP', width: 14 },
      ],
    )
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
    printTable(
      tree.map((n) => ({ name: n.name, path: n.path, type: n.type })),
      [
        { key: 'name', label: 'Name', width: 30 },
        { key: 'path', label: 'Path', width: 50 },
        { key: 'type', label: 'Type', width: 8 },
      ],
    )
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
