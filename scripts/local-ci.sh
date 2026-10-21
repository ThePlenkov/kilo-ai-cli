#!/usr/bin/env sh
# The local CI: runs the check set defined in sverka.config.ts.
#
# The sverka CLI comes from the local checkout when there is one — the
# published package cannot be installed with `npm ci` at the moment (its
# `@sverka/hub` optional dependency is not on the registry), and the
# published versions are skewed, so `npm i sverka` fails too. npx is the
# fallback for a machine without the checkout.
set -e
ENTRY="${1:-ci/local}"
SVERKA_REPO="${SVERKA_REPO:-$HOME/projects/sverka}"
if [ -f "$SVERKA_REPO/packages/cli/src/bin.ts" ]; then
  exec bun "$SVERKA_REPO/packages/cli/src/bin.ts" run --entry "$ENTRY"
fi
exec npx --yes sverka@0.2.34 run --entry "$ENTRY"
