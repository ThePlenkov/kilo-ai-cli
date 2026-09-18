# AGENTS.md — kilo-ai-cli

CLI for interacting with the kilo.ai cloud tRPC API.

## Project Layout

```
packages/cli/
├── src/
│   ├── index.ts             # CLI entry point
│   ├── cli.ts               # Command definitions (citty)
│   ├── auth/                # Authentication (device auth, token store)
│   ├── api/                 # API client (tRPC + REST, constants, headers, types)
│   └── commands/            # CLI command handlers
├── test/                    # Vitest specs (mirrors src/ structure)
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
├── biome.json
└── .oxlintrc.json
```

## Tech Stack

- **Runtime**: Node.js >= 24.21.0 (LTS), native TypeScript execution
- **Language**: TypeScript 7.x, ESM, `.ts` import extensions
- **Build**: tsdown
- **Test**: vitest
- **Lint**: oxlint
- **Format**: biome
- **Monorepo**: Nx with @nx-devkit plugins (from `.nx-devkit/` submodule)
- **CLI framework**: citty
- **Validation**: zod

## Commands

```bash
npx nx build kilo-ai-cli       # Build with tsdown
npx nx test kilo-ai-cli        # Run vitest
npx nx typecheck kilo-ai-cli   # tsc --noEmit
npx nx lint kilo-ai-cli        # oxlint
npx nx format kilo-ai-cli      # biome check --write
```

## TDD Workflow

1. Write failing test in `test/**/*.spec.ts`
2. Implement minimum to pass in `src/**/*.ts`
3. `npx nx test kilo-ai-cli` → GREEN
4. `npx nx typecheck kilo-ai-cli && npx nx lint kilo-ai-cli && npx nx build kilo-ai-cli`
5. Commit

## Conventions

- Source files are `.ts` only (no `.js`, `.mjs`, `.cjs`)
- Use `.ts` extensions in relative imports
- `"type": "module"` in all package.json
- `erasableSyntaxOnly: true` — no enums, parameter properties, or namespaces
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `isolatedDeclarations: true` — exports must be explicitly typed

## API Reference

Based on `@kilocode/kilo-gateway` (Kilo-Org/kilocode) and `@kilocode/trpc` (Kilo-Org/cloud).

- Base URL: `process.env.KILO_API_URL || "https://api.kilo.ai"`
- tRPC endpoint: `${KILO_API_BASE}/api/trpc/{procedure}`
- Auth: OAuth 2.0 Device Authorization Grant → JWT Bearer token
- Headers: `Authorization: Bearer <token>`, `X-KILOCODE-ORGANIZATIONID`, `X-KILOCODE-EDITORNAME`

## Workflow

- **`$act` is always-on for every PR** — never ask whether to run it. After opening
  a PR, immediately run `$act --loop` (fetch threads → fix → reply → resolve →
  wait for CI → repeat until exit gate passes). This is the central workflow.
- **Releases are two-phase** — trigger via
  `gh workflow run release.yml -f version=patch` which opens a `release/vX.Y.Z`
  bump PR. Merging that PR into `main` triggers publish mode: npm via OIDC,
  `vX.Y.Z` tag, GitHub Release with auto-generated changelog. Automation never
  pushes to `main`; pushing a semver `v*` tag manually is the escape hatch and
  must match `packages/cli/package.json`.
