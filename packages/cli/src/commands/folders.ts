/**
 * Workspace folder CLI command handlers — sidebar grouping of worktrees.
 */

import { defineCommand } from 'citty'

import {
  createWorkspaceFolder,
  deleteWorkspaceFolder,
  listWorkspaceFolders,
  moveWorktreeToFolder,
} from '../api/workspace-folders.ts'
import { printTable, stringifyValue } from './format.ts'
import { getToken } from './helpers.ts'

export const foldersListCommand = defineCommand({
  meta: { name: 'list', description: 'List workspace folders' },
  args: { org: { type: 'string', description: 'Organization ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const folders = await listWorkspaceFolders(token, args.org)
    if (folders.length === 0) {
      console.log('No workspace folders.')
      return
    }
    printTable(
      folders.map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color ?? '-',
        worktrees: f.worktreeIds.length,
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'name', label: 'Name', width: 28 },
        { key: 'color', label: 'Color', width: 12 },
        { key: 'worktrees', label: 'Worktrees', width: 10, align: 'right' },
      ],
    )
  },
})

export const foldersCreateCommand = defineCommand({
  meta: { name: 'create', description: 'Create a workspace folder' },
  args: {
    name: { type: 'string', description: 'Folder name', required: true },
    org: { type: 'string', description: 'Organization ID', required: true },
    color: { type: 'string', description: 'Folder color' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const folder = await createWorkspaceFolder(token, {
      name: args.name,
      color: args.color,
      organizationId: args.org,
    })
    console.log(`Created workspace folder ${stringifyValue(folder.id ?? '')}`)
  },
})

export const foldersDeleteCommand = defineCommand({
  meta: { name: 'delete', description: 'Delete a workspace folder' },
  args: {
    id: { type: 'positional', description: 'Folder ID', required: true },
    org: { type: 'string', description: 'Organization ID', required: true },
  },
  async run({ args }) {
    const { token } = await getToken()
    await deleteWorkspaceFolder(token, args.id, args.org)
    console.log(`Deleted workspace folder ${args.id}`)
  },
})

export const foldersMoveCommand = defineCommand({
  meta: { name: 'move', description: 'Move a worktree into a folder' },
  args: {
    worktree: { type: 'positional', description: 'Worktree ID', required: true },
    org: { type: 'string', description: 'Organization ID', required: true },
    folder: { type: 'string', description: 'Target folder ID (omit to unfile)' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await moveWorktreeToFolder(token, args.worktree, args.folder ?? null, args.org)
    console.log(`Moved worktree ${args.worktree} to ${args.folder ?? '(unfiled)'}`)
  },
})
