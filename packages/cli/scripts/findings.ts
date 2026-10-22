#!/usr/bin/env node
/**
 * Collect every finding the tools know about into ONE SARIF log, so the
 * policy gate can rank them together instead of each tool reporting on its
 * own.
 *
 *   node scripts/findings.ts collect [--out <file>]   merge the sources
 *   node scripts/findings.ts baseline [--file <file>]  refresh the ratchet
 *   node scripts/findings.ts backlog                  print the work queue
 *
 * Sources:
 *   oxlint       — the local lint (SARIF on stdout)
 *   SonarCloud   — the server-side analysis of the default branch
 *   CodeQL       — the code-scanning alerts, when a token can read them
 *
 * The ratchet baseline lists the findings that are already known. The policy
 * gate then fails on new findings only, and the report shows the whole
 * backlog — which is what makes the list a work queue rather than a wall.
 *
 * Two details of the default policy shape the mapping below:
 *
 *   - `high` fails even when the finding is in the baseline, so a backlog of
 *     high-severity findings could never be baselined. Every finding enters
 *     the gate as `medium` (`warning`) and is ratcheted instead. The tool's
 *     own severity travels in `properties`, so nothing is lost.
 *   - A finding without a line cannot be fingerprinted, so every result
 *     carries a region — a missing line becomes line 1.
 *
 * A scanner that cannot answer fails the collection: a gate that passes
 * without the findings of a tool is worse than a gate that stops. Only a
 * source that this machine cannot access at all is skipped — and the log
 * says which one and why.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// packages/cli/scripts/findings.ts → the repository root is three levels up.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PACKAGE_DIR = resolve(ROOT, 'packages/cli')
const BASELINE_FILE = 'config/findings-baseline.json'
const SONAR_KEY = 'ThePlenkov_kilo-ai-cli'
const SONAR_BRANCH = 'main'
const SONAR_API = 'https://sonarcloud.io/api/issues/search'
const GITHUB_API = 'https://api.github.com'
const REPOSITORY = 'ThePlenkov/kilo-ai-cli'

/** How long a scanner request may take — a scanner that hangs must not block the gate. */
const SCANNER_TIMEOUT_MS = 30_000
/** The page size of the SonarCloud issue search. */
const SONAR_PAGE_SIZE = 500
/** The page size of the code-scanning alert list. */
const CODEQL_PAGE_SIZE = 100

/**
 * The gate reads one severity class. `high` is reserved for the findings
 * that must block the push right now — a lint error, which is cheap to fix.
 * Everything else is ratcheted: known findings pass, new ones fail.
 */
const GATE_LEVEL = 'warning'

/** A lint error blocks immediately; the rest is ratcheted. */
const LINT_ERROR_LEVEL = 'error'

/** A response that did not come back with the expected status. */
class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/** Fetch JSON with a timeout — a scanner that stalls must not block the gate. */
async function fetchJson(url: URL, headers: Record<string, string> = {}): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(SCANNER_TIMEOUT_MS),
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`request failed: ${detail}`, { cause: err })
  }
  if (!response.ok) {
    throw new HttpError(response.status, `HTTP ${response.status} — ${url.origin}${url.pathname}`)
  }
  return await response.json()
}

/**
 * Run oxlint in the package and return its results with repo-relative paths.
 *
 * oxlint exits nonzero when it reports errors — and those errors are exactly
 * what must reach the gate. The SARIF is on stdout either way, so the failed
 * result is read instead of thrown.
 */
/** One finding, in the shape the SARIF log carries it. */
interface Finding {
  ruleId: string
  level: string
  message: { text: string }
  locations: {
    physicalLocation: {
      artifactLocation: { uri: string }
      region: { startLine: number }
    }
  }[]
  properties: Record<string, string>
}

/** The part of the SARIF log the collector reads. */
interface SarifResult {
  ruleId?: string
  level?: string
  message?: { text?: string }
  locations?: {
    physicalLocation?: {
      artifactLocation?: { uri?: string }
      region?: { startLine?: number }
    }
  }[]
}

function lintResults(): Finding[] {
  // The local binary, not npx: the version comes from the lockfile and
  // nothing is fetched on the fly.
  const oxlint = resolve(ROOT, 'node_modules/.bin/oxlint')
  let stdout: string
  try {
    stdout = execFileSync(oxlint, ['--format=sarif'], {
      cwd: PACKAGE_DIR,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    const output = (err as { stdout?: unknown }).stdout
    if (typeof output !== 'string' || output.length === 0) throw err
    stdout = output
  }
  const sarif = JSON.parse(stdout) as { runs?: { results?: SarifResult[] }[] }
  const results = (sarif.runs?.[0]?.results ?? []).map((result) => {
    const location = result.locations?.[0]
    const uri = location?.physicalLocation?.artifactLocation?.uri ?? ''
    const region = location?.physicalLocation?.region ?? {}
    return {
      ruleId: result.ruleId ?? 'oxlint:unknown',
      level: result.level === 'error' ? LINT_ERROR_LEVEL : GATE_LEVEL,
      message: { text: result.message?.text ?? 'finding' },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: `packages/cli/${uri}` },
            region: { startLine: region.startLine ?? 1 },
          },
        },
      ],
      properties: { 'lint:level': result.level ?? 'warning' },
    }
  })
  return results
}

/**
 * The open SonarCloud issues of the default branch — every page of them.
 *
 * The search is paged: a project with more issues than one page holds would
 * otherwise lose the rest of them, and the ratchet would treat the loss as
 * "never seen".
 */
async function sonarResults(): Promise<Finding[]> {
  const issues: Record<string, unknown>[] = []
  for (let page = 1; ; page++) {
    const url = new URL(SONAR_API)
    url.searchParams.set('componentKeys', SONAR_KEY)
    url.searchParams.set('branch', SONAR_BRANCH)
    url.searchParams.set('resolved', 'false')
    url.searchParams.set('ps', String(SONAR_PAGE_SIZE))
    url.searchParams.set('p', String(page))
    // eslint-disable-next-line no-await-in-loop -- the pages come one after another
    const body = (await fetchJson(url)) as { issues?: Record<string, unknown>[] }
    const batch = body.issues ?? []
    issues.push(...batch)
    if (batch.length < SONAR_PAGE_SIZE) break
  }

  const results = []
  let skipped = 0
  for (const issue of issues) {
    // The component is `project:path` — but an issue without one is skipped
    // rather than stringified into '[object Object]'.
    const component = issue.component
    const path = typeof component === 'string' ? component.split(':').slice(1).join(':') : ''
    if (!path) {
      skipped += 1
      continue
    }
    results.push({
      ruleId: (issue.rule as string) ?? 'sonar:unknown',
      level: GATE_LEVEL,
      message: { text: (issue.message as string) ?? (issue.rule as string) ?? 'finding' },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: path },
            region: { startLine: (issue.line as number) ?? 1 },
          },
        },
      ],
      properties: {
        'sonar:severity': (issue.severity as string) ?? 'unknown',
        'sonar:type': (issue.type as string) ?? 'unknown',
        'sonar:effort': (issue.effort as string) ?? 'unknown',
      },
    })
  }
  if (skipped > 0) {
    console.error(`sonar: ${skipped} issues without a component — skipped`)
  }
  return results
}

/**
 * The open code-scanning alerts — every page of them.
 *
 * The API needs a token with the security-events scope. Without one the
 * source is skipped: that is a fact about the machine, not a failure of the
 * scan. A token that cannot read the alerts is skipped for the same reason;
 * every other failure fails the collection.
 */
async function codeqlResults(): Promise<Finding[]> {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (!token) {
    console.error('codeql: no GH_TOKEN/GITHUB_TOKEN — skipped')
    return []
  }

  const alerts: Record<string, unknown>[] = []
  for (let page = 1; ; page++) {
    const url = new URL(`${GITHUB_API}/repos/${REPOSITORY}/code-scanning/alerts`)
    url.searchParams.set('state', 'open')
    url.searchParams.set('per_page', String(CODEQL_PAGE_SIZE))
    url.searchParams.set('page', String(page))
    let body: unknown
    try {
      // eslint-disable-next-line no-await-in-loop -- the pages come one after another
      body = await fetchJson(url, {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      })
    } catch (err) {
      if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
        console.error('codeql: the token cannot read the code-scanning alerts — skipped')
        return []
      }
      throw err
    }
    const batch = Array.isArray(body) ? (body as Record<string, unknown>[]) : []
    alerts.push(...batch)
    if (batch.length < CODEQL_PAGE_SIZE) break
  }

  return alerts.map((alert) => {
    const instance = alert.most_recent_instance as
      | { location?: { path?: string; start_line?: number } }
      | undefined
    const location = instance?.location
    return {
      ruleId: (alert.rule as { id?: string })?.id ?? 'codeql:unknown',
      level: GATE_LEVEL,
      message: {
        text:
          (alert.rule as { description?: string })?.description ??
          (alert.rule as { id?: string })?.id ??
          'finding',
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: location?.path ?? 'unknown' },
            region: { startLine: location?.start_line ?? 1 },
          },
        },
      ],
      properties: {
        'codeql:severity':
          (alert.rule as { security_severity_level?: string })?.security_severity_level ??
          'unknown',
      },
    }
  })
}

/** Merge every source into one SARIF log. */
async function collect(): Promise<Record<string, unknown>> {
  const runs = []
  const lint = lintResults()
  runs.push({
    tool: { driver: { name: 'oxlint', informationUri: 'https://oxc.rs' } },
    results: lint,
  })
  console.error(`oxlint: ${lint.length} findings`)

  const sonar = await sonarResults()
  runs.push({
    tool: {
      driver: {
        name: 'SonarCloud',
        informationUri: `https://sonarcloud.io/dashboard?id=${SONAR_KEY}`,
      },
    },
    results: sonar,
  })
  console.error(`sonar: ${sonar.length} findings (${SONAR_BRANCH})`)

  const codeql = await codeqlResults()
  if (codeql.length > 0) {
    runs.push({
      tool: { driver: { name: 'CodeQL', informationUri: 'https://codeql.github.com' } },
      results: codeql,
    })
    console.error(`codeql: ${codeql.length} findings`)
  }

  return {
    version: '2.1.0',
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs,
  }
}

/**
 * The findings of a SARIF log, normalized the way the policy gate
 * normalizes them — the same context, so the fingerprints match.
 */
async function normalize(sarif: Record<string, unknown>) {
  const { normalizeSarif } = await import('@sverka/verification')
  return normalizeSarif(sarif as never, {
    root: ROOT,
    checkIdPrefix: '',
    defaultConfidence: 0.5,
  })
}

/**
 * Refresh the ratchet: the known findings become the baseline.
 *
 * An existing baseline is never replaced by accident — a baseline that
 * cannot be read fails the command, because losing it would turn every
 * known finding into a new one.
 */
async function refreshBaseline(target: string): Promise<void> {
  const { createBaseline, loadBaseline, saveBaseline, updateBaseline } = await import(
    '@sverka/verification'
  )
  const findings = await normalize(await collect())
  const path = resolve(ROOT, target)
  let baseline
  if (existsSync(path)) {
    baseline = updateBaseline(findings, await loadBaseline(path))
  } else {
    baseline = createBaseline(findings)
  }
  mkdirSync(dirname(path), { recursive: true })
  await saveBaseline(baseline, path)
  console.error(
    `baseline: ${baseline.fingerprints.length} known findings (${findings.length} current)`,
  )
}

/** The work queue: every finding, the new ones first. */
async function backlog(): Promise<void> {
  const { loadBaseline } = await import('@sverka/verification')
  const findings = await normalize(await collect())
  let known = new Set<string>()
  try {
    known = new Set((await loadBaseline(resolve(ROOT, BASELINE_FILE))).fingerprints)
  } catch {
    console.error('backlog: no baseline yet — every finding counts as new')
  }
  const rows = findings.map((finding) => ({
    state: known.has(finding.fingerprint) ? 'known' : 'new',
    rule: finding.rule,
    at: `${finding.file}:${finding.startLine}`,
    message: finding.message.slice(0, 80),
  }))
  const newCount = rows.filter((row) => row.state === 'new').length
  console.log(`# Findings — ${findings.length} total, ${newCount} new\n`)
  // The new findings first — they are the queue, the known ones the backlog.
  for (const row of rows.toSorted((a, b) => b.state.localeCompare(a.state))) {
    console.log(`- [${row.state}] ${row.rule} ${row.at} — ${row.message}`)
  }
}

const [command = 'collect', ...rest] = process.argv.slice(2)

function flag(name: string, fallback?: string): string | undefined {
  const index = rest.indexOf(name)
  return index >= 0 && rest[index + 1] ? rest[index + 1] : fallback
}

if (command === 'collect') {
  const sarif = await collect()
  const text = `${JSON.stringify(sarif, null, 2)}\n`
  const out = flag('--out')
  if (out) {
    const path = resolve(ROOT, out)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
    console.error(`findings: written to ${path}`)
  } else {
    process.stdout.write(text)
  }
} else if (command === 'baseline') {
  await refreshBaseline(flag('--file', BASELINE_FILE) ?? BASELINE_FILE)
} else if (command === 'backlog') {
  await backlog()
} else {
  console.error('usage: findings.ts collect [--out <file>] | baseline [--file <file>] | backlog')
  process.exit(2)
}
