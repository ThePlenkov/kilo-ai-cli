/**
 * App Builder CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  checkAppBuilderEligibility,
  deployAppBuilderProject,
  listAppBuilderProjects,
} from '../api/app-builder.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const appBuilderListCommand = defineCommand({
  meta: { name: 'list', description: 'List app builder projects' },
  async run() {
    const { token } = await getToken()
    const projects = await listAppBuilderProjects(token) as Array<Record<string, unknown>>
    if (projects.length === 0) {
      console.log('No projects found.')
      return
    }
    printTable(
      projects.map((p) => ({
        id: String(p.id ?? '-').slice(0, 12),
        name: String(p.name ?? '-'),
        status: String(p.status ?? '-'),
        url: String(p.url ?? '-'),
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'name', label: 'Name', width: 30 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'url', label: 'URL', width: 50 },
      ],
    )
  },
})

export const appBuilderEligibilityCommand = defineCommand({
  meta: { name: 'eligibility', description: 'Check app builder eligibility' },
  async run() {
    const { token } = await getToken()
    const result = await checkAppBuilderEligibility(token) as Record<string, unknown>
    const eligible = result.isEligible ?? result.eligible
    console.log(`Eligible: ${eligible ? 'yes' : 'no'}`)
    if (result.balance !== undefined) console.log(`Balance: $${result.balance}`)
    if (result.minBalance !== undefined) console.log(`Min balance: $${result.minBalance}`)
    if (result.accessLevel) console.log(`Access level: ${result.accessLevel}`)
    if (result.reason) console.log(`Reason: ${result.reason}`)
  },
})

export const appBuilderDeployCommand = defineCommand({
  meta: { name: 'deploy', description: 'Deploy an app builder project' },
  args: { id: { type: 'positional', description: 'Project ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const project = await deployAppBuilderProject(token, args.id) as Record<string, unknown>
    console.log(`Deployed: ${project.name ?? '-'}`)
    console.log(`Status: ${project.status ?? '-'}`)
    if (project.url) console.log(`URL: ${project.url}`)
  },
})
