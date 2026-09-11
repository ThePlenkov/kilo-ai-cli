/**
 * Main CLI command tree using citty.
 */

import { defineCommand } from 'citty'

import {
  loginCommand,
  logoutCommand,
  statusCommand,
} from './commands/auth.ts'
import { balanceCommand, profileCommand } from './commands/profile.ts'
import {
  sessionsGetCommand,
  sessionsListCommand,
  sessionsRenameCommand,
} from './commands/sessions.ts'
import { orgListCommand, orgSetCommand } from './commands/organizations.ts'
import {
  byokListCommand,
  plansListCommand,
  plansUsageCommand,
} from './commands/plans.ts'

export const mainCommand = defineCommand({
  meta: {
    name: 'kilo-ai-cli',
    description: 'CLI for interacting with the kilo.ai cloud tRPC API',
    version: '0.0.0',
  },
  subCommands: {
    auth: defineCommand({
      meta: { name: 'auth', description: 'Authentication commands' },
      subCommands: {
        login: loginCommand,
        logout: logoutCommand,
        status: statusCommand,
      },
    }),
    profile: profileCommand,
    balance: balanceCommand,
    sessions: defineCommand({
      meta: { name: 'sessions', description: 'Cloud session commands' },
      subCommands: {
        list: sessionsListCommand,
        get: sessionsGetCommand,
        rename: sessionsRenameCommand,
      },
    }),
    org: defineCommand({
      meta: { name: 'org', description: 'Organization commands' },
      subCommands: {
        list: orgListCommand,
        set: orgSetCommand,
      },
    }),
    plans: defineCommand({
      meta: { name: 'plans', description: 'Coding plan commands' },
      subCommands: {
        list: plansListCommand,
        usage: plansUsageCommand,
      },
    }),
    byok: defineCommand({
      meta: { name: 'byok', description: 'BYOK commands' },
      subCommands: {
        list: byokListCommand,
      },
    }),
  },
})
