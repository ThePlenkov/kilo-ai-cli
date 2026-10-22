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
 * Reject a response that declares more than the limit before reading it.
 */
function assertDeclaredSize(response: Response, procedure: string): void {
  const contentLengthHeader = response.headers?.get?.('content-length')
  if (!contentLengthHeader) return
  const declared = Number.parseInt(contentLengthHeader, 10)
  if (!Number.isNaN(declared) && declared > MAX_BODY_BYTES) {
    throw new CloudTrpcError(
      'protocol',
      response.status,
      procedure,
      `Response too large: ${declared} bytes`,
    )
  }
}

/**
 * Read a streamed response body, enforcing the size limit while it is read.
 * Returns `null` when the response has no readable stream.
 */
async function readStreamedBody(response: Response, procedure: string): Promise<string | null> {
  const body = (
    response as { body?: { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } }
  ).body
  if (!body || typeof body.getReader !== 'function') return null

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- the response body is read chunk by chunk
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      // eslint-disable-next-line no-await-in-loop -- the response body is read chunk by chunk
      await reader.cancel()
      throw new CloudTrpcError(
        'protocol',
        response.status,
        procedure,
        `Response too large: >${MAX_BODY_BYTES} bytes`,
      )
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

/**
 * Read a response body as text, enforcing a 512 KB size limit.
 * Falls back to `response.text()` when no readable stream is available.
 */
async function readBody(response: Response, procedure: string): Promise<string> {
  assertDeclaredSize(response, procedure)
  const streamed = await readStreamedBody(response, procedure)
  if (streamed !== null) return streamed
  return await response.text()
}

/**
 * Perform the request, mapping a transport failure to a network error.
 *
 * The request is handed in as a function: the URL is built by the caller,
 * where the base and the path are known, and not passed in from the
 * outside — a URL that reaches the HTTP client from the outside is a
 * request injection.
 */
async function perform(request: () => Promise<Response>, procedure: string): Promise<Response> {
  try {
    return await request()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new CloudTrpcError('network', undefined, procedure, detail)
  }
}

/** Read the body as text, mapping a transport failure to a network error. */
async function readText(response: Response, procedure: string): Promise<string> {
  try {
    return await readBody(response, procedure)
  } catch (err) {
    if (err instanceof CloudTrpcError) throw err
    const detail = err instanceof Error ? err.message : String(err)
    throw new CloudTrpcError('network', response.status, procedure, detail)
  }
}

/** Parse the body as JSON, mapping a malformed body to a protocol error. */
function parseJson(text: string, response: Response, procedure: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const snippet = text.slice(0, 200)
    throw new CloudTrpcError(
      'protocol',
      response.status,
      procedure,
      `Non-JSON response: ${snippet}`,
    )
  }
}

/** The tRPC error carried by a response envelope. */
function throwForEnvelopeError(error: unknown, response: Response, procedure: string): never {
  const detail = extractErrorMessage(error)
  if (isAuthError(response.status)) {
    throw new CloudTrpcError('unauthorized', response.status, procedure, detail)
  }
  throw new CloudTrpcError('procedure', response.status, procedure, detail)
}

/** A failed response that carries no tRPC error. */
function throwForStatus(response: Response, procedure: string): never {
  if (isAuthError(response.status)) {
    throw new CloudTrpcError('unauthorized', response.status, procedure)
  }
  throw new CloudTrpcError('http', response.status, procedure)
}

/** Validate the payload against the schema. */
function validatePayload<T>(
  schema: z.ZodType<T>,
  data: unknown,
  response: Response,
  procedure: string,
): T {
  const validated = schema.safeParse(extractData(data))
  if (!validated.success) {
    const detail = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new CloudTrpcError('schema', response.status, procedure, detail)
  }
  return validated.data
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
 * Detect the tRPC/zod error for a procedure that expects an object input but
 * received none. Those procedures accept `{}`, so the call can be retried.
 */
function needsEmptyObjectInput(detail: string | undefined): boolean {
  return detail?.includes('expected object, received undefined') === true
}

/**
 * Query a tRPC procedure with typed input and Zod-validated output.
 * Uses GET with `?input=<json>` query parameter.
 * Parses the tRPC response envelope: `{ result: { data: { json } } }` or `{ error }`.
 *
 * Procedures that declare an object input but were called without one are
 * retried once with `{}` — the server rejects them otherwise.
 */
export async function trpcQuery<T>(
  procedure: string,
  token: string,
  schema: z.ZodType<T>,
  input?: unknown,
  options?: { baseUrl?: string; organizationId?: string },
): Promise<T> {
  try {
    return await requestQuery(procedure, token, schema, input, options)
  } catch (err) {
    if (
      input === undefined &&
      err instanceof CloudTrpcError &&
      err.kind === 'procedure' &&
      needsEmptyObjectInput(err.detail)
    ) {
      return await requestQuery(procedure, token, schema, {}, options)
    }
    throw err
  }
}

async function requestQuery<T>(
  procedure: string,
  token: string,
  schema: z.ZodType<T>,
  input: unknown,
  options?: { baseUrl?: string; organizationId?: string },
): Promise<T> {
  const baseUrl = options?.baseUrl ?? KILO_API_BASE
  const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(input))}`

  const headers = buildAuthHeaders(token, undefined, {
    kilocodeOrganizationId: options?.organizationId,
  })

  const url = `${baseUrl}/api/trpc/${procedure}${query}`
  const response = await perform(
    () =>
      fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }),
    procedure,
  )
  const text = await readText(response, procedure)
  const json = parseJson(text, response, procedure)

  const envelope = envelopeSchema.safeParse(json)
  if (!envelope.success) {
    const snippet = text.slice(0, 200)
    throw new CloudTrpcError(
      'protocol',
      response.status,
      procedure,
      `Unexpected response format: ${snippet}`,
    )
  }
  const { result, error } = envelope.data

  if (error != null) {
    throwForEnvelopeError(error, response, procedure)
  }
  if (!response.ok) {
    throwForStatus(response, procedure)
  }
  if (!result) {
    throw new CloudTrpcError('protocol', response.status, procedure, 'No result in response')
  }

  return validatePayload(schema, result.data, response, procedure)
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
  try {
    return await requestMutation(procedure, token, schema, input, options)
  } catch (err) {
    if (
      input === undefined &&
      err instanceof CloudTrpcError &&
      err.kind === 'procedure' &&
      needsEmptyObjectInput(err.detail)
    ) {
      return await requestMutation(procedure, token, schema, {}, options)
    }
    throw err
  }
}

async function requestMutation<T>(
  procedure: string,
  token: string,
  schema: z.ZodType<T>,
  input: unknown,
  options?: { baseUrl?: string; organizationId?: string },
): Promise<T> {
  const baseUrl = options?.baseUrl ?? KILO_API_BASE

  const headers = {
    ...buildAuthHeaders(token, undefined, {
      kilocodeOrganizationId: options?.organizationId,
    }),
    'Content-Type': 'application/json',
  }

  const url = `${baseUrl}/api/trpc/${procedure}?batch=1`
  const response = await perform(
    () =>
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ '0': input }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }),
    procedure,
  )
  const text = await readText(response, procedure)
  const json = parseJson(text, response, procedure)

  const batchSchema = z.array(envelopeSchema)
  const batch = batchSchema.safeParse(json)
  if (!batch.success) {
    const snippet = text.slice(0, 200)
    throw new CloudTrpcError(
      'protocol',
      response.status,
      procedure,
      `Unexpected batch format: ${snippet}`,
    )
  }
  const entry = batch.data[0]
  if (!entry) {
    throw new CloudTrpcError('protocol', response.status, procedure, 'Empty batch response')
  }

  if (entry.error != null) {
    throwForEnvelopeError(entry.error, response, procedure)
  }
  if (!response.ok) {
    throwForStatus(response, procedure)
  }
  if (!entry.result) {
    throw new CloudTrpcError('protocol', response.status, procedure, 'No result in batch entry')
  }

  return validatePayload(schema, entry.result.data, response, procedure)
}
