#!/usr/bin/env node
/**
 * Live smoke runner — executes every CLI command against the real api.kilo.ai
 * using the stored device-auth token, and writes a result matrix.
 *
 * Usage:
 *   node scripts/live-smoke.ts [--include-manual] [--out LIVE-MATRIX.md]
 *
 * Command classes:
 *   read        — pure queries, always run
 *   idempotent  — mutations that restore state (e.g. rename → rename back)
 *   manual      — real side effects, listed but not executed (unless --include-manual)
 *   never       — interactive or destructive, never executed by the runner
 */

import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createTokenStore } from '../src/auth/token-store.ts'
import { fetchCloudSessions, fetchCloudSession, fetchCodingPlanSubscriptions, renameCloudSession } from '../src/api/trpc.ts'
import { listFindings, listActiveCommands, getSecurityRepositories } from '../src/api/security-agent.ts'
import { listOrganizations } from '../src/api/organizations.ts'
import { listPersonalSubscriptions } from '../src/api/kiloclaw.ts'
import { listCodeReviewsForUser } from '../src/api/code-reviews.ts'
import { listAppBuilderProjects } from '../src/api/app-builder.ts'

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(PKG, 'dist/index.mjs')
const OUT_DEFAULT = resolve(PKG, '../../LIVE-MATRIX.md')
const TIMEOUT_MS = 30_000

type Cls = 'read' | 'idempotent' | 'manual' | 'never'
type Status = 'PASS' | 'FAIL' | 'SKIP' | 'MANUAL'

interface Cmd {
  cmd: string
  cls: Cls
  /** Resolve extra argv; return null to mark SKIP with the returned reason via `skipReason`. */
  args?: (ctx: Ctx) => Promise<string[] | null>
  /** Runs after the command — used by idempotent mutations to restore state. */
  post?: (ctx: Ctx) => Promise<void>
  /** If the failure output matches, the command is reported SKIP (account-state limitation), not FAIL. */
  expectError?: RegExp
  skipReason?: string
  note?: string
}

interface Ctx {
  token: string
  organizationId?: string
}

const INCLUDE_MANUAL = process.argv.includes('--include-manual')
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx > 0 ? process.argv[outIdx + 1]! : OUT_DEFAULT

// ---------------------------------------------------------------------------
// Arg resolvers — pull real IDs from the live API
// ---------------------------------------------------------------------------

async function firstSessionId(ctx: Ctx): Promise<string[] | null> {
  const r = await fetchCloudSessions(ctx.token, { limit: 1 }, ctx.organizationId)
  const id = r.cliSessions[0]?.session_id
  return id ? [id] : null
}

async function firstPlanId(ctx: Ctx): Promise<string[] | null> {
  const subs = await fetchCodingPlanSubscriptions(ctx.token, ctx.organizationId)
  // Prefer a usage-eligible subscription — the first one may be ineligible.
  const usable = subs.find((s) => s.canQueryUsage) ?? subs[0]
  return usable ? [usable.id] : null
}

async function firstOrgId(_ctx: Ctx): Promise<string[] | null> {
  const orgs = await listOrganizations(_ctx.token)
  return orgs[0] ? [orgs[0].id] : null
}

async function firstFindingId(ctx: Ctx): Promise<string[] | null> {
  const r = await listFindings(ctx.token, { limit: 1 })
  return r.findings[0]?.id ? [r.findings[0].id] : null
}

async function firstCommandId(ctx: Ctx): Promise<string[] | null> {
  const cmds = await listActiveCommands(ctx.token)
  return cmds[0]?.id ? [cmds[0].id] : null
}

async function firstSecurityRepoId(ctx: Ctx): Promise<string[] | null> {
  const repos = await getSecurityRepositories(ctx.token)
  const id = repos[0]?.id
  return id != null ? [String(id)] : null
}

async function firstReviewId(ctx: Ctx): Promise<string[] | null> {
  const reviews = await listCodeReviewsForUser(ctx.token)
  return reviews[0] ? [reviews[0].id] : null
}

async function firstKiloclawSubId(ctx: Ctx): Promise<string[] | null> {
  const { subscriptions } = await listPersonalSubscriptions(ctx.token)
  return subscriptions[0] ? [subscriptions[0].instanceId] : null
}

async function firstProjectId(ctx: Ctx): Promise<string[] | null> {
  const projects = await listAppBuilderProjects(ctx.token)
  return projects[0] ? [projects[0].id] : null
}

const dates = [
  '--from',
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  '--to',
  new Date().toISOString().slice(0, 10),
]

/** Stashed session id + original title for the idempotent rename test. */
let renameTarget: { id: string; title: string } | null = null

// ---------------------------------------------------------------------------
// Command inventory — mirrors src/cli.ts
// ---------------------------------------------------------------------------

const COMMANDS: Cmd[] = [
  { cmd: 'auth status', cls: 'read' },
  { cmd: 'auth login', cls: 'never', note: 'interactive device flow' },
  { cmd: 'auth logout', cls: 'never', note: 'clears credentials' },

  { cmd: 'profile', cls: 'read' },
  { cmd: 'balance', cls: 'read' },

  { cmd: 'sessions list', cls: 'read' },
  { cmd: 'sessions get', cls: 'read', args: firstSessionId, skipReason: 'no sessions' },
  {
    cmd: 'sessions rename',
    cls: 'idempotent',
    args: async (ctx) => {
      const ids = await firstSessionId(ctx)
      if (!ids) return null
      const title = (await fetchCloudSession(ctx.token, ids[0]!, ctx.organizationId)).title
      // Untitled sessions can't be restored via rename (title is required) — skip.
      renameTarget = title == null ? null : { id: ids[0]!, title }
      return renameTarget ? [renameTarget.id, `smoke-rename-${Date.now()}`] : null
    },
    post: async (ctx) => {
      // Restore by the captured id — list order may shift after rename.
      if (renameTarget) await renameCloudSession(ctx.token, renameTarget.id, renameTarget.title, ctx.organizationId)
    },
    skipReason: 'no sessions with a title',
    note: 'renames to a temp title, then restores the original',
  },

  { cmd: 'org list', cls: 'read' },
  { cmd: 'org set', cls: 'manual', args: firstOrgId, skipReason: 'no orgs on account', note: 'rewrites credentials.json accountId' },
  { cmd: 'org members', cls: 'read', args: firstOrgId, skipReason: 'no orgs on account' },
  { cmd: 'org usage', cls: 'read', args: firstOrgId, skipReason: 'no orgs on account' },
  { cmd: 'org credits', cls: 'read', args: firstOrgId, skipReason: 'no orgs on account' },
  { cmd: 'org seats', cls: 'read', args: firstOrgId, skipReason: 'no orgs on account' },
  { cmd: 'org invoices', cls: 'read', args: firstOrgId, skipReason: 'no orgs on account' },
  { cmd: 'org models', cls: 'read', args: firstOrgId, skipReason: 'no orgs on account' },
  { cmd: 'org security', cls: 'read', args: firstOrgId, skipReason: 'no orgs on account' },
  { cmd: 'org create', cls: 'manual', args: async () => ['live-smoke-org'], note: 'creates a real org on the account' },
  {
    cmd: 'org update',
    cls: 'manual',
    args: async (c) => {
      const org = await firstOrgId(c)
      return org ? [...org, '--name', 'live-smoke-renamed'] : null
    },
    skipReason: 'no orgs on account',
    note: 'renames an org',
  },

  { cmd: 'plans list', cls: 'read' },
  {
    cmd: 'plans usage',
    cls: 'read',
    args: firstPlanId,
    skipReason: 'no subscriptions',
    expectError: /not eligible for usage/i,
  },

  { cmd: 'byok list', cls: 'read' },

  { cmd: 'kiloclaw instances', cls: 'read' },
  { cmd: 'kiloclaw billing', cls: 'read' },
  { cmd: 'kiloclaw billing-history', cls: 'read', args: firstKiloclawSubId, skipReason: 'no kiloclaw subs' },
  { cmd: 'kiloclaw subscriptions', cls: 'read' },
  { cmd: 'kiloclaw subscription', cls: 'read', args: firstKiloclawSubId, skipReason: 'no kiloclaw subs' },
  { cmd: 'kiloclaw changelog', cls: 'read' },
  { cmd: 'kiloclaw version', cls: 'read' },
  { cmd: 'kiloclaw file-tree', cls: 'read', expectError: /requires an active subscription/i },
  { cmd: 'kiloclaw run-start', cls: 'manual', args: async () => ['live smoke test prompt'], note: 'spins up a paid run' },
  { cmd: 'kiloclaw run-status', cls: 'never', note: 'no run id fixture — needs run-start first' },
  { cmd: 'kiloclaw run-cancel', cls: 'never', note: 'needs a live run id' },
  { cmd: 'kiloclaw unpin', cls: 'manual', note: 'removes version pin' },

  { cmd: 'cloud-agent session', cls: 'never', note: 'no cloud-agent session id fixture' },
  { cmd: 'cloud-agent github-repos', cls: 'read' },
  { cmd: 'cloud-agent gitlab-repos', cls: 'read' },

  { cmd: 'reviews list', cls: 'read' },
  {
    cmd: 'reviews list --org',
    cls: 'read',
    args: firstOrgId,
    skipReason: 'no orgs on account',
    note: 'org-scoped variant',
  },
  { cmd: 'reviews get', cls: 'read', args: firstReviewId, skipReason: 'no personal reviews' },
  {
    cmd: 'reviews config',
    cls: 'read',
    args: async (c) => {
      const org = await firstOrgId(c)
      return org ? [...org, 'github'] : null
    },
    skipReason: 'no orgs on account',
  },
  {
    cmd: 'reviews toggle',
    cls: 'manual',
    args: async (c) => {
      const org = await firstOrgId(c)
      return org ? [...org, 'github', 'false'] : null
    },
    skipReason: 'no orgs on account',
    note: 'enables/disables review agent',
  },

  { cmd: 'analytics summary', cls: 'read' },
  { cmd: 'analytics summary', cls: 'read', args: async () => dates, note: 'with date range' },
  { cmd: 'analytics timeseries', cls: 'read', args: async () => dates },
  { cmd: 'analytics breakdown', cls: 'read', args: async () => dates },
  { cmd: 'analytics table', cls: 'read', args: async () => dates },

  { cmd: 'app-builder list', cls: 'read' },
  { cmd: 'app-builder eligibility', cls: 'read' },
  { cmd: 'app-builder deploy', cls: 'manual', args: firstProjectId, skipReason: 'no app-builder projects', note: 'deploys a project' },

  { cmd: 'security status', cls: 'read' },
  { cmd: 'security config', cls: 'read' },
  { cmd: 'security repos', cls: 'read' },
  { cmd: 'security findings', cls: 'read' },
  { cmd: 'security finding', cls: 'read', args: firstFindingId, skipReason: 'no findings' },
  { cmd: 'security stats', cls: 'read' },
  { cmd: 'security dashboard', cls: 'read' },
  { cmd: 'security commands', cls: 'read' },
  { cmd: 'security command', cls: 'read', args: firstCommandId, skipReason: 'no active commands' },
  { cmd: 'security orphaned-repos', cls: 'read' },
  { cmd: 'security last-sync', cls: 'read' },
  { cmd: 'security sync', cls: 'manual', note: 'triggers GitHub sync' },
  { cmd: 'security analyze', cls: 'manual', args: firstSecurityRepoId, skipReason: 'no security repos', note: 'starts a paid analysis' },
  { cmd: 'security dismiss', cls: 'manual', args: firstFindingId, skipReason: 'no findings', note: 'dismisses a finding' },
  { cmd: 'security remediate', cls: 'manual', args: firstFindingId, skipReason: 'no findings', note: 'may open real PRs' },
  { cmd: 'security retry-remediation', cls: 'manual', args: firstCommandId, skipReason: 'no active commands' },
  { cmd: 'security cancel-remediation', cls: 'manual', args: firstCommandId, skipReason: 'no active commands' },
  { cmd: 'security enable', cls: 'manual' },
  { cmd: 'security disable', cls: 'manual' },
  { cmd: 'security delete-findings', cls: 'never', note: 'destructive' },

  { cmd: 'tui', cls: 'never', note: 'interactive' },
]

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

// Intentionally strips ANSI escapes from child output (built via char codes so
// no control-character literals appear in a regex — Sonar S6324).
const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
const ANSI = new RegExp(`${ESC}\\[[0-9;]*[a-zA-Z]|${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`, 'g')

// PATH-resolved binaries trip Sonar S4036 — always spawn the current node binary.
const NODE = process.execPath
// Resolve tsdown's bin wherever the package manager placed it (hoisted or nested).
const TSDOWN = join(dirname(createRequire(import.meta.url).resolve('tsdown/package.json')), 'dist/run.mjs')

function run(cmd: string, extra: string[]): { code: number; output: string } {
  const argv = cmd.split(' ').concat(extra)
  const r = spawnSync(NODE, [DIST, ...argv], {
    timeout: TIMEOUT_MS,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.replace(ANSI, '')
  return { code: r.status ?? 1, output }
}

interface Row {
  cmd: string
  cls: Cls
  status: Status
  detail: string
}

async function main() {
  // dist/index.mjs is the executable under test — build it if missing (fresh checkout).
  if (!existsSync(DIST)) {
    console.log('dist/index.mjs not found — building first…')
    const b = spawnSync(NODE, [TSDOWN], { cwd: PKG, stdio: 'inherit' })
    if (b.status !== 0 || !existsSync(DIST)) {
      console.error('Build failed — run `npm run build` in packages/cli first.')
      process.exit(1)
    }
  }

  const store = createTokenStore()
  const auth = await store.get()
  if (!auth) {
    console.error('Not authenticated — run `kilo-ai-cli auth login` first.')
    process.exit(1)
  }
  const ctx: Ctx = {
    token: auth.type === 'oauth' ? auth.access : auth.type === 'api' ? auth.key : auth.token,
    organizationId: auth.type === 'oauth' ? auth.accountId : undefined,
  }

  const rows: Row[] = []
  for (const c of COMMANDS) {
    if (c.cls === 'never') {
      rows.push({ cmd: c.cmd, cls: c.cls, status: 'MANUAL', detail: c.note ?? 'not run' })
      continue
    }
    if (c.cls === 'manual' && !INCLUDE_MANUAL) {
      rows.push({ cmd: c.cmd, cls: c.cls, status: 'MANUAL', detail: c.note ?? 'side-effecting' })
      continue
    }

    let extra: string[] = []
    if (c.args) {
      try {
        const resolved = await c.args(ctx)
        if (!resolved) {
          rows.push({ cmd: c.cmd, cls: c.cls, status: 'SKIP', detail: c.skipReason ?? 'no fixture' })
          continue
        }
        extra = resolved
      } catch (e) {
        rows.push({ cmd: c.cmd, cls: c.cls, status: 'SKIP', detail: `resolver failed: ${msg(e)}` })
        continue
      }
    }

    const { code, output } = run(c.cmd, extra)
    if (c.post) {
      try {
        await c.post(ctx)
      } catch (e) {
        console.log(`  ⚠ post-restore failed for ${c.cmd}: ${msg(e)}`)
      }
    }
    const errLine = output
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /ERROR|Error:|error/i.test(l) && l.length > 3)
    const ok = code === 0 && !/\bERROR\b/.test(output)
    const expected = !ok && c.expectError && c.expectError.test(output)
    rows.push({
      cmd: c.cmd + (extra.length ? ` ${extra.map(maskArg).join(' ')}` : ''),
      cls: c.cls,
      status: ok ? 'PASS' : expected ? 'SKIP' : 'FAIL',
      detail: ok
        ? (c.note ?? '')
        : expected
          ? `expected failure: ${truncate(errLine ?? 'matched expectError', 160)}`
          : truncate(errLine ?? `exit ${code}`, 160),
    })
    const label = ok ? 'PASS' : expected ? 'SKIP' : 'FAIL'
    console.log(`${ok ? '✓' : expected ? '-' : '✗'} ${label} ${c.cmd}${extra.length ? ' ' + extra.map(maskArg).join(' ') : ''}`)
  }

  // Markdown matrix
  const lines = [
    '# Live API smoke matrix',
    '',
    `Generated: ${new Date().toISOString()} — \`node packages/cli/scripts/live-smoke.ts\``,
    '',
    '| Command | Class | Status | Detail |',
    '|---|---|---|---|',
    ...rows.map((r) => `| \`${r.cmd}\` | ${r.cls} | ${r.status} | ${escapeMdCell(r.detail)} |`),
    '',
    summary(rows),
  ]
  writeFileSync(OUT, lines.join('\n') + '\n')
  console.log(`\n${summary(rows)}`)
  console.log(`Matrix written to ${OUT}`)
  if (rows.some((r) => r.status === 'FAIL')) process.exitCode = 1
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Redact resolved resource IDs (UUIDs, `xxx_<token>` style) so account identifiers don't land in the matrix/log. */
function maskArg(s: string): string {
  return /^[0-9a-f]{8}-[0-9a-f-]{9,}/i.test(s) || /^[a-z]{2,5}_[A-Za-z0-9]{10,}$/.test(s) ? '<id>' : s
}

/** Escape a value for embedding in a Markdown table cell (backslashes first). */
function escapeMdCell(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function summary(rows: Row[]): string {
  const c = { PASS: 0, FAIL: 0, SKIP: 0, MANUAL: 0 }
  for (const r of rows) c[r.status]++
  return `**${c.PASS} PASS · ${c.FAIL} FAIL · ${c.SKIP} SKIP · ${c.MANUAL} MANUAL**`
}

await main()
