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
    const status = await getBillingStatus(token) as Record<string, unknown>
    console.log('Billing status:\n')
    for (const [key, value] of Object.entries(status)) {
      if (value === null || value === undefined) continue
      if (typeof value === 'object' && !Array.isArray(value)) {
        console.log(`  ${key}:`)
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          console.log(`    ${k}: ${v}`)
        }
      } else {
        console.log(`  ${key.padEnd(32)} ${value}`)
      }
    }
  },
})

export const kiloclawBillingHistoryCommand = defineCommand({
  meta: { name: 'billing-history', description: 'Show KiloClaw billing history for an instance' },
  args: { id: { type: 'positional', description: 'Instance ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const history = await getBillingHistory(token, args.id) as Array<Record<string, unknown>>
    if (history.length === 0) {
      console.log('No billing history found.')
      return
    }
    printTable(
      history.map((h) => ({
        id: String(h.id ?? '-'),
        date: String(h.date ?? '-'),
        amount: h.amount ?? 0,
        description: String(h.description ?? '-'),
        type: String(h.type ?? '-'),
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
    const subs = await listPersonalSubscriptions(token) as Array<Record<string, unknown>>
    if (subs.length === 0) {
      console.log('No subscriptions found.')
      return
    }
    printTable(
      subs.map((s) => ({
        id: String(s.instanceId ?? s.id ?? '-').slice(0, 12),
        name: String(s.instanceName ?? '-'),
        plan: String(s.plan ?? s.planName ?? '-'),
        status: String(s.status ?? '-'),
        cancel: s.cancelAtPeriodEnd ? 'yes' : 'no',
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'name', label: 'Name', width: 20 },
        { key: 'plan', label: 'Plan', width: 10 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'cancel', label: 'Cancel EOP', width: 10 },
      ],
    )
  },
})

export const kiloclawSubscriptionDetailCommand = defineCommand({
  meta: { name: 'subscription', description: 'Get subscription detail' },
  args: { id: { type: 'positional', description: 'Instance ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const detail = await getSubscriptionDetail(token, args.id) as Record<string, unknown>
    console.log(`Instance ID: ${detail.instanceId ?? detail.id ?? '-'}`)
    console.log(`Name: ${detail.instanceName ?? '-'}`)
    console.log(`Plan: ${detail.plan ?? detail.planName ?? '-'}`)
    console.log(`Status: ${detail.status ?? '-'}`)
    console.log(`Cancel at period end: ${detail.cancelAtPeriodEnd ? 'yes' : 'no'}`)
    if (detail.currentPeriodStart) console.log(`Current period start: ${detail.currentPeriodStart}`)
    if (detail.currentPeriodEnd) console.log(`Current period end: ${detail.currentPeriodEnd}`)
  },
})

export const kiloclawChangelogCommand = defineCommand({
  meta: { name: 'changelog', description: 'Show KiloClaw changelog' },
  async run() {
    const { token } = await getToken()
    const entries = await getChangelog(token) as Array<Record<string, unknown>>
    for (const entry of entries) {
      const date = String(entry.date ?? '')
      const category = String(entry.category ?? '')
      const description = String(entry.description ?? '')
      const deployHint = String(entry.deployHint ?? '')
      console.log(`\n${date} [${category}]${deployHint ? ` (${deployHint})` : ''}`)
      console.log(`  ${description}`)
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
