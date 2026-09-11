#!/usr/bin/env node

import { runMain, showUsage } from 'citty'

import { mainCommand } from './cli.ts'

const args = process.argv.slice(2)
if (args.length === 0) {
  showUsage(mainCommand)
} else {
  await runMain(mainCommand)
}
