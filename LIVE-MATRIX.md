# Live API smoke matrix

Generated: 2026-09-13T00:27:12.717Z — `node packages/cli/scripts/live-smoke.ts`

| Command | Class | Status | Detail |
|---|---|---|---|
| `auth status` | read | PASS |  |
| `auth login` | never | MANUAL | interactive device flow |
| `auth logout` | never | MANUAL | clears credentials |
| `profile` | read | PASS |  |
| `balance` | read | PASS |  |
| `sessions list` | read | PASS |  |
| `sessions get <id>` | read | PASS |  |
| `sessions rename <id> smoke-rename-1789259199083` | idempotent | PASS | renames to a temp title, then restores the original |
| `org list` | read | PASS |  |
| `org set` | manual | MANUAL | rewrites credentials.json accountId |
| `org members` | read | SKIP | no orgs on account |
| `org usage` | read | SKIP | no orgs on account |
| `org credits` | read | SKIP | no orgs on account |
| `org seats` | read | SKIP | no orgs on account |
| `org invoices` | read | SKIP | no orgs on account |
| `org models` | read | SKIP | no orgs on account |
| `org security` | read | SKIP | no orgs on account |
| `org create` | manual | MANUAL | creates a real org on the account |
| `org update` | manual | MANUAL | renames an org |
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
| `reviews list --org` | read | SKIP | no orgs on account |
| `reviews get <id>` | read | PASS |  |
| `reviews config` | read | SKIP | no orgs on account |
| `reviews toggle` | manual | MANUAL | enables/disables review agent |
| `analytics summary` | read | PASS |  |
| `analytics summary --from 2026-09-06 --to 2026-09-13` | read | PASS | with date range |
| `analytics timeseries --from 2026-09-06 --to 2026-09-13` | read | PASS |  |
| `analytics breakdown --from 2026-09-06 --to 2026-09-13` | read | PASS |  |
| `analytics table --from 2026-09-06 --to 2026-09-13` | read | PASS |  |
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
| `security command` | read | SKIP | no active commands |
| `security orphaned-repos` | read | PASS |  |
| `security last-sync` | read | PASS |  |
| `security sync` | manual | MANUAL | triggers GitHub sync |
| `security analyze` | manual | MANUAL | starts a paid analysis |
| `security dismiss` | manual | MANUAL | dismisses a finding |
| `security remediate` | manual | MANUAL | may open real PRs |
| `security retry-remediation` | manual | MANUAL | side-effecting |
| `security cancel-remediation` | manual | MANUAL | side-effecting |
| `security enable` | manual | MANUAL | side-effecting |
| `security disable` | manual | MANUAL | side-effecting |
| `security delete-findings` | never | MANUAL | destructive |
| `tui` | never | MANUAL | interactive |

**37 PASS · 0 FAIL · 12 SKIP · 22 MANUAL**
