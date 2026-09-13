/**
 * Generic tRPC query/mutation helpers for the kilo.ai cloud API.
 * Mirrors @kilocode/kilo-gateway/src/api/trpc.ts
 */

import { z } from 'zod'
import { KILO_API_BASE } from './constants.ts'
import { buildAuthHeaders } from './headers.ts'
import { CloudTrpcError } from './types.ts'

/** Maximum response body size we are willing to read (10 MB). */
const MAX_BODY_BYTES = 10 * 1024 * 1024

/** Request timeout for tRPC calls. */
const REQUEST_TIMEOUT_MS = 15000

/** tRPC response envelope: either a result with data, or an error. */
const envelopeSchema = z.object({
  result: z.object({ data: z.unknown() }).optional(),
  error: z.unknown().optional(),
})

/** Extract a human-readable message from a tRPC error object. */
function extractErrorMessage(error: unknown): string | undefined {
  if (error == null) return undefined
  if (typeof error === 'string') return error
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>
    // tRPC error shape: { message, code, data: { code, httpStatus, ... } }
    if (typeof e.message === 'string') return e.message
    if (e.data && typeof e.data === 'object') {
      const d = e.data as Record<string, unknown>
      if (typeof d.message === 'string') return d.message
      if (typeof d.code === 'string') return d.code
    }
  }
  return undefined
}

/**
 * Read a response body as text, enforcing a 512 KB size limit.
 * Falls back to `response.text()` when no readable stream is available.
 */
async function readBody(response: Response, procedure: string): Promise<string> {
  const contentLengthHeader = response.headers?.get?.('content-length')
  if (contentLengthHeader) {
    const declared = Number.parseInt(contentLengthHeader, 10)
    if (!Number.isNaN(declared) && declared > MAX_BODY_BYTES) {
      throw new CloudTrpcError('protocol', response.status, procedure, `Response too large: ${declared} bytes`)
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
          throw new CloudTrpcError('protocol', response.status, procedure, `Response too large: >${MAX_BODY_BYTES} bytes`)
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

/** Classify an HTTP status as an auth failure. 403 is entitlement (e.g. missing subscription), not auth. */
function isAuthError(status: number): boolean {
  return status === 401
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
  const baseUrl = options?.baseUrl ?? KILO_API_BASE
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new CloudTrpcError('network', undefined, procedure, detail)
  }

  let text: string
  try {
    text = await readBody(response, procedure)
  } catch (err) {
    if (err instanceof CloudTrpcError) throw err
    const detail = err instanceof Error ? err.message : String(err)
    throw new CloudTrpcError('network', response.status, procedure, detail)
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    const snippet = text.slice(0, 200)
    throw new CloudTrpcError('protocol', response.status, procedure, `Non-JSON response: ${snippet}`)
  }

  const envelope = envelopeSchema.safeParse(json)
  if (!envelope.success) {
    const snippet = text.slice(0, 200)
    throw new CloudTrpcError('protocol', response.status, procedure, `Unexpected response format: ${snippet}`)
  }
  const { result, error } = envelope.data

  if (error != null) {
    const detail = extractErrorMessage(error)
    if (isAuthError(response.status)) {
      throw new CloudTrpcError('unauthorized', response.status, procedure, detail)
    }
    throw new CloudTrpcError('procedure', response.status, procedure, detail)
  }
  if (!response.ok) {
    if (isAuthError(response.status)) {
      throw new CloudTrpcError('unauthorized', response.status, procedure)
    }
    throw new CloudTrpcError('http', response.status, procedure)
  }
  if (!result) {
    throw new CloudTrpcError('protocol', response.status, procedure, 'No result in response')
  }

  const extracted = extractData(result.data)

  const validated = schema.safeParse(extracted)
  if (!validated.success) {
    const detail = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new CloudTrpcError('schema', response.status, procedure, detail)
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
  const baseUrl = options?.baseUrl ?? KILO_API_BASE
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new CloudTrpcError('network', undefined, procedure, detail)
  }

  let text: string
  try {
    text = await readBody(response, procedure)
  } catch (err) {
    if (err instanceof CloudTrpcError) throw err
    const detail = err instanceof Error ? err.message : String(err)
    throw new CloudTrpcError('network', response.status, procedure, detail)
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    const snippet = text.slice(0, 200)
    throw new CloudTrpcError('protocol', response.status, procedure, `Non-JSON response: ${snippet}`)
  }

  const batchEntrySchema = z.object({
    result: z.object({ data: z.unknown() }).optional(),
    error: z.unknown().optional(),
  })
  const batchSchema = z.array(batchEntrySchema)
  const batch = batchSchema.safeParse(json)
  if (!batch.success) {
    const snippet = text.slice(0, 200)
    throw new CloudTrpcError('protocol', response.status, procedure, `Unexpected batch format: ${snippet}`)
  }
  const entry = batch.data[0]
  if (!entry) {
    throw new CloudTrpcError('protocol', response.status, procedure, 'Empty batch response')
  }

  if (entry.error != null) {
    const detail = extractErrorMessage(entry.error)
    if (isAuthError(response.status)) {
      throw new CloudTrpcError('unauthorized', response.status, procedure, detail)
    }
    throw new CloudTrpcError('procedure', response.status, procedure, detail)
  }
  if (!response.ok) {
    if (isAuthError(response.status)) {
      throw new CloudTrpcError('unauthorized', response.status, procedure)
    }
    throw new CloudTrpcError('http', response.status, procedure)
  }
  if (!entry.result) {
    throw new CloudTrpcError('protocol', response.status, procedure, 'No result in batch entry')
  }

  const extracted = extractData(entry.result.data)

  const validated = schema.safeParse(extracted)
  if (!validated.success) {
    const detail = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new CloudTrpcError('schema', response.status, procedure, detail)
  }
  return validated.data
}
