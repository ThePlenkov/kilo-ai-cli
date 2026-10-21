/**
 * Integration CLI command handlers — GitHub, GitLab and the chat platforms.
 */

import { defineCommand } from 'citty'

import {
  getDiscordInstallation,
  getDoltHubInstallation,
  getGitHubInstallation,
  getGitLabInstallation,
  getLinearInstallation,
  getSlackInstallation,
  listGitHubAppRepositories,
  listGitHubIntegrations,
  listGitLabRepositories,
  listIntegrationStatus,
} from '../api/integrations.ts'
import { printTable, stringifyValue } from './format.ts'
import { getToken } from './helpers.ts'

export const integrationsStatusCommand = defineCommand({
  meta: { name: 'status', description: 'Show which platform integrations are connected' },
  async run() {
    const { token } = await getToken()
    const statuses = await listIntegrationStatus(token)
    if (statuses.length === 0) {
      console.log('No integrations reported.')
      return
    }
    printTable(
      statuses.map((s) => {
        const installation = s.installation as { accountLogin?: string } | null | undefined
        return {
          platform: s.platform,
          installed: s.installed ? 'yes' : 'no',
          account: installation?.accountLogin ?? '-',
        }
      }),
      [
        { key: 'platform', label: 'Platform', width: 14 },
        { key: 'installed', label: 'Installed', width: 10 },
        { key: 'account', label: 'Account', width: 32 },
      ],
    )
  },
})

export const integrationsGithubInstallationsCommand = defineCommand({
  meta: { name: 'github-installations', description: 'List GitHub App installations' },
  async run() {
    const { token } = await getToken()
    const installations = await listGitHubIntegrations(token)
    if (installations.length === 0) {
      console.log('No GitHub installations found.')
      return
    }
    printTable(
      installations.map((i) => ({
        id: i.id,
        account: i.accountLogin ?? '-',
        type: i.appType ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 24 },
        { key: 'account', label: 'Account', width: 32 },
        { key: 'type', label: 'Type', width: 20 },
      ],
    )
  },
})

export const integrationsGithubReposCommand = defineCommand({
  meta: { name: 'github-repos', description: 'List repositories the GitHub App can reach' },
  args: { installation: { type: 'string', description: 'Installation ID' } },
  async run({ args }) {
    const { token } = await getToken()
    const repos = await listGitHubAppRepositories(token, args.installation)
    if (repos.length === 0) {
      console.log('No repositories found.')
      return
    }
    printTable(
      repos.map((r) => ({
        name: r.fullName ?? r.name ?? '-',
        private: r.private ? 'yes' : 'no',
      })),
      [
        { key: 'name', label: 'Repository', width: 48 },
        { key: 'private', label: 'Private', width: 8 },
      ],
    )
  },
})

export const integrationsGitlabReposCommand = defineCommand({
  meta: { name: 'gitlab-repos', description: 'List GitLab repositories' },
  async run() {
    const { token } = await getToken()
    const repos = await listGitLabRepositories(token)
    if (repos.length === 0) {
      console.log('No repositories found.')
      return
    }
    printTable(
      repos.map((r) => ({
        name: r.fullName ?? r.name ?? '-',
        private: r.private ? 'yes' : 'no',
      })),
      [
        { key: 'name', label: 'Repository', width: 48 },
        { key: 'private', label: 'Private', width: 8 },
      ],
    )
  },
})

export const integrationsDetailCommand = defineCommand({
  meta: { name: 'detail', description: 'Show the installation details of one platform' },
  args: {
    platform: {
      type: 'positional',
      description: 'Platform (github|gitlab|slack|linear|discord|dolthub)',
      required: true,
    },
    id: { type: 'string', description: 'Installation ID (GitHub only)' },
  },
  async run({ args }) {
    const { token } = await getToken()
    let installation: Record<string, unknown>
    switch (args.platform) {
      case 'github':
        if (!args.id) {
          throw new Error('GitHub details need an installation id (--id).')
        }
        installation = await getGitHubInstallation(token, args.id)
        break
      case 'gitlab':
        installation = await getGitLabInstallation(token)
        break
      case 'slack':
        installation = await getSlackInstallation(token)
        break
      case 'linear':
        installation = await getLinearInstallation(token)
        break
      case 'discord':
        installation = await getDiscordInstallation(token)
        break
      case 'dolthub':
        installation = await getDoltHubInstallation(token)
        break
      default:
        throw new Error(`Unknown platform: ${args.platform}`)
    }
    for (const [key, value] of Object.entries(installation)) {
      console.log(`  ${key}: ${stringifyValue(value)}`)
    }
  },
})
