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
}

/**
 * Parse a timestamp into epoch milliseconds.
 * Handles ISO strings and the Postgres-style `2026-10-20 12:47:45.360461+00`
 * the cloud API returns for some rows.
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
  return Number.isFinite(retry) ? retry : undefined
}

/** Normalize a timestamp to an ISO UTC instant, or `undefined` when unparseable. */
export function toIsoTimestamp(value: string | number | null | undefined): string | undefined {
  const epoch = toEpochMs(value)
  return epoch === undefined ? undefined : new Date(epoch).toISOString()
}

/**
 * Resolve the effective lower bound of a delta read: the explicit `since`
 * when given, otherwise the value of the stored cursor.
 */
export async function resolveSince(options: DeltaOptions = {}): Promise<string | undefined> {
  if (options.since) return toIsoTimestamp(options.since)
  if (!options.cursor) return undefined
  const store = options.store ?? createCursorStore()
  const entry = await store.get(options.cursor)
  if (!entry) return undefined
  return toIsoTimestamp(entry.value)
}

/**
 * Compute the delta of a fetched list against a cursor.
 *
 * Items are kept when their timestamp is strictly newer than the effective
 * lower bound. The cursor advances to the newest timestamp of the *fetched*
 * set so the next read continues where this one stopped.
 */
export async function applyDeltaAsync<T>(
  items: T[],
  timestampOf: (item: T) => string | number | null | undefined,
  options: DeltaOptions = {},
): Promise<DeltaResult<T>> {
  const store = options.store ?? createCursorStore()
  const cursorName = options.cursor

  let since: string | undefined
  let fromCursor = false

  if (options.since) {
    since = toIsoTimestamp(options.since)
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
      filtered.push(item)
      continue
    }
    if (newest === undefined || epoch > (toEpochMs(newest) ?? 0)) {
      newest = new Date(epoch).toISOString()
    }
    if (sinceEpoch === undefined || epoch > sinceEpoch) {
      filtered.push(item)
    }
  }

  let advancedTo: string | undefined
  const shouldAdvance = options.advance ?? true
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

  return { items: filtered, since, advancedTo, fromCursor }
}
