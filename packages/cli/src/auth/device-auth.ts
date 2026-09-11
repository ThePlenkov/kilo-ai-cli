/**
 * Device authorization flow (OAuth 2.0 Device Authorization Grant) for kilo.ai.
 */

import type {
  DeviceAuthInitiateResponse,
  DeviceAuthPollResponse,
  KiloAuth,
} from '../api/types.ts'
import { KILO_API_BASE, POLL_INTERVAL_MS, TOKEN_EXPIRATION_MS } from '../api/constants.ts'

/** Result of a successful device auth flow. */
export interface DeviceAuthResult {
  token: string
  userEmail: string
  auth: KiloAuth
}

/**
 * Initiate device auth by calling POST /api/device-auth/codes.
 * Returns the code, verification URL and expiration time.
 */
export async function initiateDeviceAuth(
  baseUrl?: string,
): Promise<DeviceAuthInitiateResponse> {
  const base: string = baseUrl ?? KILO_API_BASE
  const response = await fetch(`${base}/api/device-auth/codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new Error(`Failed to initiate device auth: ${response.status}`)
  }
  return (await response.json()) as DeviceAuthInitiateResponse
}

/**
 * Poll device auth status by calling GET /api/device-auth/codes/{code}.
 *
 * Status mapping:
 * - 202 → pending
 * - 403 → denied
 * - 410 → expired
 * - 200 → parsed JSON body
 */
export async function pollDeviceAuth(
  code: string,
  baseUrl?: string,
): Promise<DeviceAuthPollResponse> {
  const base: string = baseUrl ?? KILO_API_BASE
  const response = await fetch(`${base}/api/device-auth/codes/${code}`, {
    method: 'GET',
    signal: AbortSignal.timeout(30_000),
  })

  if (response.status === 202) return { status: 'pending' }
  if (response.status === 403) return { status: 'denied' }
  if (response.status === 410) return { status: 'expired' }

  if (!response.ok) {
    throw new Error(`Failed to poll device auth: ${response.status}`)
  }
  return (await response.json()) as DeviceAuthPollResponse
}

/** Sleep helper that respects fake timers when used with `vi.advanceTimersByTimeAsync`. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Run the full device auth flow: initiate, poll until approved/denied/expired,
 * then return the resulting token and auth object.
 */
export async function authenticateWithDeviceAuth(
  baseUrl?: string,
): Promise<DeviceAuthResult> {
  const initiation = await initiateDeviceAuth(baseUrl)

  console.log(
    `To authorize, open ${initiation.verificationUrl} and enter code ${initiation.code}.`,
  )

  let poll: DeviceAuthPollResponse = { status: 'pending' }
  while (poll.status === 'pending') {
    await sleep(POLL_INTERVAL_MS)
    poll = await pollDeviceAuth(initiation.code, baseUrl)
  }

  if (poll.status === 'approved') {
    const token: string = poll.token ?? ''
    const userEmail: string = poll.userEmail ?? ''
    const auth: KiloAuth = {
      type: 'oauth',
      access: token,
      refresh: '',
      expires: Date.now() + TOKEN_EXPIRATION_MS,
    }
    return { token, userEmail, auth }
  }

  if (poll.status === 'denied') {
    throw new Error('Authorization denied by user')
  }

  // status === 'expired'
  throw new Error('Authorization code expired')
}
