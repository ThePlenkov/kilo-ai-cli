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

/** Render an optional boolean flag; absent fields stay "unknown", not "no". */
const flag = (v: boolean | undefined) => (v == null ? 'unknown' : v ? 'yes' : 'no')

export const kiloclawBillingCommand = defineCommand({
  meta: { name: 'billing', description: 'Show KiloClaw billing status' },
  async run() {
    const { token } = await getToken()
    const status = await getBillingStatus(token)
    console.log(`Access: ${status.hasAccess ? 'yes' : 'no'}${status.accessReason ? ` (${status.accessReason})` : ''}`)
    if (status.creditBalanceMicrodollars != null) {
      console.log(`Credit balance: $${(status.creditBalanceMicrodollars / 1e6).toFixed(2)}`)
    }
    console.log(`Current subscription: ${flag(status.hasCurrentPersonalSubscription)}`)
    console.log(`Trial eligible: ${flag(status.trialEligible)}`)
    console.log(`KiloPass active: ${flag(status.hasActiveKiloPass)}`)
  },
})

export const kiloclawBillingHistoryCommand = defineCommand({
  meta: { name: 'billing-history', description: 'Show KiloClaw billing history for an instance' },
  args: {
    id: { type: 'positional', description: 'Instance ID', required: true },
    period: { type: 'string', description: 'Billing period' },
    cursor: { type: 'string', description: 'Pagination cursor from a previous call' },
    all: { type: 'boolean', description: 'Follow pagination and print all pages' },
  },
  async run({ args }) {
    const { token } = await getToken()
    if (args.all) {
      let cursor: string | undefined = args.cursor
      for (let i = 0; i < 20; i++) {
        // eslint-disable-next-line no-await-in-loop -- cursor pagination is sequential
        const page = await getBillingHistory(token, args.id, args.period, cursor)
        for (const entry of page.entries) console.log(JSON.stringify(entry))
        if (!page.hasMore || !page.cursor) return
        cursor = page.cursor ?? undefined
      }
      console.error('Stopped after 20 pages — history continues')
      return
    }
    const page = await getBillingHistory(token, args.id, args.period, args.cursor)
    if (page.entries.length === 0) {
      console.log('No billing history found.')
      return
    }
    for (const entry of page.entries) {
      console.log(JSON.stringify(entry))
    }
    if (page.hasMore) console.log(`More entries available (cursor: ${page.cursor})`)
  },
})

export const kiloclawSubscriptionsCommand = defineCommand({
  meta: { name: 'subscriptions', description: 'List personal KiloClaw subscriptions' },
  async run() {
    const { token } = await getToken()
    const { subscriptions, commitPlanAvailable } = await listPersonalSubscriptions(token)
    if (subscriptions.length === 0) {
      console.log('No subscriptions found.')
      if (commitPlanAvailable) console.log('Commit plan is available.')
      return
    }
    printTable(
      subscriptions.map((s) => ({
        id: s.instanceId,
        name: s.instanceName ?? '-',
        plan: s.plan,
        status: s.status,
        cancel: s.cancelAtPeriodEnd ? 'yes' : 'no',
      })),
      [
        { key: 'id', label: 'Instance ID', width: 12 },
        { key: 'name', label: 'Name', width: 20 },
        { key: 'plan', label: 'Plan', width: 12 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'cancel', label: 'Cancel at EOP', width: 14 },
      ],
    )
    if (commitPlanAvailable) console.log('\nCommit plan is available.')
  },
})

export const kiloclawSubscriptionDetailCommand = defineCommand({
  meta: { name: 'subscription', description: 'Get subscription detail' },
  args: { id: { type: 'positional', description: 'Instance ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const detail = await getSubscriptionDetail(token, args.id)
    console.log(`Instance ID: ${detail.instanceId}`)
    if (detail.instanceName) console.log(`Name: ${detail.instanceName}`)
    console.log(`Plan: ${detail.plan}`)
    console.log(`Status: ${detail.status}`)
    console.log(`Cancel at period end: ${detail.cancelAtPeriodEnd ? 'yes' : 'no'}`)
    if (detail.currentPeriodStart) console.log(`Current period start: ${detail.currentPeriodStart}`)
    if (detail.currentPeriodEnd) console.log(`Current period end: ${detail.currentPeriodEnd}`)
    if (detail.destroyedAt) console.log(`Destroyed: ${detail.destroyedAt}`)
    if (detail.trialEndsAt) console.log(`Trial ends: ${detail.trialEndsAt}`)
  },
})

export const kiloclawChangelogCommand = defineCommand({
  meta: { name: 'changelog', description: 'Show KiloClaw changelog' },
  async run() {
    const { token } = await getToken()
    const entries = await getChangelog(token)
    for (const entry of entries) {
      console.log(`\n## ${entry.date} [${entry.category}]${entry.deployHint ? ` (${entry.deployHint})` : ''}`)
      console.log(`  ${entry.description}`)
    }
  },
})

export const kiloclawVersionCommand = defineCommand({
  meta: { name: 'version', description: 'Check latest KiloClaw version' },
  args: { current: { type: 'string', description: 'Current image tag' } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await getLatestVersion(token, args.current)
    console.log(`OpenClaw version: ${result.openclawVersion} (${result.variant})`)
    console.log(`Image tag: ${result.imageTag}`)
    if (result.publishedAt) console.log(`Published: ${result.publishedAt}`)
    console.log(`Is latest: ${result.isLatest ? 'yes' : 'no'}`)
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
