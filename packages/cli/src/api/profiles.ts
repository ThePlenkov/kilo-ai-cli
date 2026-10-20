/**
 * Agent profiles — the reusable agent configurations (vars, commands, agents,
 * MCP servers, skills, repo bindings) Kilo ships in the web app.
 * Source: Kilo-Org/cloud apps/web/src/routers/agent-profiles-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { AgentProfile, AgentProfileSummary } from './types.ts'

const ProfileSummarySchema: z.ZodType<AgentProfileSummary> = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullish(),
    isDefault: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    varCount: z.number().optional(),
    commandCount: z.number().optional(),
    mcpServerCount: z.number().optional(),
    skillCount: z.number().optional(),
    agentCount: z.number().optional(),
    kiloCommandCount: z.number().optional(),
    instructionCount: z.number().optional(),
  })
  .passthrough() as z.ZodType<AgentProfileSummary>

const ProfileSchema: z.ZodType<AgentProfile> = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullish(),
    isDefault: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    variables: z.record(z.string(), z.unknown()).optional(),
    commands: z.array(z.unknown()).optional(),
    agents: z.array(z.unknown()).optional(),
    mcpServers: z.array(z.unknown()).optional(),
    skills: z.array(z.unknown()).optional(),
    repoBindings: z.array(z.unknown()).optional(),
  })
  .passthrough() as z.ZodType<AgentProfile>

/** agentProfiles.list — profiles of the current scope. */
export async function listAgentProfiles(
  token: string,
  organizationId?: string,
): Promise<AgentProfileSummary[]> {
  return trpcQuery('agentProfiles.list', token, z.array(ProfileSummarySchema), { organizationId })
}

/** agentProfiles.listCombined — org and personal profiles side by side. */
export async function listCombinedAgentProfiles(
  token: string,
  organizationId: string,
): Promise<{
  orgProfiles: AgentProfileSummary[]
  personalProfiles: AgentProfileSummary[]
  effectiveDefaultId?: string | null
}> {
  return trpcQuery(
    'agentProfiles.listCombined',
    token,
    z.object({
      orgProfiles: z.array(ProfileSummarySchema),
      personalProfiles: z.array(ProfileSummarySchema),
      effectiveDefaultId: z.string().nullish(),
    }),
    { organizationId },
  )
}

/** agentProfiles.get */
export async function getAgentProfile(
  token: string,
  profileId: string,
  organizationId?: string,
): Promise<AgentProfile> {
  return trpcQuery('agentProfiles.get', token, ProfileSchema, { profileId, organizationId })
}

/** agentProfiles.create */
export async function createAgentProfile(
  token: string,
  name: string,
  description?: string,
  organizationId?: string,
): Promise<{ id: string }> {
  return trpcMutate('agentProfiles.create', token, z.object({ id: z.string() }), {
    name,
    description,
    organizationId,
  })
}

/** agentProfiles.update */
export async function updateAgentProfile(
  token: string,
  profileId: string,
  changes: { name?: string; description?: string },
  organizationId?: string,
): Promise<void> {
  await trpcMutate('agentProfiles.update', token, z.unknown(), {
    profileId,
    ...changes,
    organizationId,
  })
}

/** agentProfiles.delete */
export async function deleteAgentProfile(
  token: string,
  profileId: string,
  organizationId?: string,
): Promise<void> {
  await trpcMutate('agentProfiles.delete', token, z.unknown(), { profileId, organizationId })
}

/** agentProfiles.setAsDefault */
export async function setDefaultAgentProfile(
  token: string,
  profileId: string,
  organizationId?: string,
): Promise<void> {
  await trpcMutate('agentProfiles.setAsDefault', token, z.unknown(), { profileId, organizationId })
}

/** agentProfiles.clearDefault */
export async function clearDefaultAgentProfile(
  token: string,
  profileId: string,
  organizationId?: string,
): Promise<void> {
  await trpcMutate('agentProfiles.clearDefault', token, z.unknown(), { profileId, organizationId })
}

/** agentProfiles.setVar */
export async function setProfileVariable(
  token: string,
  profileId: string,
  variable: { key: string; value: string; isSecret: boolean },
  organizationId?: string,
): Promise<void> {
  await trpcMutate('agentProfiles.setVar', token, z.unknown(), {
    profileId,
    ...variable,
    organizationId,
  })
}

/** agentProfiles.deleteVar */
export async function deleteProfileVariable(
  token: string,
  profileId: string,
  key: string,
  organizationId?: string,
): Promise<void> {
  await trpcMutate('agentProfiles.deleteVar', token, z.unknown(), {
    profileId,
    key,
    organizationId,
  })
}

/** agentProfiles.setCommands — replace the slash commands of a profile. */
export async function setProfileCommands(
  token: string,
  profileId: string,
  commands: string[],
  organizationId?: string,
): Promise<void> {
  await trpcMutate('agentProfiles.setCommands', token, z.unknown(), {
    profileId,
    commands,
    organizationId,
  })
}

/** agentProfiles.bindToRepo */
export async function bindProfileToRepo(
  token: string,
  profileId: string,
  repoFullName: string,
  platform: 'github' | 'gitlab' = 'github',
  organizationId?: string,
): Promise<void> {
  await trpcMutate('agentProfiles.bindToRepo', token, z.unknown(), {
    profileId,
    repoFullName,
    platform,
    organizationId,
  })
}

/** agentProfiles.unbindToRepo */
export async function unbindProfileFromRepo(
  token: string,
  repoFullName: string,
  platform: 'github' | 'gitlab' = 'github',
  organizationId?: string,
): Promise<void> {
  await trpcMutate('agentProfiles.unbindRepo', token, z.unknown(), {
    repoFullName,
    platform,
    organizationId,
  })
}

/** agentProfiles.listRepoBindings */
export async function listProfileRepoBindings(
  token: string,
  organizationId?: string,
): Promise<{ profileId: string; profileName?: string; repoFullName: string; platform?: string }[]> {
  return trpcQuery(
    'agentProfiles.listRepoBindings',
    token,
    z.array(
      z.looseObject({
        profileId: z.string(),
        profileName: z.string().optional(),
        repoFullName: z.string(),
        platform: z.string().optional(),
      }),
    ),
    { organizationId },
  )
}
