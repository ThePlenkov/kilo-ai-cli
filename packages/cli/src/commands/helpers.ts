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
