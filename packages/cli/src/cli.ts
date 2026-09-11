/**
 * Main CLI command tree using citty.
 */

import { defineCommand, showUsage } from 'citty'

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

/** Show help for a command without erroring. */
function helpRun() {
  return async ({ cmd }: { cmd: Parameters<typeof showUsage>[0] }) => {
    showUsage(cmd)
  }
}

export const mainCommand = defineCommand({
  meta: {
    name: 'kilo-ai-cli',
    description: 'CLI for interacting with the kilo.ai cloud tRPC API',
    version: '0.0.0',
  },
  subCommands: {
    auth: defineCommand({
      meta: { name: 'auth', description: 'Authentication commands' },
      run: helpRun(),
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
      run: helpRun(),
      subCommands: {
        list: sessionsListCommand,
        get: sessionsGetCommand,
        rename: sessionsRenameCommand,
      },
    }),
    org: defineCommand({
      meta: { name: 'org', description: 'Organization commands' },
      run: helpRun(),
      subCommands: {
        list: orgListCommand,
        set: orgSetCommand,
      },
    }),
    plans: defineCommand({
      meta: { name: 'plans', description: 'Coding plan commands' },
      run: helpRun(),
      subCommands: {
        list: plansListCommand,
        usage: plansUsageCommand,
      },
    }),
    byok: defineCommand({
      meta: { name: 'byok', description: 'BYOK commands' },
      run: helpRun(),
      subCommands: {
        list: byokListCommand,
      },
    }),
  },
})
