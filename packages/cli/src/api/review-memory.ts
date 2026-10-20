/**
 * Review memory — the agent's learned lessons about a repository, and the
 * proposals it raises to change them.
 * Source: Kilo-Org/cloud apps/web/src/routers/code-reviews/review-memory-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { ReviewMemoryProposal } from './types.ts'

const ProposalSchema: z.ZodType<ReviewMemoryProposal> = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    repositoryFullName: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough() as z.ZodType<ReviewMemoryProposal>

/** reviewMemory.getDashboardSummary — counters for the memory dashboard. */
export async function getReviewMemorySummary(
  token: string,
  platform: 'github' | 'gitlab',
  organizationId?: string,
): Promise<Record<string, unknown>> {
  return trpcQuery('reviewMemory.getDashboardSummary', token, z.record(z.string(), z.unknown()), {
    platform,
    organizationId,
  })
}

/** reviewMemory.listProposals — open and closed memory proposals. */
export async function listReviewMemoryProposals(
  token: string,
  input: {
    platform: 'github' | 'gitlab'
    organizationId?: string
    status?: string
    limit?: number
    offset?: number
  },
): Promise<ReviewMemoryProposal[]> {
  const result = await trpcQuery(
    'reviewMemory.listProposals',
    token,
    z.union([z.array(ProposalSchema), z.object({ proposals: z.array(ProposalSchema) })]),
    { limit: 20, offset: 0, ...input },
  )
  return Array.isArray(result) ? result : result.proposals
}

/** reviewMemory.setEnabled — turn the memory feature on or off. */
export async function setReviewMemoryEnabled(
  token: string,
  platform: 'github' | 'gitlab',
  enabled: boolean,
  organizationId?: string,
): Promise<unknown> {
  return trpcMutate('reviewMemory.setEnabled', token, z.unknown(), {
    platform,
    enabled,
    organizationId,
  })
}

/** reviewMemory.triggerAnalysis — ask the agent to re-analyze a repository. */
export async function triggerReviewMemoryAnalysis(
  token: string,
  platform: 'github' | 'gitlab',
  repositoryFullName: string,
  organizationId?: string,
): Promise<unknown> {
  return trpcMutate('reviewMemory.triggerAnalysis', token, z.unknown(), {
    platform,
    repositoryFullName,
    organizationId,
  })
}

/** reviewMemory.updateProposal */
export async function updateReviewMemoryProposal(
  token: string,
  proposalId: string,
  changes: { title?: string; description?: string },
  platform: 'github' | 'gitlab' = 'github',
): Promise<unknown> {
  return trpcMutate('reviewMemory.updateProposal', token, z.unknown(), {
    proposalId,
    platform,
    ...changes,
  })
}

/** reviewMemory.rejectProposal */
export async function rejectReviewMemoryProposal(
  token: string,
  proposalId: string,
  platform: 'github' | 'gitlab' = 'github',
): Promise<unknown> {
  return trpcMutate('reviewMemory.rejectProposal', token, z.unknown(), {
    proposalId,
    platform,
  })
}

/** reviewMemory.approveAndOpenChangeRequest — accept a proposal. */
export async function approveReviewMemoryProposal(
  token: string,
  proposalId: string,
  platform: 'github' | 'gitlab' = 'github',
): Promise<unknown> {
  return trpcMutate('reviewMemory.approveAndOpenChangeRequest', token, z.unknown(), {
    proposalId,
    platform,
  })
}
