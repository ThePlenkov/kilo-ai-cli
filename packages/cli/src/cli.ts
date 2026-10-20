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
  accountBalanceCommand,
  accountDevicesCommand,
  accountNotificationsCommand,
  accountRevokeCurrentCommand,
  accountRevokeDeviceCommand,
  accountSetNotificationsCommand,
  accountSpendAlertsCommand,
  accountTopUpCommand,
} from './commands/account.ts'
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
  briefingDismissCommand,
  briefingGenerateCommand,
  briefingGetCommand,
  briefingListCommand,
  briefingPrefsCommand,
  briefingReadCommand,
} from './commands/briefing.ts'
import {
  cloudAgentGithubReposCommand,
  cloudAgentGitlabReposCommand,
  cloudAgentSessionCommand,
  cloudAgentSettingsCommand,
} from './commands/cloud-agent.ts'
import {
  reviewsCancelCommand,
  reviewsConfigCommand,
  reviewsGetCommand,
  reviewsListCommand,
  reviewsMemoryAnalyzeCommand,
  reviewsMemoryApproveCommand,
  reviewsMemoryEnableCommand,
  reviewsMemoryProposalsCommand,
  reviewsMemoryRejectCommand,
  reviewsMemorySummaryCommand,
  reviewsRetriggerCommand,
  reviewsSetModelCommand,
  reviewsToggleCommand,
} from './commands/code-reviews.ts'
import {
  cursorClearCommand,
  cursorListCommand,
  cursorResetCommand,
  cursorSetCommand,
  cursorShowCommand,
} from './commands/cursor.ts'
import {
  deploymentsCancelCommand,
  deploymentsDeleteCommand,
  deploymentsEventsCommand,
  deploymentsGetCommand,
  deploymentsListCommand,
} from './commands/deployments.ts'
import { feedbackSendCommand } from './commands/feedback.ts'
import {
  foldersCreateCommand,
  foldersDeleteCommand,
  foldersListCommand,
  foldersMoveCommand,
} from './commands/folders.ts'
import {
  indexingFilesCommand,
  indexingManifestCommand,
  indexingSearchCommand,
} from './commands/indexing.ts'
import {
  integrationsDetailCommand,
  integrationsGithubInstallationsCommand,
  integrationsGithubReposCommand,
  integrationsGitlabReposCommand,
  integrationsStatusCommand,
} from './commands/integrations.ts'
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
  modelsClearUseCommand,
  modelsFavoriteCommand,
  modelsFavoritesCommand,
  modelsListCommand,
  modelsPreferredCommand,
  modelsUnfavoriteCommand,
  modelsUseCommand,
} from './commands/models.ts'
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
import {
  profilesBindCommand,
  profilesBindingsCommand,
  profilesClearDefaultCommand,
  profilesCreateCommand,
  profilesDefaultCommand,
  profilesDeleteCommand,
  profilesDelVarCommand,
  profilesGetCommand,
  profilesListCommand,
  profilesSetCommandsCommand,
  profilesSetVarCommand,
  profilesUnbindCommand,
  profilesUpdateCommand,
} from './commands/profiles.ts'
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
  sessionsActiveCommand,
  sessionsDeleteCommand,
  sessionsDiffCommand,
  sessionsGetCommand,
  sessionsListCommand,
  sessionsMessagesCommand,
  sessionsRenameCommand,
  sessionsReposCommand,
  sessionsSearchCommand,
  sessionsShareCommand,
  sessionsUnifiedCommand,
  sessionsUnshareCommand,
  sessionsWorktreesCommand,
} from './commands/sessions.ts'
import {
  todosCreateItemCommand,
  todosCreateListCommand,
  todosDeleteItemCommand,
  todosDeleteListCommand,
  todosForSessionCommand,
  todosGetItemCommand,
  todosItemsCommand,
  todosListsCommand,
  todosUpdateItemCommand,
  todosUpdateListCommand,
  todosUpNextCommand,
} from './commands/todos.ts'
import { tuiCommand } from './commands/tui.ts'
import {
  webhooksCreateCommand,
  webhooksDeleteCommand,
  webhooksGetCommand,
  webhooksInvokeCommand,
  webhooksListCommand,
  webhooksRequestsCommand,
  webhooksUpdateCommand,
} from './commands/webhooks.ts'

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
    cursor: defineCommand({
      meta: { name: 'cursor', description: 'Stored cursors — the "where was I" markers' },
      subCommands: {
        list: cursorListCommand,
        show: cursorShowCommand,
        set: cursorSetCommand,
        reset: cursorResetCommand,
        clear: cursorClearCommand,
      },
      run: showParentHelp,
    }),
    sessions: defineCommand({
      meta: { name: 'sessions', description: 'Cloud session commands' },
      subCommands: {
        list: sessionsListCommand,
        get: sessionsGetCommand,
        rename: sessionsRenameCommand,
        unified: sessionsUnifiedCommand,
        active: sessionsActiveCommand,
        search: sessionsSearchCommand,
        repos: sessionsReposCommand,
        diff: sessionsDiffCommand,
        messages: sessionsMessagesCommand,
        worktrees: sessionsWorktreesCommand,
        share: sessionsShareCommand,
        unshare: sessionsUnshareCommand,
        delete: sessionsDeleteCommand,
      },
      run: showParentHelp,
    }),
    todos: defineCommand({
      meta: { name: 'todos', description: 'Todo lists and items' },
      subCommands: {
        lists: todosListsCommand,
        'create-list': todosCreateListCommand,
        'update-list': todosUpdateListCommand,
        'delete-list': todosDeleteListCommand,
        items: todosItemsCommand,
        'create-item': todosCreateItemCommand,
        'update-item': todosUpdateItemCommand,
        'get-item': todosGetItemCommand,
        'delete-item': todosDeleteItemCommand,
        'up-next': todosUpNextCommand,
        'for-session': todosForSessionCommand,
      },
      run: showParentHelp,
    }),
    models: defineCommand({
      meta: { name: 'models', description: 'Model catalog and preferences' },
      subCommands: {
        list: modelsListCommand,
        preferred: modelsPreferredCommand,
        favorites: modelsFavoritesCommand,
        favorite: modelsFavoriteCommand,
        unfavorite: modelsUnfavoriteCommand,
        use: modelsUseCommand,
        'clear-use': modelsClearUseCommand,
      },
      run: showParentHelp,
    }),
    profiles: defineCommand({
      meta: { name: 'profiles', description: 'Agent profiles' },
      subCommands: {
        list: profilesListCommand,
        get: profilesGetCommand,
        create: profilesCreateCommand,
        update: profilesUpdateCommand,
        delete: profilesDeleteCommand,
        default: profilesDefaultCommand,
        'clear-default': profilesClearDefaultCommand,
        'set-var': profilesSetVarCommand,
        'del-var': profilesDelVarCommand,
        'set-commands': profilesSetCommandsCommand,
        bind: profilesBindCommand,
        unbind: profilesUnbindCommand,
        bindings: profilesBindingsCommand,
      },
      run: showParentHelp,
    }),
    briefing: defineCommand({
      meta: { name: 'briefing', description: 'Agent briefings' },
      subCommands: {
        list: briefingListCommand,
        get: briefingGetCommand,
        read: briefingReadCommand,
        dismiss: briefingDismissCommand,
        prefs: briefingPrefsCommand,
        generate: briefingGenerateCommand,
      },
      run: showParentHelp,
    }),
    integrations: defineCommand({
      meta: { name: 'integrations', description: 'Connected platform integrations' },
      subCommands: {
        status: integrationsStatusCommand,
        'github-installations': integrationsGithubInstallationsCommand,
        'github-repos': integrationsGithubReposCommand,
        'gitlab-repos': integrationsGitlabReposCommand,
        detail: integrationsDetailCommand,
      },
      run: showParentHelp,
    }),
    webhooks: defineCommand({
      meta: { name: 'webhooks', description: 'Webhook triggers' },
      subCommands: {
        list: webhooksListCommand,
        get: webhooksGetCommand,
        create: webhooksCreateCommand,
        update: webhooksUpdateCommand,
        invoke: webhooksInvokeCommand,
        delete: webhooksDeleteCommand,
        requests: webhooksRequestsCommand,
      },
      run: showParentHelp,
    }),
    indexing: defineCommand({
      meta: { name: 'indexing', description: 'Code indexing and semantic search' },
      subCommands: {
        search: indexingSearchCommand,
        manifest: indexingManifestCommand,
        files: indexingFilesCommand,
      },
      run: showParentHelp,
    }),
    deployments: defineCommand({
      meta: { name: 'deployments', description: 'App builder deployments' },
      subCommands: {
        list: deploymentsListCommand,
        get: deploymentsGetCommand,
        events: deploymentsEventsCommand,
        cancel: deploymentsCancelCommand,
        delete: deploymentsDeleteCommand,
      },
      run: showParentHelp,
    }),
    account: defineCommand({
      meta: { name: 'account', description: 'Account, devices, notifications and alerts' },
      subCommands: {
        balance: accountBalanceCommand,
        devices: accountDevicesCommand,
        'revoke-device': accountRevokeDeviceCommand,
        'revoke-current': accountRevokeCurrentCommand,
        notifications: accountNotificationsCommand,
        'set-notifications': accountSetNotificationsCommand,
        'spend-alerts': accountSpendAlertsCommand,
        'top-up': accountTopUpCommand,
      },
      run: showParentHelp,
    }),
    feedback: defineCommand({
      meta: { name: 'feedback', description: 'Send feedback to the Kilo team' },
      subCommands: {
        send: feedbackSendCommand,
      },
      run: showParentHelp,
    }),
    folders: defineCommand({
      meta: { name: 'folders', description: 'Workspace folders (worktree grouping)' },
      subCommands: {
        list: foldersListCommand,
        create: foldersCreateCommand,
        delete: foldersDeleteCommand,
        move: foldersMoveCommand,
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
        settings: cloudAgentSettingsCommand,
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
        'memory-summary': reviewsMemorySummaryCommand,
        'memory-proposals': reviewsMemoryProposalsCommand,
        'memory-enable': reviewsMemoryEnableCommand,
        'memory-analyze': reviewsMemoryAnalyzeCommand,
        'memory-approve': reviewsMemoryApproveCommand,
        'memory-reject': reviewsMemoryRejectCommand,
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
