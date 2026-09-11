/**
 * App Builder tRPC procedures.
 * Source: Kilo-Org/cloud apps/web/src/routers/app-builder-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'

// --- Schemas ---

const ProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  url: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough()

const EligibilitySchema = z.object({
  balance: z.number().optional(),
  minBalance: z.number().optional(),
  accessLevel: z.string().optional(),
  isEligible: z.boolean().optional(),
  eligible: z.boolean().optional(),
  reason: z.string().optional(),
}).passthrough()

// --- Queries ---

/** appBuilder.listProjects */
export async function listAppBuilderProjects(token: string): Promise<unknown[]> {
  return trpcQuery('appBuilder.listProjects', token, z.array(ProjectSchema), {})
}

/** appBuilder.checkEligibility */
export async function checkAppBuilderEligibility(token: string): Promise<unknown> {
  return trpcQuery('appBuilder.checkEligibility', token, EligibilitySchema, {})
}

// --- Mutations ---

/** appBuilder.deployProject */
export async function deployAppBuilderProject(token: string, projectId: string): Promise<unknown> {
  return trpcMutate('appBuilder.deployProject', token, ProjectSchema, { projectId })
}
