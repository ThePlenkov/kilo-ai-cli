import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { trpcQuery } from '../../src/api/client.ts'
import { KILO_API_BASE } from '../../src/api/constants.ts'

interface MockResponse {
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  text: () => Promise<string>
  body?: unknown
}

function mockResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; headers?: Record<string, string> } = {},
): MockResponse {
  const ok = init.ok ?? true
  const status = init.status ?? 200
  const headers = init.headers ?? {}
  return {
    ok,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

describe('trpcQuery', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns validated data on a successful query', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: { data: { json: { hello: 'world' } } } }))
    const schema = z.object({ hello: z.string() })
    const result = await trpcQuery('test.proc', 'tok', schema)
    expect(result).toEqual({ hello: 'world' })
  })

  it('returns validated data when envelope uses bare data (no json wrapper)', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: { data: { hello: 'world' } } }))
    const schema = z.object({ hello: z.string() })
    const result = await trpcQuery('test.proc', 'tok', schema)
    expect(result).toEqual({ hello: 'world' })
  })

  it('throws CloudTrpcError("network") on fetch rejection', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    const schema = z.object({ hello: z.string() })
    await expect(trpcQuery('test.proc', 'tok', schema)).rejects.toMatchObject({
      name: 'CloudTrpcError',
      kind: 'network',
    })
  })

  it('throws CloudTrpcError("procedure") when envelope contains error', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ error: { message: 'nope' } }, { ok: false, status: 400 }),
    )
    const schema = z.object({ hello: z.string() })
    await expect(trpcQuery('test.proc', 'tok', schema)).rejects.toMatchObject({
      name: 'CloudTrpcError',
      kind: 'procedure',
      status: 400,
    })
  })

  it('throws CloudTrpcError("http") on non-ok response without error', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ result: { data: { json: { hello: 'world' } } } }, { ok: false, status: 500 }),
    )
    const schema = z.object({ hello: z.string() })
    await expect(trpcQuery('test.proc', 'tok', schema)).rejects.toMatchObject({
      name: 'CloudTrpcError',
      kind: 'http',
      status: 500,
    })
  })

  it('throws CloudTrpcError("schema") when data fails schema validation', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: { data: { json: { hello: 123 } } } }))
    const schema = z.object({ hello: z.string() })
    await expect(trpcQuery('test.proc', 'tok', schema)).rejects.toMatchObject({
      name: 'CloudTrpcError',
      kind: 'schema',
    })
  })

  it('throws CloudTrpcError("protocol") when result is missing', async () => {
    fetchMock.mockResolvedValue(mockResponse({}))
    const schema = z.object({ hello: z.string() })
    await expect(trpcQuery('test.proc', 'tok', schema)).rejects.toMatchObject({
      name: 'CloudTrpcError',
      kind: 'protocol',
    })
  })

  it('serializes input as a query parameter', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: { data: { json: { ok: true } } } }))
    const schema = z.object({ ok: z.boolean() })
    await trpcQuery('test.proc', 'tok', schema, { foo: 'bar', n: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('?input=')
    const encoded = url.slice(url.indexOf('?input=') + '?input='.length)
    expect(JSON.parse(decodeURIComponent(encoded))).toEqual({ foo: 'bar', n: 1 })
  })

  it('does not add input query param when input is undefined', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: { data: { json: { ok: true } } } }))
    const schema = z.object({ ok: z.boolean() })
    await trpcQuery('test.proc', 'tok', schema)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).not.toContain('?input=')
  })

  it('builds the URL from baseUrl override', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: { data: { json: { ok: true } } } }))
    const schema = z.object({ ok: z.boolean() })
    await trpcQuery('test.proc', 'tok', schema, undefined, {
      baseUrl: 'https://custom.example.com',
    })
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toBe(`https://custom.example.com/api/trpc/test.proc`)
  })

  it('defaults to KILO_API_BASE', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: { data: { json: { ok: true } } } }))
    const schema = z.object({ ok: z.boolean() })
    await trpcQuery('test.proc', 'tok', schema)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toBe(`${KILO_API_BASE}/api/trpc/test.proc`)
  })

  it('passes organizationId as a header', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: { data: { json: { ok: true } } } }))
    const schema = z.object({ ok: z.boolean() })
    await trpcQuery('test.proc', 'tok', schema, undefined, { organizationId: 'org-123' })
    const init = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> }
    expect(init.headers['X-KILOCODE-ORGANIZATIONID']).toBe('org-123')
  })

  it('sets Authorization header from token', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: { data: { json: { ok: true } } } }))
    const schema = z.object({ ok: z.boolean() })
    await trpcQuery('test.proc', 'tok', schema)
    const init = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> }
    expect(init.headers['Authorization']).toBe('Bearer tok')
  })
})
