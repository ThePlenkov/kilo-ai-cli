/**
 * Cloud sessions CLI command handlers.
 */

import { defineCommand } from 'citty'

import { fetchCloudSession, fetchCloudSessions, renameCloudSession } from '../api/trpc.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const sessionsListCommand = defineCommand({
  meta: { name: 'list', description: 'List cloud CLI sessions' },
  args: {
    limit: { type: 'string', description: 'Max sessions to show', default: '20' },
    gitUrl: { type: 'string', description: 'Filter by git URL' },
  },
  async run({ args }) {
    const { token, organizationId } = await getToken()
    const limit = args.limit ? Number.parseInt(args.limit, 10) : 20
    const result = await fetchCloudSessions(token, { limit, gitUrl: args.gitUrl }, organizationId)
    if (result.cliSessions.length === 0) {
      console.log('No sessions found.')
      return
    }
    printTable(
      result.cliSessions.map((s) => ({
        id: s.session_id,
        title: s.title ?? '(untitled)',
        updated: s.updated_at,
        version: s.version,
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'title', label: 'Title', width: 40 },
        { key: 'updated', label: 'Updated', width: 24 },
        { key: 'version', label: 'Version', width: 10 },
      ],
    )
    if (result.nextCursor) {
      console.log(`More sessions available (cursor: ${result.nextCursor})`)
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
