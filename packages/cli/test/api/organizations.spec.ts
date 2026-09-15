import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createOrganization,
  getCreditTransactions,
  getOrganizationInvoices,
  getOrganizationSeats,
  getOrganizationUsageStats,
  getOrganizationWithMembers,
  getSecurityAgentPermissionStatus,
  listAvailableModels,
  listChildOrganizations,
  listOrganizations,
  updateOrganization,
} from '../../src/api/organizations.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('organizations API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('listOrganizations calls organizations.list', async () => {
    fetchMock.mockResolvedValue(mockResponse([{ id: 'o1', name: 'Org', role: 'owner' }]))
    const result = await listOrganizations('tok')
    expect(result).toHaveLength(1)
    expect(fetchMock.mock.calls[0]![0]).toContain('organizations.list')
  })

  it('getOrganizationWithMembers passes organizationId', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        id: 'o1',
        name: 'Org',
        role: 'owner',
        members: [{ id: 'm1', email: 'user@test.com', role: 'admin' }],
      }),
    )
    const result = await getOrganizationWithMembers('tok', 'o1')
    expect(result.members).toHaveLength(1)
  })

  it('listChildOrganizations passes organizationId', async () => {
    fetchMock.mockResolvedValue(mockResponse([]))
    await listChildOrganizations('tok', 'o1')
    expect(
      decodeURIComponent((fetchMock.mock.calls[0]![0] as string).split('input=')[1]!),
    ).toContain('o1')
  })

  it('getOrganizationUsageStats returns stats', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        totalCreditsUsed: 100,
        creditsUsedThisPeriod: 50,
        activeSessions: 3,
        totalMembers: 5,
      }),
    )
    const result = await getOrganizationUsageStats('tok', 'o1')
    expect(result.totalCreditsUsed).toBe(100)
  })

  it('getCreditTransactions returns transactions', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([
        { id: 't1', amount: 10, type: 'credit', description: 'test', createdAt: '2024-01-01' },
      ]),
    )
    const result = await getCreditTransactions('tok', 'o1')
    expect(result).toHaveLength(1)
  })

  it('getOrganizationSeats returns seats', async () => {
    fetchMock.mockResolvedValue(mockResponse({ total: 10, used: 5 }))
    const result = await getOrganizationSeats('tok', 'o1')
    expect(result.total).toBe(10)
    expect(result.used).toBe(5)
  })

  it('getOrganizationInvoices passes period', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ id: 'i1', date: '2024-01-01', amount: 100, status: 'paid' }]),
    )
    const result = await getOrganizationInvoices('tok', 'o1', '2024-01')
    expect(result).toHaveLength(1)
  })

  it('createOrganization posts with name and domain', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ id: 'o1', name: 'New Org', role: 'owner' }))
    const result = await createOrganization('tok', {
      name: 'New Org',
      companyDomain: 'example.com',
    })
    expect(result.id).toBe('o1')
    const init = fetchMock.mock.calls[0]![1] as { body: string }
    expect(JSON.parse(init.body)).toEqual({
      '0': { name: 'New Org', companyDomain: 'example.com' },
    })
  })

  it('updateOrganization posts with organizationId and name', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ id: 'o1', name: 'Updated', role: 'owner' }))
    const result = await updateOrganization('tok', { organizationId: 'o1', name: 'Updated' })
    expect(result.name).toBe('Updated')
  })

  it('listAvailableModels calls organizations.settings.listAvailableModels', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ id: 'm1', name: 'gpt-4', provider: 'openai', isEnabled: true }]),
    )
    const result = await listAvailableModels('tok', 'o1')
    expect(result).toHaveLength(1)
    expect(fetchMock.mock.calls[0]![0]).toContain('organizations.settings.listAvailableModels')
  })

  it('getSecurityAgentPermissionStatus calls organizations.securityAgent.getPermissionStatus', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ granted: true, permissions: ['read'], pendingRequests: 0 }),
    )
    const result = await getSecurityAgentPermissionStatus('tok', 'o1')
    expect(result.granted).toBe(true)
    expect(fetchMock.mock.calls[0]![0]).toContain('organizations.securityAgent.getPermissionStatus')
  })
})
