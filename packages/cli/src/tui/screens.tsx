/** Screen registry — sidebar groups mirror the kilo.ai web app navigation. */

import React, { useState } from 'react'

import type { FindingsFilter, ScreenDef, ScreenProps } from './types.ts'

import { ProfileScreen } from './views/profile.tsx'
import { SessionDetailScreen, SessionsScreen } from './views/sessions.tsx'
import { PlansScreen, PlanUsageScreen } from './views/plans.tsx'
import { ByokScreen } from './views/byok.tsx'
import {
  KiloclawAgentsScreen,
  KiloclawBillingScreen,
  KiloclawChangelogScreen,
  KiloclawFileScreen,
  KiloclawFilesScreen,
  KiloclawHistoryScreen,
  KiloclawInstancesScreen,
  KiloclawSubscriptionsScreen,
  KiloclawVersionScreen,
} from './views/kiloclaw.tsx'
import { CloudAgentReposScreen, CloudAgentSessionScreen } from './views/cloud-agent.tsx'
import { ReviewDetailScreen, ReviewsScreen } from './views/reviews.tsx'
import { AppBuilderScreen } from './views/app-builder.tsx'
import {
  AnalyticsBreakdownScreen,
  AnalyticsSummaryScreen,
  AnalyticsTableScreen,
  AnalyticsTimeseriesScreen,
} from './views/analytics.tsx'
import {
  OrgCreditsScreen,
  OrgDetailScreen,
  OrgInvoicesScreen,
  OrgMembersScreen,
  OrgModelsScreen,
  OrgsScreen,
  OrgSeatsScreen,
  OrgSecurityScreen,
  OrgUsageScreen,
} from './views/orgs.tsx'
import {
  SecurityCommandsScreen,
  SecurityConfigScreen,
  SecurityReposScreen,
  SecurityStatusScreen,
} from './views/security-extra.tsx'
import { FindingsListView } from './views/FindingsListView.tsx'
import { FindingDetailView } from './views/FindingDetailView.tsx'
import { StatsView } from './views/StatsView.tsx'
import { DashboardView } from './views/DashboardView.tsx'

function FindingsScreen({ ctx, focused }: ScreenProps) {
  const [filter, setFilter] = useState<FindingsFilter>({ limit: 50, offset: 0 })
  return (
    <FindingsListView
      token={ctx.token}
      focused={focused}
      filter={filter}
      onFilterChange={setFilter}
      onSelectFinding={(id) => ctx.navigate('security-finding', { id })}
      onBack={ctx.goBack}
    />
  )
}

export const SCREENS: ScreenDef[] = [
  // Dashboard
  { name: 'profile', group: 'Dashboard', title: 'Your Profile', component: ProfileScreen },

  // Cloud
  { name: 'sessions', group: 'Cloud', title: 'Sessions', component: SessionsScreen },
  { name: 'session', group: 'Cloud', title: 'Session', hidden: true, component: SessionDetailScreen },
  {
    name: 'cloud-github',
    group: 'Cloud',
    title: 'Agent · GitHub repos',
    component: (p: ScreenProps) => <CloudAgentReposScreen {...p} provider="github" />,
  },
  {
    name: 'cloud-gitlab',
    group: 'Cloud',
    title: 'Agent · GitLab repos',
    component: (p: ScreenProps) => <CloudAgentReposScreen {...p} provider="gitlab" />,
  },
  { name: 'cloud-session', group: 'Cloud', title: 'Agent · Session lookup', component: CloudAgentSessionScreen },
  { name: 'reviews', group: 'Cloud', title: 'Code Reviewer', component: ReviewsScreen },
  { name: 'review-detail', group: 'Cloud', title: 'Review detail', component: ReviewDetailScreen, hidden: true },
  { name: 'security-findings', group: 'Security', title: 'Findings', component: FindingsScreen },
  { name: 'security-finding', group: 'Security', title: 'Finding', hidden: true, component: FindingDetailWrapper },
  { name: 'security-repos', group: 'Security', title: 'Repositories', component: SecurityReposScreen },
  { name: 'security-stats', group: 'Security', title: 'Stats', component: StatsWrapper },
  { name: 'security-dashboard', group: 'Security', title: 'Dashboard', component: DashboardWrapper },
  { name: 'security-commands', group: 'Security', title: 'Commands', component: SecurityCommandsScreen },
  { name: 'security-config', group: 'Security', title: 'Config', component: SecurityConfigScreen },
  { name: 'security-status', group: 'Security', title: 'Permissions', component: SecurityStatusScreen },
  { name: 'app-builder', group: 'Cloud', title: 'App Builder', component: AppBuilderScreen },

  // Usage
  { name: 'analytics-summary', group: 'Usage', title: 'Summary', component: AnalyticsSummaryScreen },
  { name: 'analytics-timeseries', group: 'Usage', title: 'Timeseries', component: AnalyticsTimeseriesScreen },
  { name: 'analytics-breakdown', group: 'Usage', title: 'Breakdown', component: AnalyticsBreakdownScreen },
  { name: 'analytics-table', group: 'Usage', title: 'Table', component: AnalyticsTableScreen },
  { name: 'plans', group: 'Usage', title: 'Coding Plans', component: PlansScreen },
  { name: 'plan-usage', group: 'Usage', title: 'Plan usage', hidden: true, component: PlanUsageScreen },

  // KiloClaw
  { name: 'kiloclaw-instances', group: 'KiloClaw', title: 'Instances', component: KiloclawInstancesScreen },
  { name: 'kiloclaw-agents', group: 'KiloClaw', title: 'Agents', component: KiloclawAgentsScreen },
  { name: 'kiloclaw-billing', group: 'KiloClaw', title: 'Billing', component: KiloclawBillingScreen },
  { name: 'kiloclaw-history', group: 'KiloClaw', title: 'Billing History', component: KiloclawHistoryScreen },
  { name: 'kiloclaw-subscriptions', group: 'KiloClaw', title: 'Subscriptions', component: KiloclawSubscriptionsScreen },
  { name: 'kiloclaw-changelog', group: 'KiloClaw', title: "What's New", component: KiloclawChangelogScreen },
  { name: 'kiloclaw-version', group: 'KiloClaw', title: 'Version', component: KiloclawVersionScreen },
  { name: 'kiloclaw-files', group: 'KiloClaw', title: 'Files', component: KiloclawFilesScreen },
  { name: 'kiloclaw-file', group: 'KiloClaw', title: 'File', hidden: true, component: KiloclawFileScreen },

  // Organizations
  { name: 'orgs', group: 'Organizations', title: 'All Organizations', component: OrgsScreen },
  { name: 'org', group: 'Organizations', title: 'Organization', hidden: true, component: OrgDetailScreen },
  { name: 'org-members', group: 'Organizations', title: 'Members', hidden: true, component: OrgMembersScreen },
  { name: 'org-usage', group: 'Organizations', title: 'Usage', hidden: true, component: OrgUsageScreen },
  { name: 'org-credits', group: 'Organizations', title: 'Credits', hidden: true, component: OrgCreditsScreen },
  { name: 'org-seats', group: 'Organizations', title: 'Seats', hidden: true, component: OrgSeatsScreen },
  { name: 'org-invoices', group: 'Organizations', title: 'Invoices', hidden: true, component: OrgInvoicesScreen },
  { name: 'org-models', group: 'Organizations', title: 'Models', hidden: true, component: OrgModelsScreen },
  { name: 'org-security', group: 'Organizations', title: 'Security', hidden: true, component: OrgSecurityScreen },

  // Account
  { name: 'byok', group: 'Account', title: 'BYOK Keys', component: ByokScreen },
]

function FindingDetailWrapper({ ctx, focused }: ScreenProps) {
  return (
    <FindingDetailView token={ctx.token} findingId={ctx.route.params.id ?? ''} onBack={ctx.goBack} focused={focused} />
  )
}

function StatsWrapper({ ctx, focused }: ScreenProps) {
  return <StatsView token={ctx.token} onBack={ctx.goBack} focused={focused} />
}

function DashboardWrapper({ ctx, focused }: ScreenProps) {
  return <DashboardView token={ctx.token} onBack={ctx.goBack} focused={focused} />
}
