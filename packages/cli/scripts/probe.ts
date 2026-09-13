#!/usr/bin/env node
/**
 * Raw tRPC probe — dumps the real `result.data` payload for a procedure,
 * bypassing zod validation. For debugging schema mismatches.
 *
 * Usage: node scripts/probe.ts <procedure> [inputJson]
 *   node scripts/probe.ts kiloclaw.getBillingStatus
 *   node scripts/probe.ts usageAnalytics.getSummary '{"startDate":"2026-08-14","endDate":"2026-09-13"}'
 */

import { createTokenStore } from '../src/auth/token-store.ts'
import { KILO_API_BASE } from '../src/api/constants.ts'
import { buildAuthHeaders } from '../src/api/headers.ts'

const [procedure, inputJson] = process.argv.slice(2)
if (!procedure) {
  console.error('Usage: node scripts/probe.ts <procedure> [inputJson]')
  process.exit(1)
}

const auth = await createTokenStore().get()
if (!auth) {
  console.error('Not authenticated.')
  process.exit(1)
}
const token = auth.type === 'oauth' ? auth.access : auth.type === 'api' ? auth.key : auth.token

let url = `${KILO_API_BASE}/api/trpc/${procedure}`
if (inputJson) url += `?input=${encodeURIComponent(inputJson)}`

// Sanitize remote payloads before logging (Sonar S5145 — log injection).
const safe = (s: string, n: number): string =>
  Array.from(s.slice(0, n), (c) => (c === '\n' || (c >= ' ' && c <= '~') ? c : '.')).join('')

const res = await fetch(url, { method: 'GET', headers: buildAuthHeaders(token, undefined, {}) })
const text = await res.text()
console.log(`HTTP ${res.status}`)
try {
  console.log(safe(JSON.stringify(JSON.parse(text), null, 2), 12000))
} catch {
  console.log(safe(text, 4000))
}
