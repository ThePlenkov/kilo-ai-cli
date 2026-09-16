/**
 * Security Agent CLI command handlers — personal level (no organization required).
 */

import { defineCommand } from 'citty'

import {
  cancelRemediation,
  DISMISS_REASONS,
  type DismissReason,
  deleteFindingsByRepository,
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
import type { SecurityFinding } from '../api/types.ts'
import { confirm } from './confirm.ts'
import { printSummary, printTable } from './format.ts'
import { getToken } from './helpers.ts'
import { colorSeverity, colorStatus, repoLink } from './theme.ts'

/**
 * Resolve a repo identifier (numeric ID or full name like "user/repo") to a numeric ID.
 * If the input is already numeric, return it as-is. Otherwise, look it up by full name.
 * Short names (e.g. "repo") are rejected — use "owner/repo" to avoid ambiguity.
 */
async function resolveRepoId(token: string, idOrName: string): Promise<string> {
  if (/^\d+$/.test(idOrName)) return idOrName
  const repos = await getSecurityRepositories(token)
  const matches = repos.filter((r) => (r.fullName ?? r.full_name ?? null) === idOrName)
  if (matches.length > 1) {
    throw new Error(
      `Multiple repositories match "${idOrName}". Run \`kilo-ai-cli security repos\` and pass the numeric ID to disambiguate.`,
    )
  }
  const repo = matches[0]
  if (!repo) {
    throw new Error(
      `Repository "${idOrName}" not found. Use \`kilo-ai-cli security repos\` to see available repositories. Use the full name (owner/repo), not the short name.`,
    )
  }
  if (repo.id === undefined) {
    throw new Error(`Repository "${idOrName}" has no ID.`)
  }
  return String(repo.id)
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
    }
    const sortField = args.sort ?? 'findings'
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

export const securityFindingsCommand = defineCommand({
  meta: { name: 'findings', description: 'List security findings' },
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
        id: String(f.id ?? '-'),
        sev: f.severity ?? '-',
        title: f.title ?? '-',
        repo: f.repoFullName ?? f.repo_full_name ?? '-',
        status: f.status ?? '-',
        pkg: f.packageName ?? f.package_name ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'sev', label: 'Severity', width: 8, format: (v) => colorSeverity(v) },
        { key: 'title', label: 'Title', width: 50 },
        {
          key: 'repo',
          label: 'Repository',
          width: 30,
          format: (shown, raw) => repoLink(raw, shown),
        },
        { key: 'status', label: 'Status', width: 12, format: (v) => colorStatus(v) },
        { key: 'pkg', label: 'Package', width: 20 },
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

export const securityDismissCommand = defineCommand({
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

export const securityAnalyzeCommand = defineCommand({
  meta: { name: 'analyze', description: 'Start security analysis for a finding' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await startAnalysis(token, args.id)
    console.log(`Analysis queued${result.commandId ? ` (command ${result.commandId})` : ''}.`)
  },
})

export const securityRemediateCommand = defineCommand({
  meta: { name: 'remediate', description: 'Start remediation for a finding (may open a PR)' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await startRemediation(token, args.id)
    console.log(`Remediation started (attempt ${result.attemptId}).`)
  },
})

export const securityRetryRemediationCommand = defineCommand({
  meta: { name: 'retry-remediation', description: 'Retry remediation for a finding' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await retryRemediation(token, args.id)
    console.log(`Retrying remediation for finding ${args.id}.`)
  },
})

export const securityCancelRemediationCommand = defineCommand({
  meta: { name: 'cancel-remediation', description: 'Cancel an in-progress remediation' },
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

export const securityDeleteFindingsCommand = defineCommand({
  meta: { name: 'delete-findings', description: 'Delete all findings for a repository' },
  args: {
    repo: { type: 'positional', description: 'Repository ID or full name (e.g. user/repo)', required: true },
    yes: { type: 'boolean', description: 'Skip confirmation prompt', alias: 'y' },
  },
  async run({ args }) {
    const { token } = await getToken()
    // Resolve repo full name → numeric ID if needed
    const repoId = await resolveRepoId(token, args.repo)
    if (!args.yes) {
      const ok = await confirm(`Delete ALL findings for repository ${args.repo}?`)
      if (!ok) {
        console.log('Cancelled.')
        return
      }
    }
    await deleteFindingsByRepository(token, repoId)
    console.log(`Deleted findings for repository: ${args.repo}`)
  },
})
