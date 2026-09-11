/**
 * Security Agent CLI command handlers — personal level (no organization required).
 */

import { defineCommand } from 'citty'

import {
  cancelRemediation,
  deleteFindingsByRepository,
  dismissFindingsBulk,
  dismissFinding,
  getCommandStatus,
  getDashboardStats,
  getFinding,
  getLastSyncTime,
  getOrphanedRepositories,
  getPermissionStatus,
  getSecurityConfig,
  getSecurityRepositories,
  getSecurityStats,
  listActiveCommands,
  listFindings,
  retryRemediation,
  setSecurityEnabled,
  startAnalysis,
  startRemediation,
  triggerSync,
} from '../api/security-agent.ts'
import { confirm } from './confirm.ts'
import { printSummary, printTable } from './format.ts'
import { getToken } from './helpers.ts'
import { repoShort, repoUrl, truncate } from './theme.ts'

export const securityStatusCommand = defineCommand({
  meta: { name: 'status', description: 'Show security agent permission status' },
  async run() {
    const { token } = await getToken()
    const status = await getPermissionStatus(token)
    printSummary([
      { label: 'Granted', value: status.granted ? 'yes' : 'no' },
      { label: 'Permissions', value: status.permissions?.join(', ') || '(none)' },
      { label: 'Pending', value: status.pendingRequests ?? 0 },
    ])
  },
})

export const securityConfigCommand = defineCommand({
  meta: { name: 'config', description: 'Show security agent configuration' },
  async run() {
    const { token } = await getToken()
    const config = await getSecurityConfig(token)
    const enabled = config.isEnabled ?? config.is_enabled
    const freq = config.scanFrequency ?? config.scan_frequency
    const auto = config.autoRemediate ?? config.auto_remediate
    printSummary([
      { label: 'Enabled', value: enabled ? 'yes' : 'no' },
      { label: 'Repos', value: config.repositories?.length ?? 0 },
    ])
    if (freq) console.log(`  Scan frequency: ${freq}`)
    if (auto !== undefined) console.log(`  Auto-remediate: ${auto ? 'yes' : 'no'}`)
  },
})

export const securityEnableCommand = defineCommand({
  meta: { name: 'enable', description: 'Enable the security agent' },
  async run() {
    const { token } = await getToken()
    await setSecurityEnabled(token, true)
    console.log('Security agent enabled.')
  },
})

export const securityDisableCommand = defineCommand({
  meta: { name: 'disable', description: 'Disable the security agent' },
  async run() {
    const { token } = await getToken()
    await setSecurityEnabled(token, false)
    console.log('Security agent disabled.')
  },
})

export const securityReposCommand = defineCommand({
  meta: { name: 'repos', description: 'List repositories monitored by security agent' },
  async run() {
    const { token } = await getToken()
    const repos = await getSecurityRepositories(token)
    if (repos.length === 0) {
      console.log('No repositories found.')
      return
    }
    console.log(`Repositories (${repos.length}):\n`)
    printTable(
      repos.map((r) => ({
        id: String(r.id ?? '-'),
        name: r.fullName ?? r.full_name ?? r.name ?? '-',
        private: r.private ? 'yes' : 'no',
        findings: r.findingsCount ?? r.findings_count ?? '-',
        synced: String(r.lastSyncedAt ?? r.last_synced_at ?? '-').slice(0, 10),
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'name', label: 'Repository', width: 40 },
        { key: 'private', label: 'Private', width: 7 },
        { key: 'findings', label: 'Findings', width: 8, align: 'right' },
        { key: 'synced', label: 'Last Sync', width: 10 },
      ],
    )
  },
})

export const securityFindingsCommand = defineCommand({
  meta: { name: 'findings', description: 'List security findings' },
  args: {
    repo: { type: 'string', description: 'Filter by repository full name (e.g. user/repo)' },
    severity: { type: 'string', description: 'Filter by severity (critical/high/medium/low/info)' },
    status: { type: 'string', description: 'Filter by status (open/dismissed/remediated/in_progress)' },
    overdue: { type: 'boolean', description: 'Only overdue findings' },
    limit: { type: 'string', description: 'Max findings to show (1-100)', default: '50' },
    offset: { type: 'string', description: 'Pagination offset', default: '0' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const input: { repoFullName?: string; severity?: string; status?: string; overdue?: boolean; limit?: number; offset?: number } = {}
    if (args.repo) input.repoFullName = args.repo
    if (args.severity) input.severity = args.severity
    if (args.status) input.status = args.status
    if (args.overdue) input.overdue = true
    if (args.limit) {
      const parsed = Number.parseInt(args.limit, 10)
      if (Number.isNaN(parsed) || parsed < 1) {
        console.error(`Invalid limit: ${args.limit}`)
        process.exit(1)
      }
      input.limit = Math.min(100, parsed)
    }
    if (args.offset) {
      const parsed = Number.parseInt(args.offset, 10)
      if (Number.isNaN(parsed) || parsed < 0) {
        console.error(`Invalid offset: ${args.offset}`)
        process.exit(1)
      }
      input.offset = parsed
    }
    const result = await listFindings(token, input)
    printSummary([
      { label: 'Total', value: result.totalCount ?? result.total_count ?? '?' },
      { label: 'Running', value: result.runningCount ?? result.running_count ?? 0 },
      { label: 'Concurrency', value: result.concurrencyLimit ?? result.concurrency_limit ?? '?' },
    ])
    if (result.findings.length === 0) {
      console.log('No findings found.')
      return
    }
    console.log('')
    printTable(
      result.findings.map((f) => ({
        id: (f.id ?? '-').slice(0, 8),
        sev: (f.severity ?? '-').slice(0, 8),
        title: truncate(f.title ?? '-', 50),
        repo: repoShort(f.repoFullName ?? f.repo_full_name),
        status: f.status ?? '-',
        analysis: f.analysisStatus ?? f.analysis_status ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 8 },
        { key: 'sev', label: 'Severity', width: 8 },
        { key: 'title', label: 'Title', width: 50 },
        { key: 'repo', label: 'Repo', width: 20 },
        { key: 'status', label: 'Status', width: 8 },
        { key: 'analysis', label: 'Analysis', width: 10 },
      ],
    )
  },
})

export const securityFindingCommand = defineCommand({
  meta: { name: 'finding', description: 'Get details of a security finding' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const f = await getFinding(token, args.id)
    const repo = f.repoFullName ?? f.repo_full_name
    const sla = f.slaDueAt ?? f.sla_due_at
    const analysisStatus = f.analysisStatus ?? f.analysis_status
    const remediation = f.remediationSummary ?? f.remediation_summary
    const created = f.createdAt ?? f.created_at
    const updated = f.updatedAt ?? f.updated_at
    console.log(`  ID:         ${f.id}`)
    console.log(`  Severity:   ${f.severity}`)
    console.log(`  Title:      ${f.title}`)
    if (repo) console.log(`  Repo:       ${repoUrl(repo)}`)
    console.log(`  Status:     ${f.status}`)
    if (f.source) console.log(`  Source:     ${f.source}`)
    if (f.description) console.log(`  Description: ${f.description}`)
    if (sla) console.log(`  SLA due:    ${sla}`)
    if (analysisStatus) console.log(`  Analysis:   ${analysisStatus}`)
    if (remediation) console.log(`  Remediation: ${remediation}`)
    if (created) console.log(`  Created:    ${created}`)
    if (updated) console.log(`  Updated:    ${updated}`)
  },
})

export const securityStatsCommand = defineCommand({
  meta: { name: 'stats', description: 'Show security agent statistics' },
  async run() {
    const { token } = await getToken()
    const stats = await getSecurityStats(token)
    console.log('Security stats:\n')
    for (const [key, value] of Object.entries(stats)) {
      console.log(`  ${key.padEnd(16)} ${value}`)
    }
  },
})

export const securityDashboardCommand = defineCommand({
  meta: { name: 'dashboard', description: 'Show security agent dashboard stats' },
  args: {
    from: { type: 'string', description: 'Start date (ISO)' },
    to: { type: 'string', description: 'End date (ISO)' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const input: { startDate?: string; endDate?: string } = {}
    if (args.from) input.startDate = args.from
    if (args.to) input.endDate = args.to
    const stats = await getDashboardStats(token, input)
    console.log('Dashboard stats:\n')
    for (const [key, value] of Object.entries(stats)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        console.log(`\n  ${key}:`)
        const cols = Object.keys(value[0] as Record<string, unknown>)
        printTable(
          value as Record<string, unknown>[],
          cols.slice(0, 8).map((c) => ({ key: c, label: c, width: 18 })),
        )
      } else if (Array.isArray(value)) {
        console.log(`  ${key}: ${value.join(', ')}`)
      } else if (typeof value === 'object' && value !== null) {
        console.log(`  ${key}:`)
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          console.log(`    ${k}: ${v}`)
        }
      } else {
        console.log(`  ${key.padEnd(16)} ${value}`)
      }
    }
  },
})

export const securitySyncCommand = defineCommand({
  meta: { name: 'sync', description: 'Trigger a security sync' },
  args: { repo: { type: 'string', description: 'Repository ID to sync (all if omitted)' } },
  async run({ args }) {
    const { token } = await getToken()
    await triggerSync(token, args.repo ? { repositoryId: args.repo } : undefined)
    console.log('Sync triggered.')
  },
})

export const securityDismissCommand = defineCommand({
  meta: { name: 'dismiss', description: 'Dismiss a security finding' },
  args: {
    id: { type: 'positional', description: 'Finding ID', required: true },
    reason: { type: 'string', description: 'Reason for dismissal' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await dismissFinding(token, args.id, args.reason)
    console.log(`Finding ${args.id} dismissed.`)
  },
})

export const securityAnalyzeCommand = defineCommand({
  meta: { name: 'analyze', description: 'Start security analysis for a repository' },
  args: { repo: { type: 'positional', description: 'Repository ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await startAnalysis(token, args.repo)
    console.log(`Analysis started: ${result.analysisId}`)
  },
})

export const securityRemediateCommand = defineCommand({
  meta: { name: 'remediate', description: 'Start remediation for a finding' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await startRemediation(token, args.id)
    console.log(`Remediation started: ${result.commandId}`)
  },
})

export const securityRetryRemediationCommand = defineCommand({
  meta: { name: 'retry-remediation', description: 'Retry a failed remediation' },
  args: { id: { type: 'positional', description: 'Command ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await retryRemediation(token, args.id)
    console.log(`Retrying remediation: ${args.id}`)
  },
})

export const securityCancelRemediationCommand = defineCommand({
  meta: { name: 'cancel-remediation', description: 'Cancel an in-progress remediation' },
  args: { id: { type: 'positional', description: 'Command ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await cancelRemediation(token, args.id)
    console.log(`Cancelled remediation: ${args.id}`)
  },
})

export const securityCommandsCommand = defineCommand({
  meta: { name: 'commands', description: 'List active security agent commands' },
  async run() {
    const { token } = await getToken()
    const commands = await listActiveCommands(token)
    if (commands.length === 0) {
      console.log('No active commands.')
      return
    }
    console.log(`Active commands (${commands.length}):\n`)
    printTable(
      commands.map((c) => ({
        id: String(c.id ?? '-'),
        type: c.type ?? '-',
        status: c.status ?? '-',
        repo: String(c.repositoryId ?? c.repository_id ?? '-'),
        started: c.startedAt ?? c.started_at ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'type', label: 'Type', width: 12 },
        { key: 'status', label: 'Status', width: 10 },
        { key: 'repo', label: 'Repository', width: 20 },
        { key: 'started', label: 'Started', width: 20 },
      ],
    )
  },
})

export const securityCommandStatusCommand = defineCommand({
  meta: { name: 'command', description: 'Get status of a security agent command' },
  args: { id: { type: 'positional', description: 'Command ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const cmd = await getCommandStatus(token, args.id)
    console.log(`  ID:          ${cmd.id ?? '-'}`)
    console.log(`  Type:        ${cmd.type ?? '-'}`)
    console.log(`  Status:      ${cmd.status ?? '-'}`)
    console.log(`  Repository:  ${cmd.repositoryId ?? cmd.repository_id ?? '-'}`)
    console.log(`  Started:     ${cmd.startedAt ?? cmd.started_at ?? '-'}`)
    if (cmd.completedAt) console.log(`  Completed:   ${cmd.completedAt}`)
    if (cmd.output) console.log(`  Output:      ${cmd.output}`)
  },
})

export const securityOrphanedReposCommand = defineCommand({
  meta: { name: 'orphaned-repos', description: 'List orphaned repositories' },
  async run() {
    const { token } = await getToken()
    const repos = await getOrphanedRepositories(token)
    if (repos.length === 0) {
      console.log('No orphaned repositories.')
      return
    }
    console.log(`Orphaned repositories (${repos.length}):\n`)
    printTable(
      repos.map((r) => ({
        id: String(r.id ?? '-'),
        name: r.fullName ?? r.full_name ?? r.name ?? '-',
        private: r.private ? 'yes' : 'no',
      })),
      [
        { key: 'id', label: 'ID', width: 12 },
        { key: 'name', label: 'Repository', width: 40 },
        { key: 'private', label: 'Private', width: 7 },
      ],
    )
  },
})

export const securityLastSyncCommand = defineCommand({
  meta: { name: 'last-sync', description: 'Show last sync time' },
  args: { repo: { type: 'string', description: 'Repository ID' } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await getLastSyncTime(token, args.repo ? { repositoryId: args.repo } : undefined)
    const lastSync = result.lastSyncTime ?? result.last_sync_time
    console.log(`Last sync: ${lastSync ?? 'never'}`)
  },
})

export const securityCloseCommand = defineCommand({
  meta: { name: 'close', description: 'Dismiss (close/ignore) security findings matching filters' },
  args: {
    repo: { type: 'string', description: 'Repository full name (e.g. user/repo)' },
    severity: { type: 'string', description: 'Filter by severity (critical/high/medium/low/info)' },
    status: { type: 'string', description: 'Filter by status (default: open)', default: 'open' },
    from: { type: 'string', description: 'Only findings created after this date (ISO, e.g. 2025-01-01)' },
    to: { type: 'string', description: 'Only findings created before this date (ISO)' },
    reason: { type: 'string', description: 'Reason for dismissal', default: 'Bulk closed via CLI' },
    dryRun: { type: 'boolean', description: 'Show what would be closed without actually dismissing' },
    yes: { type: 'boolean', description: 'Skip confirmation prompt' },
  },
  async run({ args }) {
    const { token } = await getToken()

    const filters = {
      repoFullName: args.repo,
      severity: args.severity,
      status: args.status ?? 'open',
      createdAfter: args.from,
      createdBefore: args.to,
    }

    // Dry run — show what would be closed
    if (args.dryRun) {
      const result = await listFindings(token, {
        repoFullName: filters.repoFullName,
        severity: filters.severity,
        status: filters.status,
        limit: 100,
      })
      let findings = result.findings
      if (filters.createdAfter || filters.createdBefore) {
        findings = findings.filter((f) => {
          const created = f.createdAt ?? f.created_at ?? ''
          if (filters.createdAfter && created < filters.createdAfter) return false
          if (filters.createdBefore && created > filters.createdBefore) return false
          return true
        })
      }
      const total = result.totalCount ?? result.total_count ?? 0
      console.log(`Dry run — would close ${findings.length} findings (total matching: ${total})`)
      if (filters.repoFullName) console.log(`  repo: ${filters.repoFullName}`)
      if (filters.severity) console.log(`  severity: ${filters.severity}`)
      if (filters.status) console.log(`  status: ${filters.status}`)
      if (filters.createdAfter) console.log(`  from: ${filters.createdAfter}`)
      if (filters.createdBefore) console.log(`  to: ${filters.createdBefore}`)
      if (findings.length > 0) {
        console.log('')
        printTable(
          findings.slice(0, 20).map((f) => ({
            id: f.id.slice(0, 8),
            sev: f.severity,
            title: truncate(f.title, 50),
            repo: repoShort(f.repoFullName ?? f.repo_full_name),
            status: f.status,
            analysis: f.analysisStatus ?? f.analysis_status ?? '-',
          })),
          [
            { key: 'id', label: 'ID', width: 8 },
            { key: 'sev', label: 'Severity', width: 8 },
            { key: 'title', label: 'Title', width: 50 },
            { key: 'repo', label: 'Repo', width: 20 },
            { key: 'status', label: 'Status', width: 8 },
            { key: 'analysis', label: 'Analysis', width: 10 },
          ],
        )
        if (findings.length > 20) console.log(`  ... and ${findings.length - 20} more`)
      }
      return
    }

    // Confirmation
    const filterDesc = [
      filters.repoFullName && `repo=${filters.repoFullName}`,
      filters.severity && `severity=${filters.severity}`,
      `status=${filters.status}`,
      filters.createdAfter && `from=${filters.createdAfter}`,
      filters.createdBefore && `to=${filters.createdBefore}`,
    ].filter(Boolean).join(', ')

    if (!args.yes) {
      const ok = await confirm(`Close all findings matching: ${filterDesc}?`)
      if (!ok) {
        console.log('Aborted.')
        return
      }
    }

    console.log(`Closing findings (${filterDesc})…`)
    const result = await dismissFindingsBulk(token, filters, args.reason ?? 'Bulk closed via CLI')
    console.log('\nDone.')
    printSummary([
      { label: 'Dismissed', value: result.dismissed },
      { label: 'Total matched', value: result.totalMatched },
      { label: 'Errors', value: result.errors.length },
    ])
    if (result.errors.length > 0) {
      console.log('\nErrors:')
      for (const e of result.errors.slice(0, 10)) {
        console.log(`  ${e}`)
      }
      if (result.errors.length > 10) console.log(`  ... and ${result.errors.length - 10} more`)
    }
  },
})

export const securityDeleteCommand = defineCommand({
  meta: { name: 'delete', description: 'Permanently delete ALL findings for a repository' },
  args: {
    repo: { type: 'string', description: 'Repository full name (e.g. user/repo)', required: true },
    yes: { type: 'boolean', description: 'Skip confirmation prompt' },
  },
  async run({ args }) {
    const { token } = await getToken()

    if (!args.yes) {
      const ok = await confirm(`Permanently DELETE all findings for ${args.repo}? This cannot be undone.`)
      if (!ok) {
        console.log('Aborted.')
        return
      }
    }

    await deleteFindingsByRepository(token, args.repo)
    console.log(`Deleted all findings for repository: ${args.repo}`)
  },
})
