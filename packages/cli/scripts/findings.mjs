#!/usr/bin/env node
/**
 * Collect every finding the tools know about into ONE SARIF log, so the
 * policy gate can rank them together instead of each tool reporting on its
 * own.
 *
 *   node scripts/findings.mjs collect [--out <file>]   merge the sources
 *   node scripts/findings.mjs baseline [--file <file>]  refresh the ratchet
 *   node scripts/findings.mjs backlog                  print the work queue
 *
 * Sources:
 *   oxlint       — the local lint (SARIF on stdout)
 *   SonarCloud   — the server-side analysis of the default branch
 *   CodeQL       — the code-scanning alerts, when the token can read them
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
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// packages/cli/scripts/findings.mjs → the repository root is three levels up.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PACKAGE_DIR = resolve(ROOT, 'packages/cli')
const BASELINE_FILE = 'config/findings-baseline.json'
const SONAR_KEY = 'ThePlenkov_kilo-ai-cli'
const SONAR_BRANCH = 'main'
const SONAR_API = 'https://sonarcloud.io/api/issues/search'

/**
 * The gate reads one severity class. `high` is reserved for the findings
 * that must block the push right now — a lint error, which is cheap to fix.
 * Everything else is ratcheted: known findings pass, new ones fail.
 */
const GATE_LEVEL = 'warning'

/** A lint error blocks immediately; the rest is ratcheted. */
const LINT_ERROR_LEVEL = 'error'

/** Run oxlint in the package and return its results with repo-relative paths. */
function lintResults() {
  // The local binary, not npx: the version comes from the lockfile and
  // nothing is fetched on the fly.
  const stdout = execFileSync(resolve(ROOT, 'node_modules/.bin/oxlint'), ['--format=sarif'], {
    cwd: PACKAGE_DIR,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const sarif = JSON.parse(stdout)
  const results = (sarif.runs?.[0]?.results ?? []).map((result) => {
    const location = result.locations?.[0]
    const uri = location?.physicalLocation?.artifactLocation?.uri ?? ''
    const region = location?.physicalLocation?.region ?? {}
    return {
      ruleId: result.ruleId,
      level: result.level === 'error' ? LINT_ERROR_LEVEL : GATE_LEVEL,
      message: result.message,
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

/** The open SonarCloud issues of the default branch. */
async function sonarResults() {
  const url = new URL(SONAR_API)
  url.searchParams.set('componentKeys', SONAR_KEY)
  url.searchParams.set('branch', SONAR_BRANCH)
  url.searchParams.set('resolved', 'false')
  url.searchParams.set('ps', '500')
  const response = await fetch(url)
  if (!response.ok) {
    console.error(`sonar: HTTP ${response.status} — skipped`)
    return []
  }
  const body = await response.json()
  const results = []
  let skipped = 0
  for (const issue of body.issues ?? []) {
    const path = (issue.component ?? '').split(':').slice(1).join(':')
    if (!path) {
      skipped += 1
      continue
    }
    results.push({
      ruleId: issue.rule ?? 'sonar:unknown',
      level: GATE_LEVEL,
      message: { text: issue.message ?? issue.rule ?? 'finding' },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: path },
            region: { startLine: issue.line ?? 1 },
          },
        },
      ],
      properties: {
        'sonar:severity': issue.severity,
        'sonar:type': issue.type,
        'sonar:effort': issue.effort,
      },
    })
  }
  if (skipped > 0) {
    console.error(`sonar: ${skipped} issues without a component — skipped`)
  }
  return results
}

/** The open CodeQL alerts, when the token can read them. */
function codeqlResults() {
  try {
    const stdout = execFileSync(
      'gh',
      ['api', `repos/ThePlenkov/${'kilo-ai-cli'}/code-scanning/alerts?state=open&per_page=100`],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const alerts = JSON.parse(stdout)
    return alerts.map((alert) => ({
      ruleId: alert.rule?.id ?? 'codeql:unknown',
      level: GATE_LEVEL,
      message: { text: alert.rule?.description ?? alert.rule?.id ?? 'finding' },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: alert.most_recent_instance?.location?.path ?? 'unknown',
            },
            region: {
              startLine: alert.most_recent_instance?.location?.startLine ?? 1,
            },
          },
        },
      ],
      properties: {
        'codeql:severity': alert.rule?.security_severity_level ?? 'unknown',
      },
    }))
  } catch {
    console.error('codeql: no access to the code-scanning alerts — skipped')
    return []
  }
}

/** Merge every source into one SARIF log. */
async function collect() {
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
  console.error(`sonar: ${sonar.length} findings`)

  const codeql = codeqlResults()
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
async function normalize(sarif) {
  const { normalizeSarif } = await import('@sverka/verification')
  return normalizeSarif(sarif, {
    root: ROOT,
    checkIdPrefix: '',
    defaultConfidence: 0.5,
  })
}

/** Refresh the ratchet: the known findings become the baseline. */
async function refreshBaseline(target) {
  const { createBaseline, loadBaseline, saveBaseline, updateBaseline } = await import(
    '@sverka/verification'
  )
  const findings = await normalize(await collect())
  const path = resolve(ROOT, target)
  let baseline
  try {
    baseline = updateBaseline(findings, await loadBaseline(path))
  } catch {
    baseline = createBaseline(findings)
  }
  mkdirSync(dirname(path), { recursive: true })
  await saveBaseline(baseline, path)
  console.error(
    `baseline: ${baseline.fingerprints.length} known findings (${findings.length} current)`,
  )
}

/** The work queue: every finding, the known ones marked. */
async function backlog() {
  const { loadBaseline } = await import('@sverka/verification')
  const findings = await normalize(await collect())
  let known = new Set()
  try {
    known = new Set((await loadBaseline(resolve(ROOT, BASELINE_FILE))).fingerprints)
  } catch {
    console.error('backlog: no baseline yet — every finding counts as new')
  }
  const rows = findings.map((finding) => ({
    state: known.has(finding.fingerprint) ? 'known' : 'new',
    severity: finding.severity,
    rule: finding.rule,
    at: `${finding.file}:${finding.startLine}`,
    message: finding.message.slice(0, 80),
  }))
  const newCount = rows.filter((row) => row.state === 'new').length
  console.log(`# Findings — ${findings.length} total, ${newCount} new\n`)
  for (const row of rows.toSorted((a, b) => a.state.localeCompare(b.state))) {
    console.log(`- [${row.state}] ${row.rule} ${row.at} — ${row.message}`)
  }
}

const [command = 'collect', ...rest] = process.argv.slice(2)

function flag(name, fallback) {
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
  await refreshBaseline(flag('--file', BASELINE_FILE))
} else if (command === 'backlog') {
  await backlog()
} else {
  console.error('usage: findings.mjs collect [--out <file>] | baseline [--file <file>] | backlog')
  process.exit(2)
}
