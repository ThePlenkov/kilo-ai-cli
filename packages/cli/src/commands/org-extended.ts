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
import { getToken } from './helpers.ts'

export const orgMembersCommand = defineCommand({
  meta: { name: 'members', description: 'List organization members' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const org = await getOrganizationWithMembers(token, args.id)
    console.log(`Organization: ${org.name}`)
    console.table(org.members.map((m) => ({ ID: m.id, Email: m.email, Name: m.name ?? '-', Role: m.role })))
  },
})

export const orgUsageCommand = defineCommand({
  meta: { name: 'usage', description: 'Show organization usage stats' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const stats = await getOrganizationUsageStats(token, args.id)
    console.log(`Total credits used: $${stats.totalCreditsUsed.toFixed(2)}`)
    console.log(`Credits this period: $${stats.creditsUsedThisPeriod.toFixed(2)}`)
    console.log(`Active sessions: ${stats.activeSessions}`)
    console.log(`Total members: ${stats.totalMembers}`)
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
    console.table(transactions.map((t) => ({
      ID: t.id,
      Date: t.createdAt,
      Amount: t.amount,
      Type: t.type,
      Description: t.description,
    })))
  },
})

export const orgSeatsCommand = defineCommand({
  meta: { name: 'seats', description: 'Show organization seats' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const seats = await getOrganizationSeats(token, args.id)
    console.log(`Total seats: ${seats.total}`)
    console.log(`Used seats: ${seats.used}`)
    console.log(`Available: ${seats.total - seats.used}`)
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
    console.table(invoices.map((i) => ({
      ID: i.id,
      Date: i.date,
      Amount: i.amount,
      Status: i.status,
    })))
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
    const org = await createOrganization(token, { name: args.name, companyDomain: args.domain ?? null })
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
    console.table(models.map((m) => ({
      ID: m.id,
      Name: m.name,
      Provider: m.provider,
      Enabled: m.isEnabled ? 'yes' : 'no',
    })))
  },
})

export const orgSecurityCommand = defineCommand({
  meta: { name: 'security', description: 'Show security agent permission status' },
  args: { id: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const status = await getSecurityAgentPermissionStatus(token, args.id)
    console.log(`Granted: ${status.granted ? 'yes' : 'no'}`)
    console.log(`Permissions: ${status.permissions?.join(', ') || '(none)'}`)
    console.log(`Pending requests: ${status.pendingRequests ?? 0}`)
  },
})
