/**
 * Cloud agent settings — sandbox allocation and per-repository bindings.
 * Source: Kilo-Org/cloud apps/web/src/routers/cloud-agent-settings-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'

const RepositorySettingsSchema = z.looseObject({
  repositoryFullName: z.string(),
  repositoryPlatform: z.string().optional(),
  profileId: z.string().optional(),
  profileName: z.string().optional(),
  allocation: z.string().nullish(),
})

const SettingsSchema = z.object({
  canManage: z.boolean(),
  contextAllocation: z.string().nullish(),
  contextUnavailableReason: z.string().optional(),
  repositories: z.array(RepositorySettingsSchema),
  capabilities: z.unknown().optional(),
  capabilitiesByPlatform: z.unknown().optional(),
})

/** cloudAgentSettings.get */
export async function getCloudAgentSettings(
  token: string,
  organizationId?: string,
): Promise<{
  canManage: boolean
  contextAllocation?: string | null
  repositories: {
    repositoryFullName: string
    repositoryPlatform?: string
    profileId?: string
    profileName?: string
    allocation?: string | null
  }[]
}> {
  return trpcQuery('cloudAgentSettings.get', token, SettingsSchema, { organizationId })
}

/** cloudAgentSettings.setContextAllocation — `null` clears the allocation. */
export async function setContextAllocation(
  token: string,
  allocation: string | null,
  organizationId?: string,
): Promise<void> {
  await trpcMutate('cloudAgentSettings.setContextAllocation', token, z.unknown(), {
    organizationId,
    allocation,
  })
}

/** cloudAgentSettings.setRepositorySettings */
export async function setRepositorySettings(
  token: string,
  input: {
    repositoryFullName: string
    repositoryPlatform?: string
    profileId?: string
    allocation?: string | null
    organizationId?: string
  },
): Promise<void> {
  await trpcMutate('cloudAgentSettings.setRepositorySettings', token, z.unknown(), input)
}

/** cloudAgentSettings.removeRepositorySettings */
export async function removeRepositorySettings(
  token: string,
  input: { repositoryFullName: string; repositoryPlatform?: string; organizationId?: string },
): Promise<void> {
  await trpcMutate('cloudAgentSettings.removeRepositorySettings', token, z.unknown(), input)
}
