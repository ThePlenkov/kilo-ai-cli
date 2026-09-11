/**
 * App Builder CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  checkAppBuilderEligibility,
  deployAppBuilderProject,
  listAppBuilderProjects,
} from '../api/app-builder.ts'
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
    console.table(projects.map((p) => ({
      ID: p.id,
      Name: p.name,
      Status: p.status,
      URL: p.url ?? '-',
    })))
  },
})

export const appBuilderEligibilityCommand = defineCommand({
  meta: { name: 'eligibility', description: 'Check app builder eligibility' },
  async run() {
    const { token } = await getToken()
    const result = await checkAppBuilderEligibility(token)
    console.log(`Eligible: ${result.eligible ? 'yes' : 'no'}`)
    if (result.reason) console.log(`Reason: ${result.reason}`)
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
