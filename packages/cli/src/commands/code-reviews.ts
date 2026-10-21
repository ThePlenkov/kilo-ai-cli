/**
 * Code Reviews CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  cancelCodeReview,
  getCodeReview,
  getOrgReviewAgentConfig,
  getPersonalReviewConfig,
  listCodeReviews,
  listCodeReviewsForUser,
  listCodeReviewsPage,
  listOrgCodeReviewsPage,
  retriggerCodeReview,
  saveOrgReviewConfig,
  savePersonalReviewConfig,
  togglePersonalReviewAgent,
  toggleReviewAgent,
  toSaveReviewConfigInput,
} from '../api/code-reviews.ts'
import {
  approveReviewMemoryProposal,
  getReviewMemorySummary,
  listReviewMemoryProposals,
  rejectReviewMemoryProposal,
  setReviewMemoryEnabled,
  triggerReviewMemoryAnalysis,
} from '../api/review-memory.ts'
import type { CodeReview, ReviewAgentConfig } from '../api/types.ts'
import { applyDeltaAsync, resolveSince } from '../state/delta.ts'
import { printTable, sanitize } from './format.ts'
import { getToken } from './helpers.ts'

const PLATFORMS = ['github', 'gitlab'] as const

/** Cursor name used by `reviews list --new`. */
export const REVIEWS_CURSOR = 'reviews'

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
      author: r.pr_author ?? '-',
      model: r.model ?? '-',
      cost: r.total_cost_musd != null ? `$${(r.total_cost_musd / 1000).toFixed(3)}` : '-',
    })),
    [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'title', label: 'Title', width: 40 },
      { key: 'status', label: 'Status', width: 10 },
      { key: 'platform', label: 'Platform', width: 8 },
      { key: 'repo', label: 'Repo', width: 28 },
      { key: 'pr', label: 'PR', width: 6, align: 'right' },
      { key: 'author', label: 'Author', width: 16 },
      { key: 'model', label: 'Model', width: 24 },
      { key: 'cost', label: 'Cost', width: 10, align: 'right' },
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
  if (config.customInstructions)
    console.log(`Custom instructions: ${sanitize(config.customInstructions)}`)
  if (config.thinkingEffort) console.log(`Thinking effort: ${sanitize(config.thinkingEffort)}`)
  if (config.repositorySelectionMode)
    console.log(`Repositories: ${sanitize(config.repositorySelectionMode)}`)
  if (config.disableReviewMd != null)
    console.log(`Disable review.md: ${config.disableReviewMd ? 'yes' : 'no'}`)
  if (config.skipBotPullRequests != null)
    console.log(`Skip bot PRs: ${config.skipBotPullRequests ? 'yes' : 'no'}`)
  if (config.reviewMemoryEnabled != null)
    console.log(`Review memory: ${config.reviewMemoryEnabled ? 'enabled' : 'disabled'}`)
  if (config.councilEnabledRepositoryIds?.length)
    console.log(`Council repos: ${config.councilEnabledRepositoryIds.join(', ')}`)
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

/**
 * Cursor name for the reviews delta. Personal and organization reviews live
 * in separate scopes, so they get separate cursors — reading one scope must
 * not advance past the other.
 */
export function reviewsCursorName(orgId?: string): string {
  return orgId ? `${REVIEWS_CURSOR}:${orgId}` : REVIEWS_CURSOR
}

/** Page size used when walking the review list for a delta read. */
const REVIEWS_PAGE_LIMIT = 100

/** Upper bound on the number of pages a delta read walks. */
const REVIEWS_MAX_PAGES = 20

/** Pages read past the last page that still contained a newer review. */
const REVIEWS_TRAILING_PAGES = 2

/**
 * Walk the review list until the delta window is exhausted, so the cursor is
 * only advanced once every newer review has been seen.
 *
 * The list is ordered by `created_at` descending and reviews are updated
 * shortly after they are created, so a page without any review newer than
 * the bound marks the end of the window. Two extra pages are read past that
 * point as slack for long-running reviews.
 *
 * Returns `complete: false` when the page budget runs out — the cursor must
 * then stay put, otherwise unseen reviews would be skipped.
 */
async function fetchReviewWindow(
  token: string,
  orgId: string | undefined,
  options: { limit?: number; status?: string; platform?: string; repoFullName?: string },
  bound: string | undefined,
): Promise<{ reviews: CodeReview[]; complete: boolean }> {
  const reviews: CodeReview[] = []
  const boundEpoch = bound ? Date.parse(bound) : undefined
  let offset = 0
  let emptyPages = 0
  for (let page = 0; page < REVIEWS_MAX_PAGES; page++) {
    const request = { ...options, limit: options.limit ?? REVIEWS_PAGE_LIMIT, offset }
    const fetchPage = orgId
      ? () => listOrgCodeReviewsPage(token, orgId, request)
      : () => listCodeReviewsPage(token, request)
    // oxlint-disable-next-line no-await-in-loop -- offset pagination is sequential
    const result = await fetchPage()
    reviews.push(...result.reviews)

    // A bare-array response carries no `hasMore`; a full page then means
    // there are more pages behind it.
    const hasMore = result.hasMore ?? result.reviews.length >= request.limit

    if (boundEpoch !== undefined) {
      const hasNewer = result.reviews.some((r) => {
        const at = Date.parse(r.updated_at ?? r.created_at)
        return Number.isFinite(at) && at > boundEpoch
      })
      emptyPages = hasNewer ? 0 : emptyPages + 1
      if (emptyPages > REVIEWS_TRAILING_PAGES) return { reviews, complete: true }
    }

    if (!hasMore) return { reviews, complete: true }
    offset += request.limit
    if (page === REVIEWS_MAX_PAGES - 1) {
      console.log(
        `More than ${REVIEWS_MAX_PAGES * REVIEWS_PAGE_LIMIT} reviews match; the cursor was not advanced.`,
      )
      return { reviews, complete: false }
    }
  }
  return { reviews, complete: false }
}

export const reviewsListCommand = defineCommand({
  meta: {
    name: 'list',
    description:
      'List code reviews (personal by default; pass an org id for org reviews). Use --new for the delta since the last run.',
  },
  args: {
    id: { type: 'positional', description: 'Organization ID (same as --org)', required: false },
    org: { type: 'string', description: 'Organization ID (omit for personal reviews)' },
    new: { type: 'boolean', description: 'Only reviews newer than the stored cursor' },
    since: { type: 'string', description: 'Explicit lower bound (ISO timestamp)' },
    'no-advance': { type: 'boolean', description: 'Do not advance the stored cursor' },
    limit: { type: 'string', description: 'Max reviews per page (default 50)' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const orgId = args.org ?? args.id
    const options = { limit: args.limit ? Number.parseInt(args.limit, 10) : undefined }
    const cursorName = reviewsCursorName(orgId)

    const isDeltaRead = args.new || args.since !== undefined
    if (!isDeltaRead) {
      const reviews = orgId
        ? await listCodeReviews(token, orgId, options)
        : await listCodeReviewsForUser(token, options)
      printReviews(reviews)
      return
    }

    const bound = await resolveSince({ cursor: cursorName, since: args.since })
    const { reviews, complete } = await fetchReviewWindow(token, orgId, options, bound)
    const delta = await applyDeltaAsync(reviews, (r) => r.updated_at ?? r.created_at, {
      cursor: cursorName,
      since: args.since,
      advance: !args['no-advance'],
      complete,
    })
    if (delta.advancedTo) {
      console.log(`Cursor "${cursorName}" advanced to ${delta.advancedTo}`)
    }
    printReviews(delta.items)
  },
})

export const reviewsGetCommand = defineCommand({
  meta: { name: 'get', description: 'Get a code review with attempts and token usage' },
  args: { id: { type: 'positional', description: 'Review ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const { review, attempts, tokenUsage, success } = await getCodeReview(token, args.id)
    console.log(`ID: ${sanitize(review.id)}`)
    console.log(`Title: ${sanitize(review.pr_title ?? '-')}`)
    console.log(`Status: ${sanitize(review.status)}`)
    if (success != null) console.log(`Success: ${success ? 'yes' : 'no'}`)
    console.log(`Repo: ${sanitize(review.repo_full_name ?? '-')}  PR #${review.pr_number ?? '?'}`)
    if (review.pr_author) console.log(`Author: ${sanitize(review.pr_author)}`)
    if (review.pr_url) console.log(`URL: ${sanitize(review.pr_url)}`)
    if (review.model) console.log(`Model: ${sanitize(review.model)}`)
    if (review.agent_version) console.log(`Agent version: ${sanitize(review.agent_version)}`)
    if (review.trigger_source) console.log(`Trigger: ${sanitize(review.trigger_source)}`)
    if (review.error_message) console.log(`Error: ${sanitize(review.error_message)}`)
    if (review.terminal_reason) console.log(`Terminal reason: ${sanitize(review.terminal_reason)}`)
    if (review.total_tokens_in != null || review.total_tokens_out != null) {
      console.log(`Tokens: in ${review.total_tokens_in ?? 0} / out ${review.total_tokens_out ?? 0}`)
    }
    if (review.total_cost_musd != null)
      console.log(`Cost: $${(review.total_cost_musd / 1000).toFixed(3)}`)
    if (review.started_at) console.log(`Started: ${sanitize(review.started_at)}`)
    if (review.completed_at) console.log(`Completed: ${sanitize(review.completed_at)}`)
    if (tokenUsage) {
      console.log(
        `Token usage: in ${tokenUsage.input} / out ${tokenUsage.output} / cached ${tokenUsage.cached}`,
      )
    }
    if (attempts.length > 0) {
      console.log(`\nAttempts (${attempts.length}):`)
      printTable(
        attempts.map((a) => ({
          n: a.attempt_number,
          status: a.status,
          reason: a.retry_reason ?? '-',
          started: a.started_at ?? '-',
          completed: a.completed_at ?? '-',
          error: sanitize(a.error_message ?? '-'),
        })),
        [
          { key: 'n', label: '#', width: 4, align: 'right' },
          { key: 'status', label: 'Status', width: 12 },
          { key: 'reason', label: 'Retry reason', width: 20 },
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
      'Set the review agent model and optionally other config (personal by default; --org for organization)',
  },
  args: {
    platform: { type: 'positional', description: 'Platform (github/gitlab)', required: true },
    model: { type: 'positional', description: 'Model slug (e.g. kilo-auto/free)', required: true },
    org: { type: 'string', description: 'Organization ID (omit for personal agent)' },
    style: { type: 'string', description: 'Review style (e.g. thorough/concise)' },
    'focus-areas': { type: 'string', description: 'Comma-separated focus areas' },
    instructions: { type: 'string', description: 'Custom instructions for the review agent' },
    thinking: { type: 'string', description: 'Thinking effort (e.g. low/medium/high)' },
    gate: { type: 'string', description: 'Gate threshold (e.g. strict/standard/loose)' },
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
    const overrides: {
      modelSlug: string
      reviewStyle?: string
      focusAreas?: string[]
      customInstructions?: string
      thinkingEffort?: string
      gateThreshold?: string
    } = { modelSlug: args.model }
    if (args.style !== undefined) overrides.reviewStyle = args.style
    if (args['focus-areas'] !== undefined)
      overrides.focusAreas = args['focus-areas']
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    if (args.instructions !== undefined) overrides.customInstructions = args.instructions
    if (args.thinking !== undefined) overrides.thinkingEffort = args.thinking
    if (args.gate !== undefined) overrides.gateThreshold = args.gate
    const input = toSaveReviewConfigInput(platform, config, overrides)
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

export const reviewsRetriggerCommand = defineCommand({
  meta: {
    name: 'retrigger',
    description: 'Retrigger a failed, cancelled or interrupted code review',
  },
  args: { id: { type: 'positional', description: 'Review ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await retriggerCodeReview(token, args.id)
    console.log(`Review ${args.id} retriggered`)
  },
})

export const reviewsCancelCommand = defineCommand({
  meta: {
    name: 'cancel',
    description: 'Cancel a pending, queued or running code review',
  },
  args: { id: { type: 'positional', description: 'Review ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await cancelCodeReview(token, args.id)
    console.log(`Review ${args.id} cancelled`)
  },
})

// --- Review memory ---

export const reviewsMemorySummaryCommand = defineCommand({
  meta: { name: 'memory-summary', description: 'Show the review memory dashboard summary' },
  args: {
    platform: { type: 'string', description: 'Platform (github|gitlab)', default: 'github' },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const summary = await getReviewMemorySummary(
      token,
      args.platform as 'github' | 'gitlab',
      args.org,
    )
    for (const [key, value] of Object.entries(summary)) {
      console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    }
  },
})

export const reviewsMemoryProposalsCommand = defineCommand({
  meta: { name: 'memory-proposals', description: 'List review memory proposals' },
  args: {
    platform: { type: 'string', description: 'Platform (github|gitlab)', default: 'github' },
    org: { type: 'string', description: 'Organization ID' },
    status: { type: 'string', description: 'Filter by status' },
    limit: { type: 'string', description: 'Max proposals', default: '20' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const proposals = await listReviewMemoryProposals(token, {
      platform: args.platform as 'github' | 'gitlab',
      organizationId: args.org,
      status: args.status,
      limit: Number.parseInt(args.limit, 10) || 20,
    })
    if (proposals.length === 0) {
      console.log('No review memory proposals found.')
      return
    }
    printTable(
      proposals.map((p) => ({
        id: p.id,
        status: p.status ?? '-',
        title: p.title ?? '-',
        repo: p.repositoryFullName ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'status', label: 'Status', width: 12 },
        { key: 'title', label: 'Title', width: 40 },
        { key: 'repo', label: 'Repository', width: 32 },
      ],
    )
  },
})

export const reviewsMemoryEnableCommand = defineCommand({
  meta: { name: 'memory-enable', description: 'Enable or disable the review memory' },
  args: {
    platform: { type: 'string', description: 'Platform (github|gitlab)', default: 'github' },
    org: { type: 'string', description: 'Organization ID' },
    disable: { type: 'boolean', description: 'Disable instead of enable' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const enabled = !args.disable
    await setReviewMemoryEnabled(token, args.platform as 'github' | 'gitlab', enabled, args.org)
    console.log(`Review memory ${enabled ? 'enabled' : 'disabled'} for ${args.platform}`)
  },
})

export const reviewsMemoryAnalyzeCommand = defineCommand({
  meta: { name: 'memory-analyze', description: 'Trigger a review memory analysis' },
  args: {
    repo: { type: 'positional', description: 'Repository full name (owner/repo)', required: true },
    platform: { type: 'string', description: 'Platform (github|gitlab)', default: 'github' },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await triggerReviewMemoryAnalysis(
      token,
      args.platform as 'github' | 'gitlab',
      args.repo,
      args.org,
    )
    console.log(`Review memory analysis triggered for ${args.repo}`)
  },
})

export const reviewsMemoryApproveCommand = defineCommand({
  meta: { name: 'memory-approve', description: 'Approve a review memory proposal' },
  args: {
    id: { type: 'positional', description: 'Proposal ID', required: true },
    platform: { type: 'string', description: 'Platform (github|gitlab)', default: 'github' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await approveReviewMemoryProposal(token, args.id, args.platform as 'github' | 'gitlab')
    console.log(`Approved proposal ${args.id}`)
  },
})

export const reviewsMemoryRejectCommand = defineCommand({
  meta: { name: 'memory-reject', description: 'Reject a review memory proposal' },
  args: {
    id: { type: 'positional', description: 'Proposal ID', required: true },
    platform: { type: 'string', description: 'Platform (github|gitlab)', default: 'github' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await rejectReviewMemoryProposal(token, args.id, args.platform as 'github' | 'gitlab')
    console.log(`Rejected proposal ${args.id}`)
  },
})
