/** Interactive confirmation prompt for destructive operations. */

import * as readline from 'node:readline/promises'

/**
 * Prompt the user for yes/no confirmation on stdin.
 * Returns true if the user typed 'y' or 'yes' (case-insensitive).
 */
export async function confirm(prompt: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    // Non-interactive — refuse by default
    console.error(`ERROR: ${prompt}`)
    console.error('Refusing to proceed without --yes in non-interactive mode.')
    return false
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await rl.question(`${prompt} [y/N] `)).trim().toLowerCase()
    return answer === 'y' || answer === 'yes'
  } finally {
    rl.close()
  }
}
