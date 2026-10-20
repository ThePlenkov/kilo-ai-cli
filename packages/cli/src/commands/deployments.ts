/**
 * Deployment CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  cancelBuild,
  deleteDeployment,
  getBuildEvents,
  getDeployment,
  listDeployments,
} from '../api/deployments.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const deploymentsListCommand = defineCommand({
  meta: { name: 'list', description: 'List deployments' },
  async run() {
    const { token } = await getToken()
    const deployments = await listDeployments(token)
    if (deployments.length === 0) {
      console.log('No deployments found.')
      return
    }
    printTable(
      deployments.map((d) => ({
        id: d.id,
        name: d.name ?? '-',
        slug: d.slug ?? '-',
        status: d.status ?? '-',
        url: d.url ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'name', label: 'Name', width: 24 },
        { key: 'slug', label: 'Slug', width: 24 },
        { key: 'status', label: 'Status', width: 12 },
        { key: 'url', label: 'URL', width: 40 },
      ],
    )
  },
})

export const deploymentsGetCommand = defineCommand({
  meta: { name: 'get', description: 'Get one deployment' },
  args: { id: { type: 'positional', description: 'Deployment ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const deployment = await getDeployment(token, args.id)
    for (const [key, value] of Object.entries(deployment)) {
      console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    }
  },
})

export const deploymentsEventsCommand = defineCommand({
  meta: { name: 'events', description: 'Show the build log of a deployment build' },
  args: {
    deployment: { type: 'positional', description: 'Deployment ID', required: true },
    build: { type: 'positional', description: 'Build ID', required: true },
    limit: { type: 'string', description: 'Max events', default: '100' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const events = await getBuildEvents(
      token,
      args.deployment,
      args.build,
      Number.parseInt(args.limit, 10) || 100,
    )
    if (events.length === 0) {
      console.log('No build events.')
      return
    }
    for (const event of events) {
      console.log(
        `${event.createdAt ?? event.timestamp ?? ''} ${event.type ?? event.status ?? ''} ${event.message ?? ''}`,
      )
    }
  },
})

export const deploymentsCancelCommand = defineCommand({
  meta: { name: 'cancel', description: 'Cancel a running build' },
  args: {
    deployment: { type: 'positional', description: 'Deployment ID', required: true },
    build: { type: 'positional', description: 'Build ID', required: true },
  },
  async run({ args }) {
    const { token } = await getToken()
    await cancelBuild(token, args.deployment, args.build)
    console.log(`Cancelled build ${args.build}`)
  },
})

export const deploymentsDeleteCommand = defineCommand({
  meta: { name: 'delete', description: 'Delete a deployment' },
  args: { id: { type: 'positional', description: 'Deployment ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await deleteDeployment(token, args.id)
    console.log(`Deleted deployment ${args.id}`)
  },
})
