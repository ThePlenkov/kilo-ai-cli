/**
 * Security Agent CLI command handlers — personal level (no organization required).
 */

import { defineCommand, showUsage } from 'citty'

import {
  cancelRemediation,
  commandFailureDetail,
  commandOutcome,
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
  matchesDateFilters,
  retryRemediation,
  setSecurityEnabled,
  startAnalysis,
  startRemediation,
  triggerSync,
  waitForCommand,
} from '../api/security-agent.ts'
import type { SecurityAgentCommand, SecurityFinding } from '../api/types.ts'
import { createCursorStore } from '../state/cursor-store.ts'
import { applyDeltaAsync } from '../state/delta.ts'
import { confirm } from './confirm.ts'
import { type Column, printSummary, printTable } from './format.ts'
import { getToken } from './helpers.ts'
import { colorSeverity, colorStatus, repoLink } from './theme.ts'

/** Cursor name used by `security findings list --new`. */
export const FINDINGS_CURSOR = 'security-findings'

/** Upper bound on the number of pages a delta read walks. */
const FINDINGS_MAX_PAGES = 20

/**
 * Cursor name for the findings delta. A filtered read gets its own cursor:
 * advancing the shared one from a filtered subset would skip the findings
 * the filter hid.
 */
export function findingsCursorName(filters: {
  repoFullName?: string
  severity?: string
  status?: string
  outcomeFilter?: string
  overdue?: boolean
}): string {
  const parts = [
    filters.repoFullName,
    filters.severity,
    filters.status,
    filters.outcomeFilter,
    filters.overdue ? 'overdue' : undefined,
  ].filter(Boolean)
  return parts.length === 0 ? FINDINGS_CURSOR : `${FINDINGS_CURSOR}:${parts.join(':')}`
}

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

/** Exit code for "the server never confirmed the outcome" — not a clean run. */
const EXIT_UNVERIFIED = 2

/** Print the real outcome of a queued command and return the exit code it implies. */
function reportCommandOutcome(command: SecurityAgentCommand, subject: string): number {
  const outcome = commandOutcome(command)
  const status = command.status ?? 'unknown'
  if (outcome === 'failed') {
    console.error(`  ${subject}: ${status}`)
    const detail = commandFailureDetail(command)
    if (detail) console.error(`    ${detail}`)
    return 1
  }
  if (outcome === 'pending') {
    console.error(
      `  ${subject}: still ${status} — not confirmed, check \`security command ${command.id}\``,
    )
    return EXIT_UNVERIFIED
  }
  console.log(`  ${subject}: ${status}`)
  return 0
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
    repos = repos.toSorted((a, b) => {
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
  {
    label: string
    width: number
    get: (f: SecurityFinding) => string
    format?: NonNullable<Column['format']>
  }
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

/** The filters and the paging of a findings list. */
interface FindingsListInput {
  repoFullName?: string
  severity?: string
  status?: string
  outcomeFilter?: string
  overdue?: boolean
  sortBy?: 'severity_desc' | 'severity_asc' | 'sla_due_at_asc'
  limit?: number
  offset?: number
}

/** Parse the sort order — an unknown one ends the process. */
function parseSort(value: string | undefined): FindingsListInput['sortBy'] {
  if (!value) return undefined
  const valid = ['severity_desc', 'severity_asc', 'sla_due_at_asc']
  if (!valid.includes(value)) {
    console.error(`Invalid sort: ${value}. Valid: ${valid.join(', ')}`)
    process.exit(1)
  }
  return value as 'severity_desc' | 'severity_asc' | 'sla_due_at_asc'
}

/** Parse the page size — an invalid one ends the process. */
function parseLimit(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    console.error(`Invalid limit: ${value}`)
    process.exit(1)
  }
  return Math.min(100, parsed)
}

/** Parse the page offset — an invalid one ends the process. */
function parseOffset(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    console.error(`Invalid offset: ${value}`)
    process.exit(1)
  }
  return parsed
}

/** The filters of a findings list, taken from the command arguments. */
function parseFindingsInput(args: {
  repo?: string
  severity?: string
  status?: string
  outcome?: string
  overdue?: boolean
  sort?: string
  limit?: string
  offset?: string
}): FindingsListInput {
  const input: FindingsListInput = {}
  if (args.repo) input.repoFullName = args.repo
  if (args.severity) input.severity = args.severity
  if (args.status) input.status = args.status
  if (args.outcome) input.outcomeFilter = args.outcome
  if (args.overdue) input.overdue = true
  const sortBy = parseSort(args.sort)
  if (sortBy) input.sortBy = sortBy
  const limit = parseLimit(args.limit)
  if (limit !== undefined) input.limit = limit
  const offset = parseOffset(args.offset)
  if (offset !== undefined) input.offset = offset
  return input
}

/** The requested columns and their table definition — an unknown one ends the process. */
function parseColumns(value: string): { requested: string[]; columns: Column[] } {
  const requested = value === 'all' ? FINDINGS_COLUMN_NAMES : value.split(',').map((c) => c.trim())
  const invalid = requested.filter((c) => !Object.hasOwn(FINDINGS_COLUMNS, c))
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
  return { requested, columns }
}

/**
 * Walk every page of the delta window, so the cursor is only advanced once
 * the whole window has been seen.
 */
async function walkFindingsWindow(
  token: string,
  input: FindingsListInput,
  first: SecurityFinding[],
  pageLimit: number,
): Promise<{ findings: SecurityFinding[]; complete: boolean }> {
  let findings = first
  let complete = findings.length < pageLimit
  for (let page = 0; !complete && page < FINDINGS_MAX_PAGES; page++) {
    // eslint-disable-next-line no-await-in-loop -- offset pagination is sequential
    const more = await listFindings(token, {
      ...input,
      limit: pageLimit,
      offset: (input.offset ?? 0) + pageLimit * (page + 1),
    })
    // An empty page means the window ended exactly on a page boundary.
    if (more.findings.length === 0) {
      complete = true
      break
    }
    findings = findings.concat(more.findings)
    complete = more.findings.length < pageLimit
    if (!complete && page === FINDINGS_MAX_PAGES - 1) {
      console.log(
        `More than ${FINDINGS_MAX_PAGES * pageLimit} findings match; the cursor was not advanced.`,
      )
    }
  }
  return { findings, complete }
}

/** Apply the delta to the findings and advance the cursor. */
async function applyFindingsDelta(
  findings: SecurityFinding[],
  options: {
    cursorName: string
    since?: string
    advance: boolean
    complete: boolean
    store: ReturnType<typeof createCursorStore>
  },
): Promise<SecurityFinding[]> {
  const delta = await applyDeltaAsync(
    findings,
    (f) => f.updated_at ?? f.created_at ?? f.first_detected_at,
    {
      cursor: options.cursorName,
      since: options.since,
      advance: options.advance,
      complete: options.complete,
      store: options.store,
    },
  )
  if (delta.advancedTo) {
    console.log(`Cursor "${options.cursorName}" advanced to ${delta.advancedTo}`)
  }
  return delta.items
}

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
    new: { type: 'boolean', description: 'Only findings newer than the stored cursor' },
    since: { type: 'string', description: 'Explicit lower bound (ISO timestamp)' },
    'no-advance': { type: 'boolean', description: 'Do not advance the stored cursor' },
    columns: {
      type: 'string',
      description: 'Columns to show: id,severity,title,repo,status,package (or "all")',
      default: 'severity,title,repo,status,package',
    },
  },
  async run({ args }) {
    const { token } = await getToken()
    const input = parseFindingsInput(args)
    const { requested, columns } = parseColumns(args.columns)

    const result = await listFindings(token, input)
    printSummary([
      { label: 'Total', value: result.totalCount ?? result.total_count ?? '?' },
      { label: 'Running', value: result.runningCount ?? result.running_count ?? 0 },
      { label: 'Concurrency', value: result.concurrencyLimit ?? result.concurrency_limit ?? '?' },
    ])

    let findings = result.findings
    if (args.new || args.since !== undefined) {
      if (input.offset) {
        throw new Error(
          '--offset cannot be combined with --new/--since: the delta read has to start at the first page.',
        )
      }
      // A filtered read must not move the shared cursor: the filter selects a
      // subset, so advancing on it would skip the findings the filter hid.
      const cursorName = findingsCursorName(input)
      const store = createCursorStore()
      // The page size the first page was fetched with — the walk must use
      // the same one, or "was the page full?" compares the wrong numbers.
      const pageLimit = input.limit ?? 100

      const window = await walkFindingsWindow(token, input, findings, pageLimit)
      findings = await applyFindingsDelta(window.findings, {
        cursorName,
        since: args.since,
        advance: !args['no-advance'],
        complete: window.complete,
        store,
      })
    }

    if (findings.length === 0) {
      console.log('No findings found.')
      return
    }
    console.log('')
    printTable(
      findings.map((f) => {
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

/** Print one dashboard value: a table, a list, an object, or a scalar. */
function printDashboardValue(key: string, value: unknown): void {
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
    console.log(`\n  ${key}:`)
    const cols = Object.keys(value[0] as Record<string, unknown>)
    printTable(
      value as Record<string, unknown>[],
      cols.slice(0, 8).map((c) => ({ key: c, label: c, width: 18 })),
    )
    return
  }
  if (Array.isArray(value)) {
    console.log(`  ${key}: ${value.join(', ')}`)
    return
  }
  if (typeof value === 'object' && value !== null) {
    console.log(`  ${key}:`)
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      console.log(`    ${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`)
    }
    return
  }
  console.log(`  ${key.padEnd(16)} ${value}`)
}

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
      printDashboardValue(key, value)
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
    'no-wait': {
      type: 'boolean',
      description: 'Queue the dismissal without waiting for the command to finish',
      default: false,
    },
  },
  async run({ args }) {
    if (args.reason && !(DISMISS_REASONS as readonly string[]).includes(args.reason)) {
      const allowed = DISMISS_REASONS.join(', ')
      throw new Error(`Invalid --reason "${args.reason}". Allowed: ${allowed}`)
    }
    const { token } = await getToken()
    const result = await dismissFinding(token, args.id, args.reason as DismissReason | undefined)
    if (!result.accepted) {
      console.error(`Dismissal of ${args.id} was not accepted by the server.`)
      process.exit(1)
    }
    if (args['no-wait'] || !result.commandId) {
      const suffix = result.commandId ? ` (command ${result.commandId})` : ''
      console.log(`Dismissal of ${args.id} queued${suffix}.`)
      return
    }
    console.log(`Dismissal of ${args.id} queued (command ${result.commandId}) — waiting…`)
    const command = await waitForCommand(token, result.commandId)
    const code = reportCommandOutcome(command, `Finding ${args.id}`)
    if (code !== 0) process.exit(code)
  },
})

export const securityFindingsAnalyzeCommand = defineCommand({
  meta: { name: 'analyze', description: 'Start security analysis for a finding' },
  args: { id: { type: 'positional', description: 'Finding ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const result = await startAnalysis(token, args.id)
    const command = result.commandId ? ` (command ${result.commandId})` : ''
    console.log(`Analysis queued${command}.`)
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
    console.log(`  Type:        ${cmd.type ?? cmd.commandType ?? '-'}`)
    console.log(`  Status:      ${cmd.status ?? '-'}`)
    if (cmd.resultCode) console.log(`  Result:      ${cmd.resultCode}`)
    console.log(
      `  Repository:  ${cmd.repoFullName ?? cmd.repositoryId ?? cmd.repository_id ?? '-'}`,
    )
    console.log(`  Started:     ${cmd.startedAt ?? cmd.started_at ?? '-'}`)
    if (cmd.completedAt ?? cmd.completed_at)
      console.log(`  Completed:   ${cmd.completedAt ?? cmd.completed_at}`)
    if (cmd.lastErrorRedacted) console.log(`  Error:       ${cmd.lastErrorRedacted}`)
    if (cmd.output) console.log(`  Output:      ${cmd.output}`)
    if (commandOutcome(cmd) === 'failed') process.exit(1)
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

/** The filters of the close command, as they go to the API. */
interface CloseFilters {
  repoFullName?: string
  severity?: string
  status?: string
  outcomeFilter?: string
  overdue?: boolean
  createdAfter?: string
  createdBefore?: string
}

/** The filters as a human-readable description. */
function describeFilters(filters: CloseFilters): string {
  return [
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
}

/** The dry run: what would be closed, without closing anything. */
async function printCloseDryRun(
  token: string,
  filters: CloseFilters,
  filterDesc: string,
): Promise<void> {
  const result = await listFindings(token, {
    repoFullName: filters.repoFullName,
    severity: filters.severity,
    status: filters.status,
    outcomeFilter: filters.outcomeFilter,
    overdue: filters.overdue,
    limit: 100,
  })
  // The same filter the dismissal uses — the preview must not show a
  // finding that would not be queued.
  const findings = result.findings.filter((f) => matchesDateFilters(f, filters))
  const total = result.totalCount ?? result.total_count ?? findings.length
  console.log(`Dry run — would close ${findings.length} findings (total matching: ${total})`)
  if (filterDesc) console.log(`  filters: ${filterDesc}`)
  if (findings.length === 0) return

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

/** Report what the first queued command did. */
function reportProbe(result: {
  probe?: string
  probeError?: string
  failureDetail?: string
}): void {
  if (result.probe === 'failed') {
    console.error(`\n  First queued command failed: ${result.failureDetail ?? 'unknown error'}`)
    console.error(
      '  The other queued commands are unverified — re-check with `security findings list`.',
    )
    return
  }
  if (result.probe === 'pending') {
    console.error('\n  First queued command is still in flight — outcome unverified.')
    return
  }
  if (result.probeError) {
    console.error(`\n  Could not check the first queued command: ${result.probeError}`)
    console.error('  Outcomes are unverified — re-check with `security findings list`.')
    return
  }
  if (result.probe === 'succeeded') {
    console.log('\n  First queued command completed; the rest may still be running.')
  }
}

/** Print the errors of a bulk dismissal. */
function printBulkErrors(errors: string[]): void {
  if (errors.length === 0) return
  console.log('\nErrors:')
  for (const e of errors.slice(0, 10)) console.log(`  ${e}`)
  if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more`)
}

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
    from: {
      type: 'string',
      description: 'Only findings created after this date (ISO, e.g. 2025-01-01)',
    },
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

    const filters: CloseFilters = {
      repoFullName: args.repo,
      severity: args.severity,
      status: args.status,
      outcomeFilter: args.outcome,
      overdue: args.overdue,
      createdAfter: args.from,
      createdBefore: args.to,
    }
    const filterDesc = describeFilters(filters)

    if (args['dry-run']) {
      await printCloseDryRun(token, filters, filterDesc)
      return
    }

    if (!args.yes) {
      const ok = await confirm(`Close all findings matching: ${filterDesc || '(no filters)'}`)
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
      { probeQueue: true },
    )
    printSummary([
      { label: 'Queued', value: result.queued },
      { label: 'Rejected', value: result.rejected },
      { label: 'Total matched', value: result.totalMatched },
      { label: 'Errors', value: result.errors.length },
    ])
    reportProbe(result)
    printBulkErrors(result.errors)
    if (result.rejected > 0 || result.errors.length > 0) process.exit(1)
    if (result.probe === 'pending') process.exit(EXIT_UNVERIFIED)
    if (result.probe === 'failed' || result.probeError) process.exit(1)
  },
})

export const securityFindingsDeleteCommand = defineCommand({
  meta: { name: 'delete', description: 'Delete findings for a repository (all or filtered)' },
  args: {
    repo: {
      type: 'positional',
      description: 'Repository ID or full name (e.g. user/repo)',
      required: false,
    },
    'repo-name': {
      type: 'string',
      description: 'Repository full name (alternative to positional)',
      alias: 'repo',
    },
    severity: { type: 'string', description: 'Filter by severity (critical/high/medium/low/info)' },
    status: {
      type: 'string',
      description: 'Filter by status (open/dismissed/remediated/in_progress)',
    },
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
