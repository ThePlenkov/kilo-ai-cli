import type { CursorEntry, CursorStore } from '../../src/state/cursor-store.ts'

/**
 * An in-memory cursor store for the tests. `entries` is exposed so a test can
 * assert on the stored watermark.
 */
export function memoryStore(initial: Record<string, string> = {}): CursorStore & {
  entries: Record<string, CursorEntry>
} {
  const entries: Record<string, CursorEntry> = {}
  for (const [name, value] of Object.entries(initial)) {
    entries[name] = { value, updatedAt: '2026-01-01T00:00:00.000Z' }
  }
  return {
    entries,
    get(name) {
      return Promise.resolve(entries[name])
    },
    set(name, value) {
      const entry = { value, updatedAt: '2026-01-01T00:00:00.000Z' }
      entries[name] = entry
      return Promise.resolve(entry)
    },
    setIfNewer(name, value) {
      const current = entries[name]
      if (current) {
        const currentMs = Date.parse(current.value)
        const nextMs = Date.parse(value)
        if (Number.isFinite(currentMs) && Number.isFinite(nextMs) && nextMs <= currentMs) {
          return Promise.resolve(false)
        }
      }
      entries[name] = { value, updatedAt: '2026-01-01T00:00:00.000Z' }
      return Promise.resolve(true)
    },
    remove(name) {
      delete entries[name]
      return Promise.resolve()
    },
    list() {
      return Promise.resolve(entries)
    },
    clear() {
      for (const key of Object.keys(entries)) delete entries[key]
      return Promise.resolve()
    },
  }
}
