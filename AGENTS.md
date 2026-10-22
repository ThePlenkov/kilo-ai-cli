# AGENTS.md — kilo-ai-cli

CLI for interacting with the kilo.ai cloud tRPC API.

## Project Layout

```text
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
- **Monorepo**: Nx with @nx-devkit plugins (from npm)
- **CLI framework**: citty
- **Validation**: zod

## Commands

```bash
npm run ci                     # The whole local gate (sverka) — run this before a push
npx nx build kilo-ai-cli       # Build with tsdown
npx nx test kilo-ai-cli        # Run vitest
npx nx typecheck kilo-ai-cli   # tsc --noEmit
npx nx lint kilo-ai-cli        # oxlint
npx nx format kilo-ai-cli      # biome check --write
```

## Local CI (sverka)

`sverka.config.ts` is the single definition of the check set. The pre-push
hook runs the whole gate before a normal push (`git push --no-verify` skips
it — it is a guard rail, not a lock):

```bash
npm run ci          # the check set: plugins, typecheck, lint, lint-sarif, format, docs,
                    #   test, build, pack, smoke, audit, policy
npm run ci:health   # repository hygiene: main green, review debt, stale branches, dependabot alerts
npm run ci:policy   # evaluate the collected findings against the policy on their own
```

The `policy` step is the one the hosted workflow does not run: the evaluator
is the sverka CLI, which lives outside this repository, so the hosted
workflow keeps the lint step's own gate until the sverka npm package is
installable in CI.

The GitHub workflow runs the same set except the `policy` step, so a green
local run means a green pipeline.

Both are also reachable through the sverka CLI:

```bash
npx sverka run --entry ci/local
npx sverka run --entry repo-health/check
npx sverka view      # the last run's report
```

The GitHub workflow is still the hand-written `.github/workflows/ci.yml`:
sverka's GitHub template emits only checkout + setup-node + `npm ci
--ignore-scripts`, with no way to inject the extra steps this repository
needs. Migrating it means sverka gaining that ability.

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
  The release job approves the CI run of the bump PR it created: a
  bot-authored pull request still produces a workflow run, but it waits for a
  maintainer approval instead of executing, and without the approval the
  required `check` on `main` never arrives. The job also verifies the
  published version against the registry afterwards. Both the guard and the check probe the
  **per-version manifest** (`registry.npmjs.org/<pkg>/<version>`), not the
  packument: the packument is served with `max-age=300` and stays stale for
  minutes after a publish.
