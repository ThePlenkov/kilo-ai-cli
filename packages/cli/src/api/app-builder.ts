/**
 * App Builder tRPC procedures.
 * Source: Kilo-Org/cloud apps/web/src/routers/app-builder-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { AppBuilderEligibility, AppBuilderProject } from './types.ts'

// --- Schemas ---

const ProjectSchema: z.ZodType<AppBuilderProject> = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  url: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const EligibilitySchema: z.ZodType<AppBuilderEligibility> = z.object({
  eligible: z.boolean(),
  reason: z.string().optional(),
})

// --- Queries ---

/** appBuilder.listProjects */
export async function listAppBuilderProjects(token: string): Promise<AppBuilderProject[]> {
  return trpcQuery('appBuilder.listProjects', token, z.array(ProjectSchema))
}

/** appBuilder.checkEligibility */
export async function checkAppBuilderEligibility(token: string): Promise<AppBuilderEligibility> {
  return trpcQuery('appBuilder.checkEligibility', token, EligibilitySchema)
}

// --- Mutations ---

/** appBuilder.deployProject */
export async function deployAppBuilderProject(token: string, projectId: string): Promise<AppBuilderProject> {
  return trpcMutate('appBuilder.deployProject', token, ProjectSchema, { projectId })
}
