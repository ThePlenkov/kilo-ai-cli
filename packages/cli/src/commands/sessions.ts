/**
 * Cloud sessions CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  deleteSession,
  getSessionDiff,
  getSessionMessages,
  getWorktreeDetails,
  listActiveSessions,
  listRecentRepositories,
  listUnifiedSessions,
  searchUnifiedSessions,
  shareSession,
  unshareSession,
} from '../api/sessions.ts'
import { fetchCloudSession, fetchCloudSessions, renameCloudSession } from '../api/trpc.ts'
import { createCursorStore } from '../state/cursor-store.ts'
import { applyDeltaAsync, resolveSince } from '../state/delta.ts'
import { printTable, stringifyValue } from './format.ts'
import { getToken } from './helpers.ts'

/** Cursor name used by `sessions unified --new`. */
export const SESSIONS_CURSOR = 'sessions'

/** Upper bound on the number of pages a delta read walks. */
const SESSIONS_MAX_PAGES = 10

export const sessionsListCommand = defineCommand({
  meta: { name: 'list', description: 'List cloud CLI sessions' },
  args: {
    limit: { type: 'string', description: 'Max sessions to show', default: '20' },
    gitUrl: { type: 'string', description: 'Filter by git URL' },
    cursor: { type: 'string', description: 'Pagination cursor from a previous list' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const limit = args.limit ? Number.parseInt(args.limit, 10) : 20
    const result = await fetchCloudSessions(
      token,
      { limit, gitUrl: args.gitUrl, cursor: args.cursor },
      organizationId,
    )
    if (result.cliSessions.length === 0) {
      console.log('No sessions found.')
      return
    }
    printTable(
      result.cliSessions.map((s) => ({
        id: s.session_id,
        title: s.title ?? '(untitled)',
        created: s.created_at,
        updated: s.updated_at,
        version: s.version,
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'title', label: 'Title', width: 40 },
        { key: 'created', label: 'Created', width: 24 },
        { key: 'updated', label: 'Updated', width: 24 },
        { key: 'version', label: 'Version', width: 10 },
      ],
    )
    if (result.nextCursor) {
      console.log(`More sessions available (--cursor ${result.nextCursor})`)
    }
  },
})

export const sessionsGetCommand = defineCommand({
  meta: { name: 'get', description: 'Get details of a cloud session' },
  args: {
    id: { type: 'positional', description: 'Session ID', required: true },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const session = await fetchCloudSession(token, args.id, organizationId)
    console.log(`ID: ${session.session_id}`)
    console.log(`Title: ${session.title ?? '(untitled)'}`)
    console.log(`Created: ${session.created_at}`)
    console.log(`Updated: ${session.updated_at}`)
    console.log(`Version: ${session.version}`)
  },
})

export const sessionsRenameCommand = defineCommand({
  meta: { name: 'rename', description: 'Rename a cloud session' },
  args: {
    id: { type: 'positional', description: 'Session ID', required: true },
    title: { type: 'positional', description: 'New title', required: true },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    await renameCloudSession(token, args.id, args.title, organizationId)
    console.log(`Renamed session ${args.id} to "${args.title}"`)
  },
})

export const sessionsUnifiedCommand = defineCommand({
  meta: {
    name: 'unified',
    description: 'List v1 and v2 sessions in one feed (supports --new deltas)',
  },
  args: {
    limit: { type: 'string', description: 'Max sessions to show', default: '20' },
    org: { type: 'string', description: 'Organization ID' },
    platform: { type: 'string', description: 'Filter by platform (cli, code-review, …)' },
    order: {
      type: 'string',
      description: 'Order by (created_at|updated_at) — a delta read always uses updated_at',
      default: 'updated_at',
    },
    cursor: { type: 'string', description: 'Pagination cursor from a previous list' },
    new: { type: 'boolean', description: 'Only sessions newer than the stored cursor' },
    since: { type: 'string', description: 'Explicit lower bound (ISO timestamp)' },
    'no-advance': { type: 'boolean', description: 'Do not advance the stored cursor' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const limit = Number.parseInt(args.limit, 10) || 20
    const explicitSince = args.since
    const isDeltaRead = args.new || explicitSince !== undefined
    // Fall back to the active organization, like `sessions list` does.
    const orgId = args.org ?? organizationId
    const store = createCursorStore()

    // The cursor is read first so the server can filter on it.
    const since = isDeltaRead
      ? await resolveSince({ cursor: SESSIONS_CURSOR, since: explicitSince, store })
      : undefined

    const request = {
      limit,
      organizationId: orgId,
      createdOnPlatform: args.platform,
      // A delta read is ordered by updated_at: the newest item has to be on
      // the first page, because the watermark is taken from it.
      orderBy: (isDeltaRead ? 'updated_at' : args.order) as 'created_at' | 'updated_at' | undefined,
      updatedSince: since,
    }

    // The server combines the page cursor (`updated_at < cursor`) with the
    // delta bound (`updated_at >= since`), so a page cursor from an earlier
    // listing would cut newer sessions out of the delta window.
    const result = await listUnifiedSessions(token, {
      ...request,
      cursor: isDeltaRead ? undefined : args.cursor,
    })

    let sessions = result.cliSessions
    let nextCursor = result.nextCursor
    if (isDeltaRead) {
      // With a bound the server filters the window, so every page of it has
      // to be read before the cursor may move. Without a bound there is no
      // window yet — the first page establishes the watermark, and everything
      // older than it is not part of any later delta.
      let complete = true
      if (since) {
        let cursor = nextCursor
        for (let page = 0; page < SESSIONS_MAX_PAGES && cursor; page++) {
          // eslint-disable-next-line no-await-in-loop -- cursor pagination is sequential
          const more = await listUnifiedSessions(token, { ...request, cursor })
          sessions = sessions.concat(more.cliSessions)
          cursor = more.nextCursor
        }
        // A cursor left over means the page budget ran out before the window
        // was read completely.
        complete = cursor === null
        nextCursor = cursor
      }
      if (!complete) {
        console.log(
          `More than ${SESSIONS_MAX_PAGES * limit} sessions match; the cursor was not advanced.`,
        )
      }
      const delta = await applyDeltaAsync(sessions, (s) => s.updated_at, {
        cursor: SESSIONS_CURSOR,
        since: explicitSince,
        advance: !args['no-advance'],
        complete,
        store,
      })
      sessions = delta.items
      if (delta.advancedTo) {
        console.log(`Cursor "${SESSIONS_CURSOR}" advanced to ${delta.advancedTo}`)
      }
    }

    if (sessions.length === 0) {
      console.log('No sessions found.')
      return
    }
    printTable(
      sessions.map((s) => ({
        id: s.session_id,
        title: s.title ?? '(untitled)',
        platform: s.created_on_platform ?? '-',
        status: s.status ?? '-',
        branch: s.git_branch ?? '-',
        updated: s.updated_at,
      })),
      [
        { key: 'id', label: 'ID', width: 30 },
        { key: 'title', label: 'Title', width: 36 },
        { key: 'platform', label: 'Platform', width: 14 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'branch', label: 'Branch', width: 24 },
        { key: 'updated', label: 'Updated', width: 24 },
      ],
    )
    if (nextCursor) {
      console.log(`More sessions available (--cursor ${nextCursor})`)
    }
  },
})

export const sessionsActiveCommand = defineCommand({
  meta: { name: 'active', description: 'List sessions that are currently alive' },
  args: {
    org: { type: 'string', description: 'Organization ID' },
    cloud: { type: 'boolean', description: 'Include live cloud-agent sessions' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const sessions = await listActiveSessions(token, {
      organizationId: args.org,
      includeCloudAgentSessions: args.cloud,
    })
    if (sessions.length === 0) {
      console.log('No active sessions.')
      return
    }
    printTable(
      sessions.map((s) => ({
        id: s.sessionId ?? s.session_id ?? '-',
        name: s.name ?? s.projectName ?? s.project_name ?? '-',
        kind: s.kind ?? '-',
        branch: s.gitBranch ?? s.git_branch ?? '-',
        started: s.startedAt ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 30 },
        { key: 'name', label: 'Name', width: 30 },
        { key: 'kind', label: 'Kind', width: 10 },
        { key: 'branch', label: 'Branch', width: 24 },
        { key: 'started', label: 'Started', width: 24 },
      ],
    )
  },
})

export const sessionsSearchCommand = defineCommand({
  meta: { name: 'search', description: 'Search sessions by title' },
  args: {
    query: { type: 'positional', description: 'Search string', required: true },
    limit: { type: 'string', description: 'Max sessions to show', default: '20' },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const result = await searchUnifiedSessions(token, args.query, {
      limit: Number.parseInt(args.limit, 10) || 20,
      organizationId: args.org,
    })
    if (result.cliSessions.length === 0) {
      console.log('No sessions found.')
      return
    }
    printTable(
      result.cliSessions.map((s) => ({
        id: s.session_id,
        title: s.title ?? '(untitled)',
        repo: s.git_url ?? '-',
        updated: s.updated_at,
      })),
      [
        { key: 'id', label: 'ID', width: 30 },
        { key: 'title', label: 'Title', width: 44 },
        { key: 'repo', label: 'Repository', width: 40 },
        { key: 'updated', label: 'Updated', width: 24 },
      ],
    )
  },
})

export const sessionsReposCommand = defineCommand({
  meta: { name: 'repos', description: 'List repositories touched by recent sessions' },
  args: {
    since: {
      type: 'string',
      description: 'Lower bound (ISO timestamp)',
      default: '2026-01-01T00:00:00Z',
    },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const repos = await listRecentRepositories(token, args.since, args.org)
    if (repos.length === 0) {
      console.log('No repositories found.')
      return
    }
    printTable(
      repos.map((r) => ({ url: r.gitUrl, lastUsed: r.lastUsedAt })),
      [
        { key: 'url', label: 'Repository', width: 56 },
        { key: 'lastUsed', label: 'Last used', width: 28 },
      ],
    )
  },
})

export const sessionsDiffCommand = defineCommand({
  meta: { name: 'diff', description: 'Show the worktree diff of a session' },
  args: {
    id: { type: 'positional', description: 'Session ID', required: true },
    patch: { type: 'boolean', description: 'Print the full patch of every file' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const diff = await getSessionDiff(token, args.id)
    if (diff.kind === 'value') {
      console.log(stringifyValue(diff.value ?? ''))
      return
    }
    const files = diff.files ?? []
    if (files.length === 0) {
      console.log('No changes in this session.')
      return
    }
    printTable(
      files.map((f) => ({
        file: f.file,
        status: f.status ?? '-',
        additions: f.additions ?? 0,
        deletions: f.deletions ?? 0,
      })),
      [
        { key: 'file', label: 'File', width: 56 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'additions', label: '+', width: 6, align: 'right' },
        { key: 'deletions', label: '-', width: 6, align: 'right' },
      ],
    )
    if (args.patch) {
      for (const file of files) {
        if (file.patch) console.log(`\n${file.patch}`)
      }
    }
  },
})

export const sessionsMessagesCommand = defineCommand({
  meta: { name: 'messages', description: 'Show the transcript of a session' },
  args: {
    id: { type: 'positional', description: 'Session ID', required: true },
    limit: { type: 'string', description: 'Max messages to show', default: '50' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const { messages } = await getSessionMessages(token, args.id)
    const limit = Number.parseInt(args.limit, 10) || 50
    for (const message of messages.slice(0, limit)) {
      const record = message as { role?: string; content?: string; time?: { created?: number } }
      const role = record.role ?? 'message'
      const content = typeof record.content === 'string' ? record.content : JSON.stringify(record)
      console.log(`[${role}] ${content}`)
    }
    if (messages.length > limit) {
      console.log(`\n… ${messages.length - limit} more message(s)`)
    }
  },
})

export const sessionsWorktreesCommand = defineCommand({
  meta: { name: 'worktrees', description: 'Show worktree details for a session' },
  args: {
    ids: { type: 'positional', description: 'Worktree IDs (comma separated)', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const worktreeIds = args.ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    const worktrees = await getWorktreeDetails(token, worktreeIds, args.org)
    for (const [id, detail] of Object.entries(worktrees)) {
      console.log(`\n${id}`)
      const record = detail as Record<string, unknown>
      for (const [key, value] of Object.entries(record)) {
        console.log(`  ${key}: ${stringifyValue(value)}`)
      }
    }
  },
})

export const sessionsShareCommand = defineCommand({
  meta: { name: 'share', description: 'Share a session' },
  args: { id: { type: 'positional', description: 'Session ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await shareSession(token, args.id)
    console.log(`Shared session ${args.id}`)
  },
})

export const sessionsUnshareCommand = defineCommand({
  meta: { name: 'unshare', description: 'Stop sharing a session' },
  args: { id: { type: 'positional', description: 'Session ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await unshareSession(token, args.id)
    console.log(`Unshared session ${args.id}`)
  },
})

export const sessionsDeleteCommand = defineCommand({
  meta: { name: 'delete', description: 'Delete a session' },
  args: { id: { type: 'positional', description: 'Session ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await deleteSession(token, args.id)
    console.log(`Deleted session ${args.id}`)
  },
})
