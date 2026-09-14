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
    const projects = await listAppBuilderProjects(token)
    if (projects.length === 0) {
      console.log('No projects found.')
      return
    }
    printTable(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        url: p.url ?? '-',
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
    const result = await checkAppBuilderEligibility(token)
    console.log(`Eligible: ${result.isEligible ? 'yes' : 'no'}`)
    console.log(`Access level: ${result.accessLevel}`)
    console.log(`Balance: $${result.balance.toFixed(2)} (min: $${result.minBalance})`)
  },
})

export const appBuilderDeployCommand = defineCommand({
  meta: { name: 'deploy', description: 'Deploy an app builder project' },
  args: { id: { type: 'positional', description: 'Project ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const project = await deployAppBuilderProject(token, args.id)
    console.log(`Deployed: ${project.name}`)
    console.log(`Status: ${project.status}`)
    if (project.url) console.log(`URL: ${project.url}`)
  },
})
