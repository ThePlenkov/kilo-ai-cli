#!/usr/bin/env node

import { runMain, showUsage } from 'citty'

import { mainCommand } from './cli.ts'

/** Parent commands that require a subcommand. */
const PARENT_COMMANDS = new Set(['auth', 'sessions', 'org', 'plans', 'byok'])

const args = process.argv.slice(2)

if (args.length === 0) {
  // No args — show main help
  showUsage(mainCommand)
} else if (PARENT_COMMANDS.has(args[0]) && (args.length === 1 || (args.length === 2 && (args[1] === '--help' || args[1] === '-h')))) {
  // Parent command without a subcommand (or explicit --help) — show its help
  const sub = (mainCommand.subCommands as Record<string, Parameters<typeof showUsage>[0]>)[args[0]]
  if (sub) {
    showUsage(sub)
  } else {
    await runMain(mainCommand)
  }
} else {
  await runMain(mainCommand)
}
