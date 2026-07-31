#!/usr/bin/env bash
# Run a k6 stress scenario with env vars passed via -e (k6 does not inherit shell env into __ENV).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCENARIO="harness-smoke"
PROFILE="smoke"

ARGS=("$@")
# Allow callers to pass a lone `--` (e.g. pnpm stress:run -- --scenario …)
if [[ ${#ARGS[@]} -gt 0 && "${ARGS[0]}" == "--" ]]; then
  ARGS=("${ARGS[@]:1}")
fi

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
      # Forwarded by stress:test for the seeder; ignored by k6 run.
      i=$((i + 1))
      if [[ $i -ge ${#ARGS[@]} ]]; then
        echo "error: --stock requires a value" >&2
        exit 1
      fi
      ;;
    --help|-h)
      cat <<'EOF'
Usage: scripts/stress-run.sh [--scenario <name>] [--profile <name>]

Options:
  --scenario <name>   Stress scenario (default: harness-smoke)
  --profile <name>    Intensity profile (default: smoke)
  --stock <n>         Accepted for stress:test UX; ignored by k6 run

Profiles are loaded from tests/stress/shared/profiles.json via STRESS_PROFILES_FILE.

Environment (optional, passed through to k6 via -e as metadata/URLs only):
  GRAPHQL_URL           default http://localhost:3000/graphql
  LIMITER_PROFILE       summary metadata only — does NOT reconfigure the API
                        rate limiter. Precedence: explicit env value →
                        ScenarioPolicy.expectedLimiterProfile (via stress:policy)
                        → correctness. Wrappers never modify API configuration;
                        start the API with tests/stress/k6/config/correctness.env.example
                        (or performance.env.example) values in Compose/.env.
  STRESS_ENVIRONMENT    default local

Supported scenarios for k6 run: harness-smoke, purchase-load, oversell, duplicate-race, high-volume.
EOF
      exit 0
      ;;
    *)
      echo "error: unknown argument: $arg" >&2
      exit 1
      ;;
  esac
  i=$((i + 1))
done

case "$SCENARIO" in
  harness-smoke)
    SCRIPT="tests/stress/k6/scenarios/harness-smoke.js"
    ;;
  purchase-load)
    SCRIPT="tests/stress/k6/scenarios/purchase-load.js"
    ;;
  oversell)
    SCRIPT="tests/stress/k6/scenarios/oversell.js"
    ;;
  duplicate-race)
    SCRIPT="tests/stress/k6/scenarios/duplicate-race.js"
    ;;
  high-volume)
    SCRIPT="tests/stress/k6/scenarios/high-volume.js"
    ;;
  *)
    echo "error: scenario '$SCENARIO' is not implemented for k6 yet (supported: harness-smoke, purchase-load, oversell, duplicate-race, high-volume)" >&2
    exit 1
    ;;
esac

if [[ ! -f "$SCRIPT" ]]; then
  echo "error: k6 script not found: $SCRIPT" >&2
  exit 1
fi

if ! command -v k6 >/dev/null 2>&1; then
  echo "error: k6 not found on PATH. Install k6 (https://k6.io/docs/get-started/installation/) and retry." >&2
  exit 1
fi

STRESS_PROFILES_FILE="$ROOT/tests/stress/shared/profiles.json"
STRESS_STATE_FILE="$ROOT/tests/stress/.state/${SCENARIO}.json"
RESULTS_DIR="$ROOT/tests/stress/results/${SCENARIO}-${PROFILE}"
mkdir -p "$RESULTS_DIR"
STRESS_SUMMARY_PATH="$RESULTS_DIR/k6-summary.json"

GRAPHQL_URL="${GRAPHQL_URL:-http://localhost:3000/graphql}"
# LIMITER_PROFILE precedence: explicit env → ScenarioPolicy.expectedLimiterProfile → correctness
# Summary metadata only — does NOT reconfigure the API rate limiter.
if [[ -z "${LIMITER_PROFILE:-}" ]]; then
  LIMITER_PROFILE="$(pnpm --silent stress:policy --scenario="$SCENARIO" --field=expectedLimiterProfile)" || LIMITER_PROFILE="correctness"
fi
LIMITER_PROFILE="${LIMITER_PROFILE:-correctness}"
STRESS_ENVIRONMENT="${STRESS_ENVIRONMENT:-local}"

echo "Running k6 scenario=$SCENARIO profile=$PROFILE"
echo "  script: $SCRIPT"
echo "  state:  $STRESS_STATE_FILE"
echo "  summary: $STRESS_SUMMARY_PATH"

# k6 does NOT inherit shell env into __ENV — pass every needed var with -e.
exec k6 run \
  -e "STRESS_PROFILES_FILE=${STRESS_PROFILES_FILE}" \
  -e "STRESS_STATE_FILE=${STRESS_STATE_FILE}" \
  -e "STRESS_SUMMARY_PATH=${STRESS_SUMMARY_PATH}" \
  -e "PROFILE=${PROFILE}" \
  -e "GRAPHQL_URL=${GRAPHQL_URL}" \
  -e "LIMITER_PROFILE=${LIMITER_PROFILE}" \
  -e "STRESS_ENVIRONMENT=${STRESS_ENVIRONMENT}" \
  "$SCRIPT"
