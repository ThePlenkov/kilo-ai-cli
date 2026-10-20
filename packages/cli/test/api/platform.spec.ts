import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getContextBalance, listDeviceSessions } from '../../src/api/account.ts'
import { listBriefings, markBriefingRead } from '../../src/api/briefing.ts'
import { listIntegrationStatus } from '../../src/api/integrations.ts'
import { bindProfileToRepo, listAgentProfiles, setProfileVariable } from '../../src/api/profiles.ts'
import { listReviewMemoryProposals } from '../../src/api/review-memory.ts'
import { listWebhookTriggers } from '../../src/api/webhooks.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('platform APIs', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('listIntegrationStatus calls platformIntegrations.listSetupStatus', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ platform: 'github', installed: true, installation: { accountLogin: 'me' } }]),
    )

    const statuses = await listIntegrationStatus('tok')
    expect(statuses[0]!.platform).toBe('github')
    expect(fetchMock.mock.calls[0]![0]).toContain('platformIntegrations.listSetupStatus')
  })

  it('listWebhookTriggers calls webhookTriggers.list', async () => {
    fetchMock.mockResolvedValue(mockResponse([]))

    await listWebhookTriggers('tok')
    expect(fetchMock.mock.calls[0]![0]).toContain('webhookTriggers.list')
  })

  it('listAgentProfiles calls agentProfiles.list', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ id: 'p1', name: 'default', isDefault: true, varCount: 2 }]),
    )

    const profiles = await listAgentProfiles('tok')
    expect(profiles[0]!.varCount).toBe(2)
    expect(fetchMock.mock.calls[0]![0]).toContain('agentProfiles.list')
  })

  it('setProfileVariable posts the variable payload', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ success: true }))

    await setProfileVariable('tok', 'p1', { key: 'TOKEN', value: 'x', isSecret: true })
    const body = JSON.parse((fetchMock.mock.calls[0]![1]?.body as string) ?? '{}')
    expect(body['0']).toMatchObject({ profileId: 'p1', key: 'TOKEN', isSecret: true })
  })

  it('bindProfileToRepo posts the repository binding', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ success: true }))

    await bindProfileToRepo('tok', 'p1', 'owner/repo')
    const body = JSON.parse((fetchMock.mock.calls[0]![1]?.body as string) ?? '{}')
    expect(body['0']).toMatchObject({
      profileId: 'p1',
      repoFullName: 'owner/repo',
      platform: 'github',
    })
  })

  it('listBriefings unwraps the reports envelope', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ reports: [{ id: 'b1', localDate: '2026-10-20' }], nextCursor: null }),
    )

    const { reports } = await listBriefings('tok')
    expect(reports[0]!.localDate).toBe('2026-10-20')
  })

  it('markBriefingRead posts the report id', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ id: 'b1' }))

    await markBriefingRead('tok', 'b1')
    const body = JSON.parse((fetchMock.mock.calls[0]![1]?.body as string) ?? '{}')
    expect(body['0'].reportId).toBe('b1')
  })

  it('listReviewMemoryProposals accepts a bare array', async () => {
    fetchMock.mockResolvedValue(mockResponse([{ id: 'prop1', status: 'open' }]))

    const proposals = await listReviewMemoryProposals('tok', { platform: 'github' })
    expect(proposals[0]!.id).toBe('prop1')
  })

  it('listReviewMemoryProposals accepts a wrapped envelope', async () => {
    fetchMock.mockResolvedValue(mockResponse({ proposals: [{ id: 'prop2', status: 'open' }] }))

    const proposals = await listReviewMemoryProposals('tok', { platform: 'github' })
    expect(proposals[0]!.id).toBe('prop2')
  })

  it('getContextBalance sends the organization scope', async () => {
    fetchMock.mockResolvedValue(mockResponse({ balance: 1.5, isDepleted: false }))

    const balance = await getContextBalance('tok', 'org-1')
    expect(balance.balance).toBe(1.5)
    const url = decodeURIComponent(fetchMock.mock.calls[0]![0] as string)
    expect(url).toContain('"organizationId":"org-1"')
  })

  it('listDeviceSessions calls user.listDeviceSessions', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ id: 'd1', user_agent: 'cli', last_seen_at: '2026-10-20T10:00:00Z' }]),
    )

    const devices = await listDeviceSessions('tok')
    expect(devices[0]!.user_agent).toBe('cli')
  })
})
