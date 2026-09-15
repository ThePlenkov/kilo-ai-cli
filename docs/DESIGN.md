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

```
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
```
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

## CLI Commands

```
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

kilo-ai-cli claw status         # KiloClaw status
kilo-ai-cli claw files [path]   # KiloClaw file tree
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

```
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
│   │   ├── client.ts        # tRPC query helper
│   │   ├── constants.ts     # API base URLs, headers
│   │   ├── headers.ts       # buildKiloHeaders()
│   │   ├── profile.ts       # Profile/balance/defaults
│   │   ├── trpc.ts          # tRPC procedures (sessions, plans, byok)
│   │   ├── cloud-sessions.ts # Cloud session fetch/import
│   │   └── types.ts         # API response types
│   └── commands/
│       ├── auth.ts          # auth login/logout/status
│       ├── profile.ts       # profile commands
│       ├── sessions.ts      # sessions commands
│       ├── organizations.ts # org commands
│       └── plans.ts         # plans + byok commands
├── test/
│   ├── auth/
│   ├── api/
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
