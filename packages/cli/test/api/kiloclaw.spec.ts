import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KILO_API_BASE } from '../../src/api/constants.ts'
import {
  cancelKiloCliRun,
  cancelSubscriptionAtInstance,
  getBillingHistory,
  getBillingStatus,
  getChangelog,
  getFileTree,
  getKiloCliRunStatus,
  getLatestVersion,
  getSubscriptionDetail,
  listAllInstances,
  listPersonalSubscriptions,
  removeMyPin,
  readFile,
  startKiloCliRun,
  writeFile,
} from '../../src/api/kiloclaw.ts'

function mockResponse(data: unknown, opts: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(JSON.stringify({ result: { data: { json: data } } })),
    json: () => Promise.resolve({ result: { data: { json: data } } }),
  } as Response
}

function mockMutationResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(JSON.stringify([{ result: { data: { json: data } } }])),
    json: () => Promise.resolve([{ result: { data: { json: data } } }]),
  } as Response
}

describe('kiloclaw API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => vi.restoreAllMocks())

  describe('queries', () => {
    it('getChangelog calls kiloclaw.getChangelog', async () => {
      fetchMock.mockResolvedValue(mockResponse([{ version: '1.0', date: '2024-01-01', changes: ['fix'] }]))
      const result = await getChangelog('tok')
      expect(result).toHaveLength(1)
      expect((result[0] as Record<string, unknown>).version).toBe('1.0')
      expect(fetchMock.mock.calls[0]![0]).toContain(`${KILO_API_BASE}/api/trpc/kiloclaw.getChangelog`)
    })

    it('getBillingStatus calls kiloclaw.getBillingStatus', async () => {
      fetchMock.mockResolvedValue(mockResponse({ balance: 50, activeSubscriptions: 2, currentPeriodUsageUsd: 10 }))
      const result = await getBillingStatus('tok') as Record<string, unknown>
      expect(result.balance).toBe(50)
      expect(fetchMock.mock.calls[0]![0]).toContain('kiloclaw.getBillingStatus')
    })

    it('getLatestVersion passes currentImageTag', async () => {
      fetchMock.mockResolvedValue(mockResponse({ latestVersion: '2.0', isUpToDate: false }))
      const result = await getLatestVersion('tok', '1.0')
      expect(result.latestVersion).toBe('2.0')
      expect(result.isUpToDate).toBe(false)
      const url = fetchMock.mock.calls[0]![0] as string
      expect(url).toContain('input=')
      expect(decodeURIComponent(url.split('input=')[1]!)).toContain('currentImageTag')
    })

    it('listAllInstances calls kiloclaw.listAllInstances', async () => {
      fetchMock.mockResolvedValue(mockResponse([{ id: 'i1', name: 'inst', status: 'active', createdAt: '2024-01-01', updatedAt: '2024-01-02' }]))
      const result = await listAllInstances('tok')
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('i1')
    })

    it('getFileTree passes path when provided', async () => {
      fetchMock.mockResolvedValue(mockResponse([{ name: 'file.ts', path: '/file.ts', type: 'file' }]))
      await getFileTree('tok', '/src')
      const url = fetchMock.mock.calls[0]![0] as string
      expect(url).toContain('kiloclaw.fileTree')
      expect(decodeURIComponent(url.split('input=')[1]!)).toContain('/src')
    })

    it('readFile passes path', async () => {
      fetchMock.mockResolvedValue(mockResponse({ content: 'hello', etag: 'abc' }))
      const result = await readFile('tok', '/file.ts')
      expect(result.content).toBe('hello')
      expect(result.etag).toBe('abc')
    })

    it('getKiloCliRunStatus passes runId', async () => {
      fetchMock.mockResolvedValue(mockResponse({ runId: 'r1', status: 'running', prompt: 'test', startedAt: '2024-01-01' }))
      const result = await getKiloCliRunStatus('tok', 'r1')
      expect(result.runId).toBe('r1')
      expect(result.status).toBe('running')
    })

    it('listPersonalSubscriptions calls kiloclaw.listPersonalSubscriptions', async () => {
      fetchMock.mockResolvedValue(mockResponse({ subscriptions: [{ id: 's1', planName: 'pro', status: 'active', providerName: 'stripe', providerId: 'p1', cancelAtPeriodEnd: false }] }))
      const result = await listPersonalSubscriptions('tok')
      expect(result).toHaveLength(1)
    })

    it('getSubscriptionDetail passes instanceId', async () => {
      fetchMock.mockResolvedValue(mockResponse({ id: 's1', planName: 'pro', status: 'active', providerName: 'stripe', providerId: 'p1', cancelAtPeriodEnd: false }))
      const result = await getSubscriptionDetail('tok', 'inst1') as Record<string, unknown>
      expect(result.id).toBe('s1')
    })

    it('getBillingHistory passes instanceId', async () => {
      fetchMock.mockResolvedValue(mockResponse({ entries: [{ id: 'b1', date: '2024-01-01', amount: 10, description: 'charge', type: 'payment' }], hasMore: false, cursor: null }))
      const result = await getBillingHistory('tok', 'inst1')
      expect(result).toHaveLength(1)
      const url = fetchMock.mock.calls[0]![0] as string
      expect(decodeURIComponent(url.split('input=')[1]!)).toContain('inst1')
    })
  })

  describe('mutations', () => {
    it('startKiloCliRun posts to kiloclaw.startKiloCliRun', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse({ runId: 'r1' }))
      const result = await startKiloCliRun('tok', 'do something')
      expect(result.runId).toBe('r1')
      const url = fetchMock.mock.calls[0]![0] as string
      expect(url).toBe(`${KILO_API_BASE}/api/trpc/kiloclaw.startKiloCliRun?batch=1`)
      const init = fetchMock.mock.calls[0]![1] as { method: string; body: string }
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual({ '0': { prompt: 'do something' } })
    })

    it('cancelKiloCliRun posts to kiloclaw.cancelKiloCliRun', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await cancelKiloCliRun('tok', 'r1')
      const url = fetchMock.mock.calls[0]![0] as string
      expect(url).toContain('kiloclaw.cancelKiloCliRun')
    })

    it('removeMyPin posts to kiloclaw.removeMyPin', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await removeMyPin('tok')
      const url = fetchMock.mock.calls[0]![0] as string
      expect(url).toContain('kiloclaw.removeMyPin')
    })

    it('writeFile posts with path, content, etag', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse({ etag: 'new' }))
      const result = await writeFile('tok', '/file.ts', 'content', 'old-etag')
      expect(result.etag).toBe('new')
      const init = fetchMock.mock.calls[0]![1] as { body: string }
      expect(JSON.parse(init.body)).toEqual({ '0': { path: '/file.ts', content: 'content', etag: 'old-etag' } })
    })

    it('cancelSubscriptionAtInstance posts with instanceId', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await cancelSubscriptionAtInstance('tok', 'inst1')
      const init = fetchMock.mock.calls[0]![1] as { body: string }
      expect(JSON.parse(init.body)).toEqual({ '0': { instanceId: 'inst1' } })
    })
  })
})
