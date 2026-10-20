import type { CursorEntry, CursorStore } from '../../src/state/cursor-store.ts'

/** In-memory cursor store shared by the tests. */
export function memoryStore(initial: Record<string, string> = {}): CursorStore & {
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

/** Invoke a citty command's `run` with the given args. */
export async function runCommand(
  command: { run?: unknown },
  args: Record<string, unknown>,
): Promise<void> {
  const run = command.run as (ctx: { args: Record<string, unknown> }) => Promise<void>
  await run({ args })
}

/** Silence console output while a command runs. */
export function captureConsole(): { restore: () => void; lines: string[] } {
  const lines: string[] = []
  const original = { log: console.log, error: console.error }
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '))
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(' '))
  return {
    lines,
    restore: () => {
      console.log = original.log
      console.error = original.error
    },
  }
}
