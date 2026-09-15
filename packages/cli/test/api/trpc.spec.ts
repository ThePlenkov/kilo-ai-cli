import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KILO_API_BASE } from '../../src/api/constants.ts'
import {
  fetchByokEntries,
  fetchCloudSession,
  fetchCloudSessions,
  fetchCodingPlanSubscriptions,
  fetchCodingPlanUsage,
  renameCloudSession,
} from '../../src/api/trpc.ts'

interface MockResponse {
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  text: () => Promise<string>
}

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): MockResponse {
  const ok = init.ok ?? true
  const status = init.status ?? 200
  return {
    ok,
    status,
    headers: { get: () => null },
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

function trpcEnvelope(data: unknown): unknown {
  return { result: { data: { json: data } } }
}

function trpcBatch(data: unknown): unknown {
  return [{ result: { data: { json: data } } }]
}

describe('tRPC wrappers', () => {
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

  it('fetchCodingPlanSubscriptions calls codingPlans.listSubscriptions', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        trpcEnvelope([
          {
            id: 'sub-1',
            planId: 'plan-1',
            planName: 'Pro',
            providerName: 'stripe',
            providerId: 'stripe',
            canQueryUsage: true,
            hasInstalledByokKey: false,
            status: 'active',
            cancelAtPeriodEnd: false,
          },
        ]),
      ),
    )
    const result = await fetchCodingPlanSubscriptions('tok', 'org-1')
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('sub-1')
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toBe(`${KILO_API_BASE}/api/trpc/codingPlans.listSubscriptions`)
    const init = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> }
    expect(init.headers['X-KILOCODE-ORGANIZATIONID']).toBe('org-1')
  })

  it('fetchCodingPlanUsage calls codingPlans.getUsage with subscriptionId input', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        trpcEnvelope({
          schemaVersion: 1,
          fetchedAt: '2024-01-01T00:00:00Z',
          subscription: {
            id: 'sub-1',
            planName: 'Pro',
            providerId: 'stripe',
            providerName: 'stripe',
            windows: [],
          },
        }),
      ),
    )
    const result = await fetchCodingPlanUsage('tok', 'sub-1')
    expect(result.subscription.id).toBe('sub-1')
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('codingPlans.getUsage')
    expect(url).toContain('?input=')
    const encoded = url.slice(url.indexOf('?input=') + '?input='.length)
    expect(JSON.parse(decodeURIComponent(encoded))).toEqual({ subscriptionId: 'sub-1' })
  })

  it('fetchByokEntries calls byok.list with empty input', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        trpcEnvelope([
          { id: 'byok-1', provider_id: 'anthropic', management_source: 'user', is_enabled: true },
        ]),
      ),
    )
    const result = await fetchByokEntries('tok')
    expect(result[0]!.id).toBe('byok-1')
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('byok.list')
    const encoded = url.slice(url.indexOf('?input=') + '?input='.length)
    expect(JSON.parse(decodeURIComponent(encoded))).toEqual({})
  })

  it('fetchCloudSessions calls cliSessionsV2.list and maps result', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        trpcEnvelope({
          cliSessions: [
            {
              session_id: 's1',
              title: 'My session',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-02T00:00:00Z',
              version: 1,
            },
          ],
          nextCursor: 'cursor-1',
        }),
      ),
    )
    const result = await fetchCloudSessions('tok', { limit: 10 })
    expect(result.cliSessions).toHaveLength(1)
    expect(result.cliSessions[0]!.session_id).toBe('s1')
    expect(result.nextCursor).toBe('cursor-1')
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('cliSessionsV2.list')
    const encoded = url.slice(url.indexOf('?input=') + '?input='.length)
    expect(JSON.parse(decodeURIComponent(encoded))).toEqual({ limit: 10 })
  })

  it('fetchCloudSession calls cliSessionsV2.get with session_id input', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        trpcEnvelope({
          session_id: 's1',
          title: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          version: 1,
        }),
      ),
    )
    const result = await fetchCloudSession('tok', 's1')
    expect(result.session_id).toBe('s1')
    expect(result.title).toBeNull()
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('cliSessionsV2.get')
    const encoded = url.slice(url.indexOf('?input=') + '?input='.length)
    expect(JSON.parse(decodeURIComponent(encoded))).toEqual({ session_id: 's1' })
  })

  it('renameCloudSession posts to cliSessionsV2.rename with batch body', async () => {
    fetchMock.mockResolvedValue(mockResponse(trpcBatch({ ok: true })))
    await renameCloudSession('tok', 's1', 'New title')
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toBe(`${KILO_API_BASE}/api/trpc/cliSessionsV2.rename?batch=1`)
    const init = fetchMock.mock.calls[0]![1] as {
      method: string
      body: string
      headers: Record<string, string>
    }
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ '0': { session_id: 's1', title: 'New title' } })
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('renameCloudSession throws CloudTrpcError("procedure") on batch error', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ error: { message: 'nope' } }], { ok: false, status: 400 }),
    )
    await expect(renameCloudSession('tok', 's1', 'title')).rejects.toMatchObject({
      name: 'CloudTrpcError',
      kind: 'procedure',
    })
  })

  it('propagates schema validation failures as CloudTrpcError("schema")', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(trpcEnvelope([{ id: 'sub-1' /* missing planId/planName/... */ }])),
    )
    await expect(fetchCodingPlanSubscriptions('tok')).rejects.toMatchObject({
      name: 'CloudTrpcError',
      kind: 'schema',
    })
  })

  it('propagates network errors as CloudTrpcError("network")', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    await expect(fetchCodingPlanSubscriptions('tok')).rejects.toMatchObject({
      name: 'CloudTrpcError',
      kind: 'network',
    })
  })
})
