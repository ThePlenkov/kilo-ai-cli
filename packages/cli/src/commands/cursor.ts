/**
 * Cursor CLI command handlers — the CLI's "where was I" markers.
 */

import { defineCommand } from 'citty'

import { createCursorStore } from '../state/cursor-store.ts'
import { printTable } from './format.ts'

export const cursorListCommand = defineCommand({
  meta: { name: 'list', description: 'List all stored cursors' },
  async run() {
    const store = createCursorStore()
    const cursors = await store.list()
    const names = Object.keys(cursors)
    if (names.length === 0) {
      console.log('No cursors stored yet.')
      return
    }
    printTable(
      names.map((name) => ({
        name,
        value: cursors[name]!.value,
        updated: cursors[name]!.updatedAt || '-',
      })),
      [
        { key: 'name', label: 'Name', width: 24 },
        { key: 'value', label: 'Value', width: 32 },
        { key: 'updated', label: 'Updated', width: 24 },
      ],
    )
  },
})

export const cursorShowCommand = defineCommand({
  meta: { name: 'show', description: 'Show one stored cursor' },
  args: { name: { type: 'positional', description: 'Cursor name', required: true } },
  async run({ args }) {
    const store = createCursorStore()
    const entry = await store.get(args.name)
    if (!entry) {
      console.log(`No cursor named "${args.name}".`)
      return
    }
    console.log(`  name: ${args.name}`)
    console.log(`  value: ${entry.value}`)
    console.log(`  updated: ${entry.updatedAt || '-'}`)
  },
})

export const cursorSetCommand = defineCommand({
  meta: { name: 'set', description: 'Set a cursor value' },
  args: {
    name: { type: 'positional', description: 'Cursor name', required: true },
    value: {
      type: 'positional',
      description: 'Cursor value (ISO timestamp, id, …)',
      required: true,
    },
  },
  async run({ args }) {
    const store = createCursorStore()
    const entry = await store.set(args.name, args.value)
    console.log(`Cursor "${args.name}" set to ${entry.value}`)
  },
})

export const cursorResetCommand = defineCommand({
  meta: { name: 'reset', description: 'Remove one stored cursor' },
  args: { name: { type: 'positional', description: 'Cursor name', required: true } },
  async run({ args }) {
    const store = createCursorStore()
    await store.remove(args.name)
    console.log(`Cursor "${args.name}" removed.`)
  },
})

export const cursorClearCommand = defineCommand({
  meta: { name: 'clear', description: 'Remove every stored cursor' },
  async run() {
    const store = createCursorStore()
    await store.clear()
    console.log('All cursors cleared.')
  },
})
