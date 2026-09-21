/**
 * Code Reviews tRPC procedures.
 * Source: Kilo-Org/cloud apps/web/src/routers/code-review-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type {
  CodeReview,
  CodeReviewAttempt,
  CodeReviewConfig,
  CodeReviewDetail,
  ListCodeReviewsOptions,
  ReviewAgentConfig,
  SaveReviewConfigInput,
} from './types.ts'

// --- Schemas ---

const CodeReviewSchema: z.ZodType<CodeReview> = z
  .object({
    id: z.string(),
    owned_by_organization_id: z.string().nullish(),
    owned_by_user_id: z.string().nullish(),
    review_type: z.string().nullish(),
    trigger_source: z.string().nullish(),
    repo_full_name: z.string().nullish(),
    pr_number: z.number().nullish(),
    pr_url: z.string().nullish(),
    pr_title: z.string().nullish(),
    pr_author: z.string().nullish(),
    base_ref: z.string().nullish(),
    head_ref: z.string().nullish(),
    head_sha: z.string().nullish(),
    platform: z.string().nullish(),
    platform_project_id: z.union([z.string(), z.number()]).nullish(),
    session_id: z.string().nullish(),
    cli_session_id: z.string().nullish(),
    status: z.string(),
    error_message: z.string().nullish(),
    terminal_reason: z.string().nullish(),
    agent_version: z.string().nullish(),
    model: z.string().nullish(),
    total_tokens_in: z.number().nullish(),
    total_tokens_out: z.number().nullish(),
    total_cost_musd: z.number().nullish(),
    started_at: z.string().nullish(),
    completed_at: z.string().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough() as z.ZodType<CodeReview>

const CodeReviewAttemptSchema: z.ZodType<CodeReviewAttempt> = z
  .object({
    id: z.string(),
    code_review_id: z.string(),
    attempt_number: z.number(),
    retry_of_attempt_id: z.string().nullish(),
    retry_reason: z.string().nullish(),
    session_id: z.string().nullish(),
    cli_session_id: z.string().nullish(),
    execution_id: z.string().nullish(),
    status: z.string(),
    error_message: z.string().nullish(),
    terminal_reason: z.string().nullish(),
    started_at: z.string().nullish(),
    completed_at: z.string().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough() as z.ZodType<CodeReviewAttempt>

const CodeReviewDetailSchema: z.ZodType<CodeReviewDetail> = z.object({
  review: CodeReviewSchema,
  attempts: z.array(CodeReviewAttemptSchema),
  tokenUsage: z.object({ input: z.number(), output: z.number(), cached: z.number() }).optional(),
  success: z.boolean().optional(),
})

const CodeReviewConfigSchema: z.ZodType<CodeReviewConfig> = z.object({
  isEnabled: z.boolean(),
  platform: z.string(),
  repositoryName: z.string().optional(),
})

const ManuallyAddedRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
})

const ReviewAgentConfigSchema: z.ZodType<ReviewAgentConfig> = z
  .object({
    isEnabled: z.boolean(),
    reviewStyle: z.string().optional(),
    focusAreas: z.array(z.string()).optional(),
    customInstructions: z.string().nullish(),
    modelSlug: z.string().optional(),
    thinkingEffort: z.string().nullish(),
    gateThreshold: z.string().nullish(),
    repositorySelectionMode: z.string().optional(),
    selectedRepositoryIds: z.array(z.number()).optional(),
    manuallyAddedRepositories: z.array(ManuallyAddedRepositorySchema).optional(),
    repositoryModelOverrides: z.array(z.unknown()).optional(),
    disableReviewMd: z.boolean().optional(),
    skipBotPullRequests: z.boolean().optional(),
    reviewMemoryEnabled: z.boolean().optional(),
    council: z.unknown().optional(),
    councilEnabledRepositoryIds: z.array(z.number()).optional(),
    actionRequired: z
      .object({
        reason: z.string(),
        detectedAt: z.string().optional(),
        lastSeenAt: z.string().optional(),
        triggeringReviewId: z.string().optional(),
        lastErrorMessage: z.string().optional(),
        emailSentAt: z.string().optional(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough() as z.ZodType<ReviewAgentConfig>

/** Build a SaveReviewConfigInput from an existing config, overriding selected fields. */
export function toSaveReviewConfigInput(
  platform: string,
  config: ReviewAgentConfig,
  overrides: Partial<SaveReviewConfigInput> = {},
): SaveReviewConfigInput {
  return {
    platform,
    reviewStyle: config.reviewStyle ?? 'balanced',
    focusAreas: config.focusAreas ?? [],
    modelSlug: config.modelSlug ?? 'auto',
    customInstructions: config.customInstructions ?? undefined,
    thinkingEffort: config.thinkingEffort,
    repositorySelectionMode: config.repositorySelectionMode,
    selectedRepositoryIds: config.selectedRepositoryIds,
    manuallyAddedRepositories: config.manuallyAddedRepositories,
    repositoryModelOverrides: config.repositoryModelOverrides,
    disableReviewMd: config.disableReviewMd,
    gateThreshold: config.gateThreshold ?? undefined,
    ...overrides,
  }
}

// --- Top-level procedures (personal scope) ---

/** codeReviews.listForUser — personal code reviews, no org required. */
export async function listCodeReviewsForUser(
  token: string,
  options: ListCodeReviewsOptions = {},
): Promise<CodeReview[]> {
  const r = await trpcQuery(
    'codeReviews.listForUser',
    token,
    z.object({ reviews: z.array(CodeReviewSchema) }),
    options,
  )
  return r.reviews
}

/** codeReviews.get — single review with attempts + token usage. */
export async function getCodeReview(token: string, reviewId: string): Promise<CodeReviewDetail> {
  return trpcQuery('codeReviews.get', token, CodeReviewDetailSchema, { reviewId })
}

/** codeReviews.listForOrganization — tolerates both bare array and { reviews } envelope. */
export async function listCodeReviews(
  token: string,
  organizationId: string,
  options: ListCodeReviewsOptions = {},
): Promise<CodeReview[]> {
  const r = await trpcQuery(
    'codeReviews.listForOrganization',
    token,
    z.union([z.array(CodeReviewSchema), z.object({ reviews: z.array(CodeReviewSchema) })]),
    { organizationId, ...options },
  )
  return Array.isArray(r) ? r : r.reviews
}

/** Procedures wrapped in successResult/failureResult return { success, ... } in a 200 envelope. */
const MutationResultSchema = z
  .object({
    success: z.boolean().optional(),
    message: z.string().optional(),
    error: z.unknown().optional(),
  })
  .passthrough()

function assertMutationOk(procedure: string, result: { success?: boolean; error?: unknown }): void {
  if (result.success === false) {
    const detail =
      typeof result.error === 'string'
        ? result.error
        : result.error instanceof Error
          ? result.error.message
          : JSON.stringify(result.error)
    throw new Error(`${procedure} failed: ${detail}`)
  }
}

/** codeReviews.cancel — cancel a pending/queued/running review. */
export async function cancelCodeReview(token: string, reviewId: string): Promise<void> {
  const r = await trpcMutate('codeReviews.cancel', token, MutationResultSchema, { reviewId })
  assertMutationOk('codeReviews.cancel', r)
}

/** codeReviews.retrigger — re-run a failed, cancelled, or interrupted review. */
export async function retriggerCodeReview(token: string, reviewId: string): Promise<void> {
  const r = await trpcMutate('codeReviews.retrigger', token, MutationResultSchema, { reviewId })
  assertMutationOk('codeReviews.retrigger', r)
}

// --- Organization-scoped procedures ---

/** organizations.codeReviews.listGitLabRepositories */
export async function listGitLabRepositories(
  token: string,
  organizationId: string,
  forceRefresh?: boolean,
): Promise<{ id: string; name: string; url: string }[]> {
  return trpcQuery(
    'organizations.codeReviews.listGitLabRepositories',
    token,
    z.array(z.object({ id: z.string(), name: z.string(), url: z.string() })),
    { organizationId, forceRefresh: forceRefresh ?? false },
  )
}

/** organizations.codeReviews.getReviewConfig */
export async function getReviewConfig(
  token: string,
  organizationId: string,
  platform: string,
): Promise<CodeReviewConfig> {
  return trpcQuery('organizations.codeReviews.getReviewConfig', token, CodeReviewConfigSchema, {
    organizationId,
    platform,
  })
}

/** organizations.reviewAgent.toggleReviewAgent */
export async function toggleReviewAgent(
  token: string,
  organizationId: string,
  platform: string,
  isEnabled: boolean,
): Promise<void> {
  await trpcMutate('organizations.reviewAgent.toggleReviewAgent', token, z.unknown(), {
    organizationId,
    platform,
    isEnabled,
  })
}

// --- Personal review agent (personalReviewAgent.*) ---

/** personalReviewAgent.getReviewConfig — full personal review agent config. */
export async function getPersonalReviewConfig(
  token: string,
  platform: string,
): Promise<ReviewAgentConfig> {
  return trpcQuery('personalReviewAgent.getReviewConfig', token, ReviewAgentConfigSchema, {
    platform,
  })
}

/** personalReviewAgent.saveReviewConfig */
export async function savePersonalReviewConfig(
  token: string,
  input: SaveReviewConfigInput,
): Promise<void> {
  await trpcMutate('personalReviewAgent.saveReviewConfig', token, z.unknown(), input)
}

/** personalReviewAgent.toggleReviewAgent */
export async function togglePersonalReviewAgent(
  token: string,
  platform: string,
  isEnabled: boolean,
): Promise<void> {
  await trpcMutate('personalReviewAgent.toggleReviewAgent', token, z.unknown(), {
    platform,
    isEnabled,
  })
}

// --- Organization review agent (organizations.reviewAgent.*) ---

/** organizations.reviewAgent.getReviewConfig — full org review agent config. */
export async function getOrgReviewAgentConfig(
  token: string,
  organizationId: string,
  platform: string,
): Promise<ReviewAgentConfig> {
  return trpcQuery(
    'organizations.reviewAgent.getReviewConfig',
    token,
    ReviewAgentConfigSchema,
    { organizationId, platform },
    { organizationId },
  )
}

/** organizations.reviewAgent.saveReviewConfig */
export async function saveOrgReviewConfig(
  token: string,
  organizationId: string,
  input: SaveReviewConfigInput,
): Promise<void> {
  await trpcMutate(
    'organizations.reviewAgent.saveReviewConfig',
    token,
    z.unknown(),
    { ...input, organizationId },
    { organizationId },
  )
}
