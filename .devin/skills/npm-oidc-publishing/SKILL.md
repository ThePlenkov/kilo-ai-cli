---
name: npm-oidc-publishing
description: Set up npm OIDC trusted publishing for a package using @nx-devkit/prepare-for-release. Publishes a placeholder to reserve the package name, then runs `npm trust github` to link the npm package to a GitHub Actions workflow for passwordless publishing.
---

# npm-oidc-publishing

Set up npm OIDC trusted publishing for a package using `@nx-devkit/prepare-for-release`.

## When to use

- A new package needs to be published to npm via GitHub Actions OIDC (no long-lived npm tokens).
- The `@nx-devkit/prepare-for-release` plugin is available in the workspace (via `.nx-devkit` submodule).
- The package name is not yet registered on npm.

## Prerequisites

1. **npm account** with MFA enabled (browser-based approval — npm sends a push notification, you click approve in your browser; no OTP codes needed).
2. **npm CLI** logged in (`npm whoami` returns your username).
3. **`.nx-devkit` submodule** built (`cd .nx-devkit && bun install && bun run build`).
4. **GitHub repository** with a release workflow (e.g. `.github/workflows/release.yml`) that uses `id-token: write` and `registry-url: https://registry.npmjs.org`.

## Steps

### 1. Wire the plugin into the workspace

Create `release/project.json` in the workspace root:

```json
{
  "$schema": "../node_modules/nx/schemas/project-schema.json",
  "name": "release",
  "sourceRoot": "release",
  "targets": {
    "prepare-for-release": {
      "executor": "./.nx-devkit/packages/prepare-for-release:publish-placeholder",
      "options": {
        "trustRepo": "<owner>/<repo>"
      }
    }
  }
}
```

Add `workspaceLayout` to `nx.json` so Nx discovers the `release/` project:

```json
{
  "workspaceLayout": {
    "appsDir": ["release"],
    "libsDir": ["packages"]
  }
}
```

### 2. Publish the placeholder (reserves the package name)

```bash
# Dry run first
npx nx run release:prepare-for-release --dryRun=true

# Real publish (triggers npm MFA — approve in your browser)
npx nx run release:prepare-for-release
```

Or run the executor directly:

```bash
node -e "
import('./.nx-devkit/packages/prepare-for-release/dist/executors/publish-placeholder/executor.mjs').then(async (m) => {
  const result = await m.default(
    { trustRepo: '<owner>/<repo>', dryRun: false },
    { projectGraph: { nodes: { '<pkg-name>': { type: 'lib', data: { root: 'packages/cli' } } } }, root: process.cwd() }
  );
  console.log(JSON.stringify(result, null, 2));
}).catch(e => console.error(e.message));
"
```

This publishes a `0.0.0` placeholder tarball with dist-tag `placeholder` to reserve the package name.

### 3. Set up OIDC trust (links npm package to GitHub Actions)

The executor prints the trust command. Run it manually (triggers npm MFA — approve in your browser):

```bash
npm trust github <pkg-name> --file release.yml --repo <owner>/<repo> --allow-publish --yes
```

Example:

```bash
npm trust github kilo-ai-cli --file release.yml --repo ThePlenkov/kilo-ai-cli --allow-publish --yes
```

This tells npm: "Allow the GitHub Actions workflow `release.yml` in `ThePlenkov/kilo-ai-cli` to publish `kilo-ai-cli` without an npm token."

### 4. Create the GitHub environment

In GitHub repository settings:
1. Settings → Environments → New environment
2. Name it `npm` (must match the `environment` field in the release workflow)
3. (Optional) Add protection rules (required reviewers, deployment branch restrictions)

### 5. Trigger the first real release

```bash
git tag v0.1.0
git push origin v0.1.0
```

This triggers the release workflow, which:
1. Builds the package
2. Runs typecheck, lint, test
3. Runs `npm pack` to verify contents
4. Runs `npm publish --provenance --access public` (authenticated via OIDC, no token needed)

### 6. Verify the published package

```bash
npx <pkg-name>@<version> --help
npm view <pkg-name> version
```

## How OIDC trusted publishing works

```
GitHub Actions (id-token: write)
    │
    ▼
GitHub OIDC provider
    │
    ▼
npm registry (trusts <owner>/<repo> + release.yml)
    │
    ▼
npm publish --provenance (no NPM_TOKEN needed)
```

1. GitHub Actions generates an OIDC token for each run.
2. The `setup-node` action with `registry-url` configures npm to use the OIDC token.
3. npm validates the OIDC token against the trust configuration set up by `npm trust github`.
4. If the token matches (correct repo + workflow + environment), npm allows the publish.
5. `--provenance` attaches a signed provenance attestation to the package.

## Troubleshooting

### `EOTP` / one-time password required

`npm publish` and `npm trust github` require MFA. npm uses browser-based approval — when the command runs, npm sends a push notification and opens a browser URL. Click "Approve" in your browser to authorize. No OTP code entry needed. Run these commands in a terminal on a machine where you can open a browser.

### `Could not find project "release"`

Nx may not discover the `release/` project. Ensure `workspaceLayout` is set in `nx.json`, or run the executor directly via `node -e`.

### `E403` / forbidden on publish

The OIDC trust is not yet configured. Run `npm trust github` first, then retry the release workflow.

### Package already published

The executor is idempotent — already-published packages are skipped. To publish a new version, use the release workflow (tag `v*`), not the placeholder executor.

## Files

- `release/project.json` — Nx project wiring for the `prepare-for-release` target
- `nx.json` — `workspaceLayout` to discover the `release/` project
- `.github/workflows/release.yml` — GitHub Actions workflow with `id-token: write` and `registry-url`
