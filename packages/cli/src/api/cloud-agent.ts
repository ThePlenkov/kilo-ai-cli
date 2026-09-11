/**
 * Cloud Agent Next tRPC procedures — cloud agent sessions, terminals, messaging.
 * Source: Kilo-Org/cloud apps/web/src/routers/cloud-agent-next-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { CloudAgentSession, CloudAgentTerminal } from './types.ts'

// --- Schemas ---

const SessionSchema: z.ZodType<CloudAgentSession> = z.object({
  sessionId: z.string(),
  status: z.string(),
  gitUrl: z.string().optional(),
  branch: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  cloudAgentSessionId: z.string().optional(),
})

const RepositorySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  fullName: z.string().optional(),
  url: z.string().optional(),
  private: z.boolean().optional(),
  defaultBranch: z.string().optional(),
}).passthrough()

const TerminalSchema: z.ZodType<CloudAgentTerminal> = z.object({
  terminalId: z.string(),
  ticket: z.string(),
})

// --- Queries ---

/** cloudAgentNext.getSession */
export async function getCloudAgentSession(token: string, sessionId: string): Promise<CloudAgentSession> {
  return trpcQuery('cloudAgentNext.getSession', token, SessionSchema, { sessionId })
}

/** cloudAgentNext.listGitHubRepositories */
export async function listGitHubRepositories(token: string, forceRefresh?: boolean): Promise<unknown[]> {
  const result = await trpcQuery('cloudAgentNext.listGitHubRepositories', token, z.object({ repositories: z.array(RepositorySchema).optional() }).passthrough(), { forceRefresh: forceRefresh ?? false })
  return result.repositories ?? []
}

/** cloudAgentNext.listGitLabRepositories */
export async function listGitLabRepositories(token: string, forceRefresh?: boolean): Promise<unknown[]> {
  const result = await trpcQuery('cloudAgentNext.listGitLabRepositories', token, z.object({ repositories: z.array(RepositorySchema).optional() }).passthrough(), { forceRefresh: forceRefresh ?? false })
  return result.repositories ?? []
}

// --- Mutations ---

/** cloudAgentNext.prepareSession */
export async function prepareSession(token: string, input: Record<string, unknown>): Promise<{ preparedSessionId: string }> {
  return trpcMutate('cloudAgentNext.prepareSession', token, z.object({ preparedSessionId: z.string() }), input)
}

/** cloudAgentNext.initiateFromPreparedSession */
export async function initiateFromPreparedSession(token: string, input: Record<string, unknown>): Promise<CloudAgentSession> {
  return trpcMutate('cloudAgentNext.initiateFromPreparedSession', token, SessionSchema, input)
}

/** cloudAgentNext.sendMessage */
export async function sendMessage(token: string, input: Record<string, unknown>): Promise<{ messageId: string }> {
  return trpcMutate('cloudAgentNext.sendMessage', token, z.object({ messageId: z.string() }), input)
}

/** cloudAgentNext.createTerminal */
export async function createTerminal(token: string, input: Record<string, unknown>): Promise<CloudAgentTerminal> {
  return trpcMutate('cloudAgentNext.createTerminal', token, TerminalSchema, input)
}

/** cloudAgentNext.refreshTerminalTicket */
export async function refreshTerminalTicket(token: string, input: Record<string, unknown>): Promise<CloudAgentTerminal> {
  return trpcMutate('cloudAgentNext.refreshTerminalTicket', token, TerminalSchema, input)
}

/** cloudAgentNext.resizeTerminal */
export async function resizeTerminal(token: string, input: Record<string, unknown>): Promise<void> {
  await trpcMutate('cloudAgentNext.resizeTerminal', token, z.unknown(), input)
}

/** cloudAgentNext.closeTerminal */
export async function closeTerminal(token: string, input: Record<string, unknown>): Promise<void> {
  await trpcMutate('cloudAgentNext.closeTerminal', token, z.unknown(), input)
}

/** cloudAgentNext.getImageUploadUrl */
export async function getImageUploadUrl(token: string, input: Record<string, unknown>): Promise<{ uploadUrl: string }> {
  return trpcMutate('cloudAgentNext.getImageUploadUrl', token, z.object({ uploadUrl: z.string() }), input)
}

/** cloudAgentNext.getAttachmentUploadUrl */
export async function getAttachmentUploadUrl(token: string, input: Record<string, unknown>): Promise<{ uploadUrl: string }> {
  return trpcMutate('cloudAgentNext.getAttachmentUploadUrl', token, z.object({ uploadUrl: z.string() }), input)
}

/** cloudAgentNext.interruptSession */
export async function interruptSession(token: string, input: Record<string, unknown>): Promise<void> {
  await trpcMutate('cloudAgentNext.interruptSession', token, z.unknown(), input)
}

/** cloudAgentNext.answerQuestion */
export async function answerQuestion(token: string, input: Record<string, unknown>): Promise<void> {
  await trpcMutate('cloudAgentNext.answerQuestion', token, z.unknown(), input)
}

/** cloudAgentNext.rejectQuestion */
export async function rejectQuestion(token: string, input: Record<string, unknown>): Promise<void> {
  await trpcMutate('cloudAgentNext.rejectQuestion', token, z.unknown(), input)
}

/** cloudAgentNext.answerPermission */
export async function answerPermission(token: string, input: Record<string, unknown>): Promise<void> {
  await trpcMutate('cloudAgentNext.answerPermission', token, z.unknown(), input)
}
