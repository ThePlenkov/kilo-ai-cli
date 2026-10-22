/**
 * Shared helpers for CLI command handlers.
 */

import type { KiloAuth } from '../api/types.ts'
import { UnauthorizedError } from '../api/types.ts'
import { createTokenStore } from '../auth/token-store.ts'

export interface ResolvedToken {
  token: string
  auth: KiloAuth
  organizationId?: string
}

/**
 * Resolve the stored auth into a usable bearer token plus optional org id.
 * Throws UnauthorizedError when no auth is stored.
 */
export async function getToken(): Promise<ResolvedToken> {
  const store = createTokenStore()
  const auth = await store.get()
  if (!auth) {
    throw new UnauthorizedError('Not authenticated. Run `kilo-ai-cli auth login` first.')
  }

  if (auth.type === 'api') {
    return { token: auth.key, auth, organizationId: undefined }
  }

  if (auth.type === 'oauth') {
    return { token: auth.access, auth, organizationId: auth.accountId }
  }

  return { token: auth.token, auth, organizationId: undefined }
}

/**
 * Tri-state value from two mutually exclusive CLI flags: `--flag` means
 * true, `--no-flag` means false, neither means undefined. Both at once is a
 * mistake and is rejected — silently picking one of them hides the
 * contradiction from the user.
 */
export function triState(
  on: boolean | undefined,
  off: boolean | undefined,
  label = 'the two flags conflict',
): boolean | undefined {
  if (on && off) throw new Error(`Conflicting flags: ${label}.`)
  if (on) return true
  if (off) return false
  return undefined
}
