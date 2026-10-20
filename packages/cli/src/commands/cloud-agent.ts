/**
 * Cloud Agent CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  getCloudAgentSession,
  listGitHubRepositories,
  listGitLabRepositories,
} from '../api/cloud-agent.ts'
import { getCloudAgentSettings, setContextAllocation } from '../api/cloud-agent-settings.ts'
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

async function listRepos(
  fetcher: (
    token: string,
    refresh: boolean,
  ) => Promise<{ fullName: string; private: boolean; defaultBranch?: string }[]>,
  refresh: boolean,
): Promise<void> {
  const { token } = await getToken()
  const repos = await fetcher(token, refresh)
  if (repos.length === 0) {
    console.log('No repositories found.')
    return
  }
  printTable(
    repos.map((r) => ({
      name: r.fullName,
      private: r.private ? 'yes' : 'no',
      default: r.defaultBranch ?? '-',
    })),
    [
      { key: 'name', label: 'Repository', width: 40 },
      { key: 'private', label: 'Private', width: 8 },
      { key: 'default', label: 'Default Branch', width: 20 },
    ],
  )
}

export const cloudAgentGithubReposCommand = defineCommand({
  meta: { name: 'github-repos', description: 'List GitHub repositories for cloud agent' },
  args: { refresh: { type: 'boolean', description: 'Force refresh', alias: 'f' } },
  async run({ args }) {
    await listRepos(listGitHubRepositories, args.refresh)
  },
})

export const cloudAgentGitlabReposCommand = defineCommand({
  meta: { name: 'gitlab-repos', description: 'List GitLab repositories for cloud agent' },
  args: { refresh: { type: 'boolean', description: 'Force refresh', alias: 'f' } },
  async run({ args }) {
    await listRepos(listGitLabRepositories, args.refresh)
  },
})

export const cloudAgentSettingsCommand = defineCommand({
  meta: { name: 'settings', description: 'Show or change the cloud agent settings' },
  args: {
    org: { type: 'string', description: 'Organization ID' },
    allocation: {
      type: 'string',
      description: 'Set the sandbox allocation (pass "none" to clear it)',
    },
  },
  async run({ args }) {
    const { token } = await getToken()
    if (args.allocation !== undefined) {
      const allocation = args.allocation === 'none' ? null : args.allocation
      await setContextAllocation(token, allocation, args.org)
      console.log(
        allocation ? `Context allocation set to ${allocation}` : 'Context allocation cleared.',
      )
      return
    }
    const settings = await getCloudAgentSettings(token, args.org)
    console.log(`  can manage: ${settings.canManage ? 'yes' : 'no'}`)
    console.log(`  context allocation: ${settings.contextAllocation ?? '(none)'}`)
    if (settings.repositories.length === 0) {
      console.log('  repositories: none')
      return
    }
    printTable(
      settings.repositories.map((r) => ({
        repo: r.repositoryFullName,
        platform: r.repositoryPlatform ?? '-',
        profile: r.profileName ?? r.profileId ?? '-',
        allocation: r.allocation ?? '-',
      })),
      [
        { key: 'repo', label: 'Repository', width: 40 },
        { key: 'platform', label: 'Platform', width: 10 },
        { key: 'profile', label: 'Profile', width: 24 },
        { key: 'allocation', label: 'Allocation', width: 20 },
      ],
    )
  },
})
