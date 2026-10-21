/**
 * Timestamp parsing shared by the delta reads and the cursor store.
 */

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
