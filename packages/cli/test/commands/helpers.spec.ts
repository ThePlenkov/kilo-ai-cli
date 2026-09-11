import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { KiloAuth } from '../../src/api/types.ts'
import { UnauthorizedError } from '../../src/api/types.ts'

// Mock the token store module (created in parallel by another subagent)
const mockStore = {
  get: vi.fn<() => Promise<KiloAuth | undefined>>(),
  set: vi.fn<(auth: KiloAuth) => Promise<void>>(),
  clear: vi.fn<() => Promise<void>>(),
}

vi.mock('../../src/auth/token-store.ts', () => ({
  createTokenStore: () => mockStore,
}))

const { getToken } = await import('../../src/commands/helpers.ts')

describe('getToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws UnauthorizedError when no auth is stored', async () => {
    mockStore.get.mockResolvedValue(undefined)
    await expect(getToken()).rejects.toThrow(UnauthorizedError)
    await expect(getToken()).rejects.toThrow(/Not authenticated/)
  })

  it('returns the api key as token for api auth', async () => {
    const auth: KiloAuth = { type: 'api', key: 'api-key-123' }
    mockStore.get.mockResolvedValue(auth)
    const result = await getToken()
    expect(result).toEqual({ token: 'api-key-123', auth, organizationId: undefined })
  })

  it('returns the access token and accountId for oauth auth', async () => {
    const auth: KiloAuth = {
      type: 'oauth',
      access: 'access-token',
      refresh: 'refresh-token',
      expires: 123,
      accountId: 'org-1',
    }
    mockStore.get.mockResolvedValue(auth)
    const result = await getToken()
    expect(result).toEqual({ token: 'access-token', auth, organizationId: 'org-1' })
  })

  it('returns undefined organizationId for oauth auth without accountId', async () => {
    const auth: KiloAuth = {
      type: 'oauth',
      access: 'access-token',
      refresh: 'refresh-token',
      expires: 123,
    }
    mockStore.get.mockResolvedValue(auth)
    const result = await getToken()
    expect(result.token).toBe('access-token')
    expect(result.organizationId).toBeUndefined()
  })

  it('returns the token field for wellknown auth', async () => {
    const auth: KiloAuth = { type: 'wellknown', key: 'wk-key', token: 'wk-token' }
    mockStore.get.mockResolvedValue(auth)
    const result = await getToken()
    expect(result).toEqual({ token: 'wk-token', auth, organizationId: undefined })
  })
})
