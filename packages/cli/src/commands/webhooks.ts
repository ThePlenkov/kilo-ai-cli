/**
 * Webhook trigger CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  createWebhookTrigger,
  deleteWebhookTrigger,
  getWebhookTrigger,
  invokeWebhookTrigger,
  listWebhookRequests,
  listWebhookTriggers,
  updateWebhookTrigger,
} from '../api/webhooks.ts'
import { printTable, sanitize, stringifyValue } from './format.ts'
import { getToken, triState } from './helpers.ts'

export const webhooksListCommand = defineCommand({
  meta: { name: 'list', description: 'List webhook triggers' },
  args: {
    org: { type: 'string', description: 'Organization ID' },
    target: { type: 'string', description: 'Target type (cloud_agent|kiloclaw_chat)' },
    mode: { type: 'string', description: 'Activation mode (webhook|scheduled)' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const triggers = await listWebhookTriggers(token, {
      organizationId: args.org,
      targetType: args.target as 'cloud_agent' | 'kiloclaw_chat' | undefined,
      activationMode: args.mode as 'webhook' | 'scheduled' | undefined,
    })
    if (triggers.length === 0) {
      console.log('No webhook triggers found.')
      return
    }
    printTable(
      triggers.map((t) => ({
        id: t.id,
        trigger: t.triggerId ?? '-',
        target: t.targetType ?? '-',
        mode: t.activationMode ?? '-',
        repo: t.githubRepo ?? '-',
        enabled: t.enabled === false ? 'no' : 'yes',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'trigger', label: 'Trigger', width: 24 },
        { key: 'target', label: 'Target', width: 14 },
        { key: 'mode', label: 'Mode', width: 10 },
        { key: 'repo', label: 'Repository', width: 32 },
        { key: 'enabled', label: 'Enabled', width: 8 },
      ],
    )
  },
})

/** Fields of a webhook trigger that are safe to print. */
const WEBHOOK_SAFE_FIELDS = [
  'id',
  'triggerId',
  'name',
  'targetType',
  'activationMode',
  'githubRepo',
  'promptTemplate',
  'enabled',
  'cronExpression',
  'cronTimezone',
  'mode',
  'model',
  'autoCommit',
  'profileId',
  'createdAt',
  'updatedAt',
] as const

export const webhooksGetCommand = defineCommand({
  meta: { name: 'get', description: 'Get one webhook trigger' },
  args: {
    id: { type: 'positional', description: 'Trigger ID', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const trigger = await getWebhookTrigger(token, args.id, args.org)
    // Allowlist, not a blocklist: the response is passthrough-typed, so an
    // unknown field could carry a secret.
    for (const key of WEBHOOK_SAFE_FIELDS) {
      const value = trigger[key]
      if (value === undefined) continue
      console.log(`  ${key}: ${sanitize(stringifyValue(value))}`)
    }
  },
})

export const webhooksCreateCommand = defineCommand({
  meta: { name: 'create', description: 'Create a webhook trigger' },
  args: {
    triggerId: { type: 'string', description: 'Trigger identifier', required: true },
    prompt: { type: 'string', description: 'Prompt template', required: true },
    repo: { type: 'string', description: 'GitHub repository (owner/repo)' },
    org: { type: 'string', description: 'Organization ID' },
    target: { type: 'string', description: 'Target type (cloud_agent|kiloclaw_chat)' },
    mode: { type: 'string', description: 'Agent mode (architect|code|ask|debug|orchestrator)' },
    model: { type: 'string', description: 'Model ID' },
    activation: { type: 'string', description: 'Activation mode (webhook|scheduled)' },
    cron: { type: 'string', description: 'Cron expression (scheduled mode)' },
    timezone: { type: 'string', description: 'Cron timezone', default: 'UTC' },
    authHeader: { type: 'string', description: 'Webhook auth header name' },
    authSecret: {
      type: 'string',
      description:
        'Webhook auth secret (prefer the KILO_WEBHOOK_AUTH_SECRET env var — CLI args are visible in shell history)',
    },
  },
  async run({ args }) {
    const { token } = await getToken()
    // Secrets must not travel as CLI arguments — they end up in shell history
    // and in /proc/<pid>/cmdline. The environment variable wins.
    const secret = process.env.KILO_WEBHOOK_AUTH_SECRET ?? args.authSecret
    const trigger = await createWebhookTrigger(token, {
      triggerId: args.triggerId,
      promptTemplate: args.prompt,
      githubRepo: args.repo,
      organizationId: args.org,
      targetType: args.target as 'cloud_agent' | 'kiloclaw_chat' | undefined,
      mode: args.mode as 'architect' | 'code' | 'ask' | 'debug' | 'orchestrator' | undefined,
      model: args.model,
      activationMode: args.activation as 'webhook' | 'scheduled' | undefined,
      cronExpression: args.cron,
      cronTimezone: args.timezone,
      webhookAuth: args.authHeader && secret ? { header: args.authHeader, secret } : undefined,
    })
    console.log(`Created webhook trigger ${trigger.id}`)
  },
})

export const webhooksUpdateCommand = defineCommand({
  meta: { name: 'update', description: 'Update a webhook trigger' },
  args: {
    id: { type: 'positional', description: 'Trigger ID', required: true },
    prompt: { type: 'string', description: 'New prompt template' },
    model: { type: 'string', description: 'New model ID' },
    org: { type: 'string', description: 'Organization ID' },
    disable: { type: 'boolean', description: 'Disable the trigger' },
    enable: { type: 'boolean', description: 'Enable the trigger' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await updateWebhookTrigger(token, {
      id: args.id,
      promptTemplate: args.prompt,
      model: args.model,
      organizationId: args.org,
      enabled: triState(args.enable, args.disable),
    })
    console.log(`Updated webhook trigger ${args.id}`)
  },
})

export const webhooksInvokeCommand = defineCommand({
  meta: { name: 'invoke', description: 'Fire a webhook trigger manually' },
  args: {
    id: { type: 'positional', description: 'Trigger ID', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await invokeWebhookTrigger(token, { id: args.id, organizationId: args.org })
    console.log(`Invoked webhook trigger ${args.id}`)
  },
})

export const webhooksDeleteCommand = defineCommand({
  meta: { name: 'delete', description: 'Delete a webhook trigger' },
  args: {
    id: { type: 'positional', description: 'Trigger ID', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await deleteWebhookTrigger(token, args.id, args.org)
    console.log(`Deleted webhook trigger ${args.id}`)
  },
})

export const webhooksRequestsCommand = defineCommand({
  meta: { name: 'requests', description: 'List recent webhook deliveries' },
  args: {
    id: { type: 'positional', description: 'Trigger ID', required: true },
    org: { type: 'string', description: 'Organization ID' },
    limit: { type: 'string', description: 'Max deliveries', default: '20' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const requests = await listWebhookRequests(token, {
      id: args.id,
      organizationId: args.org,
      limit: Number.parseInt(args.limit, 10) || 20,
    })
    if (requests.length === 0) {
      console.log('No deliveries found.')
      return
    }
    printTable(
      requests.map((r) => ({
        id: r.id ?? '-',
        status: r.status ?? r.statusCode ?? '-',
        created: r.createdAt ?? r.created_at ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'status', label: 'Status', width: 12 },
        { key: 'created', label: 'Created', width: 24 },
      ],
    )
  },
})
