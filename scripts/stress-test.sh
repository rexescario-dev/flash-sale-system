#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARGS=("$@")
# Strip leading `--` tokens from nested pnpm wrappers (stress:test -- --scenario …).
while [[ ${#ARGS[@]} -gt 0 && "${ARGS[0]}" == "--" ]]; do
  ARGS=("${ARGS[@]:1}")
done

SCENARIO="harness-smoke"
PROFILE="smoke"
HAS_STOCK=0
STOCK_VALUE=""

SEED_ARGS=()
RUN_ARGS=()
VERIFY_ARGS=()

i=0
while [[ $i -lt ${#ARGS[@]} ]]; do
  arg="${ARGS[$i]}"
  case "$arg" in
    --scenario)
      i=$((i + 1))
      if [[ $i -ge ${#ARGS[@]} ]]; then
        echo "error: --scenario requires a value" >&2
        exit 1
      fi
      SCENARIO="${ARGS[$i]}"
      ;;
    --profile)
      i=$((i + 1))
      if [[ $i -ge ${#ARGS[@]} ]]; then
        echo "error: --profile requires a value" >&2
        exit 1
      fi
      PROFILE="${ARGS[$i]}"
      ;;
    --stock)
      i=$((i + 1))
      if [[ $i -ge ${#ARGS[@]} ]]; then
        echo "error: --stock requires a value" >&2
        exit 1
      fi
      HAS_STOCK=1
      STOCK_VALUE="${ARGS[$i]}"
      ;;
    --help|-h)
      cat <<'EOF'
Usage: scripts/stress-test.sh [--scenario <name>] [--profile <name>] [--stock <n>]

Runs stress:seed → stress:run → stress:verify with scenario-appropriate flags.

Options:
  --scenario <name>   Stress scenario (default: harness-smoke)
  --profile <name>    Intensity profile (default: smoke)
  --stock <n>         Seed stock override (purchase-load only; auto-resolved when omitted)

For purchase-load without --stock, comfortable stock is resolved from the profile
and passed to stress:seed only (not forwarded to stress:run or stress:verify).
EOF
      exit 0
      ;;
    *)
      echo "error: unknown argument: $arg (supported: --scenario, --profile, --stock, --help)" >&2
      exit 1
      ;;
  esac
  i=$((i + 1))
done

if [[ "$SCENARIO" == "purchase-load" && "$HAS_STOCK" -eq 0 ]]; then
  # --silent: pnpm otherwise prints script banners to stdout and breaks integer capture.
  STOCK_VALUE="$(pnpm --silent stress:stock "$PROFILE")"
  HAS_STOCK=1
  echo "stress:test: purchase-load comfortable stock=$STOCK_VALUE (profile=$PROFILE)"
fi

SEED_ARGS+=(--scenario "$SCENARIO" --profile "$PROFILE")
RUN_ARGS+=(--scenario "$SCENARIO" --profile "$PROFILE")
VERIFY_ARGS+=(--scenario "$SCENARIO" --profile "$PROFILE")

if [[ "$HAS_STOCK" -eq 1 ]]; then
  SEED_ARGS+=(--stock "$STOCK_VALUE")
fi

pnpm stress:seed -- "${SEED_ARGS[@]}"
pnpm stress:run -- "${RUN_ARGS[@]}"
pnpm stress:verify -- "${VERIFY_ARGS[@]}"
