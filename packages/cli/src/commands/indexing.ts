/**
 * Code indexing CLI command handlers — the semantic code search.
 */

import { defineCommand } from 'citty'

import { getCodeIndexManifest, listIndexedProjectFiles, searchCodeIndex } from '../api/indexing.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const indexingSearchCommand = defineCommand({
  meta: { name: 'search', description: 'Search the indexed codebase' },
  args: {
    query: { type: 'positional', description: 'Search query', required: true },
    project: { type: 'string', description: 'Project ID', required: true },
    org: { type: 'string', description: 'Organization ID' },
    path: { type: 'string', description: 'Restrict to a path prefix' },
    branch: { type: 'string', description: 'Preferred branch' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const results = await searchCodeIndex(token, {
      query: args.query,
      projectId: args.project,
      organizationId: args.org,
      path: args.path,
      preferBranch: args.branch,
    })
    if (results.length === 0) {
      console.log('No matches.')
      return
    }
    printTable(
      results.map((r) => ({
        file: r.filePath,
        start: r.startLine ?? '-',
        end: r.endLine ?? '-',
        score: r.score ?? '-',
      })),
      [
        { key: 'file', label: 'File', width: 56 },
        { key: 'start', label: 'Start', width: 7, align: 'right' },
        { key: 'end', label: 'End', width: 7, align: 'right' },
        { key: 'score', label: 'Score', width: 8, align: 'right' },
      ],
    )
  },
})

export const indexingManifestCommand = defineCommand({
  meta: { name: 'manifest', description: 'Show the index manifest of a project' },
  args: {
    project: { type: 'string', description: 'Project ID', required: true },
    branch: { type: 'string', description: 'Git branch', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const manifest = await getCodeIndexManifest(token, {
      projectId: args.project,
      gitBranch: args.branch,
      organizationId: args.org,
    })
    console.log(`  project: ${manifest.projectId}`)
    console.log(`  branch: ${manifest.gitBranch}`)
    console.log(`  files: ${manifest.totalFiles}`)
    console.log(`  lines: ${manifest.totalLines ?? '-'}`)
    console.log(`  ai lines: ${manifest.totalAILines ?? '-'}`)
    console.log(`  ai share: ${manifest.percentageOfAILines ?? '-'}%`)
    console.log(`  updated: ${manifest.lastUpdated ?? '-'}`)
  },
})

export const indexingFilesCommand = defineCommand({
  meta: { name: 'files', description: 'List the indexed files of a project' },
  args: {
    project: { type: 'string', description: 'Project ID', required: true },
    branch: { type: 'string', description: 'Git branch' },
    search: { type: 'string', description: 'File name filter' },
    page: { type: 'string', description: 'Page number', default: '1' },
    pageSize: { type: 'string', description: 'Files per page', default: '20' },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const files = await listIndexedProjectFiles(token, {
      projectId: args.project,
      gitBranch: args.branch,
      fileSearch: args.search,
      page: Number.parseInt(args.page, 10) || 1,
      pageSize: Number.parseInt(args.pageSize, 10) || 20,
      organizationId: args.org,
    })
    if (files.length === 0) {
      console.log('No indexed files.')
      return
    }
    printTable(
      files.map((f) => ({ file: f.file_path })),
      [{ key: 'file', label: 'File', width: 72 }],
    )
  },
})
