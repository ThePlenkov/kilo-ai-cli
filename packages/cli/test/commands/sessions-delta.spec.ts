import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureConsole, memoryStore, runCommand } from './helpers.ts'

const store = memoryStore()

/** Pages the mocked unified-sessions endpoint returns, keyed by cursor. */
let pages: Record<string, { cliSessions: unknown[]; nextCursor?: string | null }> = {}
let firstPage: { cliSessions: unknown[]; nextCursor?: string | null } = {
  cliSessions: [],
  nextCursor: null,
}
let pageRequests: string[] = []

vi.mock('../../src/state/cursor-store.ts', () => ({
  createCursorStore: () => store,
}))

vi.mock('../../src/commands/helpers.ts', () => ({
  getToken: async () => ({ token: 'tok', organizationId: undefined }),
}))

vi.mock('../../src/api/sessions.ts', () => ({
  listUnifiedSessions: async (_token: string, options: { cursor?: string }) => {
    pageRequests.push(options.cursor ?? '')
    if (!options.cursor) return firstPage
    return pages[options.cursor] ?? { cliSessions: [], nextCursor: null }
  },
  listActiveSessions: async () => [],
  listRecentRepositories: async () => [],
  searchUnifiedSessions: async () => ({ cliSessions: [] }),
  getSessionDiff: async () => ({ kind: 'files', files: [] }),
  getSessionMessages: async () => ({ messages: [] }),
  getWorktreeDetails: async () => ({}),
  shareSession: async () => undefined,
  unshareSession: async () => undefined,
  deleteSession: async () => undefined,
}))

const session = (id: string, updated: string): Record<string, unknown> => ({
  session_id: id,
  title: id,
  created_at: updated,
  updated_at: updated,
})

describe('sessions unified delta walk', () => {
  beforeEach(() => {
    vi.resetModules()
    pages = {}
    pageRequests = []
    firstPage = { cliSessions: [], nextCursor: null }
    delete store.entries.sessions
  })

  it('advances the cursor after reading the whole window', async () => {
    firstPage = {
      cliSessions: [session('a', '2026-10-20T10:00:00.000Z')],
      nextCursor: 'p2',
    }
    pages = {
      p2: { cliSessions: [session('b', '2026-10-20T11:00:00.000Z')], nextCursor: null },
    }

    const { sessionsUnifiedCommand } = await import('../../src/commands/sessions.ts')
    const capture = captureConsole()
    await runCommand(sessionsUnifiedCommand, {
      new: true,
      limit: '20',
      since: '2026-01-01T00:00:00.000Z',
    })
    capture.restore()

    // Both pages were read and the cursor moved to the newest item.
    expect(pageRequests).toEqual(['', 'p2'])
    expect(store.entries.sessions?.value).toBe('2026-10-20T11:00:00.000Z')
  })

  it('does not advance the cursor when the window could not be read completely', async () => {
    // Every page is full and there is always another one: the budget runs out.
    firstPage = {
      cliSessions: [session('a', '2026-10-20T10:00:00.000Z')],
      nextCursor: 'p2',
    }
    // Every following page is full and points at another one, so the page
    // budget of the walk runs out.
    pages = {
      p2: { cliSessions: [session('b', '2026-10-20T11:00:00.000Z')], nextCursor: 'p3' },
      p3: { cliSessions: [session('c', '2026-10-20T12:00:00.000Z')], nextCursor: 'p3' },
    }

    const { sessionsUnifiedCommand } = await import('../../src/commands/sessions.ts')
    const capture = captureConsole()
    await runCommand(sessionsUnifiedCommand, {
      new: true,
      limit: '20',
      since: '2026-01-01T00:00:00.000Z',
    })
    capture.restore()

    // The cursor must not have moved past the unseen pages.
    expect(store.entries.sessions).toBeUndefined()
  })

  it('establishes the watermark from the first page when there is no bound yet', async () => {
    firstPage = {
      cliSessions: [session('a', '2026-10-20T10:00:00.000Z')],
      nextCursor: 'p2',
    }
    pages = { p2: { cliSessions: [session('b', '2026-10-20T11:00:00.000Z')], nextCursor: null } }

    const { sessionsUnifiedCommand } = await import('../../src/commands/sessions.ts')
    const capture = captureConsole()
    await runCommand(sessionsUnifiedCommand, { new: true, limit: '20' })
    capture.restore()

    // No bound yet: the first page is ordered by updated_at, so it holds the
    // newest item and the watermark is set from it. The older pages are not
    // part of any later delta.
    expect(pageRequests).toEqual([''])
    expect(store.entries.sessions?.value).toBe('2026-10-20T10:00:00.000Z')
  })
})
