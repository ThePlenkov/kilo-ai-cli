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
  readFile,
  removeMyPin,
  startKiloCliRun,
  writeFile,
} from '../../src/api/kiloclaw.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('kiloclaw API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  describe('queries', () => {
    it('getChangelog calls kiloclaw.getChangelog', async () => {
      fetchMock.mockResolvedValue(
        mockResponse([
          { date: '2026-08-01', description: 'fix thing', category: 'fix', deployHint: 'auto' },
        ]),
      )
      const result = await getChangelog('tok')
      expect(result).toHaveLength(1)
      expect(result[0]!.description).toBe('fix thing')
      expect(fetchMock.mock.calls[0]![0]).toBe(`${KILO_API_BASE}/api/trpc/kiloclaw.getChangelog`)
    })

    it('getBillingStatus calls kiloclaw.getBillingStatus', async () => {
      fetchMock.mockResolvedValue(
        mockResponse({
          hasAccess: true,
          creditBalanceMicrodollars: 10346942,
          hasCurrentPersonalSubscription: false,
        }),
      )
      const result = await getBillingStatus('tok')
      expect(result.hasAccess).toBe(true)
      expect(result.creditBalanceMicrodollars).toBe(10346942)
      expect(fetchMock.mock.calls[0]![0]).toContain('kiloclaw.getBillingStatus')
    })

    it('getLatestVersion passes currentImageTag', async () => {
      fetchMock.mockResolvedValue(
        mockResponse({
          openclawVersion: '2.0',
          variant: 'standard',
          imageTag: 'v2.0',
          isLatest: false,
        }),
      )
      const result = await getLatestVersion('tok', '1.0')
      expect(result.openclawVersion).toBe('2.0')
      expect(result.isLatest).toBe(false)
      const url = fetchMock.mock.calls[0]![0] as string
      expect(url).toContain('input=')
      expect(decodeURIComponent(url.split('input=')[1]!)).toContain('currentImageTag')
    })

    it('listAllInstances calls kiloclaw.listAllInstances', async () => {
      fetchMock.mockResolvedValue(
        mockResponse([
          {
            id: 'i1',
            name: 'inst',
            status: 'active',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-02',
          },
        ]),
      )
      const result = await listAllInstances('tok')
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('i1')
    })

    it('getFileTree passes path when provided', async () => {
      fetchMock.mockResolvedValue(
        mockResponse([{ name: 'file.ts', path: '/file.ts', type: 'file' }]),
      )
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
      fetchMock.mockResolvedValue(
        mockResponse({ runId: 'r1', status: 'running', prompt: 'test', startedAt: '2024-01-01' }),
      )
      const result = await getKiloCliRunStatus('tok', 'r1')
      expect(result.runId).toBe('r1')
      expect(result.status).toBe('running')
    })

    it('listPersonalSubscriptions calls kiloclaw.listPersonalSubscriptions', async () => {
      fetchMock.mockResolvedValue(
        mockResponse({
          commitPlanAvailable: false,
          subscriptions: [
            { instanceId: 's1', plan: 'pro', status: 'active', cancelAtPeriodEnd: false },
          ],
        }),
      )
      const result = await listPersonalSubscriptions('tok')
      expect(result.subscriptions).toHaveLength(1)
      expect(result.subscriptions[0]!.instanceId).toBe('s1')
    })

    it('getSubscriptionDetail passes instanceId', async () => {
      fetchMock.mockResolvedValue(
        mockResponse({
          instanceId: 'inst1',
          plan: 'pro',
          status: 'active',
          cancelAtPeriodEnd: false,
        }),
      )
      const result = await getSubscriptionDetail('tok', 'inst1')
      expect(result.instanceId).toBe('inst1')
      const url = fetchMock.mock.calls[0]![0] as string
      expect(JSON.parse(decodeURIComponent(url.split('input=')[1]!))).toEqual({
        instanceId: 'inst1',
      })
    })

    it('getBillingHistory passes instanceId and period', async () => {
      fetchMock.mockResolvedValue(
        mockResponse({ entries: [{ amount: 10 }], hasMore: false, cursor: null }),
      )
      const page = await getBillingHistory('tok', 'inst1', '2024-01')
      expect(page.entries).toHaveLength(1)
      const url = fetchMock.mock.calls[0]![0] as string
      const input = JSON.parse(decodeURIComponent(url.split('input=')[1]!))
      expect(input.instanceId).toBe('inst1')
      expect(input.period).toBe('2024-01')
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
      expect(JSON.parse(init.body)).toEqual({
        '0': { path: '/file.ts', content: 'content', etag: 'old-etag' },
      })
    })

    it('cancelSubscriptionAtInstance posts with instanceId', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await cancelSubscriptionAtInstance('tok', 'inst1')
      const init = fetchMock.mock.calls[0]![1] as { body: string }
      expect(JSON.parse(init.body)).toEqual({ '0': { instanceId: 'inst1' } })
    })
  })
})
