#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARGS=("$@")
# Strip leading `--` tokens from nested pnpm wrappers (stress:test -- --scenario …).
while [[ ${#ARGS[@]} -gt 0 && "${ARGS[0]}" == "--" ]]; do
  ARGS=("${ARGS[@]:1}")
done

pnpm stress:seed -- "${ARGS[@]}"
pnpm stress:run -- "${ARGS[@]}"
pnpm stress:verify -- "${ARGS[@]}"
