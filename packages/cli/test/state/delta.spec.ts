import { describe, expect, it } from 'vitest'
import type { CursorEntry, CursorStore } from '../../src/state/cursor-store.ts'
import { applyDeltaAsync, resolveSince, toEpochMs, toIsoTimestamp } from '../../src/state/delta.ts'

/** In-memory cursor store for the delta tests. */
function memoryStore(initial: Record<string, string> = {}): CursorStore & {
  entries: Record<string, CursorEntry>
} {
  const entries: Record<string, CursorEntry> = {}
  for (const [name, value] of Object.entries(initial)) {
    entries[name] = { value, updatedAt: '2026-01-01T00:00:00.000Z' }
  }
  return {
    entries,
    async get(name) {
      return entries[name]
    },
    async set(name, value) {
      const entry = { value, updatedAt: '2026-01-01T00:00:00.000Z' }
      entries[name] = entry
      return entry
    },
    async remove(name) {
      delete entries[name]
    },
    async list() {
      return entries
    },
    async clear() {
      for (const key of Object.keys(entries)) delete entries[key]
    },
  }
}

interface Item {
  id: string
  at: string
}

const items: Item[] = [
  { id: 'a', at: '2026-10-20T10:00:00.000Z' },
  { id: 'b', at: '2026-10-20T11:00:00.000Z' },
  { id: 'c', at: '2026-10-20T12:00:00.000Z' },
]

describe('toEpochMs', () => {
  it('parses ISO timestamps', () => {
    expect(toEpochMs('2026-10-20T12:00:00.000Z')).toBe(Date.parse('2026-10-20T12:00:00.000Z'))
  })

  it('parses the Postgres-style timestamps the API returns', () => {
    expect(toEpochMs('2026-10-20 12:00:00.360461+00')).toBe(Date.parse('2026-10-20T12:00:00.360Z'))
  })

  it('returns undefined for empty and invalid values', () => {
    expect(toEpochMs(undefined)).toBeUndefined()
    expect(toEpochMs(null)).toBeUndefined()
    expect(toEpochMs('')).toBeUndefined()
    expect(toEpochMs('not a date')).toBeUndefined()
  })
})

describe('toIsoTimestamp', () => {
  it('normalizes to a UTC ISO instant', () => {
    expect(toIsoTimestamp('2026-10-20 12:00:00.360461+00')).toBe('2026-10-20T12:00:00.360Z')
  })

  it('returns undefined for unparseable values', () => {
    expect(toIsoTimestamp('nope')).toBeUndefined()
  })
})

describe('resolveSince', () => {
  it('prefers the explicit since over the stored cursor', async () => {
    const store = memoryStore({ reviews: '2026-10-20T09:00:00.000Z' })
    const since = await resolveSince({
      since: '2026-10-20T10:00:00.000Z',
      cursor: 'reviews',
      store,
    })
    expect(since).toBe('2026-10-20T10:00:00.000Z')
  })

  it('falls back to the stored cursor', async () => {
    const store = memoryStore({ reviews: '2026-10-20T09:00:00.000Z' })
    const since = await resolveSince({ cursor: 'reviews', store })
    expect(since).toBe('2026-10-20T09:00:00.000Z')
  })

  it('returns undefined when no cursor is stored', async () => {
    const store = memoryStore()
    expect(await resolveSince({ cursor: 'reviews', store })).toBeUndefined()
  })
})

describe('applyDeltaAsync', () => {
  it('keeps everything when there is no lower bound', async () => {
    const store = memoryStore()
    const result = await applyDeltaAsync(items, (i) => i.at, { cursor: 'reviews', store })
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(result.since).toBeUndefined()
  })

  it('keeps only the items newer than the cursor', async () => {
    const store = memoryStore({ reviews: '2026-10-20T10:30:00.000Z' })
    const result = await applyDeltaAsync(items, (i) => i.at, { cursor: 'reviews', store })

    expect(result.items.map((i) => i.id)).toEqual(['b', 'c'])
    expect(result.fromCursor).toBe(true)
    expect(result.since).toBe('2026-10-20T10:30:00.000Z')
  })

  it('advances the cursor to the newest item seen', async () => {
    const store = memoryStore({ reviews: '2026-10-20T10:30:00.000Z' })
    const result = await applyDeltaAsync(items, (i) => i.at, { cursor: 'reviews', store })

    expect(result.advancedTo).toBe('2026-10-20T12:00:00.000Z')
    expect(store.entries.reviews?.value).toBe('2026-10-20T12:00:00.000Z')
  })

  it('does not advance the cursor when advancing is disabled', async () => {
    const store = memoryStore({ reviews: '2026-10-20T10:30:00.000Z' })
    const result = await applyDeltaAsync(items, (i) => i.at, {
      cursor: 'reviews',
      store,
      advance: false,
    })

    expect(result.advancedTo).toBeUndefined()
    expect(store.entries.reviews?.value).toBe('2026-10-20T10:30:00.000Z')
  })

  it('never moves the cursor backwards', async () => {
    const store = memoryStore({ reviews: '2026-10-20T23:00:00.000Z' })
    const result = await applyDeltaAsync(items, (i) => i.at, { cursor: 'reviews', store })

    expect(result.items).toEqual([])
    expect(store.entries.reviews?.value).toBe('2026-10-20T23:00:00.000Z')
  })

  it('does not report a move when the cursor is already at the newest item', async () => {
    const store = memoryStore({ reviews: '2026-10-20T12:00:00.000Z' })
    const result = await applyDeltaAsync(items, (i) => i.at, { cursor: 'reviews', store })

    expect(result.advancedTo).toBeUndefined()
    expect(store.entries.reviews?.value).toBe('2026-10-20T12:00:00.000Z')
  })

  it('uses the explicit since and advances the cursor', async () => {
    const store = memoryStore()
    const result = await applyDeltaAsync(items, (i) => i.at, {
      cursor: 'reviews',
      since: '2026-10-20T11:00:00.000Z',
      store,
    })

    expect(result.items.map((i) => i.id)).toEqual(['c'])
    expect(result.fromCursor).toBe(false)
    expect(store.entries.reviews?.value).toBe('2026-10-20T12:00:00.000Z')
  })

  it('keeps items without a parseable timestamp', async () => {
    const store = memoryStore({ reviews: '2026-10-20T10:30:00.000Z' })
    const result = await applyDeltaAsync([{ id: 'x', at: 'not a date' }, ...items], (i) => i.at, {
      cursor: 'reviews',
      store,
    })
    expect(result.items.map((i) => i.id)).toEqual(['x', 'b', 'c'])
  })
})
