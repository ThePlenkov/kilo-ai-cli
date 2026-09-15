#!/usr/bin/env node

/**
 * Raw tRPC probe — dumps the real `result.data` payload for a procedure,
 * bypassing zod validation. For debugging schema mismatches.
 *
 * Usage: node scripts/probe.ts <procedure> [inputJson]
 *   node scripts/probe.ts kiloclaw.getBillingStatus
 *   node scripts/probe.ts usageAnalytics.getSummary '{"startDate":"2026-08-14","endDate":"2026-09-13"}'
 *
 * `inputJson` is sent verbatim as the tRPC `input` query parameter — i.e. the
 * JSON the client would put in `?input=`. For procedures whose input schema is
 * `z.void()`/optional, pass `'{}'` or omit it entirely.
 */

import { KILO_API_BASE } from '../src/api/constants.ts'
import { buildAuthHeaders } from '../src/api/headers.ts'
import { createTokenStore } from '../src/auth/token-store.ts'

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

const url = new URL(`${KILO_API_BASE}/api/trpc/${procedure}`)
if (inputJson) url.searchParams.set('input', inputJson)

// Sanitize remote payloads before logging (Sonar S5145 — log injection).
const safe = (s: string, n: number): string => s.slice(0, n).replace(/[^\x20-\x7E\n]/g, '.')
// Non-JSON output also escapes newlines so one remote line can't forge entries.
const safeLine = (s: string, n: number): string => safe(s, n).replace(/\n/g, '\\n')

const res = await fetch(url, {
  method: 'GET',
  headers: buildAuthHeaders(token, undefined, {
    kilocodeOrganizationId: auth.type === 'oauth' ? auth.accountId : undefined,
  }),
  signal: AbortSignal.timeout(15_000),
})
// Bound the response while reading — a huge payload must not exhaust memory.
const MAX_BYTES = 10 * 1024 * 1024
let text: string
const reader = res.body?.getReader()
if (reader) {
  const chunks: Buffer[] = []
  let size = 0
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- stream chunks are sequential by design
    const { done, value } = await reader.read()
    if (done || !value) break
    const remaining = MAX_BYTES - size
    if (value.byteLength >= remaining) {
      chunks.push(Buffer.from(value.subarray(0, remaining)))
      // eslint-disable-next-line no-await-in-loop -- cancelling after the cap
      await reader.cancel()
      break
    }
    chunks.push(Buffer.from(value))
    size += value.byteLength
  }
  text = Buffer.concat(chunks).toString('utf8')
} else {
  text = await res.text()
}
console.log(`HTTP ${res.status}`)
if (!res.ok) process.exitCode = 1
try {
  console.log(safe(JSON.stringify(JSON.parse(text), null, 2), 12000))
} catch {
  console.log(safeLine(text, 4000))
}
