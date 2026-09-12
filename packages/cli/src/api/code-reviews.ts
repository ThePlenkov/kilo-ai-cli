/**
 * Code Reviews tRPC procedures.
 * Source: Kilo-Org/cloud apps/web/src/routers/code-review-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { CodeReview, CodeReviewConfig } from './types.ts'

// --- Schemas ---

const CodeReviewSchema: z.ZodType<CodeReview> = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  platform: z.string(),
  repositoryName: z.string().optional(),
  pullRequestNumber: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const CodeReviewConfigSchema: z.ZodType<CodeReviewConfig> = z.object({
  isEnabled: z.boolean(),
  platform: z.string(),
  repositoryName: z.string().optional(),
})

// --- Top-level procedures ---

/** codeReviews.listForOrganization */
export async function listCodeReviews(token: string, organizationId: string): Promise<CodeReview[]> {
  return trpcQuery('codeReviews.listForOrganization', token, z.array(CodeReviewSchema), { organizationId })
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
