#!/usr/bin/env node
/**
 * Demo API stub — local passthrough proxy used ONLY to record docs/demo.gif.
 *
 * Forwards every request to https://api.kilo.ai unchanged, except the
 * security-agent procedures below which are served from fixtures so the
 * TUI demo shows a populated findings table, working filters, sorting,
 * pagination, and dashboard cards without touching real data.
 *
 * Mutating security procedures (dismiss/delete/sync/analyze/remediate)
 * are stubbed as no-ops — the demo can never mutate the real account.
 *
 * Usage:
 *   node packages/cli/scripts/demo-api-stub.ts &            # listens on :8399
 *   KILO_API_URL=http://localhost:8399 npx kilo-ai-cli tui
 */

import { createServer } from 'node:http'
import { request as httpsReq } from 'node:https'

const UPSTREAM = 'https://api.kilo.ai'
const PORT = 8399

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

interface FixtureFinding {
  id: string
  repoFullName: string
  severity: string
  title: string
  status: string
  packageName: string
  packageEcosystem: string
  vulnerableVersionRange: string
  patchedVersion: string
  cveId?: string
  ghsaId?: string
  cvssScore?: number
  manifestPath: string
  createdAt: string
  slaDueAt?: string
  description: string
}

const REPO_A = 'ThePlenkov/kilo-ai-cli'
const REPO_B = 'ThePlenkov/nx.ts'
const REPO_C = 'ThePlenkov/markdown-confluence'

const FINDINGS: FixtureFinding[] = [
  {
    id: 'fnd_01lodash',
    repoFullName: REPO_A,
    severity: 'critical',
    title: 'Command injection in lodash template',
    status: 'open',
    packageName: 'lodash',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '< 4.17.21',
    patchedVersion: '4.17.21',
    cveId: 'CVE-2021-23337',
    ghsaId: 'GHSA-35jh-r3h4-6jhm',
    cvssScore: 9.8,
    manifestPath: 'packages/cli/package-lock.json',
    createdAt: '2026-09-10T08:12:44Z',
    slaDueAt: '2026-09-24T08:12:44Z',
    description:
      'lodash versions prior to 4.17.21 are vulnerable to command injection via the template function.',
  },
  {
    id: 'fnd_02axios',
    repoFullName: REPO_A,
    severity: 'high',
    title: 'SSRF in axios via absolute URL in baseURL',
    status: 'open',
    packageName: 'axios',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '>= 1.0.0 < 1.7.4',
    patchedVersion: '1.7.4',
    cveId: 'CVE-2024-39338',
    ghsaId: 'GHSA-8hc4-vh64-cxmj',
    cvssScore: 7.5,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-11T14:02:10Z',
    slaDueAt: '2026-10-11T14:02:10Z',
    description:
      'axios allows absolute URLs to bypass baseURL restrictions, enabling server-side request forgery.',
  },
  {
    id: 'fnd_03braces',
    repoFullName: REPO_A,
    severity: 'high',
    title: 'Uncontrolled resource consumption in braces',
    status: 'open',
    packageName: 'braces',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '< 3.0.3',
    patchedVersion: '3.0.3',
    cveId: 'CVE-2024-4068',
    ghsaId: 'GHSA-grv7-fg5c-xmjg',
    cvssScore: 7.5,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-11T14:02:10Z',
    description: 'braces fails to limit the number of characters it can handle, leading to memory exhaustion.',
  },
  {
    id: 'fnd_04ws',
    repoFullName: REPO_A,
    severity: 'high',
    title: 'DoS in ws when handling many headers',
    status: 'in_progress',
    packageName: 'ws',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '>= 8.0.0 < 8.17.1',
    patchedVersion: '8.17.1',
    cveId: 'CVE-2024-37890',
    ghsaId: 'GHSA-3h5v-q93c-6h6q',
    cvssScore: 7.5,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-12T09:44:01Z',
    description: 'ws does not limit the number of headers in a request, allowing CPU exhaustion.',
  },
  {
    id: 'fnd_05crossspawn',
    repoFullName: REPO_A,
    severity: 'high',
    title: 'ReDoS in cross-spawn',
    status: 'open',
    packageName: 'cross-spawn',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '>= 7.0.0 < 7.0.5',
    patchedVersion: '7.0.5',
    cveId: 'CVE-2024-21538',
    ghsaId: 'GHSA-3xgq-45jj-v275',
    cvssScore: 7.7,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-12T09:44:01Z',
    slaDueAt: '2026-10-02T09:44:01Z',
    description: 'cross-spawn is vulnerable to regular expression denial of service.',
  },
  {
    id: 'fnd_06express',
    repoFullName: REPO_A,
    severity: 'medium',
    title: 'Open redirect in express res.location()',
    status: 'open',
    packageName: 'express',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '< 4.19.2',
    patchedVersion: '4.19.2',
    cveId: 'CVE-2024-29041',
    ghsaId: 'GHSA-rv95-896h-c2vc',
    cvssScore: 6.1,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-13T11:20:33Z',
    description: 'express improperly handles URLs in res.location(), enabling open redirects.',
  },
  {
    id: 'fnd_07wordwrap',
    repoFullName: REPO_A,
    severity: 'medium',
    title: 'ReDoS in word-wrap',
    status: 'dismissed',
    packageName: 'word-wrap',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '< 1.2.4',
    patchedVersion: '1.2.4',
    cveId: 'CVE-2023-26115',
    ghsaId: 'GHSA-j8xg-fqg3-53r7',
    cvssScore: 5.3,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-13T11:20:33Z',
    description: 'word-wrap is vulnerable to regular expression denial of service.',
  },
  {
    id: 'fnd_08nanoid',
    repoFullName: REPO_A,
    severity: 'medium',
    title: 'Predictable results in nanoid non-secure API',
    status: 'open',
    packageName: 'nanoid',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '< 3.3.8',
    patchedVersion: '3.3.8',
    cveId: 'CVE-2024-55565',
    ghsaId: 'GHSA-mwcw-c2x4-8c55',
    cvssScore: 4.3,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-14T16:05:00Z',
    description: 'nanoid produces predictable output when given non-integer values.',
  },
  {
    id: 'fnd_09ip',
    repoFullName: REPO_B,
    severity: 'high',
    title: 'SSRF via improper IP categorization in ip',
    status: 'open',
    packageName: 'ip',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '<= 2.0.1',
    patchedVersion: '2.0.1',
    ghsaId: 'GHSA-78xj-cgh5-2h22',
    cvssScore: 8.1,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-09T07:30:15Z',
    slaDueAt: '2026-09-23T07:30:15Z',
    description: 'ip misclassifies certain octal IP addresses as public, enabling SSRF.',
  },
  {
    id: 'fnd_10json5',
    repoFullName: REPO_B,
    severity: 'high',
    title: 'Prototype pollution in JSON5.parse',
    status: 'open',
    packageName: 'json5',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '< 2.2.2',
    patchedVersion: '2.2.2',
    cveId: 'CVE-2022-46175',
    ghsaId: 'GHSA-9c47-m6qq-7p4h',
    cvssScore: 7.1,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-09T07:30:15Z',
    description: 'JSON5 allows prototype pollution via the __proto__ key in parsed objects.',
  },
  {
    id: 'fnd_11tar',
    repoFullName: REPO_B,
    severity: 'high',
    title: 'Race condition in tar node_modules extraction',
    status: 'open',
    packageName: 'tar',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '= 7.5.0',
    patchedVersion: '7.5.1',
    cveId: 'CVE-2024-28863',
    ghsaId: 'GHSA-f5x3-32g6-xq36',
    cvssScore: 6.5,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-10T18:55:41Z',
    description: 'tar can create a symlink outside the extraction dir via a race in node_modules handling.',
  },
  {
    id: 'fnd_12semver',
    repoFullName: REPO_B,
    severity: 'medium',
    title: 'ReDoS in semver range parsing',
    status: 'open',
    packageName: 'semver',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '>= 7.0.0 < 7.5.2',
    patchedVersion: '7.5.2',
    ghsaId: 'GHSA-c2qf-rxjj-qqgw',
    cvssScore: 5.3,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-10T18:55:41Z',
    description: 'semver is vulnerable to regular expression denial of service via crafted ranges.',
  },
  {
    id: 'fnd_13pathtoregexp',
    repoFullName: REPO_B,
    severity: 'medium',
    title: 'ReDoS in path-to-regexp',
    status: 'remediated',
    packageName: 'path-to-regexp',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '>= 0.2.0 < 0.1.10',
    patchedVersion: '0.1.10',
    cveId: 'CVE-2024-45296',
    ghsaId: 'GHSA-9wv6-86v2-598j',
    cvssScore: 7.5,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-08T12:10:02Z',
    description: 'path-to-regexp is vulnerable to regular expression denial of service.',
  },
  {
    id: 'fnd_14toughcookie',
    repoFullName: REPO_C,
    severity: 'medium',
    title: 'Prototype pollution in tough-cookie',
    status: 'open',
    packageName: 'tough-cookie',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '< 4.1.3',
    patchedVersion: '4.1.3',
    cveId: 'CVE-2023-26136',
    ghsaId: 'GHSA-72xf-g2v4-qvf3',
    cvssScore: 6.5,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-07T10:41:26Z',
    description: 'tough-cookie is vulnerable to prototype pollution via the CookieJar.',
  },
  {
    id: 'fnd_15undici',
    repoFullName: REPO_C,
    severity: 'medium',
    title: 'Proxy-authorization header leak in undici',
    status: 'open',
    packageName: 'undici',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '>= 6.0.0 < 6.11.0',
    patchedVersion: '6.11.0',
    cveId: 'CVE-2024-30260',
    ghsaId: 'GHSA-m4v8-wqvr-p9f7',
    cvssScore: 5.9,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-07T10:41:26Z',
    slaDueAt: '2026-10-07T10:41:26Z',
    description: 'undici may leak proxy-authorization headers on cross-origin redirects.',
  },
  {
    id: 'fnd_16follow',
    repoFullName: REPO_C,
    severity: 'low',
    title: 'Credential leak in follow-redirects',
    status: 'open',
    packageName: 'follow-redirects',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '< 1.15.6',
    patchedVersion: '1.15.6',
    cveId: 'CVE-2024-28849',
    ghsaId: 'GHSA-cxjh-pqwp-8mfp',
    cvssScore: 6.1,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-06T15:17:55Z',
    description: 'follow-redirects can leak authorization headers to third-party domains.',
  },
  {
    id: 'fnd_17minimatch',
    repoFullName: REPO_A,
    severity: 'low',
    title: 'ReDoS in minimatch brace expansion',
    status: 'open',
    packageName: 'minimatch',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '>= 3.0.0 < 3.1.2',
    patchedVersion: '3.1.2',
    ghsaId: 'GHSA-f8q6-p94x-37v3',
    cvssScore: 3.7,
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-15T09:02:18Z',
    description: 'minimatch is vulnerable to regular expression denial of service.',
  },
  {
    id: 'fnd_18vite',
    repoFullName: REPO_B,
    severity: 'info',
    title: 'Informational: dev-server fs permissions in vite',
    status: 'open',
    packageName: 'vite',
    packageEcosystem: 'npm',
    vulnerableVersionRange: '< 6.0.0',
    patchedVersion: '6.0.0',
    manifestPath: 'package-lock.json',
    createdAt: '2026-09-05T13:44:09Z',
    description: 'Informational advisory about vite dev-server filesystem handling.',
  },
]

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

const REPOSITORIES = [REPO_A, REPO_B, REPO_C].map((name, i) => ({
  id: String(92067341 + i),
  full_name: name,
  url: `https://github.com/${name}`,
  private: false,
  last_synced_at: '2026-09-17T12:00:00Z',
  findings_count: FINDINGS.filter((f) => f.repoFullName === name).length,
}))

/* ------------------------------------------------------------------ */
/* Stubbed procedures                                                  */
/* ------------------------------------------------------------------ */

function listFindings(input: Record<string, unknown>): unknown {
  let rows = FINDINGS
  if (input.repoFullName) rows = rows.filter((f) => f.repoFullName === input.repoFullName)
  if (input.severity) rows = rows.filter((f) => f.severity === input.severity)
  if (input.status) rows = rows.filter((f) => f.status === input.status)
  const dir = input.sortBy === 'severity_asc' ? -1 : 1
  rows = rows.toSorted(
    (a, b) => dir * (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
  )
  const offset = Number(input.offset ?? 0)
  const limit = Number(input.limit ?? 50)
  return {
    findings: rows.slice(offset, offset + limit),
    totalCount: rows.length,
    runningCount: 1,
    concurrencyLimit: 3,
  }
}

function securityStats(): unknown {
  const by = (k: string) => FINDINGS.filter((f) => f.severity === k).length
  const st = (k: string) => FINDINGS.filter((f) => f.status === k).length
  return {
    total: FINDINGS.length,
    critical: by('critical'),
    high: by('high'),
    medium: by('medium'),
    low: by('low'),
    open: st('open'),
    fixed: st('remediated'),
    ignored: st('dismissed'),
  }
}

function dashboardStats(): unknown {
  const by = (k: string) => FINDINGS.filter((f) => f.severity === k).length
  return {
    summary: {
      totalFindings: FINDINGS.length,
      openFindings: FINDINGS.filter((f) => f.status === 'open').length,
      repositoriesMonitored: REPOSITORIES.length,
      lastSync: '2026-09-17T12:00:00Z',
    },
    bySeverity: ['critical', 'high', 'medium', 'low', 'info'].map((s) => ({
      severity: s,
      count: by(s),
    })),
    byRepository: REPOSITORIES.map((r) => ({
      repository: r.full_name,
      findings: r.findings_count,
      lastSync: '2026-09-17',
    })),
    sla: {
      overdue: FINDINGS.filter(
        (f) => f.slaDueAt && new Date(f.slaDueAt) < new Date('2026-09-17'),
      ).length,
      dueWithin7d: 2,
      onTrack: 12,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Proxy                                                               */
/* ------------------------------------------------------------------ */

function stubResponse(procedure: string, input: Record<string, unknown>): unknown {
  switch (procedure) {
    case 'securityAgent.listFindings':
      return listFindings(input)
    case 'securityAgent.getRepositories':
      return REPOSITORIES
    case 'securityAgent.getFinding': {
      const f = FINDINGS.find((x) => x.id === input.id)
      return f ?? { error: 'not found' }
    }
    case 'securityAgent.getStats':
      return securityStats()
    case 'securityAgent.getDashboardStats':
      return dashboardStats()
    case 'securityAgent.getLastSyncTime':
      return { last_sync_time: '2026-09-17T12:00:00Z' }
    default:
      // Mutations and anything else under securityAgent — no-op, never
      // let a demo recording touch the real account.
      return { ok: true }
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const m = url.pathname.match(/^\/api\/trpc\/(securityAgent\.\w+)/)

  if (m) {
    const inputRaw = url.searchParams.get('input')
    let input: Record<string, unknown> = {}
    try {
      input = inputRaw ? (JSON.parse(inputRaw) as Record<string, unknown>) : {}
    } catch {
      input = {}
    }
    const data = stubResponse(m[1], input)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ result: { data: { json: data } } }))
    console.log(`stub  ${m[1]}`)
    return
  }

  // Pass through to the real API.
  const upstream = httpsReq(
    `${UPSTREAM}${url.pathname}${url.search}`,
    { method: req.method, headers: { ...req.headers, host: 'api.kilo.ai' } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
    },
  )
  upstream.on('error', (e) => {
    res.writeHead(502)
    res.end(String(e))
  })
  req.pipe(upstream)
  console.log(`proxy ${req.method} ${url.pathname}`)
}).listen(PORT, () => {
  console.log(`demo stub → ${UPSTREAM} on http://localhost:${PORT}`)
})
