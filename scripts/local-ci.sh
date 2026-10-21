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
if [ -f "$SVERKA_REPO/packages/cli/src/bin.ts" ]; then
  exec bun "$SVERKA_REPO/packages/cli/src/bin.ts" "$@"
fi
exec npx --yes sverka@0.2.34 "$@"
