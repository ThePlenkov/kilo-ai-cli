# Live API smoke matrix

Generated: 2026-09-15T11:24:00.343Z — `node packages/cli/scripts/live-smoke.ts`

| Command | Class | Status | Detail |
|---|---|---|---|
| `auth status` | read | PASS |  |
| `auth login` | never | MANUAL | interactive device flow |
| `auth logout` | never | MANUAL | clears credentials |
| `profile` | read | PASS |  |
| `balance` | read | PASS |  |
| `sessions list` | read | PASS |  |
| `sessions get <id>` | read | PASS |  |
| `sessions rename <id> smoke-rename-1789471396287` | idempotent | PASS | renames to a temp title, then restores the original |
| `org list` | read | PASS |  |
| `org set <id>` | idempotent | PASS | sets active org, then restores credentials.json |
| `org members <id>` | read | PASS |  |
| `org usage <id>` | read | PASS |  |
| `org credits <id>` | read | PASS |  |
| `org seats <id>` | read | PASS |  |
| `org invoices <id>` | read | PASS |  |
| `org models <id>` | read | PASS |  |
| `org security <id>` | read | PASS |  |
| `org create` | manual | MANUAL | creates a real org on the account |
| `org update <id> --name live-smoke-renamed` | idempotent | PASS | renames org, then restores the original name |
| `plans list` | read | PASS |  |
| `plans usage <id>` | read | SKIP | expected failure: ERROR  [codingPlans.getUsage] Procedure error (HTTP 412) — the API rejected the request. Detail: Coding Plan subscription is not eligible for usage. |
| `byok list` | read | PASS |  |
| `kiloclaw instances` | read | PASS |  |
| `kiloclaw billing` | read | PASS |  |
| `kiloclaw billing-history <id>` | read | PASS |  |
| `kiloclaw subscriptions` | read | PASS |  |
| `kiloclaw subscription <id>` | read | PASS |  |
| `kiloclaw changelog` | read | PASS |  |
| `kiloclaw version` | read | PASS |  |
| `kiloclaw file-tree` | read | SKIP | expected failure: ERROR  [kiloclaw.fileTree] Procedure error (HTTP 403) — the API rejected the request. Detail: KiloClaw access requires an active subscription or trial. |
| `kiloclaw run-start` | manual | MANUAL | spins up a paid run |
| `kiloclaw run-status` | never | MANUAL | no run id fixture — needs run-start first |
| `kiloclaw run-cancel` | never | MANUAL | needs a live run id |
| `kiloclaw unpin` | manual | MANUAL | removes version pin |
| `cloud-agent session` | never | MANUAL | no cloud-agent session id fixture |
| `cloud-agent github-repos` | read | PASS |  |
| `cloud-agent gitlab-repos` | read | PASS |  |
| `reviews list` | read | PASS |  |
| `reviews list --org <id>` | read | PASS | org-scoped variant |
| `reviews get <id>` | read | PASS |  |
| `reviews config github` | read | PASS | personal scope |
| `reviews config <id> github` | read | PASS | org scope |
| `reviews toggle github --enabled false` | idempotent | PASS | personal: flips agent state, then restores it |
| `reviews toggle <id> github --enabled true` | idempotent | PASS | org: flips agent state, then restores it |
| `reviews set-model github kilo-auto/free` | idempotent | PASS | personal: writes current model back (no-op value) |
| `analytics summary` | read | PASS |  |
| `analytics summary --from 2026-09-08 --to 2026-09-15` | read | PASS | with date range |
| `analytics timeseries --from 2026-09-08 --to 2026-09-15` | read | PASS |  |
| `analytics breakdown --from 2026-09-08 --to 2026-09-15` | read | PASS |  |
| `analytics table --from 2026-09-08 --to 2026-09-15` | read | PASS |  |
| `app-builder list` | read | PASS |  |
| `app-builder eligibility` | read | PASS |  |
| `app-builder deploy` | manual | MANUAL | deploys a project |
| `security status` | read | PASS |  |
| `security config` | read | PASS |  |
| `security repos` | read | PASS |  |
| `security findings` | read | PASS |  |
| `security finding <id>` | read | PASS |  |
| `security stats` | read | PASS |  |
| `security dashboard` | read | PASS |  |
| `security commands` | read | PASS |  |
| `security command <id>` | read | PASS |  |
| `security orphaned-repos` | read | PASS |  |
| `security last-sync` | read | PASS |  |
| `security sync` | idempotent | PASS | triggers a GitHub re-sync (no user state changed) |
| `security analyze` | manual | MANUAL | starts a paid analysis |
| `security dismiss` | manual | MANUAL | dismisses a finding |
| `security remediate` | manual | MANUAL | may open real PRs |
| `security retry-remediation` | manual | MANUAL | side-effecting |
| `security cancel-remediation` | manual | MANUAL | side-effecting |
| `security enable` | idempotent | PASS | enables agent, then restores original state |
| `security disable` | manual | MANUAL | restore path covered by security enable post |
| `security delete-findings` | never | MANUAL | destructive |
| `tui` | never | MANUAL | interactive |

**55 PASS · 0 FAIL · 2 SKIP · 17 MANUAL**
