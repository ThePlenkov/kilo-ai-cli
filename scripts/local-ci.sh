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
# the merged findings of every tool, not the lint alone. Two places hold one:
# the artifact of the newest run that produced it, and the file a standalone
# `npm run ci:findings` writes. The newer of the two wins.
if [ "$1" = "policy" ] && [ "${2:-}" != "--findings" ]; then
  candidates=""
  for dir in $(ls -td .sverka/artifacts/*/ 2>/dev/null); do
    if [ -f "${dir}ci/findings/findings.sarif" ]; then
      candidates="$candidates ${dir}ci/findings/findings.sarif"
      break
    fi
  done
  if [ -f .sverka/findings.sarif ]; then
    candidates="$candidates .sverka/findings.sarif"
  fi
  if [ -z "$(echo "$candidates" | tr -d ' \t\n')" ]; then
    echo "no collected findings — run the gate first (npm run ci)" >&2
    exit 1
  fi
  report=""
  for c in $candidates; do
    [ -n "$c" ] && [ -f "$c" ] && report="$c"
  done
  [ -z "$report" ] && report=$(ls -t $candidates 2>/dev/null | head -n 1)
  [ -n "$report" ] || { echo "no collected findings — run the gate first (npm run ci)" >&2; exit 1; }
  # Keep the other options (--format, …) and add the findings.
  shift
  set -- policy --findings "$report" "$@"
  # The ratchet, unless the caller named its own baseline.
  case " $* " in
    *" --baseline "*) ;;
    *)
      if [ -f config/findings-baseline.json ]; then
        set -- "$@" --baseline config/findings-baseline.json
      fi
      ;;
  esac
fi

sverka "$@"
