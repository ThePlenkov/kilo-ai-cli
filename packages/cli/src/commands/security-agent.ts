/**
 * Security Agent CLI command handlers — personal level (no organization required).
 */

import { defineCommand, showUsage } from 'citty'

import {
  cancelRemediation,
  DISMISS_REASONS,
  type DismissReason,
  deleteFindingsByRepository,
  dismissFinding,
  dismissFindingsBulk,
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
import type { SecurityFinding } from '../api/types.ts'
import { confirm } from './confirm.ts'
import { type Column, printSummary, printTable } from './format.ts'
import { getToken } from './helpers.ts'
import { colorSeverity, colorStatus, repoLink } from './theme.ts'

/** Resolve a numeric repo ID or full name to the full name (owner/repo). */
async function resolveRepoFullName(token: string, idOrName: string): Promise<string> {
  if (!/^\d+$/.test(idOrName)) return idOrName // already a full name
  const repos = await getSecurityRepositories(token)
  const repo = repos.find((r) => String(r.id) === idOrName)
  const fullName = repo?.fullName ?? repo?.full_name
  if (!fullName) {
    throw new Error(
      `Repository ID "${idOrName}" not found. Use \`kilo-ai-cli security repos\` to see available repositories.`,
    )
  }
  return fullName
}

export const securityStatusCommand = defineCommand({
  meta: { name: 'status', description: 'Show security agent permission status' },
  async run() {
    const { token } = await getToken()
    const status = await getPermissionStatus(token)
    printSummary([
      { label: 'Integration connected', value: status.hasIntegration ? 'yes' : 'no' },
      { label: 'Permissions granted', value: status.hasPermissions ? 'yes' : 'no' },
      ...(status.reauthorizeUrl ? [{ label: 'Reauthorize', value: status.reauthorizeUrl }] : []),
      ...(status.authInvalidAt
        ? [
            {
              label: 'Auth invalid',
              value: `${status.authInvalidAt} (${status.authInvalidReason ?? 'unknown'})`,
            },
          ]
        : []),
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
  args: {
    sort: {
      type: 'string',
      description: 'Sort by: findings (desc), name (asc), synced (desc)',
      default: 'findings',
    },
    'min-findings': {
      type: 'boolean',
      description: 'Hide repositories with zero findings',
      default: false,
    },
  },
  async run({ args }) {
    const { token } = await getToken()
    let repos = await getSecurityRepositories(token)
    if (repos.length === 0) {
      console.log('No repositories found.')
      return
    }
    if (args['min-findings']) {
      repos = repos.filter((r) => (r.findingsCount ?? r.findings_count ?? 0) > 0)
      if (repos.length === 0) {
        console.log('No repositories with findings found.')
        return
      }
    }
    const sortField = args.sort ?? 'findings'
    const validSorts = ['findings', 'name', 'synced']
    if (!validSorts.includes(sortField)) {
      console.error(`Invalid sort: ${sortField}. Valid: ${validSorts.join(', ')}`)
      process.exit(1)
    }
    repos = [...repos].sort((a, b) => {
      switch (sortField) {
        case 'name':
          return (a.fullName ?? a.full_name ?? a.name ?? '').localeCompare(
            b.fullName ?? b.full_name ?? b.name ?? '',
          )
        case 'synced': {
          const aT = a.lastSyncedAt ?? a.last_synced_at ?? ''
          const bT = b.lastSyncedAt ?? b.last_synced_at ?? ''
          return bT.localeCompare(aT)
        }
        case 'findings':
        default: {
          const aN = a.findingsCount ?? a.findings_count ?? 0
          const bN = b.findingsCount ?? b.findings_count ?? 0
          return bN - aN
        }
      }
    })
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
        { key: 'id', label: 'ID', width: 14 },
        { key: 'name', label: 'Repository', width: 40 },
        { key: 'private', label: 'Private', width: 7 },
        { key: 'findings', label: 'Findings', width: 8, align: 'right' },
        { key: 'synced', label: 'Last Sync', width: 10 },
      ],
    )
  },
})

/** Column registry for `security findings --columns`. */
const FINDINGS_COLUMNS: Record<
  string,
  { label: string; width: number; get: (f: SecurityFinding) => string; format?: Column['format'] }
> = {
  id: { label: 'ID', width: 36, get: (f) => String(f.id ?? '-') },
  severity: { label: 'Severity', width: 8, get: (f) => f.severity ?? '-', format: colorSeverity },
  title: { label: 'Title', width: 50, get: (f) => f.title ?? '-' },
  repo: {
    label: 'Repository',
    width: 30,
    get: (f) => f.repoFullName ?? f.repo_full_name ?? '-',
    format: (shown, raw) => repoLink(raw, shown),
  },
  status: { label: 'Status', width: 12, get: (f) => f.status ?? '-', format: colorStatus },
  package: {
    label: 'Package',
    width: 20,
    get: (f) => f.packageName ?? f.package_name ?? '-',
  },
}

const FINDINGS_COLUMN_NAMES = Object.keys(FINDINGS_COLUMNS)

export const securityFindingsListCommand = defineCommand({
  meta: { name: 'list', description: 'List security findings' },
  args: {
    repo: { type: 'string', description: 'Filter by repository full name (e.g. user/repo)' },
    severity: { type: 'string', description: 'Filter by severity (critical/high/medium/low/info)' },
    status: {
      type: 'string',
      description: 'Filter by status (open/dismissed/remediated/in_progress)',
    },
    outcome: {
      type: 'string',
      description: 'Filter by remediation outcome (e.g. fixed/failed/pending)',
    },
    overdue: { type: 'boolean', description: 'Only overdue findings' },
    sort: {
      type: 'string',
      description: 'Sort: severity_desc (default), severity_asc, sla_due_at_asc',
      default: 'severity_desc',
    },
    limit: { type: 'string', description: 'Max findings to show (1-100)', default: '50' },
    offset: { type: 'string', description: 'Pagination offset', default: '0' },
    columns: {
      type: 'string',
      description: 'Columns to show: id,severity,title,repo,status,package (or "all")',
      default: 'severity,title,repo,status,package',
    },
  },
  async run({ args }) {
    const { token } = await getToken()
    const input: {
      repoFullName?: string
      severity?: string
      status?: string
      outcomeFilter?: string
      overdue?: boolean
      sortBy?: 'severity_desc' | 'severity_asc' | 'sla_due_at_asc'
      limit?: number
      offset?: number
    } = {}
    if (args.repo) input.repoFullName = args.repo
    if (args.severity) input.severity = args.severity
    if (args.status) input.status = args.status
    if (args.outcome) input.outcomeFilter = args.outcome
    if (args.overdue) input.overdue = true
    if (args.sort) {
      const valid = ['severity_desc', 'severity_asc', 'sla_due_at_asc']
      if (!valid.includes(args.sort)) {
        console.error(`Invalid sort: ${args.sort}. Valid: ${valid.join(', ')}`)
        process.exit(1)
      }
      input.sortBy = args.sort as 'severity_desc' | 'severity_asc' | 'sla_due_at_asc'
    }
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
    // Parse --columns
    const requested =
      args.columns === 'all' ? FINDINGS_COLUMN_NAMES : args.columns.split(',').map((c) => c.trim())
    const invalid = requested.filter((c) => !(c in FINDINGS_COLUMNS))
    if (invalid.length > 0) {
      console.error(
        `Invalid columns: ${invalid.join(', ')}. Valid: ${FINDINGS_COLUMN_NAMES.join(', ')} or "all"`,
      )
      process.exit(1)
    }
    const columns: Column[] = requested.map((name) => ({
      key: name,
      label: FINDINGS_COLUMNS[name].label,
      width: FINDINGS_COLUMNS[name].width,
      format: FINDINGS_COLUMNS[name].format,
    }))

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
      result.findings.map((f) => {
        const row: Record<string, string> = {}
        for (const name of requested) row[name] = FINDINGS_COLUMNS[name].get(f)
        return row
      }),
      columns,
    )
  },
})

export const securityFindingsDetailCommand = defineCommand({
  meta: { name: 'detail', description: 'Get details of a security finding' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const f = await getFinding(token, args.id)
    const repo = f.repoFullName ?? f.repo_full_name
    const pkg = f.packageName ?? f.package_name
    const ecosystem = f.packageEcosystem ?? f.package_ecosystem
    const vuln = f.vulnerableVersionRange ?? f.vulnerable_version_range
    const patched = f.patchedVersion ?? f.patched_version
    const cve = f.cveId ?? f.cve_id
    const ghsa = f.ghsaId ?? f.ghsa_id
    const cvss = f.cvssScore ?? f.cvss_score
    const sla = f.slaDueAt ?? f.sla_due_at
    const analysisStatus = f.analysisStatus ?? f.analysis_status
    const remediation = f.remediationSummary ?? f.remediation_summary
    const created = f.createdAt ?? f.created_at
    const updated = f.updatedAt ?? f.updated_at
    console.log(`  ID:         ${f.id}`)
    console.log(`  Severity:   ${f.severity}`)
    console.log(`  Title:      ${f.title}`)
    if (repo) console.log(`  Repository: ${repo}`)
    console.log(`  Status:     ${f.status}`)
    if (f.source) console.log(`  Source:     ${f.source}`)
    if (f.description) console.log(`  Description: ${f.description}`)
    if (pkg) console.log(`  Package:    ${pkg} (${ecosystem ?? '?'})`)
    if (vuln) console.log(`  Vulnerable: ${vuln}`)
    if (patched) console.log(`  Patched:    ${patched}`)
    if (cve) console.log(`  CVE:        ${cve}`)
    if (ghsa) console.log(`  GHSA:       ${ghsa}`)
    if (cvss) console.log(`  CVSS:       ${cvss}`)
    if (sla) console.log(`  SLA due:    ${sla}`)
    if (analysisStatus) console.log(`  Analysis:   ${analysisStatus}`)
    printRemediation(remediation)
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
          console.log(`    ${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`)
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

function printRemediation(remediation: SecurityFinding['remediationSummary']): void {
  if (typeof remediation === 'string') {
    console.log(`  Remediation: ${remediation}`)
    return
  }
  if (!remediation) return
  console.log(`  Remediation: ${remediation.status ?? 'unknown'}`)
  const prUrl = remediation.prUrl ?? remediation.latestAttempt?.prUrl
  if (prUrl) console.log(`    PR: ${prUrl}`)
  if (remediation.latestAttempt?.branchName)
    console.log(`    Branch: ${remediation.latestAttempt.branchName}`)
  if (remediation.outcomeSummary) console.log(`    Outcome: ${remediation.outcomeSummary}`)
}

export const securityFindingsDismissCommand = defineCommand({
  meta: { name: 'dismiss', description: 'Dismiss a security finding (one-way)' },
  args: {
    id: { type: 'positional', description: 'Finding ID', required: true },
    reason: {
      type: 'string',
      description: `Reason for dismissal (${DISMISS_REASONS.join('/')})`,
    },
  },
  async run({ args }) {
    if (args.reason && !(DISMISS_REASONS as readonly string[]).includes(args.reason)) {
      const allowed = DISMISS_REASONS.join(', ')
      throw new Error(`Invalid --reason "${args.reason}". Allowed: ${allowed}`)
    }
    const { token } = await getToken()
    await dismissFinding(token, args.id, args.reason as DismissReason | undefined)
    console.log(`Finding ${args.id} dismissed.`)
  },
})

export const securityFindingsAnalyzeCommand = defineCommand({
  meta: { name: 'analyze', description: 'Start security analysis for a finding' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await startAnalysis(token, args.id)
    console.log(`Analysis queued${result.commandId ? ` (command ${result.commandId})` : ''}.`)
  },
})

export const securityFindingsRemediateCommand = defineCommand({
  meta: { name: 'remediate', description: 'Start remediation for a finding (may open a PR)' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await startRemediation(token, args.id)
    console.log(`Remediation started (attempt ${result.attemptId}).`)
  },
})

export const securityFindingsRetryCommand = defineCommand({
  meta: { name: 'retry', description: 'Retry remediation for a finding' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await retryRemediation(token, args.id)
    console.log(`Retrying remediation for finding ${args.id}.`)
  },
})

export const securityFindingsCancelCommand = defineCommand({
  meta: { name: 'cancel', description: 'Cancel an in-progress remediation' },
  args: { id: { type: 'positional', description: 'Attempt ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await cancelRemediation(token, args.id)
    console.log(`Cancelled remediation attempt ${args.id}.`)
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

export const securityFindingsCloseCommand = defineCommand({
  meta: { name: 'close', description: 'Dismiss (close/ignore) findings matching filters' },
  args: {
    repo: { type: 'string', description: 'Repository full name (e.g. user/repo)' },
    severity: { type: 'string', description: 'Filter by severity (critical/high/medium/low/info)' },
    status: {
      type: 'string',
      description: 'Filter by status (open/dismissed/remediated/in_progress)',
      default: 'open',
    },
    outcome: { type: 'string', description: 'Filter by remediation outcome' },
    overdue: { type: 'boolean', description: 'Only overdue findings' },
    from: { type: 'string', description: 'Only findings created after this date (ISO, e.g. 2025-01-01)' },
    to: { type: 'string', description: 'Only findings created before this date (ISO)' },
    reason: {
      type: 'string',
      description: `Reason for dismissal (${DISMISS_REASONS.join('/')})`,
    },
    'dry-run': { type: 'boolean', description: 'Show what would be closed without dismissing' },
    yes: { type: 'boolean', description: 'Skip confirmation prompt', alias: 'y' },
  },
  async run({ args }) {
    if (args.reason && !(DISMISS_REASONS as readonly string[]).includes(args.reason)) {
      throw new Error(`Invalid --reason "${args.reason}". Allowed: ${DISMISS_REASONS.join(', ')}`)
    }
    const { token } = await getToken()

    const filters = {
      repoFullName: args.repo,
      severity: args.severity,
      status: args.status,
      outcomeFilter: args.outcome,
      overdue: args.overdue,
      createdAfter: args.from,
      createdBefore: args.to,
    }
    const filterDesc = [
      filters.repoFullName && `repo=${filters.repoFullName}`,
      filters.severity && `severity=${filters.severity}`,
      filters.status && `status=${filters.status}`,
      filters.outcomeFilter && `outcome=${filters.outcomeFilter}`,
      filters.overdue && 'overdue',
      filters.createdAfter && `from=${filters.createdAfter}`,
      filters.createdBefore && `to=${filters.createdBefore}`,
    ]
      .filter(Boolean)
      .join(', ')

    if (args['dry-run']) {
      const result = await listFindings(token, {
        repoFullName: filters.repoFullName,
        severity: filters.severity,
        status: filters.status,
        outcomeFilter: filters.outcomeFilter,
        overdue: filters.overdue,
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
      const total = result.totalCount ?? result.total_count ?? findings.length
      console.log(`Dry run — would close ${findings.length} findings (total matching: ${total})`)
      if (filterDesc) console.log(`  filters: ${filterDesc}`)
      if (findings.length > 0) {
        console.log('')
        const previewNames = ['severity', 'title', 'repo', 'status', 'package']
        printTable(
          findings.slice(0, 20).map((f) => {
            const row: Record<string, string> = {}
            for (const name of previewNames) row[name] = FINDINGS_COLUMNS[name].get(f)
            return row
          }),
          previewNames.map((name) => ({
            key: name,
            label: FINDINGS_COLUMNS[name].label,
            width: FINDINGS_COLUMNS[name].width,
            format: FINDINGS_COLUMNS[name].format,
          })),
        )
        if (findings.length > 20) console.log(`  ... and ${findings.length - 20} more`)
      }
      return
    }

    if (!args.yes) {
      const ok = await confirm(`Close all findings matching: ${filterDesc || '(no filters)'}?`)
      if (!ok) {
        console.log('Cancelled.')
        return
      }
    }

    console.log(`Closing findings (${filterDesc || 'no filters'})…`)
    const result = await dismissFindingsBulk(
      token,
      filters,
      (args.reason as DismissReason | undefined) ?? 'no_bandwidth',
    )
    printSummary([
      { label: 'Dismissed', value: result.dismissed },
      { label: 'Total matched', value: result.totalMatched },
      { label: 'Errors', value: result.errors.length },
    ])
    if (result.errors.length > 0) {
      console.log('\nErrors:')
      for (const e of result.errors.slice(0, 10)) console.log(`  ${e}`)
      if (result.errors.length > 10) console.log(`  ... and ${result.errors.length - 10} more`)
    }
  },
})

export const securityFindingsDeleteCommand = defineCommand({
  meta: { name: 'delete', description: 'Delete findings for a repository (all or filtered)' },
  args: {
    repo: { type: 'positional', description: 'Repository ID or full name (e.g. user/repo)', required: false },
    'repo-name': { type: 'string', description: 'Repository full name (alternative to positional)', alias: 'repo' },
    severity: { type: 'string', description: 'Filter by severity (critical/high/medium/low/info)' },
    status: { type: 'string', description: 'Filter by status (open/dismissed/remediated/in_progress)' },
    outcome: { type: 'string', description: 'Filter by remediation outcome' },
    overdue: { type: 'boolean', description: 'Only overdue findings' },
    'dry-run': { type: 'boolean', description: 'Show what would be deleted without deleting' },
    yes: { type: 'boolean', description: 'Skip confirmation prompt', alias: 'y' },
  },
  async run({ args }) {
    const repoName = args.repo ?? args['repo-name']
    if (!repoName) {
      console.error('Missing repository. Usage: security findings delete <repo> or --repo=<repo>')
      process.exit(1)
    }
    const { token } = await getToken()
    const fullName = await resolveRepoFullName(token, repoName)

    const hasFilters = args.severity || args.status || args.outcome || args.overdue

    // Preview — list matching findings
    const result = await listFindings(token, {
      repoFullName: fullName,
      severity: args.severity,
      status: args.status,
      outcomeFilter: args.outcome,
      overdue: args.overdue,
      limit: 100,
    })
    const total = result.totalCount ?? result.total_count ?? result.findings.length

    if (args['dry-run']) {
      console.log(`Dry run — would delete ${total} findings for ${fullName}`)
      if (args.severity) console.log(`  severity: ${args.severity}`)
      if (args.status) console.log(`  status: ${args.status}`)
      if (args.outcome) console.log(`  outcome: ${args.outcome}`)
      if (args.overdue) console.log(`  overdue: true`)
      return
    }

    if (total === 0) {
      console.log('No matching findings to delete.')
      return
    }

    // API deletes ALL findings for the repo — fetch unfiltered total for the report
    let repoTotal = total
    if (hasFilters) {
      const all = await listFindings(token, { repoFullName: fullName, limit: 1 })
      repoTotal = all.totalCount ?? all.total_count ?? all.findings.length
      console.log(
        `Found ${total} matching findings — note: API deletes ALL ${repoTotal} findings for the repository.`,
      )
    }

    if (!args.yes) {
      const ok = await confirm(`Delete ALL ${repoTotal} findings for repository ${fullName}?`)
      if (!ok) {
        console.log('Cancelled.')
        return
      }
    }
    await deleteFindingsByRepository(token, fullName)
    printSummary([
      { label: 'Deleted', value: repoTotal },
      { label: 'Repository', value: fullName },
    ])
  },
})

export const securityFindingsCommand = defineCommand({
  meta: { name: 'findings', description: 'Security findings commands' },
  subCommands: {
    list: securityFindingsListCommand,
    detail: securityFindingsDetailCommand,
    dismiss: securityFindingsDismissCommand,
    close: securityFindingsCloseCommand,
    analyze: securityFindingsAnalyzeCommand,
    remediate: securityFindingsRemediateCommand,
    retry: securityFindingsRetryCommand,
    cancel: securityFindingsCancelCommand,
    delete: securityFindingsDeleteCommand,
  },
  async run(ctx) {
    if (ctx.rawArgs.some((a) => !a.startsWith('-'))) return
    await showUsage(ctx.cmd, { meta: { name: 'security' } })
  },
})
