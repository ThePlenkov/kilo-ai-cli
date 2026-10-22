#!/usr/bin/env sh
# The local CI: runs the check set defined in sverka.config.ts.
#
# The sverka CLI comes from the local checkout when there is one — the
# published package cannot be installed with `npm ci` at the moment (its
# `@sverka/hub` optional dependency is not on the registry), and the
# published versions are skewed, so `npm i sverka` fails too. npx is the
# fallback for a machine without the checkout.
#
# Every sverka command is reachable through this script:
#   sh scripts/local-ci.sh run --entry ci/local
#   sh scripts/local-ci.sh policy --findings <file>
set -e
SVERKA_REPO="${SVERKA_REPO:-$HOME/projects/sverka}"

sverka() {
  if [ -f "$SVERKA_REPO/packages/cli/src/bin.ts" ]; then
    bun "$SVERKA_REPO/packages/cli/src/bin.ts" "$@"
  else
    npx --yes sverka@0.2.34 "$@"
  fi
}

# No arguments means the local gate.
if [ "$#" -eq 0 ]; then
  set -- run --entry ci/local
fi

# `policy` without an explicit --findings uses the newest collected report —
# the newest run that actually produced one.
if [ "$1" = "policy" ] && [ "${2:-}" != "--findings" ]; then
  report=""
  for dir in $(ls -td .sverka/artifacts/*/ 2>/dev/null); do
    if [ -f "${dir}ci/lint-sarif/eslint.sarif" ]; then
      report="${dir}ci/lint-sarif/eslint.sarif"
      break
    fi
  done
  if [ -z "$report" ]; then
    echo "no collected report — run the gate first (npm run ci)" >&2
    exit 1
  fi
  # Keep the other options (--baseline, --format, …) and add the findings.
  shift
  set -- policy --findings "$report" "$@"
fi

sverka "$@"
