/**
 * Agent briefing CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  dismissBriefing,
  generateBriefingSummary,
  getBriefing,
  getBriefingPreferences,
  listBriefings,
  markBriefingRead,
} from '../api/briefing.ts'
import { printTable, sanitize, stringifyValue } from './format.ts'
import { getToken } from './helpers.ts'

export const briefingListCommand = defineCommand({
  meta: { name: 'list', description: 'List agent briefings' },
  args: {
    scope: { type: 'string', description: 'Scope (all|personal|organization)' },
    org: { type: 'string', description: 'Organization ID' },
    limit: { type: 'string', description: 'Max briefings', default: '20' },
    cursor: { type: 'string', description: 'Pagination cursor from a previous list' },
    current: { type: 'boolean', description: 'Only the current briefing' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const { reports, nextCursor } = await listBriefings(token, {
      scope: args.scope as 'all' | 'personal' | 'organization' | undefined,
      organizationId: args.org,
      limit: Number.parseInt(args.limit, 10) || 20,
      cursor: args.cursor,
      currentOnly: args.current,
    })
    if (reports.length === 0) {
      console.log('No briefings found.')
      return
    }
    printTable(
      reports.map((r) => ({
        id: r.id,
        date: r.localDate ?? '-',
        read: r.readAt ? 'yes' : 'no',
        dismissed: r.dismissedAt ? 'yes' : 'no',
        published: r.publishedAt ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'date', label: 'Date', width: 12 },
        { key: 'read', label: 'Read', width: 6 },
        { key: 'dismissed', label: 'Dismissed', width: 10 },
        { key: 'published', label: 'Published', width: 24 },
      ],
    )
    if (nextCursor) console.log(`More available (--cursor ${nextCursor})`)
  },
})

export const briefingGetCommand = defineCommand({
  meta: { name: 'get', description: 'Get one briefing' },
  args: { id: { type: 'positional', description: 'Briefing ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const report = await getBriefing(token, args.id)
    console.log(`  id: ${report.id}`)
    console.log(`  date: ${report.localDate ?? '-'}`)
    console.log(`  published: ${report.publishedAt ?? '-'}`)
    console.log(`  read: ${report.readAt ?? 'no'}`)
    if (report.summary) console.log(`\n${sanitize(report.summary)}`)
  },
})

export const briefingReadCommand = defineCommand({
  meta: { name: 'read', description: 'Mark a briefing as read' },
  args: { id: { type: 'positional', description: 'Briefing ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await markBriefingRead(token, args.id)
    console.log(`Marked briefing ${args.id} as read.`)
  },
})

export const briefingDismissCommand = defineCommand({
  meta: { name: 'dismiss', description: 'Dismiss a briefing' },
  args: { id: { type: 'positional', description: 'Briefing ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await dismissBriefing(token, args.id)
    console.log(`Dismissed briefing ${args.id}.`)
  },
})

export const briefingPrefsCommand = defineCommand({
  meta: { name: 'prefs', description: 'Show briefing preferences' },
  args: {
    timezone: { type: 'string', description: 'IANA timezone' },
    language: { type: 'string', description: 'Language' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const prefs = await getBriefingPreferences(token, args.timezone, args.language)
    for (const [key, value] of Object.entries(prefs)) {
      console.log(`  ${key}: ${sanitize(stringifyValue(value))}`)
    }
  },
})

export const briefingGenerateCommand = defineCommand({
  meta: { name: 'generate', description: 'Ask the cloud to build the briefing summary' },
  args: {
    id: { type: 'positional', description: 'Briefing ID', required: true },
    token: { type: 'string', description: 'Estimate token', required: true },
  },
  async run({ args }) {
    const { token } = await getToken()
    await generateBriefingSummary(token, args.id, args.token)
    console.log(`Summary generation queued for ${args.id}.`)
  },
})
