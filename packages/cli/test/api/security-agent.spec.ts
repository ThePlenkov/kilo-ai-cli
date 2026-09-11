import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cancelRemediation,
  deleteFindingsByRepository,
  dismissFinding,
  getDashboardStats,
  getFinding,
  getLastSyncTime,
  getOrphanedRepositories,
  getPermissionStatus,
  getSecurityConfig,
  getSecurityRepositories,
  getSecurityStats,
  listActiveCommands,
  listFindings,
  retryRemediation,
  setSecurityEnabled,
  startAnalysis,
  startRemediation,
  triggerSync,
} from '../../src/api/security-agent.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('security-agent API (personal level)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  describe('queries', () => {
    it('getPermissionStatus calls securityAgent.getPermissionStatus', async () => {
      fetchMock.mockResolvedValue(mockResponse({ granted: true, permissions: ['read', 'write'], pendingRequests: 0 }))
      const result = await getPermissionStatus('tok')
      expect(result.granted).toBe(true)
      expect(result.permissions).toEqual(['read', 'write'])
      expect(fetchMock.mock.calls[0]![0]).toContain('securityAgent.getPermissionStatus')
    })

    it('getSecurityConfig calls securityAgent.getConfig', async () => {
      fetchMock.mockResolvedValue(mockResponse({ isEnabled: true, repositories: ['repo1'] }))
      const result = await getSecurityConfig('tok')
      expect(result.isEnabled).toBe(true)
      expect(result.repositories).toEqual(['repo1'])
    })

    it('getSecurityRepositories calls securityAgent.getRepositories', async () => {
      fetchMock.mockResolvedValue(mockResponse([{ id: 'r1', name: 'repo', fullName: 'user/repo', url: 'https://github.com/user/repo', private: false }]))
      const result = await getSecurityRepositories('tok')
      expect(result).toHaveLength(1)
    })

    it('listFindings passes filters', async () => {
      fetchMock.mockResolvedValue(mockResponse([{ id: 'f1', repositoryId: 'r1', repositoryName: 'repo', severity: 'critical', title: 'SQL injection', description: 'bad', status: 'open', createdAt: '2024-01-01', updatedAt: '2024-01-02' }]))
      const result = await listFindings('tok', { severity: 'critical', limit: 10 })
      expect(result).toHaveLength(1)
      expect(result[0]!.severity).toBe('critical')
      const url = fetchMock.mock.calls[0]![0] as string
      expect(decodeURIComponent(url.split('input=')[1]!)).toContain('critical')
    })

    it('getFinding passes findingId', async () => {
      fetchMock.mockResolvedValue(mockResponse({ id: 'f1', repositoryId: 'r1', repositoryName: 'repo', severity: 'high', title: 'XSS', description: 'bad', status: 'open', createdAt: '2024-01-01', updatedAt: '2024-01-02' }))
      const result = await getFinding('tok', 'f1')
      expect(result.id).toBe('f1')
    })

    it('getSecurityStats calls securityAgent.getStats', async () => {
      fetchMock.mockResolvedValue(mockResponse({ totalFindings: 10, criticalFindings: 2, highFindings: 3, mediumFindings: 3, lowFindings: 2, openFindings: 5, remediatedFindings: 3, dismissedFindings: 2 }))
      const result = await getSecurityStats('tok')
      expect(result.totalFindings).toBe(10)
      expect(result.criticalFindings).toBe(2)
    })

    it('getDashboardStats passes date range', async () => {
      fetchMock.mockResolvedValue(mockResponse({ totalRepositories: 5, totalFindings: 20, findingsTrend: [], topRepositories: [{ name: 'repo', findings: 10 }] }))
      const result = await getDashboardStats('tok', { startDate: '2024-01-01' })
      expect(result.totalRepositories).toBe(5)
      const url = fetchMock.mock.calls[0]![0] as string
      expect(decodeURIComponent(url.split('input=')[1]!)).toContain('2024-01-01')
    })

    it('getLastSyncTime calls securityAgent.getLastSyncTime', async () => {
      fetchMock.mockResolvedValue(mockResponse({ lastSyncTime: '2024-01-01T00:00:00Z' }))
      const result = await getLastSyncTime('tok')
      expect(result.lastSyncTime).toBe('2024-01-01T00:00:00Z')
    })

    it('listActiveCommands calls securityAgent.listActiveCommands', async () => {
      fetchMock.mockResolvedValue(mockResponse([{ id: 'c1', type: 'remediation', status: 'running', repositoryId: 'r1', startedAt: '2024-01-01' }]))
      const result = await listActiveCommands('tok')
      expect(result).toHaveLength(1)
    })

    it('getOrphanedRepositories calls securityAgent.getOrphanedRepositories', async () => {
      fetchMock.mockResolvedValue(mockResponse([]))
      await getOrphanedRepositories('tok')
      expect(fetchMock.mock.calls[0]![0]).toContain('securityAgent.getOrphanedRepositories')
    })
  })

  describe('mutations', () => {
    it('setSecurityEnabled posts with isEnabled', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await setSecurityEnabled('tok', true)
      const init = fetchMock.mock.calls[0]![1] as { body: string }
      expect(JSON.parse(init.body)).toEqual({ '0': { isEnabled: true } })
    })

    it('triggerSync posts to securityAgent.triggerSync', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await triggerSync('tok', { repositoryId: 'r1' })
      const init = fetchMock.mock.calls[0]![1] as { body: string }
      expect(JSON.parse(init.body)).toEqual({ '0': { repositoryId: 'r1' } })
    })

    it('dismissFinding posts with findingId and reason', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await dismissFinding('tok', 'f1', 'false positive')
      const init = fetchMock.mock.calls[0]![1] as { body: string }
      expect(JSON.parse(init.body)).toEqual({ '0': { findingId: 'f1', reason: 'false positive' } })
    })

    it('startAnalysis returns analysisId', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse({ analysisId: 'a1' }))
      const result = await startAnalysis('tok', 'r1')
      expect(result.analysisId).toBe('a1')
    })

    it('startRemediation returns commandId', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse({ commandId: 'c1' }))
      const result = await startRemediation('tok', 'f1')
      expect(result.commandId).toBe('c1')
    })

    it('retryRemediation posts with commandId', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await retryRemediation('tok', 'c1')
      const init = fetchMock.mock.calls[0]![1] as { body: string }
      expect(JSON.parse(init.body)).toEqual({ '0': { commandId: 'c1' } })
    })

    it('cancelRemediation posts with commandId', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await cancelRemediation('tok', 'c1')
      const init = fetchMock.mock.calls[0]![1] as { body: string }
      expect(JSON.parse(init.body)).toEqual({ '0': { commandId: 'c1' } })
    })

    it('deleteFindingsByRepository posts with repositoryId', async () => {
      fetchMock.mockResolvedValue(mockMutationResponse(null))
      await deleteFindingsByRepository('tok', 'r1')
      const init = fetchMock.mock.calls[0]![1] as { body: string }
      expect(JSON.parse(init.body)).toEqual({ '0': { repositoryId: 'r1' } })
    })
  })
})
