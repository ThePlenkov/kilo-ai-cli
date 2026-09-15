import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DeviceAuthInitiateResponse,
  DeviceAuthPollResponse,
  KiloAuth,
} from '../../src/api/types.ts'

// `global.fetch` is mocked per-test via `vi.stubGlobal('fetch', ...)`.
const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Build a minimal Response-like object for the mock. */
function jsonResponse(status: number, body: unknown): Response {
  const json = JSON.stringify(body)
  return new Response(json, {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('initiateDeviceAuth', () => {
  it('sends a POST and returns the parsed response', async () => {
    const { initiateDeviceAuth } = await import('../../src/auth/device-auth.ts')

    const payload: DeviceAuthInitiateResponse = {
      code: 'ABC123',
      verificationUrl: 'https://kilo.ai/device?code=ABC123',
      expiresIn: 900,
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(200, payload))

    const result = await initiateDeviceAuth('https://api.test')

    expect(result).toEqual(payload)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.test/api/device-auth/codes')
    expect(init?.method).toBe('POST')
    const headers = new Headers(init?.headers as Record<string, string> | undefined)
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('defaults the base URL to KILO_API_BASE', async () => {
    const { initiateDeviceAuth } = await import('../../src/auth/device-auth.ts')
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { code: 'X', verificationUrl: 'https://kilo.ai', expiresIn: 60 }),
    )

    await initiateDeviceAuth()

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.kilo.ai/api/device-auth/codes')
  })
})

describe('pollDeviceAuth', () => {
  it('returns pending on 202', async () => {
    const { pollDeviceAuth } = await import('../../src/auth/device-auth.ts')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }))

    const result = await pollDeviceAuth('CODE', 'https://api.test')

    expect(result).toEqual({ status: 'pending' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.test/api/device-auth/codes/CODE')
    expect(init?.method ?? 'GET').toBe('GET')
  })

  it('returns denied on 403', async () => {
    const { pollDeviceAuth } = await import('../../src/auth/device-auth.ts')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))

    const result = await pollDeviceAuth('CODE', 'https://api.test')
    expect(result).toEqual({ status: 'denied' })
  })

  it('returns expired on 410', async () => {
    const { pollDeviceAuth } = await import('../../src/auth/device-auth.ts')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 410 }))

    const result = await pollDeviceAuth('CODE', 'https://api.test')
    expect(result).toEqual({ status: 'expired' })
  })

  it('parses the JSON body on 200', async () => {
    const { pollDeviceAuth } = await import('../../src/auth/device-auth.ts')
    const body: DeviceAuthPollResponse = {
      status: 'approved',
      token: 'tok-123',
      userEmail: 'user@example.com',
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(200, body))

    const result = await pollDeviceAuth('CODE', 'https://api.test')
    expect(result).toEqual(body)
  })
})

describe('authenticateWithDeviceAuth', () => {
  it('polls and returns on approved', async () => {
    vi.useFakeTimers()
    const { authenticateWithDeviceAuth } = await import('../../src/auth/device-auth.ts')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const initiate: DeviceAuthInitiateResponse = {
      code: 'ABC',
      verificationUrl: 'https://kilo.ai/device?code=ABC',
      expiresIn: 900,
    }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, initiate)) // initiate POST
      .mockResolvedValueOnce(new Response(null, { status: 202 })) // first poll: pending
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'approved', token: 'tok-1', userEmail: 'a@b.com' }),
      ) // second poll: approved

    const pending = authenticateWithDeviceAuth('https://api.test')
    // Advance past the polling interval twice.
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(3000)

    const result = await pending

    expect(result.token).toBe('tok-1')
    expect(result.userEmail).toBe('a@b.com')
    expect(result.auth).toEqual<KiloAuth>({
      type: 'oauth',
      access: 'tok-1',
      refresh: '',
      expires: expect.any(Number),
    })
    expect(result.auth.type === 'oauth' && result.auth.expires).toBeGreaterThan(0)
    // Verification URL should have been logged.
    expect(logSpy).toHaveBeenCalled()
  })

  it('throws on denied', async () => {
    vi.useFakeTimers()
    const { authenticateWithDeviceAuth } = await import('../../src/auth/device-auth.ts')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { code: 'ABC', verificationUrl: 'https://kilo.ai', expiresIn: 900 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 403 }))

    const pending = authenticateWithDeviceAuth('https://api.test')
    // Attach the rejection handler before advancing timers so the rejection
    // raised inside the polling loop is not reported as unhandled.
    const assertion = expect(pending).rejects.toThrow('Authorization denied by user')
    await vi.advanceTimersByTimeAsync(3000)
    await assertion
  })

  it('throws on expired', async () => {
    vi.useFakeTimers()
    const { authenticateWithDeviceAuth } = await import('../../src/auth/device-auth.ts')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { code: 'ABC', verificationUrl: 'https://kilo.ai', expiresIn: 900 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 410 }))

    const pending = authenticateWithDeviceAuth('https://api.test')
    const assertion = expect(pending).rejects.toThrow('Authorization code expired')
    await vi.advanceTimersByTimeAsync(3000)
    await assertion
  })
})
