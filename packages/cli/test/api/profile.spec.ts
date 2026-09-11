import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FREE_MODEL, DEFAULT_MODEL, KILO_API_BASE } from '../../src/api/constants.ts'
import {
  defaultOrganizationId,
  fetchBalance,
  fetchDefaultModel,
  fetchProfile,
  fetchProfileWithBalance,
} from '../../src/api/profile.ts'

interface MockResponse {
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  text: () => Promise<string>
  json: () => Promise<unknown>
}

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): MockResponse {
  const ok = init.ok ?? true
  const status = init.status ?? 200
  const parsed = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok,
    status,
    headers: { get: () => null },
    text: () => Promise.resolve(parsed),
    json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
  }
}

describe('fetchProfile', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns a parsed profile from GET /api/profile', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        user: { email: 'a@b.com', name: 'A' },
        organizations: [{ id: 'org-1', name: 'Org', role: 'owner' }],
        selectedOrganizationId: 'org-1',
        hasPersonalAccount: true,
      }),
    )
    const profile = await fetchProfile('tok')
    expect(profile.email).toBe('a@b.com')
    expect(profile.name).toBe('A')
    expect(profile.organizations).toEqual([{ id: 'org-1', name: 'Org', role: 'owner' }])
    expect(profile.selectedOrganizationId).toBe('org-1')
    expect(profile.hasPersonalAccount).toBe(true)

    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toBe(`${KILO_API_BASE}/api/profile`)
    const init = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> }
    expect(init.headers['Authorization']).toBe('Bearer tok')
  })

  it('supports top-level email/name when user is absent', async () => {
    fetchMock.mockResolvedValue(mockResponse({ email: 'x@y.com', name: 'X' }))
    const profile = await fetchProfile('tok')
    expect(profile.email).toBe('x@y.com')
    expect(profile.name).toBe('X')
  })

  it('throws on 401', async () => {
    fetchMock.mockResolvedValue(mockResponse({ message: 'no' }, { ok: false, status: 401 }))
    await expect(fetchProfile('tok')).rejects.toThrow()
  })

  it('throws on 403', async () => {
    fetchMock.mockResolvedValue(mockResponse({ message: 'no' }, { ok: false, status: 403 }))
    await expect(fetchProfile('tok')).rejects.toThrow()
  })

  it('uses baseUrl override', async () => {
    fetchMock.mockResolvedValue(mockResponse({ email: 'a@b.com' }))
    await fetchProfile('tok', 'https://custom.example.com')
    expect(fetchMock.mock.calls[0]![0]).toBe('https://custom.example.com/api/profile')
  })
})

describe('fetchBalance', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns balance from GET /api/profile/balance', async () => {
    fetchMock.mockResolvedValue(mockResponse({ balance: 12.5 }))
    const balance = await fetchBalance('tok')
    expect(balance).toEqual({ balance: 12.5 })
  })

  it('defaults balance to 0 when missing', async () => {
    fetchMock.mockResolvedValue(mockResponse({}))
    const balance = await fetchBalance('tok')
    expect(balance).toEqual({ balance: 0 })
  })

  it('passes organizationId as a header', async () => {
    fetchMock.mockResolvedValue(mockResponse({ balance: 1 }))
    await fetchBalance('tok', 'org-9')
    const init = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> }
    expect(init.headers['X-KILOCODE-ORGANIZATIONID']).toBe('org-9')
  })

  it('returns null on error', async () => {
    fetchMock.mockResolvedValue(mockResponse({ message: 'no' }, { ok: false, status: 500 }))
    const balance = await fetchBalance('tok')
    expect(balance).toBeNull()
  })
})

describe('fetchProfileWithBalance', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('fetches profile and balance in parallel', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ email: 'a@b.com' }))
      .mockResolvedValueOnce(mockResponse({ balance: 5 }))
    const result = await fetchProfileWithBalance('tok')
    expect(result.profile.email).toBe('a@b.com')
    expect(result.balance).toEqual({ balance: 5 })
  })
})

describe('fetchDefaultModel', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns defaultModel for authenticated users', async () => {
    fetchMock.mockResolvedValue(mockResponse({ defaultModel: 'kilo-auto/x' }))
    const model = await fetchDefaultModel('tok')
    expect(model).toBe('kilo-auto/x')
  })

  it('falls back to DEFAULT_MODEL when defaultModel missing (authenticated)', async () => {
    fetchMock.mockResolvedValue(mockResponse({}))
    const model = await fetchDefaultModel('tok')
    expect(model).toBe(DEFAULT_MODEL)
  })

  it('returns defaultFreeModel for anonymous users', async () => {
    fetchMock.mockResolvedValue(mockResponse({ defaultFreeModel: 'kilo-auto/free-x' }))
    const model = await fetchDefaultModel()
    expect(model).toBe('kilo-auto/free-x')
  })

  it('falls back to DEFAULT_FREE_MODEL when defaultFreeModel missing (anonymous)', async () => {
    fetchMock.mockResolvedValue(mockResponse({}))
    const model = await fetchDefaultModel()
    expect(model).toBe(DEFAULT_FREE_MODEL)
  })

  it('uses organization-scoped defaults endpoint when orgId provided', async () => {
    fetchMock.mockResolvedValue(mockResponse({ defaultModel: 'kilo-auto/org' }))
    const model = await fetchDefaultModel('tok', 'org-1')
    expect(model).toBe('kilo-auto/org')
    expect(fetchMock.mock.calls[0]![0]).toBe(`${KILO_API_BASE}/api/organizations/org-1/defaults`)
  })

  it('returns default on error', async () => {
    fetchMock.mockResolvedValue(mockResponse({}, { ok: false, status: 500 }))
    const model = await fetchDefaultModel('tok')
    expect(model).toBe(DEFAULT_MODEL)
  })
})

describe('defaultOrganizationId', () => {
  it('returns selectedOrganizationId when valid', () => {
    const id = defaultOrganizationId({
      email: 'a@b.com',
      selectedOrganizationId: 'org-1',
      organizations: [{ id: 'org-1', name: 'Org', role: 'owner' }],
    })
    expect(id).toBe('org-1')
  })

  it('returns undefined when selectedOrganizationId not in orgs', () => {
    const id = defaultOrganizationId({
      email: 'a@b.com',
      selectedOrganizationId: 'missing',
      organizations: [{ id: 'org-1', name: 'Org', role: 'owner' }],
    })
    expect(id).toBeUndefined()
  })

  it('returns first org id when hasPersonalAccount is false', () => {
    const id = defaultOrganizationId({
      email: 'a@b.com',
      hasPersonalAccount: false,
      organizations: [
        { id: 'org-1', name: 'Org', role: 'owner' },
        { id: 'org-2', name: 'Org2', role: 'member' },
      ],
    })
    expect(id).toBe('org-1')
  })

  it('returns undefined when no organizations and no personal account', () => {
    const id = defaultOrganizationId({ email: 'a@b.com', hasPersonalAccount: false })
    expect(id).toBeUndefined()
  })

  it('returns undefined when hasPersonalAccount is true and no selected', () => {
    const id = defaultOrganizationId({
      email: 'a@b.com',
      hasPersonalAccount: true,
      organizations: [{ id: 'org-1', name: 'Org', role: 'owner' }],
    })
    expect(id).toBeUndefined()
  })
})
