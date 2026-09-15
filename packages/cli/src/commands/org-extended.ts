/**
 * Extended Organization CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  createOrganization,
  getCreditTransactions,
  getOrganizationInvoices,
  getOrganizationSeats,
  getOrganizationUsageStats,
  getOrganizationWithMembers,
  getSecurityAgentPermissionStatus,
  listAvailableModels,
  updateOrganization,
} from '../api/organizations.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const orgMembersCommand = defineCommand({
  meta: { name: 'members', description: 'List organization members' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const org = await getOrganizationWithMembers(token, args.id)
    console.log(`Organization: ${org.name}`)
    printTable(
      org.members.map((m) => ({ id: m.id, email: m.email, name: m.name ?? '-', role: m.role })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'email', label: 'Email', width: 30 },
        { key: 'name', label: 'Name', width: 24 },
        { key: 'role', label: 'Role', width: 12 },
      ],
    )
  },
})

export const orgUsageCommand = defineCommand({
  meta: { name: 'usage', description: 'Show organization usage stats' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const stats = await getOrganizationUsageStats(token, args.id)
    console.log(`Total cost: $${stats.totalCost.toFixed(2)}`)
    console.log(`Requests: ${stats.totalRequestCount}`)
    console.log(`Input tokens: ${stats.totalInputTokens}`)
    console.log(`Output tokens: ${stats.totalOutputTokens}`)
  },
})

export const orgCreditsCommand = defineCommand({
  meta: { name: 'credits', description: 'Show organization credit transactions' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const transactions = await getCreditTransactions(token, args.id)
    if (transactions.length === 0) {
      console.log('No credit transactions found.')
      return
    }
    printTable(
      transactions.map((t) => ({
        id: t.id,
        date: t.createdAt,
        amount: t.amount,
        type: t.type,
        description: t.description,
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'date', label: 'Date', width: 12 },
        { key: 'amount', label: 'Amount', width: 10, align: 'right' },
        { key: 'type', label: 'Type', width: 10 },
        { key: 'description', label: 'Description', width: 40 },
      ],
    )
  },
})

export const orgSeatsCommand = defineCommand({
  meta: { name: 'seats', description: 'Show organization seats' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const seats = await getOrganizationSeats(token, args.id)
    console.log(`Total seats: ${seats.totalSeats}`)
    console.log(`Used seats: ${seats.usedSeats}`)
    console.log(`Available: ${seats.totalSeats - seats.usedSeats}`)
  },
})

export const orgInvoicesCommand = defineCommand({
  meta: { name: 'invoices', description: 'Show organization invoices' },
  args: {
    id: { type: 'positional', description: 'Organization ID', required: true },
    period: { type: 'string', description: 'Billing period' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const invoices = await getOrganizationInvoices(token, args.id, args.period)
    if (invoices.length === 0) {
      console.log('No invoices found.')
      return
    }
    printTable(
      invoices.map((i) => ({
        id: i.id,
        date: i.date,
        amount: i.amount,
        status: i.status,
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'date', label: 'Date', width: 12 },
        { key: 'amount', label: 'Amount', width: 10, align: 'right' },
        { key: 'status', label: 'Status', width: 10 },
      ],
    )
  },
})

export const orgCreateCommand = defineCommand({
  meta: { name: 'create', description: 'Create a new organization' },
  args: {
    name: { type: 'positional', description: 'Organization name', required: true },
    domain: { type: 'string', description: 'Company domain' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const org = await createOrganization(token, {
      name: args.name,
      companyDomain: args.domain ?? null,
      autoAddCreator: true,
    })
    console.log(`Created organization: ${org.name} (${org.id})`)
  },
})

export const orgUpdateCommand = defineCommand({
  meta: { name: 'update', description: 'Update an organization' },
  args: {
    id: { type: 'positional', description: 'Organization ID', required: true },
    name: { type: 'string', description: 'New name' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const org = await updateOrganization(token, { organizationId: args.id, name: args.name })
    console.log(`Updated organization: ${org.name} (${org.id})`)
  },
})

export const orgModelsCommand = defineCommand({
  meta: { name: 'models', description: 'List available models for an organization' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const models = await listAvailableModels(token, args.id)
    if (models.length === 0) {
      console.log('No models available.')
      return
    }
    printTable(
      models.map((m) => ({
        id: m.id,
        name: m.name,
        free: m.isFree ? 'yes' : 'no',
        context: m.contextLength ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 24 },
        { key: 'name', label: 'Name', width: 30 },
        { key: 'free', label: 'Free', width: 6 },
        { key: 'context', label: 'Context', width: 10, align: 'right' },
      ],
    )
  },
})

export const orgSecurityCommand = defineCommand({
  meta: { name: 'security', description: 'Show security agent permission status' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const status = await getSecurityAgentPermissionStatus(token, args.id)
    console.log(`Integration connected: ${status.hasIntegration ? 'yes' : 'no'}`)
    console.log(`Permissions granted: ${status.hasPermissions ? 'yes' : 'no'}`)
    if (status.reauthorizeUrl) console.log(`Reauthorize: ${status.reauthorizeUrl}`)
    if (status.authInvalidAt)
      console.log(
        `Auth invalid since ${status.authInvalidAt}: ${status.authInvalidReason ?? 'unknown'}`,
      )
  },
})
