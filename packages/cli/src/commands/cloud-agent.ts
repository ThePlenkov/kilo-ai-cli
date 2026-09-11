/**
 * Cloud Agent CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  getCloudAgentSession,
  listGitHubRepositories,
  listGitLabRepositories,
} from '../api/cloud-agent.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const cloudAgentSessionCommand = defineCommand({
  meta: { name: 'session', description: 'Get cloud agent session details' },
  args: { id: { type: 'positional', description: 'Session ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const session = await getCloudAgentSession(token, args.id)
    console.log(`Session ID: ${session.sessionId}`)
    console.log(`Status: ${session.status}`)
    if (session.gitUrl) console.log(`Git URL: ${session.gitUrl}`)
    if (session.branch) console.log(`Branch: ${session.branch}`)
    console.log(`Created: ${session.createdAt}`)
    console.log(`Updated: ${session.updatedAt}`)
  },
})

export const cloudAgentGithubReposCommand = defineCommand({
  meta: { name: 'github-repos', description: 'List GitHub repositories for cloud agent' },
  args: { refresh: { type: 'boolean', description: 'Force refresh', alias: 'f' } },
  async run({ args }) {
    const { token } = await getToken()
    const repos = await listGitHubRepositories(token, args.refresh)
    if (repos.length === 0) {
      console.log('No repositories found.')
      return
    }
    printTable(
      repos.map((r) => ({ name: r.fullName, private: r.private ? 'yes' : 'no', default: r.defaultBranch ?? '-' })),
      [
        { key: 'name', label: 'Repository', width: 40 },
        { key: 'private', label: 'Private', width: 8 },
        { key: 'default', label: 'Default Branch', width: 20 },
      ],
    )
  },
})

export const cloudAgentGitlabReposCommand = defineCommand({
  meta: { name: 'gitlab-repos', description: 'List GitLab repositories for cloud agent' },
  args: { refresh: { type: 'boolean', description: 'Force refresh', alias: 'f' } },
  async run({ args }) {
    const { token } = await getToken()
    const repos = await listGitLabRepositories(token, args.refresh)
    if (repos.length === 0) {
      console.log('No repositories found.')
      return
    }
    printTable(
      repos.map((r) => ({ name: r.fullName, private: r.private ? 'yes' : 'no', default: r.defaultBranch ?? '-' })),
      [
        { key: 'name', label: 'Repository', width: 40 },
        { key: 'private', label: 'Private', width: 8 },
        { key: 'default', label: 'Default Branch', width: 20 },
      ],
    )
  },
})
