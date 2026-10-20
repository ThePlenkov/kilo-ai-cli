/**
 * Code indexing — the semantic code search the cloud agent uses.
 * Source: Kilo-Org/cloud apps/web/src/routers/code-indexing/code-indexing-router.ts
 */

import { z } from 'zod'
import { trpcQuery } from './client.ts'
import type { CodeIndexManifest, CodeIndexSearchResult } from './types.ts'

const SearchResultSchema: z.ZodType<CodeIndexSearchResult> = z
  .object({
    id: z.string(),
    filePath: z.string(),
    startLine: z.number().optional(),
    endLine: z.number().optional(),
    content: z.string().optional(),
    score: z.number().optional(),
  })
  .passthrough() as z.ZodType<CodeIndexSearchResult>

const ManifestSchema: z.ZodType<CodeIndexManifest> = z
  .object({
    organizationId: z.string().optional(),
    projectId: z.string(),
    gitBranch: z.string(),
    totalFiles: z.number(),
    totalLines: z.number().optional(),
    totalAILines: z.number().optional(),
    percentageOfAILines: z.number().optional(),
    lastUpdated: z.string().optional(),
  })
  .passthrough() as z.ZodType<CodeIndexManifest>

/** codeIndexing.search */
export async function searchCodeIndex(
  token: string,
  input: {
    query: string
    projectId: string
    organizationId?: string | null
    path?: string
    preferBranch?: string
    fallbackBranch?: string
    excludeFiles?: string[]
  },
): Promise<CodeIndexSearchResult[]> {
  return trpcQuery('codeIndexing.search', token, z.array(SearchResultSchema), {
    fallbackBranch: 'main',
    excludeFiles: [],
    ...input,
  })
}

/** codeIndexing.getManifest */
export async function getCodeIndexManifest(
  token: string,
  input: { projectId: string; gitBranch: string; organizationId?: string | null },
): Promise<CodeIndexManifest> {
  return trpcQuery('codeIndexing.getManifest', token, ManifestSchema, input)
}

/** codeIndexing.getProjectFiles */
export async function listIndexedProjectFiles(
  token: string,
  input: {
    projectId: string
    gitBranch?: string
    fileSearch?: string
    page?: number
    pageSize?: number
    organizationId?: string | null
  },
): Promise<{ file_path: string; chunk_count: number; size_kb: number; branches: string[] }[]> {
  const result = await trpcQuery(
    'codeIndexing.getProjectFiles',
    token,
    z.object({ files: z.array(z.looseObject({ file_path: z.string() })) }),
    { page: 1, pageSize: 20, ...input },
  )
  return result.files.map((f) => ({
    file_path: f.file_path,
    chunk_count: 0,
    size_kb: 0,
    branches: [],
  }))
}
