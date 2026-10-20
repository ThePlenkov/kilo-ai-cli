/**
 * Deployments — the app-builder build/deploy pipeline.
 * Source: Kilo-Org/cloud apps/web/src/routers/deployments-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'

const DeploymentSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  slug: z.string().optional(),
  status: z.string().optional(),
  url: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  buildId: z.string().optional(),
})

const DeploymentsEnvelope = z.object({
  success: z.boolean().optional(),
  data: z.array(DeploymentSchema).optional(),
  deployments: z.array(DeploymentSchema).optional(),
})

/** deployments.listDeployments */
export async function listDeployments(token: string): Promise<Record<string, unknown>[]> {
  const result = await trpcQuery('deployments.listDeployments', token, DeploymentsEnvelope)
  return result.data ?? result.deployments ?? []
}

/** deployments.getDeployment */
export async function getDeployment(token: string, id: string): Promise<Record<string, unknown>> {
  const result = await trpcQuery(
    'deployments.getDeployment',
    token,
    z.object({ success: z.boolean().optional(), data: DeploymentSchema.optional() }),
    { id },
  )
  return (result.data ?? {}) as Record<string, unknown>
}

/** deployments.getBuildEvents — the build log of one build. */
export async function getBuildEvents(
  token: string,
  deploymentId: string,
  buildId: string,
  limit = 100,
): Promise<Record<string, unknown>[]> {
  const result = await trpcQuery(
    'deployments.getBuildEvents',
    token,
    z.object({ events: z.array(z.record(z.string(), z.unknown())) }),
    { deploymentId, buildId, limit },
  )
  return result.events
}

/** deployments.cancelBuild */
export async function cancelBuild(
  token: string,
  deploymentId: string,
  buildId: string,
): Promise<unknown> {
  return trpcMutate('deployments.cancelBuild', token, z.unknown(), { deploymentId, buildId })
}

/** deployments.deleteDeployment */
export async function deleteDeployment(token: string, id: string): Promise<unknown> {
  return trpcMutate('deployments.deleteDeployment', token, z.unknown(), { id })
}

/** deployments.checkSlugAvailability */
export async function checkSlugAvailability(
  token: string,
  slug: string,
): Promise<Record<string, unknown>> {
  return trpcQuery('deployments.checkSlugAvailability', token, z.record(z.string(), z.unknown()), {
    slug,
  })
}
