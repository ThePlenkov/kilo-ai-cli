/**
 * Code Reviews tRPC procedures.
 * Source: Kilo-Org/cloud apps/web/src/routers/code-review-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { CodeReview, CodeReviewAttempt, CodeReviewConfig, CodeReviewDetail } from './types.ts'

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

// --- Top-level procedures (personal scope) ---

/** codeReviews.listForUser — personal code reviews, no org required. */
export async function listCodeReviewsForUser(token: string): Promise<CodeReview[]> {
  const r = await trpcQuery('codeReviews.listForUser', token, z.object({ reviews: z.array(CodeReviewSchema) }), {})
  return r.reviews
}

/** codeReviews.get — single review with attempts + token usage. */
export async function getCodeReview(token: string, reviewId: string): Promise<CodeReviewDetail> {
  return trpcQuery('codeReviews.get', token, CodeReviewDetailSchema, { reviewId })
}

/** codeReviews.listForOrganization — tolerates both bare array and { reviews } envelope. */
export async function listCodeReviews(token: string, organizationId: string): Promise<CodeReview[]> {
  const r = await trpcQuery(
    'codeReviews.listForOrganization',
    token,
    z.union([z.array(CodeReviewSchema), z.object({ reviews: z.array(CodeReviewSchema) })]),
    { organizationId },
  )
  return Array.isArray(r) ? r : r.reviews
}

// --- Organization-scoped procedures ---

/** organizations.codeReviews.listGitLabRepositories */
export async function listGitLabRepositories(token: string, organizationId: string, forceRefresh?: boolean): Promise<{ id: string; name: string; url: string }[]> {
  return trpcQuery(
    'organizations.codeReviews.listGitLabRepositories',
    token,
    z.array(z.object({ id: z.string(), name: z.string(), url: z.string() })),
    { organizationId, forceRefresh: forceRefresh ?? false },
  )
}

/** organizations.codeReviews.getReviewConfig */
export async function getReviewConfig(token: string, organizationId: string, platform: string): Promise<CodeReviewConfig> {
  return trpcQuery('organizations.codeReviews.getReviewConfig', token, CodeReviewConfigSchema, { organizationId, platform })
}

/** organizations.codeReviews.toggleReviewAgent */
export async function toggleReviewAgent(token: string, organizationId: string, platform: string, isEnabled: boolean): Promise<void> {
  await trpcMutate('organizations.codeReviews.toggleReviewAgent', token, z.unknown(), { organizationId, platform, isEnabled })
}
