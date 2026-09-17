# Live API smoke matrix

Generated: 2026-09-15T15:46:12.539Z — `node packages/cli/scripts/live-smoke.ts`

| Command | Class | Status | Detail |
|---|---|---|---|
| `auth status` | read | PASS |  |
| `auth login` | never | MANUAL | interactive device flow |
| `auth logout` | never | MANUAL | clears credentials |
| `profile` | read | PASS |  |
| `balance` | read | PASS |  |
| `sessions list` | read | PASS |  |
| `sessions get <id>` | read | PASS |  |
| `sessions rename <id> smoke-rename-1789487113563` | idempotent | PASS | renames to a temp title, then restores the original |
| `org list` | read | PASS |  |
| `org set <id>` | idempotent | PASS | sets active org, then restores credentials.json |
| `org members <id>` | read | PASS |  |
| `org usage <id>` | read | PASS |  |
| `org credits <id>` | read | PASS |  |
| `org seats <id>` | read | PASS |  |
| `org invoices <id>` | read | PASS |  |
| `org models <id>` | read | PASS |  |
| `org security <id>` | read | PASS |  |
| `org create live-smoke-org` | manual | PASS | creates a real org on the account |
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
| `kiloclaw run-start live smoke test prompt` | manual | SKIP | expected failure: ERROR  [kiloclaw.startKiloCliRun] Procedure error (HTTP 403) — the API rejected the request. Detail: KiloClaw access requires an active subscription or trial. |
| `kiloclaw run-status` | never | MANUAL | no run id fixture — needs run-start first |
| `kiloclaw run-cancel` | never | MANUAL | needs a live run id |
| `kiloclaw unpin` | manual | SKIP | expected failure: ERROR  [kiloclaw.removeMyPin] Procedure error (HTTP 403) — the API rejected the request. Detail: KiloClaw access requires an active subscription or trial. |
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
| `app-builder deploy` | manual | SKIP | no app-builder projects |
| `security status` | read | PASS |  |
| `security config` | read | PASS |  |
| `security repos` | read | PASS |  |
| `security findings list` | read | PASS |  |
| `security findings detail <id>` | read | PASS |  |
| `security stats` | read | PASS |  |
| `security dashboard` | read | PASS |  |
| `security commands` | read | PASS |  |
| `security command` | read | SKIP | no active commands |
| `security orphaned-repos` | read | PASS |  |
| `security last-sync` | read | PASS |  |
| `security sync` | manual | PASS | triggers GitHub sync |
| `security findings analyze <id>` | manual | PASS | queues finding analysis |
| `security findings dismiss <id> --reason inaccurate` | manual | PASS | dismisses a finding (one-way) |
| `security findings remediate <id>` | manual | PASS | queues a remediation attempt, then cancels it |
| `security findings retry <id>` | manual | PASS | queues a remediation attempt, then cancels it |
| `security findings cancel` | manual | SKIP | no running remediation attempt |
| `security enable` | idempotent | PASS | enables agent, then restores original state |
| `security disable` | idempotent | PASS | disables agent, then restores original state |
| `security findings delete` | never | MANUAL | destructive |
| `tui` | never | MANUAL | interactive |

**60 PASS · 0 FAIL · 7 SKIP · 7 MANUAL**
