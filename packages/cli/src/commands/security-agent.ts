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
    console.log(`Permissions: ${status.permissions.join(', ') || '(none)'}`)
    console.log(`Pending requests: ${status.pendingRequests}`)
  },
})

export const securityConfigCommand = defineCommand({
  meta: { name: 'config', description: 'Show security agent configuration' },
  async run() {
    const { token } = await getToken()
    const config = await getSecurityConfig(token)
    console.log(`Enabled: ${config.isEnabled ? 'yes' : 'no'}`)
    console.log(`Repositories: ${config.repositories.length > 0 ? config.repositories.join(', ') : '(none)'}`)
    if (config.scanFrequency) console.log(`Scan frequency: ${config.scanFrequency}`)
    if (config.autoRemediate !== undefined) console.log(`Auto-remediate: ${config.autoRemediate ? 'yes' : 'no'}`)
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
      ID: r.id,
      Name: r.fullName,
      Private: r.private ? 'yes' : 'no',
      Findings: r.findingsCount ?? '-',
      'Last synced': r.lastSyncedAt ?? '-',
    })))
  },
})

export const securityFindingsCommand = defineCommand({
  meta: { name: 'findings', description: 'List security findings' },
  args: {
    repo: { type: 'string', description: 'Filter by repository ID' },
    severity: { type: 'string', description: 'Filter by severity (critical/high/medium/low/info)' },
    status: { type: 'string', description: 'Filter by status (open/dismissed/remediated/in_progress)' },
    limit: { type: 'string', description: 'Max findings to show', default: '50' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const input: { repositoryId?: string; severity?: string; status?: string; limit?: number } = {}
    if (args.repo) input.repositoryId = args.repo
    if (args.severity) input.severity = args.severity
    if (args.status) input.status = args.status
    if (args.limit) {
      const parsed = Number.parseInt(args.limit, 10)
      if (Number.isNaN(parsed) || parsed < 1) {
        console.error(`Invalid limit: ${args.limit}`)
        process.exit(1)
      }
      input.limit = parsed
    }
    const findings = await listFindings(token, input)
    if (findings.length === 0) {
      console.log('No findings found.')
      return
    }
    console.table(findings.map((f) => ({
      ID: f.id,
      Severity: f.severity,
      Title: f.title,
      Repo: f.repositoryName,
      Status: f.status,
      File: f.file ? `${f.file}:${f.line ?? '?'}` : '-',
    })))
  },
})

export const securityFindingCommand = defineCommand({
  meta: { name: 'finding', description: 'Get details of a security finding' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const finding = await getFinding(token, args.id)
    console.log(`ID: ${finding.id}`)
    console.log(`Severity: ${finding.severity}`)
    console.log(`Title: ${finding.title}`)
    console.log(`Repository: ${finding.repositoryName}`)
    console.log(`Status: ${finding.status}`)
    console.log(`Description: ${finding.description}`)
    if (finding.file) console.log(`File: ${finding.file}:${finding.line ?? '?'}`)
    console.log(`Created: ${finding.createdAt}`)
    console.log(`Updated: ${finding.updatedAt}`)
  },
})

export const securityStatsCommand = defineCommand({
  meta: { name: 'stats', description: 'Show security agent statistics' },
  async run() {
    const { token } = await getToken()
    const stats = await getSecurityStats(token)
    console.log(`Total findings: ${stats.totalFindings}`)
    console.log(`  Critical: ${stats.criticalFindings}`)
    console.log(`  High: ${stats.highFindings}`)
    console.log(`  Medium: ${stats.mediumFindings}`)
    console.log(`  Low: ${stats.lowFindings}`)
    console.log(`Open: ${stats.openFindings}`)
    console.log(`Remediated: ${stats.remediatedFindings}`)
    console.log(`Dismissed: ${stats.dismissedFindings}`)
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
    console.log(`Total repositories: ${stats.totalRepositories}`)
    console.log(`Total findings: ${stats.totalFindings}`)
    if (stats.findingsTrend.length > 0) {
      console.log('\nFindings trend:')
      console.table(stats.findingsTrend.map((t) => ({ Date: t.date, Findings: t.count })))
    }
    if (stats.topRepositories.length > 0) {
      console.log('\nTop repositories by findings:')
      console.table(stats.topRepositories.map((r) => ({ Repository: r.name, Findings: r.findings })))
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
      ID: c.id,
      Type: c.type,
      Status: c.status,
      Repo: c.repositoryId,
      Started: c.startedAt,
    })))
  },
})

export const securityCommandStatusCommand = defineCommand({
  meta: { name: 'command', description: 'Get status of a security agent command' },
  args: { id: { type: 'positional', description: 'Command ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const cmd = await getCommandStatus(token, args.id)
    console.log(`ID: ${cmd.id}`)
    console.log(`Type: ${cmd.type}`)
    console.log(`Status: ${cmd.status}`)
    console.log(`Repository: ${cmd.repositoryId}`)
    console.log(`Started: ${cmd.startedAt}`)
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
    console.table(repos.map((r) => ({ ID: r.id, Name: r.fullName, Private: r.private ? 'yes' : 'no' })))
  },
})

export const securityLastSyncCommand = defineCommand({
  meta: { name: 'last-sync', description: 'Show last sync time' },
  args: { repo: { type: 'string', description: 'Repository ID' } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await getLastSyncTime(token, args.repo ? { repositoryId: args.repo } : undefined)
    console.log(`Last sync: ${result.lastSyncTime ?? 'never'}`)
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
