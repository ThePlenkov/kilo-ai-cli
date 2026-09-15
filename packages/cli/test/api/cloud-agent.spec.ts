import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  closeTerminal,
  createTerminal,
  getCloudAgentSession,
  interruptSession,
  listGitHubRepositories,
  listGitLabRepositories,
  prepareSession,
  refreshTerminalTicket,
  resizeTerminal,
  sendMessage,
} from '../../src/api/cloud-agent.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('cloud-agent API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('getCloudAgentSession calls cloudAgentNext.getSession', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        sessionId: 's1',
        status: 'active',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      }),
    )
    const result = await getCloudAgentSession('tok', 's1')
    expect(result.sessionId).toBe('s1')
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('cloudAgentNext.getSession')
  })

  it('listGitHubRepositories unwraps { repositories } and passes forceRefresh', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        repositories: [{ id: 1314103791, name: 'repo', fullName: 'user/repo', private: false }],
      }),
    )
    const result = await listGitHubRepositories('tok', true)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(1314103791)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('cloudAgentNext.listGitHubRepositories')
    expect(decodeURIComponent(url.split('input=')[1]!)).toContain('true')
  })

  it('listGitLabRepositories calls cloudAgentNext.listGitLabRepositories', async () => {
    fetchMock.mockResolvedValue(mockResponse({ repositories: [] }))
    await listGitLabRepositories('tok')
    expect(fetchMock.mock.calls[0]![0]).toContain('cloudAgentNext.listGitLabRepositories')
  })

  it('prepareSession posts to cloudAgentNext.prepareSession', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ preparedSessionId: 'p1' }))
    const result = await prepareSession('tok', { gitUrl: 'https://github.com/repo' })
    expect(result.preparedSessionId).toBe('p1')
    expect(fetchMock.mock.calls[0]![0]).toContain('cloudAgentNext.prepareSession')
  })

  it('sendMessage posts to cloudAgentNext.sendMessage', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ messageId: 'm1' }))
    const result = await sendMessage('tok', { sessionId: 's1', text: 'hello' })
    expect(result.messageId).toBe('m1')
  })

  it('createTerminal returns terminalId and ticket', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ terminalId: 't1', ticket: 'ticket123' }))
    const result = await createTerminal('tok', { sessionId: 's1' })
    expect(result.terminalId).toBe('t1')
    expect(result.ticket).toBe('ticket123')
  })

  it('refreshTerminalTicket returns new ticket', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ terminalId: 't1', ticket: 'new-ticket' }))
    const result = await refreshTerminalTicket('tok', { terminalId: 't1' })
    expect(result.ticket).toBe('new-ticket')
  })

  it('resizeTerminal posts to cloudAgentNext.resizeTerminal', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse(null))
    await resizeTerminal('tok', { terminalId: 't1', cols: 80, rows: 24 })
    expect(fetchMock.mock.calls[0]![0]).toContain('cloudAgentNext.resizeTerminal')
  })

  it('closeTerminal posts to cloudAgentNext.closeTerminal', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse(null))
    await closeTerminal('tok', { terminalId: 't1' })
    expect(fetchMock.mock.calls[0]![0]).toContain('cloudAgentNext.closeTerminal')
  })

  it('interruptSession posts to cloudAgentNext.interruptSession', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse(null))
    await interruptSession('tok', { sessionId: 's1' })
    expect(fetchMock.mock.calls[0]![0]).toContain('cloudAgentNext.interruptSession')
  })
})
