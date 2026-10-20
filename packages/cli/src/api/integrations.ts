/**
 * Platform integrations — GitHub, GitLab, Slack, Linear, Discord, DoltHub.
 * Source: Kilo-Org/cloud apps/web/src/routers/{platform-integrations,github-apps,gitlab,slack,linear,discord,dolthub}-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { PlatformIntegrationStatus } from './types.ts'

const IntegrationStatusSchema: z.ZodType<PlatformIntegrationStatus> = z
  .object({
    platform: z.string(),
    installed: z.boolean(),
    installation: z.unknown().nullish(),
  })
  .passthrough() as z.ZodType<PlatformIntegrationStatus>

const RepositorySchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  fullName: z.string().optional(),
  full_name: z.string().optional(),
  url: z.string().optional(),
  private: z.boolean().optional(),
  defaultBranch: z.string().optional(),
})

/** platformIntegrations.listSetupStatus — which integrations are connected. */
export async function listIntegrationStatus(token: string): Promise<PlatformIntegrationStatus[]> {
  return trpcQuery('platformIntegrations.listSetupStatus', token, z.array(IntegrationStatusSchema))
}

/** githubApps.listIntegrations — installed GitHub App installations. */
export async function listGitHubIntegrations(
  token: string,
): Promise<{ id: string; accountLogin?: string; appType?: string }[]> {
  return trpcQuery(
    'githubApps.listIntegrations',
    token,
    z.array(
      z.looseObject({
        id: z.string(),
        accountLogin: z.string().optional(),
        appType: z.string().optional(),
      }),
    ),
  )
}

/** githubApps.listRepositories — repositories the GitHub App can reach. */
export async function listGitHubAppRepositories(
  token: string,
  installationId?: string,
): Promise<{ id: string; name?: string; fullName?: string; private?: boolean }[]> {
  const result = await trpcQuery(
    'githubApps.listRepositories',
    token,
    z.object({ repositories: z.array(RepositorySchema) }),
    { installationId },
  )
  return result.repositories.map((r) => ({
    id: String(r.id ?? ''),
    name: r.name,
    fullName: r.fullName ?? r.full_name,
    private: r.private,
  }))
}

/** githubApps.getInstallation — one installation by id. */
export async function getGitHubInstallation(
  token: string,
  installationId: string,
): Promise<Record<string, unknown>> {
  return trpcQuery('githubApps.getInstallation', token, z.record(z.string(), z.unknown()), {
    installationId,
  })
}

/** githubApps.refreshInstallation — re-sync the installation metadata. */
export async function refreshGitHubInstallation(
  token: string,
  installationId: string,
): Promise<unknown> {
  return trpcMutate('githubApps.refreshInstallation', token, z.unknown(), { installationId })
}

/** gitlab.getInstallation */
export async function getGitLabInstallation(token: string): Promise<Record<string, unknown>> {
  return trpcQuery('gitlab.getInstallation', token, z.record(z.string(), z.unknown()))
}

/** gitlab.listRepositories */
export async function listGitLabRepositories(
  token: string,
): Promise<{ id: string; name?: string; fullName?: string; private?: boolean }[]> {
  const result = await trpcQuery(
    'gitlab.listRepositories',
    token,
    z.object({ repositories: z.array(RepositorySchema) }),
  )
  return result.repositories.map((r) => ({
    id: String(r.id ?? ''),
    name: r.name,
    fullName: r.fullName ?? r.full_name,
    private: r.private,
  }))
}

/** gitlab.refreshRepositories */
export async function refreshGitLabRepositories(token: string): Promise<unknown> {
  return trpcMutate('gitlab.refreshRepositories', token, z.unknown(), {})
}

/** slack.getInstallation */
export async function getSlackInstallation(token: string): Promise<Record<string, unknown>> {
  return trpcQuery('slack.getInstallation', token, z.record(z.string(), z.unknown()))
}

/** linear.getInstallation */
export async function getLinearInstallation(token: string): Promise<Record<string, unknown>> {
  return trpcQuery('linear.getInstallation', token, z.record(z.string(), z.unknown()))
}

/** discord.getInstallation */
export async function getDiscordInstallation(token: string): Promise<Record<string, unknown>> {
  return trpcQuery('discord.getInstallation', token, z.record(z.string(), z.unknown()))
}

/** dolthub.getInstallation */
export async function getDoltHubInstallation(token: string): Promise<Record<string, unknown>> {
  return trpcQuery('dolthub.getInstallation', token, z.record(z.string(), z.unknown()))
}
