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

/** How long to wait for a competing writer to release the lock. */
const LOCK_TIMEOUT_MS = 5_000

/** Delay between lock acquisition attempts. */
const LOCK_RETRY_MS = 25

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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Create a cursor store backed by a JSON file at `${configDir}/cursors.json`.
 * Defaults to `~/.kilo/cursors.json` when no config dir is provided.
 *
 * Writes are atomic (temp file + rename) and guarded by an exclusive lock
 * file, so two concurrent CLI invocations cannot clobber each other's cursor.
 */
export function createCursorStore(configDir?: string): CursorStore {
  const dir = configDir ?? DEFAULT_CONFIG_DIR
  const filePath = cursorsPath(dir)
  const lockPath = `${filePath}.lock`

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

  /** Write the file atomically: a temp file plus a rename. */
  async function write(file: CursorFile): Promise<void> {
    await fs.mkdir(dir, { recursive: true })
    const tmpPath = `${filePath}.${process.pid}.tmp`
    try {
      await fs.writeFile(tmpPath, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 })
      await fs.rename(tmpPath, filePath)
    } catch (err) {
      await fs.rm(tmpPath, { force: true }).catch(() => undefined)
      throw err
    }
  }

  /**
   * Read the pid of the process holding the lock.
   * Returns undefined when the lock file is empty or unreadable.
   */
  async function lockHolderPid(): Promise<number | undefined> {
    try {
      const raw = await fs.readFile(lockPath, 'utf8')
      const pid = Number.parseInt(raw.trim(), 10)
      return Number.isInteger(pid) && pid > 0 ? pid : undefined
    } catch {
      return undefined
    }
  }

  /** True when the process holding the lock is gone. */
  async function lockHolderIsGone(): Promise<boolean> {
    const pid = await lockHolderPid()
    if (pid === undefined || pid === process.pid) return false
    try {
      process.kill(pid, 0)
      return false
    } catch (err) {
      return (err as NodeJS.ErrnoException).code === 'ESRCH'
    }
  }

  /**
   * Run `fn` while holding the exclusive lock file.
   *
   * The lock file carries the pid of its holder. When the wait times out the
   * lock is only taken over if that process is gone; otherwise the call
   * fails, because a live writer must never be raced.
   */
  async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    await fs.mkdir(dir, { recursive: true })
    const deadline = Date.now() + LOCK_TIMEOUT_MS
    for (;;) {
      let handle: Awaited<ReturnType<typeof fs.open>> | undefined
      try {
        handle = await fs.open(lockPath, 'wx')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
        handle = undefined
      }

      if (handle) {
        // Record the holder so a crashed writer's lock can be reclaimed.
        await handle.writeFile(String(process.pid)).catch(() => undefined)
        try {
          return await fn()
        } finally {
          await handle.close().catch(() => undefined)
          await fs.rm(lockPath, { force: true }).catch(() => undefined)
        }
      }

      // The lock is held by someone else. A lock whose holder is gone is
      // stale and can be reclaimed right away.
      if (await lockHolderIsGone()) {
        await fs.rm(lockPath, { force: true }).catch(() => undefined)
        continue
      }

      if (Date.now() >= deadline) {
        throw new Error('Timed out waiting for the cursor lock — another process is writing it.')
      }
      await sleep(LOCK_RETRY_MS)
    }
  }

  return {
    async get(name: string): Promise<CursorEntry | undefined> {
      const file = await read()
      return file.cursors[name]
    },

    async set(name: string, value: string): Promise<CursorEntry> {
      return withLock(async () => {
        const file = await read()
        const entry: CursorEntry = { value, updatedAt: new Date().toISOString() }
        file.cursors[name] = entry
        await write(file)
        return entry
      })
    },

    async remove(name: string): Promise<void> {
      await withLock(async () => {
        const file = await read()
        if (!(name in file.cursors)) return
        delete file.cursors[name]
        await write(file)
      })
    },

    async list(): Promise<Record<string, CursorEntry>> {
      return (await read()).cursors
    },

    async clear(): Promise<void> {
      await withLock(async () => {
        await write(emptyFile())
      })
    },
  }
}
