/**
 * Delta reads — "what changed since the last time I looked?".
 *
 * A cursor is an opaque, per-resource marker stored by the cursor store. For
 * list-style endpoints the marker is an ISO timestamp; the API's own
 * `updatedSince` filters are driven by the same value.
 */

import { type CursorStore, createCursorStore } from './cursor-store.ts'

/** Options shared by every delta-aware read. */
export interface DeltaOptions {
  /** Explicit lower bound (ISO instant) — overrides the stored cursor. */
  since?: string
  /** Name of the cursor in the store. Required for store-backed reads. */
  cursor?: string
  /** Write the newest seen timestamp back to the store. Default: true. */
  advance?: boolean
  /**
   * False when the fetched set is a truncated page of a larger result set.
   * The cursor must not move past unseen rows, so the advance is skipped.
   * Default: true.
   */
  complete?: boolean
  /** Store to use — injected in tests, defaults to the on-disk store. */
  store?: CursorStore
}

/** Outcome of a delta read. */
export interface DeltaResult<T> {
  /** Items newer than the effective lower bound. */
  items: T[]
  /** Effective lower bound applied (ISO). `undefined` means "no bound". */
  since: string | undefined
  /** Value written back to the store, when the cursor advanced. */
  advancedTo: string | undefined
  /** Whether the bound came from the stored cursor rather than an explicit one. */
  fromCursor: boolean
  /** True when the source was truncated and the cursor was therefore held back. */
  truncated: boolean
}

/**
 * Parse a timestamp into epoch milliseconds.
 *
 * Handles ISO strings and the Postgres-style `2026-10-20 12:47:45.360461+00`
 * the cloud API returns for some rows. `Date.parse` already understands both
 * the `+00` and the `+00:00` offset forms; the explicit rewrites below only
 * cover shapes it rejects.
 */
export function toEpochMs(value: string | number | null | undefined): number | undefined {
  if (value == null) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const direct = Date.parse(trimmed)
  if (Number.isFinite(direct)) return direct

  // Postgres style: space separator and a short (+00) UTC offset.
  const normalized = trimmed.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const retry = Date.parse(normalized)
  if (Number.isFinite(retry)) return retry

  // Last resort: a space separator with an offset V8 still rejects.
  const spaceToT = trimmed.replace(' ', 'T')
  const spaceRetry = Date.parse(spaceToT)
  return Number.isFinite(spaceRetry) ? spaceRetry : undefined
}

/** Normalize a timestamp to an ISO UTC instant, or `undefined` when unparseable. */
export function toIsoTimestamp(value: string | number | null | undefined): string | undefined {
  const epoch = toEpochMs(value)
  return epoch === undefined ? undefined : new Date(epoch).toISOString()
}

/**
 * Resolve the effective lower bound of a delta read: the explicit `since`
 * when given, otherwise the value of the stored cursor.
 *
 * An explicit `since` that cannot be parsed is a user error and throws — it
 * must not silently degrade into "no bound", which would return everything.
 */
export async function resolveSince(options: DeltaOptions = {}): Promise<string | undefined> {
  if (options.since !== undefined) {
    const parsed = toIsoTimestamp(options.since)
    if (!parsed) throw new Error(`Invalid --since timestamp: ${options.since}`)
    return parsed
  }
  if (!options.cursor) return undefined
  const store = options.store ?? createCursorStore()
  const entry = await store.get(options.cursor)
  if (!entry) return undefined
  // A corrupt stored value is self-healing: treat it as "no bound".
  return toIsoTimestamp(entry.value)
}

/**
 * Compute the delta of a fetched list against a cursor.
 *
 * Items are kept when their timestamp is strictly newer than the effective
 * lower bound. The cursor advances to the newest timestamp of the *fetched*
 * set so the next read continues where this one stopped — but only when the
 * fetch was complete, so a truncated page can never hide unseen rows.
 */
export async function applyDeltaAsync<T>(
  items: T[],
  timestampOf: (item: T) => string | number | null | undefined,
  options: DeltaOptions = {},
): Promise<DeltaResult<T>> {
  const store = options.store ?? createCursorStore()
  const cursorName = options.cursor

  const explicitSince = options.since !== undefined
  let since: string | undefined
  let fromCursor = false

  if (explicitSince) {
    const parsed = toIsoTimestamp(options.since)
    if (!parsed) throw new Error(`Invalid --since timestamp: ${options.since}`)
    since = parsed
  } else if (cursorName) {
    const entry = await store.get(cursorName)
    if (entry) {
      since = toIsoTimestamp(entry.value)
      fromCursor = since !== undefined
    }
  }

  const sinceEpoch = since ? toEpochMs(since) : undefined

  let newest: string | undefined
  const filtered: T[] = []
  for (const item of items) {
    const epoch = toEpochMs(timestampOf(item))
    if (epoch === undefined) {
      // Without a bound the item cannot be older than anything, so keep it.
      // With a bound its age is unknown — it may well be old, so drop it.
      if (sinceEpoch === undefined) filtered.push(item)
      continue
    }
    if (newest === undefined || epoch > (toEpochMs(newest) ?? 0)) {
      newest = new Date(epoch).toISOString()
    }
    if (sinceEpoch === undefined || epoch > sinceEpoch) {
      filtered.push(item)
    }
  }

  const truncated = options.complete === false
  let advancedTo: string | undefined
  const shouldAdvance = (options.advance ?? true) && !truncated
  if (shouldAdvance && cursorName && newest) {
    const current = await store.get(cursorName)
    const currentEpoch = current ? toEpochMs(current.value) : undefined
    const newestEpoch = toEpochMs(newest) ?? 0
    // Only move the cursor forward, and only report a move that happened.
    if (currentEpoch === undefined || newestEpoch > currentEpoch) {
      await store.set(cursorName, newest)
      advancedTo = newest
    }
  }

  return { items: filtered, since, advancedTo, fromCursor, truncated }
}
