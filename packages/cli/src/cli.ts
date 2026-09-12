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
import {
  orgListCommand,
  orgSetCommand,
} from './commands/organizations.ts'
import {
  byokListCommand,
  plansListCommand,
  plansUsageCommand,
} from './commands/plans.ts'
import {
  kiloclawBillingCommand,
  kiloclawBillingHistoryCommand,
  kiloclawChangelogCommand,
  kiloclawFileTreeCommand,
  kiloclawInstancesCommand,
  kiloclawRunCancelCommand,
  kiloclawRunStartCommand,
  kiloclawRunStatusCommand,
  kiloclawSubscriptionsCommand,
  kiloclawSubscriptionDetailCommand,
  kiloclawUnpinCommand,
  kiloclawVersionCommand,
} from './commands/kiloclaw.ts'
import {
  cloudAgentGithubReposCommand,
  cloudAgentGitlabReposCommand,
  cloudAgentSessionCommand,
} from './commands/cloud-agent.ts'
import {
  reviewsConfigCommand,
  reviewsListCommand,
  reviewsToggleCommand,
} from './commands/code-reviews.ts'
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
import {
  orgCreateCommand,
  orgCreditsCommand,
  orgInvoicesCommand,
  orgMembersCommand,
  orgModelsCommand,
  orgSecurityCommand,
  orgSeatsCommand,
  orgUpdateCommand,
  orgUsageCommand,
} from './commands/org-extended.ts'
import {
  securityAnalyzeCommand,
  securityCancelRemediationCommand,
  securityCommandStatusCommand,
  securityCommandsCommand,
  securityConfigCommand,
  securityDashboardCommand,
  securityDeleteFindingsCommand,
  securityDisableCommand,
  securityDismissCommand,
  securityEnableCommand,
  securityFindingCommand,
  securityFindingsCommand,
  securityLastSyncCommand,
  securityOrphanedReposCommand,
  securityRemediateCommand,
  securityReposCommand,
  securityRetryRemediationCommand,
  securityStatsCommand,
  securityStatusCommand,
  securitySyncCommand,
} from './commands/security-agent.ts'
import { tuiCommand } from './commands/tui.ts'

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
    tui: tuiCommand,
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
    }),
    'cloud-agent': defineCommand({
      meta: { name: 'cloud-agent', description: 'Cloud agent commands' },
      subCommands: {
        session: cloudAgentSessionCommand,
        'github-repos': cloudAgentGithubReposCommand,
        'gitlab-repos': cloudAgentGitlabReposCommand,
      },
    }),
    reviews: defineCommand({
      meta: { name: 'reviews', description: 'Code review commands' },
      subCommands: {
        list: reviewsListCommand,
        config: reviewsConfigCommand,
        toggle: reviewsToggleCommand,
      },
    }),
    analytics: defineCommand({
      meta: { name: 'analytics', description: 'Usage analytics commands' },
      subCommands: {
        summary: analyticsSummaryCommand,
        timeseries: analyticsTimeseriesCommand,
        breakdown: analyticsBreakdownCommand,
        table: analyticsTableCommand,
      },
    }),
    'app-builder': defineCommand({
      meta: { name: 'app-builder', description: 'App builder commands' },
      subCommands: {
        list: appBuilderListCommand,
        eligibility: appBuilderEligibilityCommand,
        deploy: appBuilderDeployCommand,
      },
    }),
    security: defineCommand({
      meta: { name: 'security', description: 'Security agent commands (personal, no org required)' },
      subCommands: {
        status: securityStatusCommand,
        config: securityConfigCommand,
        enable: securityEnableCommand,
        disable: securityDisableCommand,
        repos: securityReposCommand,
        findings: securityFindingsCommand,
        finding: securityFindingCommand,
        stats: securityStatsCommand,
        dashboard: securityDashboardCommand,
        sync: securitySyncCommand,
        dismiss: securityDismissCommand,
        analyze: securityAnalyzeCommand,
        remediate: securityRemediateCommand,
        'retry-remediation': securityRetryRemediationCommand,
        'cancel-remediation': securityCancelRemediationCommand,
        commands: securityCommandsCommand,
        command: securityCommandStatusCommand,
        'orphaned-repos': securityOrphanedReposCommand,
        'last-sync': securityLastSyncCommand,
        'delete-findings': securityDeleteFindingsCommand,
      },
    }),
  },
})
