/**
 * Security Agent CLI command handlers — personal level (no organization required).
 */

import { defineCommand } from 'citty'

import {
  cancelRemediation,
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
import { getToken } from './helpers.ts'

export const securityStatusCommand = defineCommand({
  meta: { name: 'status', description: 'Show security agent permission status' },
  async run() {
    const { token } = await getToken()
    const status = await getPermissionStatus(token)
    console.log(`Granted: ${status.granted ? 'yes' : 'no'}`)
    console.log(`Permissions: ${status.permissions?.join(', ') || '(none)'}`)
    console.log(`Pending requests: ${status.pendingRequests ?? 0}`)
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
    console.log(`Enabled: ${enabled ? 'yes' : 'no'}`)
    console.log(`Repositories: ${config.repositories?.length ? config.repositories.join(', ') : '(none)'}`)
    if (freq) console.log(`Scan frequency: ${freq}`)
    if (auto !== undefined) console.log(`Auto-remediate: ${auto ? 'yes' : 'no'}`)
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
    console.table(repos.map((r) => ({
      ID: r.id ?? '-',
      Name: r.fullName ?? r.full_name ?? r.name ?? '-',
      Private: r.private ? 'yes' : 'no',
      Findings: r.findingsCount ?? r.findings_count ?? '-',
      'Last synced': r.lastSyncedAt ?? r.last_synced_at ?? '-',
    })))
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
    if (args.limit) input.limit = Math.min(100, Math.max(1, Number.parseInt(args.limit, 10)))
    if (args.offset) input.offset = Math.max(0, Number.parseInt(args.offset, 10))
    const result = await listFindings(token, input)
    console.log(`Total: ${result.totalCount} | Running: ${result.runningCount} | Concurrency limit: ${result.concurrencyLimit}`)
    if (result.findings.length === 0) {
      console.log('No findings found.')
      return
    }
    console.table(result.findings.map((f) => ({
      ID: f.id,
      Severity: f.severity,
      Title: f.title,
      Repo: f.repoFullName ?? f.repo_full_name ?? '-',
      Status: f.status,
      Package: f.packageName ?? f.package_name ?? '-',
      Source: f.source ?? '-',
    })))
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
    console.log(`ID: ${f.id}`)
    console.log(`Severity: ${f.severity}`)
    console.log(`Title: ${f.title}`)
    if (repo) console.log(`Repository: ${repo}`)
    console.log(`Status: ${f.status}`)
    if (f.source) console.log(`Source: ${f.source}`)
    if (f.description) console.log(`Description: ${f.description}`)
    if (pkg) console.log(`Package: ${pkg} (${ecosystem ?? '?'})`)
    if (vuln) console.log(`Vulnerable: ${vuln}`)
    if (patched) console.log(`Patched: ${patched}`)
    if (cve) console.log(`CVE: ${cve}`)
    if (ghsa) console.log(`GHSA: ${ghsa}`)
    if (cvss) console.log(`CVSS: ${cvss}`)
    if (sla) console.log(`SLA due: ${sla}`)
    if (analysisStatus) console.log(`Analysis: ${analysisStatus}`)
    if (remediation) console.log(`Remediation: ${remediation}`)
    if (created) console.log(`Created: ${created}`)
    if (updated) console.log(`Updated: ${updated}`)
  },
})

export const securityStatsCommand = defineCommand({
  meta: { name: 'stats', description: 'Show security agent statistics' },
  async run() {
    const { token } = await getToken()
    const stats = await getSecurityStats(token)
    console.log('Security stats:')
    for (const [key, value] of Object.entries(stats)) {
      console.log(`  ${key}: ${value}`)
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
    console.log('Dashboard stats:')
    for (const [key, value] of Object.entries(stats)) {
      if (Array.isArray(value)) {
        console.log(`\n${key}:`)
        console.table(value)
      } else {
        console.log(`  ${key}: ${value}`)
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
    console.table(commands.map((c) => ({
      ID: c.id ?? '-',
      Type: c.type ?? '-',
      Status: c.status ?? '-',
      Repo: c.repositoryId ?? c.repository_id ?? '-',
      Started: c.startedAt ?? c.started_at ?? '-',
    })))
  },
})

export const securityCommandStatusCommand = defineCommand({
  meta: { name: 'command', description: 'Get status of a security agent command' },
  args: { id: { type: 'positional', description: 'Command ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const cmd = await getCommandStatus(token, args.id)
    console.log(`ID: ${cmd.id ?? '-'}`)
    console.log(`Type: ${cmd.type ?? '-'}`)
    console.log(`Status: ${cmd.status ?? '-'}`)
    console.log(`Repository: ${cmd.repositoryId ?? cmd.repository_id ?? '-'}`)
    console.log(`Started: ${cmd.startedAt ?? cmd.started_at ?? '-'}`)
    if (cmd.completedAt) console.log(`Completed: ${cmd.completedAt}`)
    if (cmd.output) console.log(`Output: ${cmd.output}`)
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
    console.table(repos.map((r) => ({ ID: r.id ?? '-', Name: r.fullName ?? r.full_name ?? r.name ?? '-', Private: r.private ? 'yes' : 'no' })))
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
  args: { repo: { type: 'positional', description: 'Repository ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await deleteFindingsByRepository(token, args.repo)
    console.log(`Deleted findings for repository: ${args.repo}`)
  },
})
