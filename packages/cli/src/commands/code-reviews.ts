/**
 * Code Reviews CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  getCodeReview,
  getOrgReviewAgentConfig,
  getPersonalReviewConfig,
  listCodeReviews,
  listCodeReviewsForUser,
  saveOrgReviewConfig,
  savePersonalReviewConfig,
  togglePersonalReviewAgent,
  toggleReviewAgent,
  toSaveReviewConfigInput,
} from '../api/code-reviews.ts'
import type { ReviewAgentConfig } from '../api/types.ts'
import { printTable, sanitize } from './format.ts'
import { getToken } from './helpers.ts'

const PLATFORMS = ['github', 'gitlab'] as const

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

function printAgentConfig(config: ReviewAgentConfig, platform: string, scope: string) {
  console.log(`Scope: ${scope}`)
  console.log(`Platform: ${platform}`)
  console.log(`Enabled: ${config.isEnabled ? 'yes' : 'no'}`)
  if (config.modelSlug) console.log(`Model: ${sanitize(config.modelSlug)}`)
  if (config.reviewStyle) console.log(`Style: ${sanitize(config.reviewStyle)}`)
  if (config.gateThreshold) console.log(`Gate threshold: ${sanitize(config.gateThreshold)}`)
  if (config.focusAreas?.length)
    console.log(`Focus areas: ${config.focusAreas.map(sanitize).join(', ')}`)
  if (config.repositorySelectionMode)
    console.log(`Repositories: ${sanitize(config.repositorySelectionMode)}`)
  const action = config.actionRequired
  if (action) {
    console.log(`\nNeeds attention: ${sanitize(action.reason)}`)
    if (action.lastErrorMessage) console.log(sanitize(action.lastErrorMessage))
  }
}

/** Resolve "platform" (personal) or "org platform" positional forms plus the --org flag. */
function resolveScope(args: { scope?: string; platform?: string; org?: string }): {
  platform: string
  orgId?: string
} {
  const orgId = args.org ?? (args.platform ? args.scope : undefined)
  const platform = args.platform ?? args.scope
  if (!platform || !PLATFORMS.includes(platform as (typeof PLATFORMS)[number])) {
    throw new Error(`Platform must be one of: ${PLATFORMS.join(', ')}`)
  }
  return { platform, orgId }
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
    console.log(`ID: ${sanitize(review.id)}`)
    console.log(`Title: ${sanitize(review.pr_title ?? '-')}`)
    console.log(`Status: ${sanitize(review.status)}`)
    console.log(`Repo: ${sanitize(review.repo_full_name ?? '-')}  PR #${review.pr_number ?? '?'}`)
    if (review.pr_url) console.log(`URL: ${sanitize(review.pr_url)}`)
    if (review.model) console.log(`Model: ${sanitize(review.model)}`)
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
  meta: {
    name: 'config',
    description:
      'Show review agent configuration (personal: `config <platform>`; org: `config <org> <platform>` or --org)',
  },
  args: {
    scope: {
      type: 'positional',
      description: 'Platform (github/gitlab), or Organization ID when a second arg is given',
      required: true,
    },
    platform: {
      type: 'positional',
      description: 'Platform (github/gitlab) when the first arg is an Organization ID',
      required: false,
    },
    org: { type: 'string', description: 'Organization ID (omit for personal config)' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const { platform, orgId } = resolveScope(args)
    if (orgId) {
      const config = await getOrgReviewAgentConfig(token, orgId, platform)
      printAgentConfig(config, platform, `org ${orgId}`)
    } else {
      const config = await getPersonalReviewConfig(token, platform)
      printAgentConfig(config, platform, 'personal')
    }
  },
})

export const reviewsToggleCommand = defineCommand({
  meta: {
    name: 'toggle',
    description:
      'Toggle review agent on/off (personal: `toggle <platform>`; org: `toggle <org> <platform>` or --org)',
  },
  args: {
    scope: {
      type: 'positional',
      description: 'Platform (github/gitlab), or Organization ID when a second arg is given',
      required: true,
    },
    platform: {
      type: 'positional',
      description: 'Platform (github/gitlab) when the first arg is an Organization ID',
      required: false,
    },
    org: { type: 'string', description: 'Organization ID (omit for personal agent)' },
    enabled: { type: 'boolean', description: 'Enable or disable', required: true },
  },
  async run({ args }) {
    const { token } = await getToken()
    const { platform, orgId } = resolveScope(args)
    if (orgId) {
      await toggleReviewAgent(token, orgId, platform, args.enabled)
      console.log(
        `Review agent ${args.enabled ? 'enabled' : 'disabled'} for ${platform} (org ${orgId})`,
      )
    } else {
      await togglePersonalReviewAgent(token, platform, args.enabled)
      console.log(
        `Review agent ${args.enabled ? 'enabled' : 'disabled'} for ${platform} (personal)`,
      )
    }
  },
})

export const reviewsSetModelCommand = defineCommand({
  meta: {
    name: 'set-model',
    description:
      'Set the review agent model, preserving other config (personal by default; --org for organization)',
  },
  args: {
    platform: { type: 'positional', description: 'Platform (github/gitlab)', required: true },
    model: { type: 'positional', description: 'Model slug (e.g. kilo-auto/free)', required: true },
    org: { type: 'string', description: 'Organization ID (omit for personal agent)' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const platform = args.platform
    if (!PLATFORMS.includes(platform as (typeof PLATFORMS)[number])) {
      throw new Error(`Platform must be one of: ${PLATFORMS.join(', ')}`)
    }
    const orgId = args.org
    const config = orgId
      ? await getOrgReviewAgentConfig(token, orgId, platform)
      : await getPersonalReviewConfig(token, platform)
    const input = toSaveReviewConfigInput(platform, config, { modelSlug: args.model })
    if (orgId) {
      await saveOrgReviewConfig(token, orgId, input)
    } else {
      await savePersonalReviewConfig(token, input)
    }
    console.log(
      `Review agent model set to ${args.model} for ${platform} (${orgId ? `org ${orgId}` : 'personal'})`,
    )
    if (!config.isEnabled || config.actionRequired) {
      console.log(
        `Note: agent is disabled. Re-enable with: reviews toggle ${platform} --enabled${orgId ? ` --org ${orgId}` : ''}`,
      )
    }
  },
})
