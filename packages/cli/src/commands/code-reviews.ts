/**
 * Code Reviews CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  getCodeReview,
  getReviewConfig,
  listCodeReviews,
  listCodeReviewsForUser,
  toggleReviewAgent,
} from '../api/code-reviews.ts'
import { printTable, sanitize } from './format.ts'
import { getToken } from './helpers.ts'

function printReviews(reviews: Awaited<ReturnType<typeof listCodeReviewsForUser>>) {
  if (reviews.length === 0) {
    console.log('No code reviews found.')
    return
  }
  printTable(
    reviews.map((r) => ({
      id: r.id,
      title: r.pr_title ?? '-',
      status: r.status,
      platform: r.platform ?? '-',
      repo: r.repo_full_name ?? '-',
      pr: r.pr_number ?? '-',
      model: r.model ?? '-',
    })),
    [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'title', label: 'Title', width: 40 },
      { key: 'status', label: 'Status', width: 10 },
      { key: 'platform', label: 'Platform', width: 8 },
      { key: 'repo', label: 'Repo', width: 28 },
      { key: 'pr', label: 'PR', width: 6, align: 'right' },
      { key: 'model', label: 'Model', width: 24 },
    ],
  )
}

export const reviewsListCommand = defineCommand({
  meta: { name: 'list', description: 'List code reviews (personal by default; pass an org id for org reviews)' },
  args: {
    id: { type: 'positional', description: 'Organization ID (same as --org)', required: false },
    org: { type: 'string', description: 'Organization ID (omit for personal reviews)' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const orgId = args.org ?? args.id
    const reviews = orgId
      ? await listCodeReviews(token, orgId)
      : await listCodeReviewsForUser(token)
    printReviews(reviews)
  },
})

export const reviewsGetCommand = defineCommand({
  meta: { name: 'get', description: 'Get a code review with attempts and token usage' },
  args: { id: { type: 'positional', description: 'Review ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const { review, attempts, tokenUsage } = await getCodeReview(token, args.id)
    console.log(`ID: ${review.id}`)
    console.log(`Title: ${sanitize(review.pr_title ?? '-')}`)
    console.log(`Status: ${review.status}`)
    console.log(`Repo: ${sanitize(review.repo_full_name ?? '-')}  PR #${review.pr_number ?? '?'}`)
    if (review.pr_url) console.log(`URL: ${sanitize(review.pr_url)}`)
    if (review.model) console.log(`Model: ${review.model}`)
    if (review.error_message) console.log(`Error: ${sanitize(review.error_message)}`)
    if (tokenUsage) {
      console.log(`Tokens: in ${tokenUsage.input} / out ${tokenUsage.output} / cached ${tokenUsage.cached}`)
    }
    if (attempts.length > 0) {
      console.log(`\nAttempts (${attempts.length}):`)
      printTable(
        attempts.map((a) => ({
          n: a.attempt_number,
          status: a.status,
          started: a.started_at ?? '-',
          completed: a.completed_at ?? '-',
          error: sanitize(a.error_message ?? '-'),
        })),
        [
          { key: 'n', label: '#', width: 4, align: 'right' },
          { key: 'status', label: 'Status', width: 12 },
          { key: 'started', label: 'Started', width: 26 },
          { key: 'completed', label: 'Completed', width: 26 },
          { key: 'error', label: 'Error', width: 30 },
        ],
      )
    }
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
