# kilo-ai-cli

CLI for interacting with the [kilo.ai](https://kilo.ai) cloud tRPC API.

## Features

- **Authentication** — OAuth 2.0 Device Authorization Grant (browser-based login)
- **Profile** — View your profile, balance, and organization info
- **Sessions** — List, inspect, and rename cloud CLI sessions
- **Organizations** — List and switch between organizations
- **Coding Plans** — View subscriptions and usage quotas
- **BYOK** — List bring-your-own-key entries

## Quick Start

```bash
# Install
npm install

# Authenticate
npx nx build kilo-ai-cli
node packages/cli/dist/index.mjs auth login

# Use
node packages/cli/dist/index.mjs sessions list
node packages/cli/dist/index.mjs profile
node packages/cli/dist/index.mjs plans list
```

## Commands

```
kilo-ai-cli auth login          # Browser-based authentication
kilo-ai-cli auth logout         # Clear stored credentials
kilo-ai-cli auth status         # Show authentication status

kilo-ai-cli profile             # Show profile + balance
kilo-ai-cli balance             # Show credit balance

kilo-ai-cli sessions list       # List cloud sessions
kilo-ai-cli sessions get <id>   # Get session details
kilo-ai-cli sessions rename <id> <title>

kilo-ai-cli org list            # List organizations
kilo-ai-cli org set <id>        # Set active organization

kilo-ai-cli plans list          # List coding plan subscriptions
kilo-ai-cli plans usage <id>    # Show usage for a subscription

kilo-ai-cli byok list           # List BYOK entries
```

## Development

```bash
npx nx build kilo-ai-cli       # Build with tsdown
npx nx test kilo-ai-cli        # Run vitest (68 tests)
npx nx typecheck kilo-ai-cli   # tsc --noEmit
npx nx lint kilo-ai-cli        # oxlint
npx nx format kilo-ai-cli      # biome check --write
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| TypeScript 7 | Language (native type stripping, ESM) |
| Node.js >= 24.21.0 | Runtime (LTS) |
| tsdown | Build / bundle |
| vitest | Test framework |
| oxlint | Linter |
| biome | Formatter |
| citty | CLI framework |
| zod | Schema validation |
| Nx + @nx-devkit | Monorepo (zero-config inference plugins) |

## Architecture

See [docs/DESIGN.md](docs/DESIGN.md) for the full design document.

## License

MIT
