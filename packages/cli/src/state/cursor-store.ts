/**
 * Persistent named cursors — the CLI's memory of "where we left off".
 *
 * The cloud API exposes no generic change feed, so the CLI keeps one cursor
 * per resource (reviews, sessions, findings, …) and uses it to compute the
 * delta between two reads. Cursors live next to the credentials in
 * `~/.kilo/cursors.json`.
 */

import * as fs from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** A single stored cursor. `value` is opaque to the store (ISO time, id, …). */
export interface CursorEntry {
  /** Opaque cursor value — an ISO timestamp, a pagination cursor, an id. */
  value: string
  /** ISO timestamp of the moment the cursor was last written. */
  updatedAt: string
}

/** On-disk shape of the cursor file. */
export interface CursorFile {
  version: 1
  cursors: Record<string, CursorEntry>
}

/** Read/write access to the persisted cursors. */
export interface CursorStore {
  get(name: string): Promise<CursorEntry | undefined>
  set(name: string, value: string): Promise<CursorEntry>
  remove(name: string): Promise<void>
  list(): Promise<Record<string, CursorEntry>>
  clear(): Promise<void>
}

/** Default config directory: ~/.kilo/ */
const DEFAULT_CONFIG_DIR: string = join(homedir(), '.kilo')

/** File name used to persist cursors inside the config directory. */
const CURSORS_FILENAME = 'cursors.json'

/** Resolve the cursors file path for a given config directory. */
function cursorsPath(configDir: string): string {
  return join(configDir, CURSORS_FILENAME)
}

function emptyFile(): CursorFile {
  return { version: 1, cursors: {} }
}

/** Parse the cursor file, tolerating a missing or corrupt file. */
function parseFile(raw: string): CursorFile {
  try {
    const parsed = JSON.parse(raw) as Partial<CursorFile>
    if (parsed.version !== 1 || typeof parsed.cursors !== 'object' || parsed.cursors === null) {
      return emptyFile()
    }
    const cursors: Record<string, CursorEntry> = {}
    for (const [name, entry] of Object.entries(parsed.cursors)) {
      if (entry && typeof entry.value === 'string') {
        cursors[name] = {
          value: entry.value,
          updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
        }
      }
    }
    return { version: 1, cursors }
  } catch {
    return emptyFile()
  }
}

/**
 * Create a cursor store backed by a JSON file at `${configDir}/cursors.json`.
 * Defaults to `~/.kilo/cursors.json` when no config dir is provided.
 */
export function createCursorStore(configDir?: string): CursorStore {
  const dir = configDir ?? DEFAULT_CONFIG_DIR
  const filePath = cursorsPath(dir)

  async function read(): Promise<CursorFile> {
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      return parseFile(raw)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return emptyFile()
      throw err
    }
  }

  async function write(file: CursorFile): Promise<void> {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 })
  }

  return {
    async get(name: string): Promise<CursorEntry | undefined> {
      const file = await read()
      return file.cursors[name]
    },

    async set(name: string, value: string): Promise<CursorEntry> {
      const file = await read()
      const entry: CursorEntry = { value, updatedAt: new Date().toISOString() }
      file.cursors[name] = entry
      await write(file)
      return entry
    },

    async remove(name: string): Promise<void> {
      const file = await read()
      if (!(name in file.cursors)) return
      delete file.cursors[name]
      await write(file)
    },

    async list(): Promise<Record<string, CursorEntry>> {
      return (await read()).cursors
    },

    async clear(): Promise<void> {
      await write(emptyFile())
    },
  }
}
