# kilo-ai-cli

A command-line interface for the [kilo.ai](https://kilo.ai) cloud platform. Authenticate via browser, manage sessions and organizations, inspect coding plans and usage, run KiloClaw instances, trigger code reviews, browse usage analytics, deploy apps, and operate the personal Security Agent — all from your terminal.

- **Auth** — OAuth 2.0 Device Authorization Grant (browser-based login, persisted credentials)
- **Profile & Balance** — view your profile, credit balance, and active organization
- **Sessions** — list, inspect, and rename cloud CLI sessions
- **Organizations** — list, switch, create, update, manage members, seats, usage, credits, invoices, models, and security
- **Coding Plans** — view subscriptions and usage quotas (windows, remaining percent, resets)
- **BYOK** — list bring-your-own-key entries
- **KiloClaw** — manage instances, billing, subscriptions, changelog, versions, file trees, run lifecycle
- **Cloud Agent** — inspect sessions and connected GitHub/GitLab repositories
- **Code Reviews** — list reviews, view/toggle review configuration
- **Usage Analytics** — summary, timeseries, breakdown, and table views
- **App Builder** — list apps, check eligibility, deploy
- **Security Agent** — enable/disable, list repos and findings, view finding details, stats, dashboard, sync, dismiss, analyze, remediate, retry/cancel remediation, list commands, orphaned repos, last sync, bulk delete findings
- **TUI** — interactive terminal UI for the security agent (Ink/React)

---

## Table of Contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Configuration](#configuration)
- [Commands](#commands)
  - [auth](#auth)
  - [profile](#profile)
  - [balance](#balance)
  - [sessions](#sessions)
  - [org](#org)
  - [plans](#plans)
  - [byok](#byok)
  - [kiloclaw](#kiloclaw)
  - [cloud-agent](#cloud-agent)
  - [reviews](#reviews)
  - [analytics](#analytics)
  - [app-builder](#app-builder)
  - [security](#security)
  - [tui](#tui)
- [Interactive TUI Mode](#interactive-tui-mode)
- [Environment Variables](#environment-variables)
- [Credential Storage](#credential-storage)
- [Exit Codes](#exit-codes)
- [Development](#development)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

---

## Requirements

- **Node.js** `>= 24.21.0` (LTS recommended)
- A kilo.ai account (sign up at [kilo.ai](https://kilo.ai))

The CLI uses native TypeScript type stripping (no transpilation step at runtime), ESM modules, and modern Node.js APIs. Older Node.js versions are not supported.

---

## Install

### From npm (when published)

```bash
# Global install
npm install -g kilo-ai-cli

# Or run ad-hoc without installing
npx kilo-ai-cli auth login
```

### From source (development)

```bash
git clone --recurse-submodules https://github.com/ThePlenkov/kilo-ai-cli.git
cd kilo-ai-cli

# Install dependencies
npm install

# Build the .nx-devkit submodule plugins (required for Nx)
cd .nx-devkit
bun install --frozen-lockfile --ignore-scripts
bun run build
cd ..

# Build the CLI
npx nx build kilo-ai-cli

# Run the built CLI
node packages/cli/dist/index.mjs --help

# Or run directly from source (native TS execution)
node packages/cli/src/index.ts --help
```

---

## Quick Start

```bash
# 1. Authenticate (opens browser)
kilo-ai-cli auth login

# 2. Check your profile and balance
kilo-ai-cli profile
kilo-ai-cli balance

# 3. List your cloud sessions
kilo-ai-cli sessions list

# 4. List organizations and switch
kilo-ai-cli org list
kilo-ai-cli org set <org-id>

# 5. View coding plan usage
kilo-ai-cli plans list
kilo-ai-cli plans usage <subscription-id>

# 6. Explore the security agent
kilo-ai-cli security status
kilo-ai-cli security findings
kilo-ai-cli security dashboard

# 7. Launch the interactive TUI
kilo-ai-cli tui
```

---

## Authentication

The CLI uses the **OAuth 2.0 Device Authorization Grant** flow. When you run `kilo-ai-cli auth login`:

1. The CLI requests a device code from the Kilo API.
2. It prints a verification URL and a user code to the terminal.
3. You open the verification URL in your browser and enter the code.
4. The CLI polls the API until you authorize the request.
5. The resulting token is stored locally at `~/.kilo/credentials.json`.
6. Subsequent commands read the token automatically.

Tokens are long-lived (1 year). To re-authenticate, run `kilo-ai-cli auth login` again. To clear credentials, run `kilo-ai-cli auth logout`.

```bash
kilo-ai-cli auth login     # Authenticate via browser
kilo-ai-cli auth logout    # Clear stored credentials
kilo-ai-cli auth status    # Show current authentication status
```

---

## Configuration

The CLI reads configuration from environment variables and a local credentials file. No config file is required for basic usage.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KILO_API_URL` | `https://api.kilo.ai` | Base URL for the Kilo API |
| `KILO_SESSION_INGEST_URL` | `https://ingest.kilosessions.ai` | Session ingest endpoint |
| `KILO_CLI_VERSION` | _(from package)_ | Version reported in User-Agent |

### Credential Storage

Credentials are stored at `~/.kilo/credentials.json` with the following shape:

```json
{
  "type": "oauth",
  "access": "<jwt>",
  "refresh": "<refresh-token>",
  "expires": 1760000000000,
  "accountId": "user-123"
}
```

The file is created with `0600` permissions. Do not commit this file or share it.

---

## Commands

All commands support `--help` / `-h` for inline usage. Parent commands (e.g. `kilo-ai-cli security`) show a list of available subcommands when invoked without arguments or with `--help`.

### auth

```text
kilo-ai-cli auth login      # Authenticate with kilo.ai via browser
kilo-ai-cli auth logout     # Clear stored credentials
kilo-ai-cli auth status     # Show authentication status
```

### profile

```text
kilo-ai-cli profile         # Show your profile and active organization
```

### balance

```text
kilo-ai-cli balance         # Show your credit balance
```

### sessions

```text
kilo-ai-cli sessions list                    # List cloud CLI sessions
kilo-ai-cli sessions get <id>                # Get details of a session
kilo-ai-cli sessions rename <id> <title>     # Rename a session
```

### org

Organization management. Some subcommands require an active organization (set via `org set`).

```text
kilo-ai-cli org list                        # List organizations you belong to
kilo-ai-cli org set <id>                    # Set the active organization
kilo-ai-cli org members <id>               # List members of an organization
kilo-ai-cli org usage <id>                  # Show usage for an organization
kilo-ai-cli org credits <id>               # Show credits for an organization
kilo-ai-cli org seats <id>                 # Show seats for an organization
kilo-ai-cli org invoices <id>              # List invoices for an organization
kilo-ai-cli org create                     # Create a new organization
kilo-ai-cli org update <id>                # Update organization settings
kilo-ai-cli org models <id>                # List available models for an organization
kilo-ai-cli org security <id>              # Show security settings for an organization
```

### plans

```text
kilo-ai-cli plans list               # List coding plan subscriptions
kilo-ai-cli plans usage <sub-id>     # Show usage for a subscription (windows, remaining %, resets)
```

### byok

```text
kilo-ai-cli byok list                # List bring-your-own-key entries
```

### kiloclaw

Manage KiloClaw managed instances.

```text
kilo-ai-cli kiloclaw instances                   # List instances
kilo-ai-cli kiloclaw billing                       # Show billing info
kilo-ai-cli kiloclaw billing-history              # Show billing history
kilo-ai-cli kiloclaw subscriptions                 # List subscriptions
kilo-ai-cli kiloclaw subscription <id>             # Show subscription details
kilo-ai-cli kiloclaw changelog                     # Show changelog
kilo-ai-cli kiloclaw version                       # Show version info
kilo-ai-cli kiloclaw file-tree <instance>          # Show file tree for an instance
kilo-ai-cli kiloclaw run-start <instance>          # Start a run
kilo-ai-cli kiloclaw run-status <instance>         # Show run status
kilo-ai-cli kiloclaw run-cancel <instance>         # Cancel a running job
kilo-ai-cli kiloclaw unpin <instance>             # Unpin an instance
```

### cloud-agent

```text
kilo-ai-cli cloud-agent session                    # Show cloud agent session info
kilo-ai-cli cloud-agent github-repos              # List connected GitHub repositories
kilo-ai-cli cloud-agent gitlab-repos              # List connected GitLab repositories
```

### reviews

```text
kilo-ai-cli reviews list <org>                    # List code reviews for an organization
kilo-ai-cli reviews config <org> <platform>       # Show review configuration (github/gitlab)
kilo-ai-cli reviews toggle <org> <platform> --enabled <bool>   # Toggle code reviews on/off
```

### analytics

```text
kilo-ai-cli analytics summary                      # Show usage summary
kilo-ai-cli analytics timeseries                   # Show usage over time
kilo-ai-cli analytics breakdown                    # Show usage breakdown by dimension
kilo-ai-cli analytics table                         # Show usage in table format
```

### app-builder

```text
kilo-ai-cli app-builder list                       # List apps
kilo-ai-cli app-builder eligibility                # Check deployment eligibility
kilo-ai-cli app-builder deploy                     # Deploy an app
```

### security

The Security Agent operates at the **personal level** — no organization context is required. It monitors your repositories for security findings (vulnerabilities, license issues, etc.) and can automatically remediate them.

```text
# Status & configuration
kilo-ai-cli security status                        # Show permission status
kilo-ai-cli security config                        # Show security agent configuration
kilo-ai-cli security enable                        # Enable the security agent
kilo-ai-cli security disable                       # Disable the security agent

# Repositories
kilo-ai-cli security repos                          # List monitored repositories
kilo-ai-cli security orphaned-repos                # List orphaned repositories
kilo-ai-cli security sync                           # Trigger a security sync
kilo-ai-cli security last-sync                     # Show last sync time

# Findings
kilo-ai-cli security findings [options]            # List findings
kilo-ai-cli security finding <id>                  # Get finding details
kilo-ai-cli security dismiss <id>                   # Dismiss a finding
kilo-ai-cli security delete-findings <repo>        # Delete all findings for a repo (interactive)
kilo-ai-cli security delete-findings <repo> --yes  # Delete without confirmation prompt

# Analysis & remediation
kilo-ai-cli security analyze <repo>                 # Start security analysis for a repository
kilo-ai-cli security remediate <finding-id>         # Start remediation for a finding
kilo-ai-cli security retry-remediation <cmd-id>     # Retry a failed remediation
kilo-ai-cli security cancel-remediation <cmd-id>   # Cancel an in-progress remediation

# Stats & dashboard
kilo-ai-cli security stats                          # Show security agent statistics
kilo-ai-cli security dashboard                     # Show dashboard stats

# Commands
kilo-ai-cli security commands                       # List active security agent commands
kilo-ai-cli security command <id>                   # Get status of a specific command
```

#### `security findings` options

| Flag | Type | Description |
|------|------|-------------|
| `--repo` | string | Filter by repository full name (e.g. `user/repo`) |
| `--severity` | string | Filter by severity: `critical` / `high` / `medium` / `low` / `info` |
| `--status` | string | Filter by status: `open` / `dismissed` / `remediated` / `in_progress` |
| `--overdue` | boolean | Only show overdue findings |
| `--limit` | string | Max findings to show (1–100, default `50`) |
| `--offset` | string | Pagination offset (default `0`) |

Output includes a summary (total, running, concurrency) followed by a table with ID, severity (color-coded), title, repository (clickable hyperlink), status (color-coded), and package columns.

#### `security finding <id>` output

Shows full finding details: severity, title, repository, status, source, description, package (with ecosystem), vulnerable version range, patched version, CVE, GHSA, CVSS score, SLA due date, analysis status, remediation summary, created/updated timestamps.

### tui

```text
kilo-ai-cli tui                                    # Launch interactive TUI for the security agent
```

---

## Interactive TUI Mode

The `tui` command launches a full-screen interactive terminal UI built with [Ink](https://github.com/vadimdemedes/ink) (React for CLIs). It provides a navigable interface for the Security Agent:

- **Menu** — navigate between views
- **Dashboard** — overview of security stats
- **Findings List** — browse and filter findings
- **Finding Detail** — inspect a single finding
- **Stats** — aggregated security statistics

Use arrow keys to navigate, Enter to select, and `q` or `Esc` to quit.

---

## Environment Variables

```bash
# Override the API base URL (e.g. for self-hosted or staging)
export KILO_API_URL=https://staging.api.kilo.ai

# Override the session ingest URL
export KILO_SESSION_INGEST_URL=https://staging.ingest.kilosessions.ai

# Override the CLI version reported in User-Agent
export KILO_CLI_VERSION=1.0.0
```

---

## Credential Storage

| OS | Path |
|----|------|
| Linux / macOS | `~/.kilo/credentials.json` |
| Windows | `%USERPROFILE%\.kilo\credentials.json` |

The file is created with `0600` permissions (owner read/write only). If the file is removed, the CLI will prompt for re-authentication on the next command.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error (invalid input, API error, not authenticated) |

Errors are printed to `stderr`. The CLI exits non-zero on any failure.

---

## Development

### Prerequisites

- Node.js `>= 24.21.0`
- [Bun](https://bun.sh) (for building the `.nx-devkit` submodule)
- [Nx](https://nx.dev) (installed via `npm install`)

### Build

```bash
# Build the .nx-devkit submodule plugins (first time only)
cd .nx-devkit
bun install --frozen-lockfile --ignore-scripts
bun run build
cd ..

# Build the CLI (tsdown bundles to packages/cli/dist/index.mjs)
npx nx build kilo-ai-cli
```

### Test

```bash
npx nx test kilo-ai-cli        # Run vitest
```

### Typecheck

```bash
npx nx typecheck kilo-ai-cli   # tsc --noEmit
```

### Lint

```bash
npx nx lint kilo-ai-cli        # oxlint
```

### Format

```bash
npx nx format kilo-ai-cli      # biome check --write
```

### Run from source

The CLI supports native TypeScript execution — no build step needed for development:

```bash
node packages/cli/src/index.ts auth login
node packages/cli/src/index.ts security findings
```

### Project structure

```text
kilo-ai-cli/
├── packages/
│   └── cli/
│       ├── src/
│       │   ├── api/            # API client, tRPC helpers, types
│       │   ├── auth/           # Device auth flow, token store
│       │   ├── commands/       # CLI command handlers (citty)
│       │   ├── tui/            # Interactive TUI (Ink/React)
│       │   ├── cli.ts          # Command tree
│       │   └── index.ts        # Entry point
│       ├── test/               # Vitest tests
│       ├── package.json
│       ├── tsconfig.json
│       └── tsdown.config.ts
├── .nx-devkit/                 # Nx TypeScript plugin submodule
├── .github/workflows/          # CI/CD
├── docs/                       # Design docs
├── nx.json
└── package.json
```

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [TypeScript 7](https://www.typescriptlang.org/) | Language (native type stripping, ESM) |
| [Node.js](https://nodejs.org/) `>= 24.21.0` | Runtime (LTS) |
| [tsdown](https://github.com/sxzz/tsdown) | Build / bundle |
| [Vitest](https://vitest.dev/) | Test framework |
| [Oxlint](https://oxc.rs/docs/guide/usage/linter) | Linter |
| [Biome](https://biomejs.dev/) | Formatter |
| [Citty](https://github.com/unjs/citty) | CLI framework |
| [Zod](https://zod.dev/) | Schema validation |
| [Ink](https://github.com/vadimdemedes/ink) + [React](https://react.dev/) | Interactive TUI |
| [Nx](https://nx.dev/) + [@nx-devkit](https://github.com/nx-devkit/nx.ts) | Monorepo (zero-config inference plugins) |

---

## Architecture

The CLI is a single-package Nx monorepo workspace. The `packages/cli` package contains all source code. The `.nx-devkit` submodule provides Nx TypeScript plugins for zero-config inference (tsdown, vitest, oxlint, biome, tsc).

### API layer

- `src/api/client.ts` — generic `trpcQuery` / `trpcMutate` helpers with Zod validation, size limits, timeout, and typed errors
- `src/api/trpc.ts` — typed procedure wrappers for each Kilo Cloud router
- `src/api/types.ts` — TypeScript interfaces mirroring the Kilo Cloud schema
- `src/api/constants.ts` — API base URL, headers, polling intervals
- `src/api/headers.ts` — auth header builder (Bearer token, organization, editor)

### Auth layer

- `src/auth/device-auth.ts` — OAuth 2.0 Device Authorization Grant flow
- `src/auth/token-store.ts` — file-based credential store (`~/.kilo/credentials.json`)

### Command layer

- `src/commands/*.ts` — one file per command group (auth, profile, sessions, org, plans, byok, kiloclaw, cloud-agent, reviews, analytics, app-builder, security-agent, tui)
- `src/commands/format.ts` — shared table/summary formatting helpers
- `src/commands/theme.ts` — shared color scheme and OSC 8 hyperlink helpers
- `src/commands/confirm.ts` — interactive confirmation prompt
- `src/cli.ts` — command tree wiring

### TUI layer

- `src/tui/App.tsx` — root Ink component
- `src/tui/views/*.tsx` — individual views (Menu, Dashboard, FindingsList, FindingDetail, Stats)

See [docs/DESIGN.md](docs/DESIGN.md) for the full design document.

---

## Contributing

Contributions are welcome via pull requests to the [`ThePlenkov/kilo-ai-cli`](https://github.com/ThePlenkov/kilo-ai-cli) repository.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/my-feature`.
3. Make your changes following the existing conventions.
4. Run the full verification suite:
   ```bash
   npx nx typecheck kilo-ai-cli
   npx nx lint kilo-ai-cli
   npx nx test kilo-ai-cli
   npx nx build kilo-ai-cli
   ```
5. Open a pull request against `main`.

### Conventions

- Source files use `.ts` / `.tsx` extensions.
- Relative imports include the `.ts` extension.
- ESM only (`"type": "module"`).
- No enums, parameter properties, or namespaces.
- `verbatimModuleSyntax: true`, `isolatedDeclarations: true`.
- Type-only imports use `import type`.
- Follow [TDD](https://en.wikipedia.org/wiki/Test-driven_development): write a failing test, implement the minimum change, verify.

---

## License

[MIT](LICENSE)
