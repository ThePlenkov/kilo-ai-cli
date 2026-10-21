import {
  Project,
  Pipeline,
  ShellStep,
  Entry,
  push,
  changeRequest,
  manual,
} from "@sverka/workflow";

const proj = new Project("kilo-ai-cli");

// The local gate. `sverka run --entry ci/local` runs the whole check set
// before a push (the pre-push hook does it automatically), and the same
// definition is what the GitHub workflow is compiled from.
//
// The CI workflow is still the hand-written one: sverka's GitHub template
// emits checkout + setup-node + `npm ci --ignore-scripts`, and this
// repository also needs bun and a built `.nx-devkit` submodule — which
// the template cannot express yet. Migrating it means either sverka
// gaining a way to inject CI steps, or the submodule build moving into
// the install.

// ---------------------------------------------------------------------------
// The check set.
//
// One definition, three consumers: the compiled GitHub workflow, the local
// pre-push gate (`sverka run`), and an ad-hoc run of a single pipeline.
//
// The static checks do not depend on each other — they run in parallel, so
// a type error does not hold up the formatter and the docs lint. The heavy
// chain (test → build → the steps that need the build) is sequential.
// ---------------------------------------------------------------------------
const ci = new Pipeline(proj, "ci");

const typecheck = new ShellStep(ci, "typecheck", {
  command: "npm run typecheck",
});
const lint = new ShellStep(ci, "lint", {
  command: "npm run lint",
});
const format = new ShellStep(ci, "format", {
  command: "npm run format:check",
});
const docs = new ShellStep(ci, "docs", {
  command:
    'npx markdownlint-cli2 "README.md" "AGENTS.md" "docs/**/*.md" "packages/*/README.md" "#**/node_modules"',
  runtime: { shell: "sh" },
});
const test = new ShellStep(ci, "test", {
  command: "npm run test",
});
const build = new ShellStep(ci, "build", {
  command: "npm run build",
  dependsOn: [test.node.id],
});
// The published tarball is what users install — pack it dry and look at it.
const pack = new ShellStep(ci, "pack", {
  command: "npm pack --dry-run --workspace kilo-ai-cli",
  dependsOn: [build.node.id],
});
// The CLI has to work when it is started from source.
const smoke = new ShellStep(ci, "smoke", {
  command:
    "node packages/cli/src/index.ts --help > /dev/null && node packages/cli/src/index.ts cursor list > /dev/null",
  dependsOn: [build.node.id],
  runtime: { shell: "sh" },
});
// A high-severity advisory in the dependency tree is a release blocker.
const audit = new ShellStep(ci, "audit", {
  command: "npm audit --audit-level=high",
  dependsOn: [build.node.id],
});

const ciRoots = [
  typecheck.node.id,
  lint.node.id,
  format.node.id,
  docs.node.id,
  test.node.id,
  build.node.id,
  pack.node.id,
  smoke.node.id,
  audit.node.id,
];

// ---------------------------------------------------------------------------
// Repo health — the checks that keep the repository itself tidy. They need
// `gh` and the network, so they are a separate pipeline: the pre-push gate
// runs the `ci` pipeline, the health checks run on demand.
// ---------------------------------------------------------------------------
const health = new Pipeline(proj, "repo-health");

// Every GitHub Actions check on main's HEAD must be green.
const mainGreen = new ShellStep(health, "main-green", {
  command:
    'out=$(gh api --paginate --slurp "repos/{owner}/{repo}/commits/main/check-runs?per_page=100" | jq -r \'map(.check_runs) | add | group_by(.name) | map(last)[] | select(.app.slug=="github-actions") | select(.conclusion != "success" and .conclusion != "skipped" and .conclusion != "neutral") | "\\(.name) (\\(.conclusion // .status))"\') || exit 1; [ -z "$out" ] || { echo "non-green checks on main:"; echo "$out"; exit 1; }',
  runtime: { shell: "sh" },
});

// Zero unresolved review threads across the last 20 merged PRs.
const reviewDebt = new ShellStep(health, "review-debt", {
  command:
    "count=$(gh api graphql -f query='query($owner:String!,$name:String!){repository(owner:$owner,name:$name){pullRequests(first:20,states:MERGED,orderBy:{field:CREATED_AT,direction:DESC}){nodes{reviewThreads(first:100){pageInfo{hasNextPage}nodes{isResolved}}}}}}' -F owner='{owner}' -F name='{repo}' --jq '([.data.repository.pullRequests.nodes[].reviewThreads.nodes[]|select(.isResolved==false)]|length) + ([.data.repository.pullRequests.nodes[].reviewThreads.pageInfo.hasNextPage|select(.)]|length)') || exit 1; [ \"$count\" = \"0\" ] || { echo \"unresolved threads or truncated thread pages: $count\"; exit 1; }",
  runtime: { shell: "sh" },
});

// No remote branches left behind by merged PRs — the check that would have
// caught the forty stale branches this repository accumulated.
const staleBranches = new ShellStep(health, "stale-branches", {
  command:
    'if ! heads=$(git ls-remote --heads origin); then echo "ls-remote failed"; exit 1; fi; if ! owner=$(gh repo view --json owner --jq \'.owner.login\'); then echo "repo query failed"; exit 1; fi; stale=""; for b in $(echo "$heads" | sed \'s|.*refs/heads/||\'); do if [ "$b" != "main" ]; then if ! n=$(gh pr list --head "$owner:$b" --state merged --json number --jq length); then echo "pr query failed for $b"; exit 1; fi; if [ "$n" -gt 0 ]; then stale="$stale $b"; fi; fi; done; [ -z "$stale" ] || { echo "stale branches:$stale"; exit 1; }',
  runtime: { shell: "sh" },
});

// Zero open dependabot alerts.
const dependabotAlerts = new ShellStep(health, "dependabot-alerts", {
  command:
    'out=$(gh api --paginate "repos/{owner}/{repo}/dependabot/alerts?state=open" --jq ".[].number" 2>&1) || { echo "$out" | grep -qi "not accessible\\|403" && { echo "::warning::GITHUB_TOKEN cannot read dependabot alerts (needs the vulnerability-alerts scope); check skipped"; exit 0; }; echo "$out"; exit 1; }; [ -z "$out" ] || { echo "open dependabot alerts:"; echo "$out"; exit 1; }',
  runtime: { shell: "sh" },
});

const healthRoots = [
  mainGreen.node.id,
  reviewDebt.node.id,
  staleBranches.node.id,
  dependabotAlerts.node.id,
];

// ---------------------------------------------------------------------------
// Entries — what the compiled workflow and the local runs execute.
// ---------------------------------------------------------------------------

/** The compiled GitHub workflow: the full check set on main and on a PR. */
export const onPush = new Entry(ci, "on-push", {
  trigger: push({ branches: ["main"] }),
  roots: ciRoots,
});

export const onPr = new Entry(ci, "on-pr", {
  trigger: changeRequest({ branches: ["main"] }),
  roots: ciRoots,
});

/** The local pre-push gate — the same checks, on the developer's machine. */
export const local = new Entry(ci, "local", {
  trigger: manual(),
  roots: ciRoots,
});

/** The repository hygiene sweep — on demand. */
export const repoHealth = new Entry(health, "check", {
  trigger: manual(),
  roots: healthRoots,
});

export default proj;
