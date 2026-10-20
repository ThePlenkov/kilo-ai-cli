import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteSession,
  getSessionDiff,
  getSessionMessages,
  listActiveSessions,
  listRecentRepositories,
  listUnifiedSessions,
  searchUnifiedSessions,
  shareSession,
} from '../../src/api/sessions.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('sessions API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('listUnifiedSessions calls unifiedSessions.list', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        cliSessions: [
          {
            session_id: 's1',
            title: 'One',
            created_at: '2026-10-20 10:00:00+00',
            updated_at: '2026-10-20 11:00:00+00',
            source: 'v2',
          },
        ],
        nextCursor: null,
      }),
    )

    const result = await listUnifiedSessions('tok', { limit: 5 })
    expect(result.cliSessions[0]!.session_id).toBe('s1')
    expect(fetchMock.mock.calls[0]![0]).toContain('unifiedSessions.list')
  })

  it('listUnifiedSessions forwards updatedSince for delta reads', async () => {
    fetchMock.mockResolvedValue(mockResponse({ cliSessions: [], nextCursor: null }))

    await listUnifiedSessions('tok', { updatedSince: '2026-10-20T10:00:00.000Z' })
    const url = decodeURIComponent(fetchMock.mock.calls[0]![0] as string)
    expect(url).toContain('"updatedSince":"2026-10-20T10:00:00.000Z"')
  })

  it('searchUnifiedSessions sends the search string', async () => {
    fetchMock.mockResolvedValue(mockResponse({ cliSessions: [], nextCursor: null }))

    await searchUnifiedSessions('tok', 'deploy')
    const url = decodeURIComponent(fetchMock.mock.calls[0]![0] as string)
    expect(url).toContain('"search_string":"deploy"')
    expect(fetchMock.mock.calls[0]![0]).toContain('unifiedSessions.search')
  })

  it('listRecentRepositories unwraps the repositories array', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        repositories: [{ gitUrl: 'https://github.com/o/r', lastUsedAt: '2026-10-20 10:00:00+00' }],
      }),
    )

    const repos = await listRecentRepositories('tok', '2026-01-01T00:00:00Z')
    expect(repos[0]!.gitUrl).toBe('https://github.com/o/r')
    expect(fetchMock.mock.calls[0]![0]).toContain('unifiedSessions.recentRepositories')
  })

  it('listActiveSessions unwraps the sessions array', async () => {
    fetchMock.mockResolvedValue(mockResponse({ sessions: [{ sessionId: 's1', name: 'live' }] }))

    const sessions = await listActiveSessions('tok')
    expect(sessions[0]!.name).toBe('live')
    expect(fetchMock.mock.calls[0]![0]).toContain('activeSessions.list')
  })

  it('getSessionDiff returns the changed files', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        kind: 'files',
        files: [{ file: 'src/a.ts', additions: 3, deletions: 1, status: 'modified' }],
      }),
    )

    const diff = await getSessionDiff('tok', 's1')
    expect(diff.kind).toBe('files')
    expect(diff.files?.[0]?.file).toBe('src/a.ts')
  })

  it('getSessionMessages unwraps the transcript', async () => {
    fetchMock.mockResolvedValue(mockResponse({ info: {}, messages: [{ role: 'user' }] }))

    const { messages } = await getSessionMessages('tok', 's1')
    expect(messages).toHaveLength(1)
  })

  it('shareSession posts to cliSessionsV2.share', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({}))

    await shareSession('tok', 's1')
    expect(fetchMock.mock.calls[0]![0]).toContain('cliSessionsV2.share')
  })

  it('deleteSession posts to cliSessionsV2.delete', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({}))

    await deleteSession('tok', 's1')
    expect(fetchMock.mock.calls[0]![0]).toContain('cliSessionsV2.delete')
  })
})
