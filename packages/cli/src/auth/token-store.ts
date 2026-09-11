/**
 * Token store that reads/writes kilo.ai credentials to ~/.kilo/credentials.json.
 */

import * as fs from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { KiloAuth } from '../api/types.ts'

/** Interface for a credential token store. */
export interface TokenStore {
  get(): Promise<KiloAuth | undefined>
  set(auth: KiloAuth): Promise<void>
  clear(): Promise<void>
}

/** Default config directory: ~/.kilo/ */
const DEFAULT_CONFIG_DIR: string = join(homedir(), '.kilo')

/** File name used to persist credentials inside the config directory. */
const CREDENTIALS_FILENAME = 'credentials.json'

/** Resolve the credentials file path for a given config directory. */
function credentialsPath(configDir: string): string {
  return join(configDir, CREDENTIALS_FILENAME)
}

/**
 * Create a token store backed by a JSON file at `${configDir}/credentials.json`.
 * Defaults to `~/.kilo/credentials.json` when no config dir is provided.
 */
export function createTokenStore(configDir?: string): TokenStore {
  const dir: string = configDir ?? DEFAULT_CONFIG_DIR
  const filePath: string = credentialsPath(dir)

  return {
    async get(): Promise<KiloAuth | undefined> {
      try {
        const raw = await fs.readFile(filePath, 'utf8')
        return JSON.parse(raw) as KiloAuth
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'ENOENT') return undefined
        throw err
      }
    },

    async set(auth: KiloAuth): Promise<void> {
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(auth, null, 2), { mode: 0o600 })
    },

    async clear(): Promise<void> {
      try {
        await fs.unlink(filePath)
      } catch {
        // Ignore errors (e.g. file does not exist).
      }
    },
  }
}
