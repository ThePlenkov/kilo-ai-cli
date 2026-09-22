/**
 * Main CLI command tree using citty.
 */

import { defineCommand, showUsage } from 'citty'
import pkg from '../package.json' with { type: 'json' }

/** Show subcommand help instead of "No command specified" for parent commands. */
async function showParentHelp(ctx: { cmd: Parameters<typeof showUsage>[0]; rawArgs: string[] }) {
  // Skip if citty already resolved a subcommand — rawArgs contains its name
  if (ctx.rawArgs.some((a) => !a.startsWith('-'))) return
  await showUsage(ctx.cmd)
}

import {
  analyticsBreakdownCommand,
  analyticsSummaryCommand,
  analyticsTableCommand,
  analyticsTimeseriesCommand,
} from './commands/analytics.ts'
import {
  appBuilderDeployCommand,
  appBuilderEligibilityCommand,
  appBuilderListCommand,
} from './commands/app-builder.ts'
import { loginCommand, logoutCommand, statusCommand } from './commands/auth.ts'
import {
  cloudAgentGithubReposCommand,
  cloudAgentGitlabReposCommand,
  cloudAgentSessionCommand,
} from './commands/cloud-agent.ts'
import {
  reviewsCancelCommand,
  reviewsConfigCommand,
  reviewsGetCommand,
  reviewsListCommand,
  reviewsRetriggerCommand,
  reviewsSetModelCommand,
  reviewsToggleCommand,
} from './commands/code-reviews.ts'
import {
  kiloclawBillingCommand,
  kiloclawBillingHistoryCommand,
  kiloclawChangelogCommand,
  kiloclawFileTreeCommand,
  kiloclawInstancesCommand,
  kiloclawRunCancelCommand,
  kiloclawRunStartCommand,
  kiloclawRunStatusCommand,
  kiloclawSubscriptionDetailCommand,
  kiloclawSubscriptionsCommand,
  kiloclawUnpinCommand,
  kiloclawVersionCommand,
} from './commands/kiloclaw.ts'
import {
  orgCreateCommand,
  orgCreditsCommand,
  orgInvoicesCommand,
  orgMembersCommand,
  orgModelsCommand,
  orgSeatsCommand,
  orgSecurityCommand,
  orgUpdateCommand,
  orgUsageCommand,
} from './commands/org-extended.ts'
import { orgListCommand, orgSetCommand } from './commands/organizations.ts'
import { byokListCommand, plansListCommand, plansUsageCommand } from './commands/plans.ts'
import { balanceCommand, profileCommand } from './commands/profile.ts'
import { reviewsRecoverCommand } from './commands/review-recovery.ts'
import {
  securityCommandStatusCommand,
  securityCommandsCommand,
  securityConfigCommand,
  securityDashboardCommand,
  securityDisableCommand,
  securityEnableCommand,
  securityFindingsCommand,
  securityLastSyncCommand,
  securityOrphanedReposCommand,
  securityReposCommand,
  securityStatsCommand,
  securityStatusCommand,
  securitySyncCommand,
} from './commands/security-agent.ts'
import {
  sessionsGetCommand,
  sessionsListCommand,
  sessionsRenameCommand,
} from './commands/sessions.ts'
import { tuiCommand } from './commands/tui.ts'

export const mainCommand = defineCommand({
  meta: {
    name: 'kilo-ai-cli',
    description: 'CLI for interacting with the kilo.ai cloud tRPC API',
    version: pkg.version,
  },
  subCommands: {
    auth: defineCommand({
      meta: { name: 'auth', description: 'Authentication commands' },
      subCommands: {
        login: loginCommand,
        logout: logoutCommand,
        status: statusCommand,
      },
      run: showParentHelp,
    }),
    profile: profileCommand,
    balance: balanceCommand,
    tui: tuiCommand,
    sessions: defineCommand({
      meta: { name: 'sessions', description: 'Cloud session commands' },
      subCommands: {
        list: sessionsListCommand,
        get: sessionsGetCommand,
        rename: sessionsRenameCommand,
      },
      run: showParentHelp,
    }),
    org: defineCommand({
      meta: { name: 'org', description: 'Organization commands' },
      subCommands: {
        list: orgListCommand,
        set: orgSetCommand,
        members: orgMembersCommand,
        usage: orgUsageCommand,
        credits: orgCreditsCommand,
        seats: orgSeatsCommand,
        invoices: orgInvoicesCommand,
        create: orgCreateCommand,
        update: orgUpdateCommand,
        models: orgModelsCommand,
        security: orgSecurityCommand,
      },
      run: showParentHelp,
    }),
    plans: defineCommand({
      meta: { name: 'plans', description: 'Coding plan commands' },
      subCommands: {
        list: plansListCommand,
        usage: plansUsageCommand,
      },
      run: showParentHelp,
    }),
    byok: defineCommand({
      meta: { name: 'byok', description: 'BYOK commands' },
      subCommands: {
        list: byokListCommand,
      },
      run: showParentHelp,
    }),
    kiloclaw: defineCommand({
      meta: { name: 'kiloclaw', description: 'KiloClaw managed instance commands' },
      subCommands: {
        instances: kiloclawInstancesCommand,
        billing: kiloclawBillingCommand,
        'billing-history': kiloclawBillingHistoryCommand,
        subscriptions: kiloclawSubscriptionsCommand,
        subscription: kiloclawSubscriptionDetailCommand,
        changelog: kiloclawChangelogCommand,
        version: kiloclawVersionCommand,
        'file-tree': kiloclawFileTreeCommand,
        'run-start': kiloclawRunStartCommand,
        'run-status': kiloclawRunStatusCommand,
        'run-cancel': kiloclawRunCancelCommand,
        unpin: kiloclawUnpinCommand,
      },
      run: showParentHelp,
    }),
    'cloud-agent': defineCommand({
      meta: { name: 'cloud-agent', description: 'Cloud agent commands' },
      subCommands: {
        session: cloudAgentSessionCommand,
        'github-repos': cloudAgentGithubReposCommand,
        'gitlab-repos': cloudAgentGitlabReposCommand,
      },
      run: showParentHelp,
    }),
    reviews: defineCommand({
      meta: { name: 'reviews', description: 'Code review commands' },
      subCommands: {
        list: reviewsListCommand,
        get: reviewsGetCommand,
        config: reviewsConfigCommand,
        toggle: reviewsToggleCommand,
        'set-model': reviewsSetModelCommand,
        recover: reviewsRecoverCommand,
        retrigger: reviewsRetriggerCommand,
        cancel: reviewsCancelCommand,
      },
      run: showParentHelp,
    }),
    analytics: defineCommand({
      meta: { name: 'analytics', description: 'Usage analytics commands' },
      subCommands: {
        summary: analyticsSummaryCommand,
        timeseries: analyticsTimeseriesCommand,
        breakdown: analyticsBreakdownCommand,
        table: analyticsTableCommand,
      },
      run: showParentHelp,
    }),
    'app-builder': defineCommand({
      meta: { name: 'app-builder', description: 'App builder commands' },
      subCommands: {
        list: appBuilderListCommand,
        eligibility: appBuilderEligibilityCommand,
        deploy: appBuilderDeployCommand,
      },
      run: showParentHelp,
    }),
    security: defineCommand({
      meta: {
        name: 'security',
        description: 'Security agent commands (personal, no org required)',
      },
      subCommands: {
        status: securityStatusCommand,
        config: securityConfigCommand,
        enable: securityEnableCommand,
        disable: securityDisableCommand,
        repos: securityReposCommand,
        findings: securityFindingsCommand,
        stats: securityStatsCommand,
        dashboard: securityDashboardCommand,
        sync: securitySyncCommand,
        commands: securityCommandsCommand,
        command: securityCommandStatusCommand,
        'orphaned-repos': securityOrphanedReposCommand,
        'last-sync': securityLastSyncCommand,
      },
      run: showParentHelp,
    }),
  },
})
