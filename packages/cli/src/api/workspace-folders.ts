/**
 * Workspace folders — the sidebar grouping of cloud-agent worktrees.
 * Source: Kilo-Org/cloud apps/web/src/routers/workspace-folders-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'

const FolderSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  worktreeIds: z.array(z.string()).optional(),
  worktree_ids: z.array(z.string()).optional(),
})

/** workspaceFolders.list */
export async function listWorkspaceFolders(
  token: string,
  organizationId: string,
): Promise<{ id: string; name: string; color?: string; worktreeIds: string[] }[]> {
  const result = await trpcQuery(
    'workspaceFolders.list',
    token,
    z.object({ folders: z.array(FolderSchema) }),
    { organizationId },
  )
  return result.folders.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    worktreeIds: f.worktreeIds ?? f.worktree_ids ?? [],
  }))
}

/** workspaceFolders.create */
export async function createWorkspaceFolder(
  token: string,
  input: { name: string; color?: string; organizationId: string },
): Promise<Record<string, unknown>> {
  return trpcMutate('workspaceFolders.create', token, z.record(z.string(), z.unknown()), input)
}

/** workspaceFolders.update */
export async function updateWorkspaceFolder(
  token: string,
  input: { id: string; name?: string; color?: string; organizationId: string },
): Promise<Record<string, unknown>> {
  return trpcMutate('workspaceFolders.update', token, z.record(z.string(), z.unknown()), input)
}

/** workspaceFolders.delete */
export async function deleteWorkspaceFolder(
  token: string,
  id: string,
  organizationId: string,
): Promise<unknown> {
  return trpcMutate('workspaceFolders.delete', token, z.unknown(), { id, organizationId })
}

/** workspaceFolders.moveWorktree — file a worktree into a folder (null = unfiled). */
export async function moveWorktreeToFolder(
  token: string,
  worktreeId: string,
  folderId: string | null,
  organizationId: string,
): Promise<unknown> {
  return trpcMutate('workspaceFolders.moveWorktree', token, z.unknown(), {
    worktreeId,
    folderId,
    organizationId,
  })
}
