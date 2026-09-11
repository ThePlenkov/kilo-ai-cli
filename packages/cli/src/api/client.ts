/**
 * Generic tRPC query/mutation helpers for the kilo.ai cloud API.
 * Mirrors @kilocode/kilo-gateway/src/api/trpc.ts
 */

import { z } from 'zod'
import { KILO_API_BASE } from './constants.ts'
import { buildAuthHeaders } from './headers.ts'
import { CloudTrpcError } from './types.ts'

/** Maximum response body size we are willing to read (512 KB). */
const MAX_BODY_BYTES = 512 * 1024

/** Request timeout for tRPC calls. */
const REQUEST_TIMEOUT_MS = 5000

/**
 * Validate that the API base URL uses HTTPS to prevent cleartext token transmission (CWE-319).
 * Allows http: only on localhost for development.
 */
function assertHttpsBaseUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl)
  if (parsed.protocol === 'https:') return baseUrl
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return baseUrl
  throw new CloudTrpcError('protocol', 0)
}

/** tRPC response envelope: either a result with data, or an error. */
const envelopeSchema = z.object({
  result: z.object({ data: z.unknown() }).optional(),
  error: z.unknown().optional(),
})

/**
 * Read a response body as text, enforcing a 512 KB size limit.
 * Falls back to `response.text()` when no readable stream is available.
 */
async function readBody(response: Response): Promise<string> {
  const contentLengthHeader = response.headers?.get?.('content-length')
  if (contentLengthHeader) {
    const declared = Number.parseInt(contentLengthHeader, 10)
    if (!Number.isNaN(declared) && declared > MAX_BODY_BYTES) {
      throw new CloudTrpcError('protocol', response.status)
    }
  }

  const body = (response as { body?: { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } }).body
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > MAX_BODY_BYTES) {
          throw new CloudTrpcError('protocol', response.status)
        }
        chunks.push(value)
      }
    }
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new TextDecoder().decode(merged)
  }

  return await response.text()
}

/** Extract the JSON payload from a tRPC result.data, unwrapping the `{ json }` wrapper when present. */
function extractData(data: unknown): unknown {
  if (data != null && typeof data === 'object' && 'json' in data) {
    return (data as { json: unknown }).json
  }
  return data
}

/**
 * Query a tRPC procedure with typed input and Zod-validated output.
 * Uses GET with `?input=<json>` query parameter.
 * Parses the tRPC response envelope: `{ result: { data: { json } } }` or `{ error }`.
 */
export async function trpcQuery<T>(
  procedure: string,
  token: string,
  schema: z.ZodType<T>,
  input?: unknown,
  options?: { baseUrl?: string; organizationId?: string },
): Promise<T> {
  const baseUrl = assertHttpsBaseUrl(options?.baseUrl ?? KILO_API_BASE)
  let url = `${baseUrl}/api/trpc/${procedure}`
  if (input !== undefined) {
    url += `?input=${encodeURIComponent(JSON.stringify(input))}`
  }

  const headers = buildAuthHeaders(token, undefined, {
    kilocodeOrganizationId: options?.organizationId,
  })

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new CloudTrpcError('network')
  }

  let text: string
  try {
    text = await readBody(response)
  } catch (err) {
    if (err instanceof CloudTrpcError) throw err
    throw new CloudTrpcError('network')
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new CloudTrpcError('protocol', response.status)
  }

  const envelope = envelopeSchema.safeParse(json)
  if (!envelope.success) {
    throw new CloudTrpcError('protocol', response.status)
  }
  const { result, error } = envelope.data

  if (error != null) {
    throw new CloudTrpcError('procedure', response.status)
  }
  if (!response.ok) {
    throw new CloudTrpcError('http', response.status)
  }
  if (!result) {
    throw new CloudTrpcError('protocol', response.status)
  }

  const extracted = extractData(result.data)

  const validated = schema.safeParse(extracted)
  if (!validated.success) {
    throw new CloudTrpcError('schema', response.status)
  }
  return validated.data
}

/**
 * Mutate a tRPC procedure with typed input and Zod-validated output.
 * Uses POST with a batched body `{"0": input}` and `?batch=1`.
 * Parses the batched response: `json[0].result.data.json` or `json[0].error`.
 */
export async function trpcMutate<T>(
  procedure: string,
  token: string,
  schema: z.ZodType<T>,
  input: unknown,
  options?: { baseUrl?: string; organizationId?: string },
): Promise<T> {
  const baseUrl = assertHttpsBaseUrl(options?.baseUrl ?? KILO_API_BASE)
  const url = `${baseUrl}/api/trpc/${procedure}?batch=1`

  const headers = {
    ...buildAuthHeaders(token, undefined, {
      kilocodeOrganizationId: options?.organizationId,
    }),
    'Content-Type': 'application/json',
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ '0': input }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new CloudTrpcError('network')
  }

  let text: string
  try {
    text = await readBody(response)
  } catch (err) {
    if (err instanceof CloudTrpcError) throw err
    throw new CloudTrpcError('network')
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new CloudTrpcError('protocol', response.status)
  }

  const batchEntrySchema = z.object({
    result: z.object({ data: z.unknown() }).optional(),
    error: z.unknown().optional(),
  })
  const batchSchema = z.array(batchEntrySchema)
  const batch = batchSchema.safeParse(json)
  if (!batch.success) {
    throw new CloudTrpcError('protocol', response.status)
  }
  const entry = batch.data[0]
  if (!entry) {
    throw new CloudTrpcError('protocol', response.status)
  }

  if (entry.error != null) {
    throw new CloudTrpcError('procedure', response.status)
  }
  if (!response.ok) {
    throw new CloudTrpcError('http', response.status)
  }
  if (!entry.result) {
    throw new CloudTrpcError('protocol', response.status)
  }

  const extracted = extractData(entry.result.data)

  const validated = schema.safeParse(extracted)
  if (!validated.success) {
    throw new CloudTrpcError('schema', response.status)
  }
  return validated.data
}
