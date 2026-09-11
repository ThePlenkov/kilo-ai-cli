import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { KiloAuth } from '../../src/api/types.ts'

// --- Mocks for modules created in parallel ---

const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
}

vi.mock('../../src/auth/token-store.ts', () => ({
  createTokenStore: () => mockStore,
}))

const mockAuthenticateWithDeviceAuth = vi.fn()

vi.mock('../../src/auth/device-auth.ts', () => ({
  initiateDeviceAuth: vi.fn(),
  pollDeviceAuth: vi.fn(),
  authenticateWithDeviceAuth: mockAuthenticateWithDeviceAuth,
}))

const mockFetchProfile = vi.fn()

vi.mock('../../src/api/profile.ts', () => ({
  fetchProfile: mockFetchProfile,
  fetchBalance: vi.fn(),
  fetchProfileWithBalance: vi.fn(),
  fetchDefaultModel: vi.fn(),
  defaultOrganizationId: vi.fn(),
}))

// --- Import after mocks ---
const { loginCommand, logoutCommand, statusCommand } = await import('../../src/commands/auth.ts')

describe('loginCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('authenticates, stores auth, and prints success with email', async () => {
    const auth: KiloAuth = {
      type: 'oauth',
      access: 'access-token',
      refresh: 'refresh-token',
      expires: 999,
      accountId: 'org-1',
    }
    mockAuthenticateWithDeviceAuth.mockResolvedValue({
      token: 'access-token',
      userEmail: 'user@example.com',
      auth,
    })

    await loginCommand.run!({ rawArgs: [], args: { _: [] }, cmd: loginCommand })

    expect(mockAuthenticateWithDeviceAuth).toHaveBeenCalled()
    expect(mockStore.set).toHaveBeenCalledWith(auth)
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('user@example.com'),
    )
  })
})

describe('logoutCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('clears the token store and prints success', async () => {
    await logoutCommand.run!({ rawArgs: [], args: { _: [] }, cmd: logoutCommand })

    expect(mockStore.clear).toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('logged out'))
  })
})

describe('statusCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('prints "Not authenticated" when no token is stored', async () => {
    mockStore.get.mockResolvedValue(undefined)

    await statusCommand.run!({ rawArgs: [], args: { _: [] }, cmd: statusCommand })

    expect(mockFetchProfile).not.toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'))
  })

  it('fetches profile and prints email + org info when authenticated', async () => {
    const auth: KiloAuth = {
      type: 'oauth',
      access: 'access-token',
      refresh: 'refresh-token',
      expires: 999,
      accountId: 'org-1',
    }
    mockStore.get.mockResolvedValue(auth)
    mockFetchProfile.mockResolvedValue({
      email: 'user@example.com',
      name: 'User Name',
      organizations: [{ id: 'org-1', name: 'My Org', role: 'owner' }],
      selectedOrganizationId: 'org-1',
    })

    await statusCommand.run!({ rawArgs: [], args: { _: [] }, cmd: statusCommand })

    expect(mockFetchProfile).toHaveBeenCalledWith('access-token')
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('user@example.com'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('My Org'))
  })
})
