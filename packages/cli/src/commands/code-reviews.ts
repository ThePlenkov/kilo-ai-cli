/**
 * Code Reviews CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  getReviewConfig,
  listCodeReviews,
  toggleReviewAgent,
} from '../api/code-reviews.ts'
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
    console.table(reviews.map((r) => ({
      ID: r.id,
      Title: r.title,
      Status: r.status,
      Platform: r.platform,
      Repo: r.repositoryName ?? '-',
      'PR #': r.pullRequestNumber ?? '-',
    })))
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
