import { memoryStore } from '../helpers/memory-store.ts'

export { memoryStore }

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
