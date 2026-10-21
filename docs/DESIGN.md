# kilo-ai-cli — Design Document

> CLI for interacting with the kilo.ai cloud tRPC API.

## Overview

A standalone TypeScript CLI that authenticates with the kilo.ai cloud platform
via OAuth 2.0 Device Authorization Grant and provides typed access to the cloud
tRPC API — sessions, organizations, coding plans, BYOK entries, KiloClaw, and
more.

Built on the existing `@kilocode/kilo-gateway` patterns (Kilo-Org/kilocode) and
the cloud tRPC router structure (Kilo-Org/cloud).

## Architecture

```text
┌──────────────────────────────────────────────────┐
│                   kilo-ai-cli                     │
│                                                   │
│  ┌─────────┐   ┌──────────┐   ┌───────────────┐  │
│  │  CLI    │──▶│ Commands │──▶│  API Client   │  │
│  │  Parser │   │ (citty)  │   │  (tRPC + REST)│  │
│  └─────────┘   └──────────┘   └───────┬───────┘  │
│                                       │          │
│                ┌──────────────────────┤          │
│                │                      │          │
│         ┌──────▼──────┐      ┌───────▼────────┐  │
│         │   Auth      │      │   Headers      │  │
│         │  (Device    │      │  (Kilo-specific)│  │
│         │   Auth Flow)│      │                │  │
│         └──────┬──────┘      └────────────────┘  │
│                │                                 │
│         ┌──────▼──────┐                          │
│         │ Token Store │                          │
│         │ (~/.kilo/)  │                          │
│         └─────────────┘                          │
└──────────────────────────────────────────────────┘
                        │
                        ▼
              https://api.kilo.ai
                   /api/trpc/*
                   /api/profile
                   /api/device-auth/*
```

## Authentication

### OAuth 2.0 Device Authorization Grant

1. `POST /api/device-auth/codes` → `{ code, verificationUrl, expiresIn }`
2. Open browser to `verificationUrl`
3. Poll `GET /api/device-auth/codes/{code}` every 3s
   - `202` → pending
   - `200` → approved: `{ status: "approved", token, userEmail }`
   - `403` → denied
   - `410` → expired
4. Store token locally at `~/.kilo/credentials.json`

### Token usage

All API requests include:

```text
Authorization: Bearer <token>
User-Agent: kilo-ai-cli/<version>
X-KILOCODE-EDITORNAME: kilo-ai-cli <version>
X-KILOCODE-ORGANIZATIONID: <org-id>  (when set)
```

### Token types

```typescript
type KiloAuth =
  | { type: "api"; key: string }
  | { type: "oauth"; access: string; refresh: string; expires: number; accountId?: string }
  | { type: "wellknown"; key: string; token: string }
```

## API Endpoints

### Base URL

- `KILO_API_BASE` = `process.env.KILO_API_URL || "https://api.kilo.ai"`
- Session ingest: `process.env.KILO_SESSION_INGEST_URL || "https://ingest.kilosessions.ai"`

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/device-auth/codes` | Initiate device auth |
| GET | `/api/device-auth/codes/{code}` | Poll device auth |
| GET | `/api/profile` | Fetch user profile |
| GET | `/api/profile/balance` | Fetch balance |
| GET | `/api/defaults` | Fetch default model (free) |
| GET | `/api/organizations/{id}/defaults` | Fetch default model (org) |
| GET | `/api/kiloclaw/status` | KiloClaw status |
| GET | `/api/notifications` | Notifications |

### tRPC Procedures

tRPC queries use GET with `?input=<json>` and parse `{ result: { data: { json } } }`.

| Procedure | Type | Description |
|-----------|------|-------------|
| `cliSessionsV2.list` | query | List CLI sessions (cursor, limit, gitUrl, orgId) |
| `cliSessionsV2.get` | query | Get single session by session_id |
| `cliSessionsV2.getByCloudAgentSessionId` | query | Reverse lookup by cloud agent session ID |
| `cliSessionsV2.rename` | mutation | Rename a session |
| `cloudAgentNext.prepareSession` | mutation | Prepare a cloud agent session |
| `kiloclaw.fileTree` | query | KiloClaw file tree |
| `kiloclaw.removeMyPin` | mutation | Remove version pin |
| `organizations.list` | query | List user's organizations |
| `organizations.create` | mutation | Create organization |
| `organizations.updateCompanyDomain` | mutation | Update org company domain |
| `organizations.kiloclaw.getChangelog` | query | KiloClaw changelog |
| `organizations.kiloclaw.serviceDegraded` | query | Service degradation check |
| `organizations.kiloclaw.latestVersion` | query | Latest KiloClaw version |
| `organizations.kiloclaw.listKiloCliRuns` | query | List Kilo CLI runs |
| `organizations.kiloclaw.fileTree` | query | Org KiloClaw file tree |
| `organizations.kiloclaw.readFile` | query | Read KiloClaw file |
| `organizations.members.listPublic` | query | List public org members |
| `codingPlans.listSubscriptions` | query | List coding plan subscriptions |
| `codingPlans.getUsage` | query | Get coding plan usage |
| `byok.list` | query | List BYOK entries |
| `codeReviews.*` | — | Code review management |
| `personalReviewAgent.getReviewConfig` | query | Personal review agent config (model, style, actionRequired) |
| `personalReviewAgent.saveReviewConfig` | mutation | Save personal review agent config |
| `personalReviewAgent.toggleReviewAgent` | mutation | Enable/disable personal review agent |
| `organizations.reviewAgent.getReviewConfig` | query | Org review agent config |
| `organizations.reviewAgent.saveReviewConfig` | mutation | Save org review agent config |
| `usageAnalytics.*` | — | Usage analytics |
| `securityAgent.*` | — | Security agent findings |
| `unifiedSessions.list` | query | v1 + v2 sessions in one feed (`updatedSince` delta filter) |
| `unifiedSessions.recentRepositories` | query | Repositories touched since an instant |
| `activeSessions.list` | query | Sessions that are alive right now |
| `cliSessionsV2.getSessionDiff` | query | Worktree diff of a session |
| `cliSessionsV2.getSessionMessages` | query | Transcript of a session |
| `todos.lists.*` / `todos.items.*` | query/mutation | Todo lists and their items |
| `agentProfiles.*` | query/mutation | Agent profiles, variables, bindings |
| `agentBriefing.*` | query/mutation | The daily agent briefing |
| `models.list` / `models.preferred` | query | Model catalog |
| `modelPreferences.*` | query/mutation | Favorites and last selected model |
| `webhookTriggers.*` | query/mutation | Inbound webhooks and cron triggers |
| `codeIndexing.*` | query | Semantic code search and index manifests |
| `deployments.*` | query/mutation | App builder builds and deployments |
| `reviewMemory.*` | query/mutation | What the review agent learned |
| `platformIntegrations.listSetupStatus` | query | Which platforms are connected |
| `user.getContextBalance` | query | Session context budget |
| `spendAlerts.*` | query/mutation | Spend alert rules |
| `cloudAgentSettings.*` | query/mutation | Sandbox allocation and repo bindings |
| `workspaceFolders.*` | query/mutation | Sidebar grouping of worktrees |

The full router map lives in `Kilo-Org/cloud` at
`apps/web/src/routers/root-router.ts` — clone it shallow to enumerate
procedures and their input schemas.

## TypeScript Types

### Core types

```typescript
interface Organization { id: string; name: string; role: string }
interface KilocodeProfile { email: string; name?: string; organizations?: Organization[]; selectedOrganizationId?: string; hasPersonalAccount?: boolean }
interface KilocodeBalance { balance: number }
interface KiloPassState { currentPeriodBaseCreditsUsd: number; currentPeriodUsageUsd: number; currentPeriodBonusCreditsUsd: number; nextBillingAt?: string | null }
interface ByokEntry { id: string; provider_id: string; management_source: "user" | "coding_plan"; is_enabled: boolean }
interface CodingPlanSubscription { id: string; planId: string; planName: string; providerName: string; providerId: string; canQueryUsage: boolean; hasInstalledByokKey: boolean; status: "active" | "past_due" | "canceled"; cancelAtPeriodEnd: boolean }
interface CodingPlanQuotaWindow { id: string; remainingPercent: number; resetsAt: string; startsAt?: string; period: { unit: "hour" | "day" | "week" | "month"; value: number } }
interface CodingPlanUsage { schemaVersion: 1; fetchedAt: string; subscription: { id: string; planName: string; providerId: string; providerName: string; windows: CodingPlanQuotaWindow[] } }
interface DeviceAuthInitiateResponse { code: string; verificationUrl: string; expiresIn: number }
interface DeviceAuthPollResponse { status: "pending" | "approved" | "denied" | "expired"; token?: string; userEmail?: string }
```

## Delta Reads (Cursors)

The cloud API has no generic change feed, so the CLI keeps one **cursor** per
resource and computes the delta between two reads itself.

```text
src/state/cursor-store.ts   # Named cursors persisted in ~/.kilo/cursors.json
src/state/delta.ts          # resolveSince / applyDeltaAsync / timestamp parsing
```

A cursor entry is `{ value, updatedAt }`, where `value` is an ISO UTC instant.
`applyDeltaAsync` keeps the items strictly newer than the bound, then advances
the cursor to the newest timestamp of the fetched set — never backwards.

Delta reads are exposed as `--new` (bound = stored cursor), `--since <iso>`
(bound = explicit) and `--no-advance` (read without moving the cursor):

| Command | Cursor name |
| --- | --- |
| `reviews list --new` | `reviews` |
| `sessions unified --new` | `sessions` |
| `security findings list --new` | `security-findings` |

`unifiedSessions.list` accepts `updatedSince`, so the sessions delta is
filtered server-side; the other two filter client-side.

## CLI Commands

```text
kilo-ai-cli auth login          # Device auth flow
kilo-ai-cli auth logout         # Clear stored token
kilo-ai-cli auth status         # Show auth status

kilo-ai-cli profile             # Show profile + balance
kilo-ai-cli profile balance     # Show balance only

kilo-ai-cli org list            # List organizations
kilo-ai-cli org set <id>        # Set active organization

kilo-ai-cli sessions list       # List cloud sessions
kilo-ai-cli sessions get <id>   # Get session details
kilo-ai-cli sessions rename <id> <title>

kilo-ai-cli plans list          # List coding plan subscriptions
kilo-ai-cli plans usage <id>    # Show usage for a subscription

kilo-ai-cli byok list           # List BYOK entries

kilo-ai-cli cursor list         # Stored cursors ("where was I")
kilo-ai-cli cursor set <n> <v>  # Set a cursor manually

kilo-ai-cli todos lists         # Todo lists
kilo-ai-cli models list         # Model catalog
kilo-ai-cli profiles list       # Agent profiles
kilo-ai-cli webhooks list       # Webhook triggers
kilo-ai-cli account balance     # Balance and context budget
```

## Tech Stack

- **Runtime**: Node.js >= 24.21.0 (LTS)
- **Language**: TypeScript 7.x (native type stripping, ESM)
- **Build**: tsdown
- **Test**: vitest
- **Lint**: oxlint
- **Format**: biome
- **Monorepo**: Nx with @nx-devkit plugins (from submodule)
- **CLI framework**: citty
- **HTTP**: native fetch
- **Validation**: zod

## Project Structure

```text
kilo-ai-cli/
├── .nx-devkit/              # git submodule (nx-devkit/nx.ts)
├── docs/
│   └── DESIGN.md            # This file
├── src/
│   ├── index.ts             # CLI entry point
│   ├── cli.ts               # Command definitions (citty)
│   ├── auth/
│   │   ├── device-auth.ts   # Device auth flow
│   │   ├── token-store.ts   # Token storage (~/.kilo/)
│   │   └── types.ts         # KiloAuth types
│   ├── api/
│   │   ├── client.ts        # tRPC query/mutation helpers
│   │   ├── constants.ts     # API base URLs, headers
│   │   ├── headers.ts       # buildKiloHeaders()
│   │   ├── profile.ts       # Profile/balance/defaults
│   │   ├── trpc.ts          # tRPC procedures (sessions, plans, byok)
│   │   ├── cloud-sessions.ts # Cloud session fetch/import
│   │   ├── sessions.ts      # Unified + active sessions, diffs, transcripts
│   │   ├── todos.ts         # Todo lists and items
│   │   ├── profiles.ts      # Agent profiles
│   │   ├── models.ts        # Model catalog and preferences
│   │   ├── briefing.ts      # Agent briefings
│   │   ├── integrations.ts  # GitHub/GitLab/Slack/Linear/Discord/DoltHub
│   │   ├── webhooks.ts      # Webhook triggers
│   │   ├── indexing.ts      # Semantic code search
│   │   ├── deployments.ts   # App builder deployments
│   │   ├── account.ts       # Balance, devices, notifications, spend alerts
│   │   ├── review-memory.ts # Review memory proposals
│   │   ├── workspace-folders.ts # Worktree grouping
│   │   ├── cloud-agent-settings.ts # Sandbox allocation
│   │   ├── feedback.ts      # Feedback submission
│   │   └── types.ts         # API response types
│   ├── state/
│   │   ├── cursor-store.ts  # Named cursors (~/.kilo/cursors.json)
│   │   └── delta.ts         # Delta reads and timestamp parsing
│   └── commands/
│       ├── auth.ts          # auth login/logout/status
│       ├── profile.ts       # profile commands
│       ├── sessions.ts      # sessions commands
│       ├── cursor.ts        # cursor commands
│       ├── todos.ts         # todo commands
│       ├── models.ts        # model commands
│       ├── profiles.ts      # agent profile commands
│       ├── briefing.ts      # briefing commands
│       ├── integrations.ts  # integration commands
│       ├── webhooks.ts      # webhook trigger commands
│       ├── indexing.ts      # code index commands
│       ├── deployments.ts   # deployment commands
│       ├── account.ts       # account commands
│       ├── feedback.ts      # feedback commands
│       ├── folders.ts       # workspace folder commands
│       ├── organizations.ts # org commands
│       └── plans.ts         # plans + byok commands
├── test/
│   ├── auth/
│   ├── api/
│   ├── state/
│   ├── tui/
│   └── commands/
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
├── biome.json
├── .oxlintrc.json
├── nx.json
└── .gitignore
```

## Nx Plugin Configuration

Uses `@nx-devkit/*` plugins from the `.nx-devkit/` submodule. Plugins are
referenced via `file:` protocol in `package.json` and registered by package
name in `nx.json`. The typescript preset plugin auto-infers `typecheck`,
`test`, `build` (via tsdown), `lint` (via oxlint), and `format` (via biome)
targets from config files — no `project.json` needed.

## Development Workflow (TDD + SDD)

1. Write failing test (`*.spec.ts`)
2. Implement minimum to pass
3. Refactor
4. `npx nx typecheck && npx nx test && npx nx lint && npx nx build`
5. Commit

## References

- [Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode) — `packages/kilo-gateway/`
- [Kilo-Org/cloud](https://github.com/Kilo-Org/cloud) — `packages/trpc/`, `apps/web/src/routers/`
- [nx-devkit/nx.ts](https://github.com/nx-devkit/nx.ts) — Nx inference plugins
