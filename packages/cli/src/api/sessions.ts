/**
 * Session procedures beyond the v2 basics: unified listing (v1 + v2),
 * live/active sessions, transcripts and diffs.
 * Source: Kilo-Org/cloud apps/web/src/routers/{unified-sessions,active-sessions,cli-sessions-v2}-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type {
  ActiveSession,
  SessionDiff,
  SessionDiffFile,
  UnifiedSession,
  UnifiedSessionsResult,
} from './types.ts'

// --- Schemas ---

const UnifiedSessionSchema: z.ZodType<UnifiedSession> = z
  .object({
    session_id: z.string(),
    title: z.string().nullish(),
    git_url: z.string().nullish(),
    cloud_agent_session_id: z.string().nullish(),
    created_on_platform: z.string().optional(),
    organization_id: z.string().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
    version: z.number().optional(),
    last_mode: z.string().nullish(),
    last_model: z.string().nullish(),
    git_branch: z.string().nullish(),
    parent_session_id: z.string().nullish(),
    status: z.string().nullish(),
    status_updated_at: z.string().nullish(),
    source: z.string().optional(),
  })
  .passthrough() as z.ZodType<UnifiedSession>

const UnifiedSessionsSchema: z.ZodType<UnifiedSessionsResult> = z
  .object({
    cliSessions: z.array(UnifiedSessionSchema),
    nextCursor: z.string().nullish(),
  })
  .passthrough() as z.ZodType<UnifiedSessionsResult>

const ActiveSessionSchema: z.ZodType<ActiveSession> = z
  .object({
    sessionId: z.string().optional(),
    session_id: z.string().optional(),
    name: z.string().optional(),
    projectName: z.string().optional(),
    project_name: z.string().optional(),
    kind: z.string().optional(),
    version: z.string().optional(),
    startedAt: z.string().nullish(),
    gitBranch: z.string().nullish(),
    git_branch: z.string().nullish(),
    lastActivityAt: z.string().nullish(),
    organizationId: z.string().nullish(),
  })
  .passthrough() as z.ZodType<ActiveSession>

const SessionDiffFileSchema: z.ZodType<SessionDiffFile> = z
  .object({
    file: z.string(),
    patch: z.string().optional(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    status: z.string().optional(),
  })
  .passthrough() as z.ZodType<SessionDiffFile>

const SessionDiffSchema: z.ZodType<SessionDiff> = z
  .object({
    kind: z.string(),
    files: z.array(SessionDiffFileSchema).optional(),
    value: z.unknown().optional(),
  })
  .passthrough() as z.ZodType<SessionDiff>

// --- Unified sessions ---

/** Filters accepted by unifiedSessions.list. */
export interface UnifiedSessionsOptions {
  limit?: number
  cursor?: string
  organizationId?: string | null
  createdOnPlatform?: string | string[]
  orderBy?: 'created_at' | 'updated_at'
  includeSubSessions?: boolean
  gitUrl?: string | string[]
  /** Server-side "newer than" filter — the cursor-driven delta. */
  updatedSince?: string
}

/** unifiedSessions.list — v1 and v2 sessions in one feed. */
export async function listUnifiedSessions(
  token: string,
  options: UnifiedSessionsOptions = {},
): Promise<UnifiedSessionsResult> {
  return trpcQuery('unifiedSessions.list', token, UnifiedSessionsSchema, {
    limit: options.limit ?? 20,
    ...options,
  })
}

/** unifiedSessions.search — full-text session search. */
export async function searchUnifiedSessions(
  token: string,
  searchString: string,
  options: { limit?: number; offset?: number; organizationId?: string | null } = {},
): Promise<UnifiedSessionsResult> {
  return trpcQuery('unifiedSessions.search', token, UnifiedSessionsSchema, {
    search_string: searchString,
    limit: options.limit ?? 20,
    offset: options.offset ?? 0,
    organizationId: options.organizationId,
  })
}

/** unifiedSessions.recentRepositories — repositories touched since an instant. */
export async function listRecentRepositories(
  token: string,
  updatedSince: string,
  organizationId?: string | null,
): Promise<{ gitUrl: string; lastUsedAt: string }[]> {
  const result = await trpcQuery(
    'unifiedSessions.recentRepositories',
    token,
    z.object({
      repositories: z.array(z.looseObject({ gitUrl: z.string(), lastUsedAt: z.string() })),
    }),
    { updatedSince, organizationId },
  )
  return result.repositories
}

// --- Active sessions ---

/** activeSessions.list — sessions that are currently alive. */
export async function listActiveSessions(
  token: string,
  options: { organizationId?: string | null; includeCloudAgentSessions?: boolean } = {},
): Promise<ActiveSession[]> {
  const result = await trpcQuery(
    'activeSessions.list',
    token,
    z.object({ sessions: z.array(ActiveSessionSchema) }),
    options,
  )
  return result.sessions
}

// --- Transcripts and diffs ---

/** cliSessionsV2.getSessionDiff — the worktree diff of a session. */
export async function getSessionDiff(token: string, sessionId: string): Promise<SessionDiff> {
  return trpcQuery('cliSessionsV2.getSessionDiff', token, SessionDiffSchema, {
    session_id: sessionId,
  })
}

/** cliSessionsV2.getSessionMessages — the stored transcript of a session. */
export async function getSessionMessages(
  token: string,
  sessionId: string,
): Promise<{ info?: unknown; messages: unknown[] }> {
  return trpcQuery(
    'cliSessionsV2.getSessionMessages',
    token,
    z.object({ info: z.unknown().optional(), messages: z.array(z.unknown()) }),
    { session_id: sessionId },
  )
}

/** cliSessionsV2.getSessionMessagesPage — one page of the transcript. */
export async function getSessionMessagesPage(
  token: string,
  sessionId: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<unknown> {
  return trpcQuery('cliSessionsV2.getSessionMessagesPage', token, z.unknown(), {
    session_id: sessionId,
    ...options,
  })
}

/** cliSessionsV2.getWithRuntimeState — session plus live runtime metadata. */
export async function getSessionWithRuntimeState(
  token: string,
  sessionId: string,
): Promise<unknown> {
  return trpcQuery('cliSessionsV2.getWithRuntimeState', token, z.unknown(), {
    session_id: sessionId,
  })
}

/** cliSessionsV2.worktreeDetails — worktree metadata for a set of ids. */
export async function getWorktreeDetails(
  token: string,
  worktreeIds: string[],
  organizationId?: string | null,
): Promise<Record<string, unknown>> {
  const result = await trpcQuery(
    'cliSessionsV2.worktreeDetails',
    token,
    z.object({ worktrees: z.record(z.string(), z.unknown()) }),
    { worktreeIds, organizationId },
  )
  return result.worktrees
}

/** cliSessionsV2.refreshAssociatedPullRequest — re-sync the linked PR. */
export async function refreshAssociatedPullRequest(
  token: string,
  sessionId: string,
): Promise<unknown> {
  return trpcMutate('cliSessionsV2.refreshAssociatedPullRequest', token, z.unknown(), {
    session_id: sessionId,
  })
}

/** cliSessionsV2.share — publish a session. */
export async function shareSession(token: string, sessionId: string): Promise<unknown> {
  return trpcMutate('cliSessionsV2.share', token, z.unknown(), { session_id: sessionId })
}

/** cliSessionsV2.unshare — unpublish a session. */
export async function unshareSession(token: string, sessionId: string): Promise<unknown> {
  return trpcMutate('cliSessionsV2.unshare', token, z.unknown(), { session_id: sessionId })
}

/** cliSessionsV2.delete — remove a session. */
export async function deleteSession(token: string, sessionId: string): Promise<void> {
  await trpcMutate('cliSessionsV2.delete', token, z.unknown(), { session_id: sessionId })
}
