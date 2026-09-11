#!/usr/bin/env node

import { runMain } from 'citty'

import { mainCommand } from './cli.ts'

await runMain(mainCommand)
