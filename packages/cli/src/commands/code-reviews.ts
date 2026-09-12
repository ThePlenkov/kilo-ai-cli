/**
 * Code Reviews CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  getReviewConfig,
  listCodeReviews,
  toggleReviewAgent,
} from '../api/code-reviews.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const reviewsListCommand = defineCommand({
  meta: { name: 'list', description: 'List code reviews for an organization' },
  args: { org: { type: 'positional', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const reviews = await listCodeReviews(token, args.org)
    if (reviews.length === 0) {
      console.log('No code reviews found.')
      return
    }
    printTable(
      reviews.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        platform: r.platform,
        repo: r.repositoryName ?? '-',
        pr: r.pullRequestNumber ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'title', label: 'Title', width: 40 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'platform', label: 'Platform', width: 10 },
        { key: 'repo', label: 'Repo', width: 30 },
        { key: 'pr', label: 'PR #', width: 6, align: 'right' },
      ],
    )
  },
})

export const reviewsConfigCommand = defineCommand({
  meta: { name: 'config', description: 'Get review agent configuration' },
  args: {
    org: { type: 'positional', description: 'Organization ID', required: true },
    platform: { type: 'positional', description: 'Platform (github/gitlab)', required: true },
  },
  async run({ args }) {
    const { token } = await getToken()
    const config = await getReviewConfig(token, args.org, args.platform)
    console.log(`Platform: ${config.platform}`)
    console.log(`Enabled: ${config.isEnabled ? 'yes' : 'no'}`)
    if (config.repositoryName) console.log(`Repository: ${config.repositoryName}`)
  },
})

export const reviewsToggleCommand = defineCommand({
  meta: { name: 'toggle', description: 'Toggle review agent on/off' },
  args: {
    org: { type: 'positional', description: 'Organization ID', required: true },
    platform: { type: 'positional', description: 'Platform (github/gitlab)', required: true },
    enabled: { type: 'boolean', description: 'Enable or disable', required: true },
  },
  async run({ args }) {
    const { token } = await getToken()
    await toggleReviewAgent(token, args.org, args.platform, args.enabled)
    console.log(`Review agent ${args.enabled ? 'enabled' : 'disabled'} for ${args.platform}`)
  },
})
