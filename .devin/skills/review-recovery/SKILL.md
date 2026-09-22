---
name: review-recovery
description: Recover failed or stuck Kilo code reviews — verify the PR is still open, skip models that already failed on that review, retrigger, and poll to a terminal state. Use when the user reports failed/stuck jobs at app.kilo.ai/code-reviews, asks to retry/restart reviews, or wants the failed-review queue cleaned up.
---

# Review Recovery

Policy layer over `kilo-ai-cli reviews` primitives. The CLI carries mechanics
(list/get/cancel/retrigger/set-model); this skill carries the decision rules —
which jobs are worth retrying, and which model to try next.

`reviews recover` is the unattended variant of the same loop (batch, built-in
fallback chain). Prefer this skill when the model policy matters — e.g. a model
that already failed on a review must not burn another ~25-minute attempt.

## Primitives

| Command | Purpose |
| --- | --- |
| `reviews list [--limit N]` | Recent reviews with status, repo, PR, model |
| `reviews get <id>` | Attempts table: status, retry_reason, error, timing |
| `reviews config <platform>` | Current review model + enabled flag |
| `reviews set-model <platform> <slug>` | Change the review model |
| `reviews toggle <platform> --enabled` | Re-enable agent (Kilo auto-disables it when the configured model becomes unavailable) |
| `reviews cancel <id>` | Cancel pending/queued/running |
| `reviews retrigger <id>` | Retry failed/cancelled/interrupted |

## Candidate selection

1. `reviews list --limit N` — candidates are `failed`, `cancelled`,
   `interrupted`, plus `pending`/`queued` untouched for >75 min (server
   auto-expires them around that mark anyway). Never touch `running` — a live
   review killed mid-flight produces a duplicate.
2. **One job per PR** — keep only the newest candidate per repo+PR. Older
   entries for the same PR are superseded history; retriggering them spawns
   duplicate reviews.
3. **PR must still be open** — `gh pr view <n> --repo <owner/repo> --json state`
   (or `glab api projects/<id>/merge_requests/<n>`). `OPEN` → proceed,
   `MERGED`/`CLOSED` → skip, unreachable/unknown → skip too. Retriggering a
   review on a closed PR wastes a slot forever.

## Model policy — the reason this skill exists

Before retriggering, read the review's attempts:

```text
reviews get <id>
```

Look at the last attempt's error and the `Model:` field, plus the currently
configured model (`reviews config github`). Rules:

- **Last attempt already failed on the current model → switch first.** Do not
  retrigger into the same model — it burns a full attempt (~20-30 min) before
  failing again. `reviews set-model github <next>` then retrigger.
- `terminal_reason` tells you whether the model is even the problem:
  - `assistant_unavailable` / `assistant_timeout` with 0 tokens → provider
    endpoint dead — switch model/provider.
  - `assistant_rate_limited_managed` → shared free-pool throttle — same model
    retry is fine, just wait.
  - `selected_model_unavailable` → slug not allowed for cloud sessions — pick
    a different slug, never retry it.
  - `assistant_output_limit` → hit max output tokens — pick a model with a
    bigger output cap (e.g. `deepseek-v4-flash` 384k vs `glm-5.3-flash` 128k).
  - `superseded` → newer push already spawned a fresh review — do nothing.
  - `dispatch_expired` → sat in queue >75 min — plain retrigger is fine.

### Default fallback chain

`orcarouter/z-ai/glm-5.3-flash-free` → `kilo-auto/free` → provider-specific
BYOK models the user has keys for (`reviews` errors on a slug mean "not in
Kilo's catalog" — check `byok list` first).

Caveats:

- BYOK models never fall back to Kilo credentials — a dead BYOK key means
  failed reviews until the model is switched.
- `set-model` is global per scope (personal/org) — it changes the default for
  every repo. The per-repo override path only exists inside `reviews recover`.
- If `reviews config` shows `Enabled: no` after a model failure, re-enable
  with `reviews toggle`.

## Loop

```text
for each candidate (newest per open PR):
    if stale pending/queued → reviews cancel <id>
    if last attempt failed on current model → reviews set-model <next-in-chain>
    reviews retrigger <id>
    poll reviews get <id> every 60-90s until terminal
    on failed → next model in chain, repeat
    on chain exhausted → report and stop
```

Reviews take 5–30 minutes. Poll, don't sleep-spam. When done, report a table:
review id, repo/PR, was → outcome, model used, error if failed.
