import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureConsole, memoryStore, runCommand } from './helpers.ts'

const store = memoryStore()

/** Pages the mocked findings endpoint returns, keyed by offset. */
let pages: Record<string, unknown[]> = {}
/** Number of pages the endpoint keeps filling with a full page. */
let fillPages = 0

vi.mock('../../src/state/cursor-store.ts', () => ({
  createCursorStore: () => store,
}))

vi.mock('../../src/commands/helpers.ts', () => ({
  getToken: async () => ({ token: 'tok', organizationId: undefined }),
}))

vi.mock('../../src/api/security-agent.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/security-agent.ts')>()
  return {
    ...actual,
    listFindings: async (_token: string, input: { offset?: number; limit?: number }) => {
      const offset = input.offset ?? 0
      const limit = input.limit ?? 50
      let findings = pages[String(offset)]
      if (!findings) {
        // Keep the window going until the walk's page budget runs out.
        findings =
          offset / limit < fillPages
            ? Array.from({ length: limit }, (_, i) =>
                finding(`f${offset + i}`, '2026-10-20T10:00:00.000Z'),
              )
            : []
      }
      return { findings, totalCount: 1000, runningCount: 0, concurrencyLimit: 3 }
    },
  }
})

const finding = (id: string, updated: string): Record<string, unknown> => ({
  id,
  title: id,
  severity: 'high',
  repoFullName: 'owner/repo',
  status: 'open',
  updated_at: updated,
})

describe('security findings delta walk', () => {
  beforeEach(() => {
    vi.resetModules()
    pages = {}
    fillPages = 0
    delete store.entries['security-findings']
  })

  it('advances the cursor after reading the whole window', async () => {
    // The first page is full (limit 50), the second closes the window.
    pages['0'] = Array.from({ length: 50 }, (_, i) => finding(`f${i}`, '2026-10-20T10:00:00.000Z'))
    pages['50'] = [finding('f50', '2026-10-20T11:00:00.000Z')]

    const { securityFindingsListCommand } = await import('../../src/commands/security-agent.ts')
    const capture = captureConsole()
    await runCommand(securityFindingsListCommand, {
      new: true,
      limit: '50',
      columns: 'severity',
    })
    capture.restore()

    expect(store.entries['security-findings']?.value).toBe('2026-10-20T11:00:00.000Z')
  })

  it('does not advance the cursor when the window could not be read completely', async () => {
    // Every page is full: the walk never reaches the end of the window.
    fillPages = 100

    const { securityFindingsListCommand } = await import('../../src/commands/security-agent.ts')
    const capture = captureConsole()
    await runCommand(securityFindingsListCommand, {
      new: true,
      limit: '50',
      columns: 'severity',
    })
    capture.restore()

    // The cursor must not have moved past the unseen pages.
    expect(store.entries['security-findings']).toBeUndefined()
  })
})
