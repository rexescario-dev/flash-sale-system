# #54 Flash Sale Load Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `#54` baseline concurrent purchase-load k6 scenario under the existing `#53` stress harness, with a shared comfortable-stock resolver so `stress:test` (and the documented split path) plant stock above attempts.

**Architecture:** Thin sibling of `harness-smoke.js`. Attempts/VUs are defined once in `tests/stress/shared/profiles.json` and consumed by both the k6 helper (`profiles.js`) and the Node comfortable-stock resolver — do not hardcode a second attempts/VUs table. Seeder stays generic (`--stock` default 1000). `stress:test` injects resolver stock for `purchase-load` when `--stock` is omitted. Verifier reused unchanged. Strict all-success k6 thresholds.

**Tech Stack:** k6 (external binary), existing stress helpers, Node/`tsx` for resolver + tests (`node:test`), bash wrappers, Prisma seeder/verifier from `#53`.

**Base:** `main` with `#53` harness present (`tests/stress/`, commit `42b87c6` or later `0470918` merge tip when fetch works).

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review; skip per-task commit steps or treat them as “stage only when asked.”

**Spec:** `docs/superpowers/specs/2026-07-31-issue-54-flash-sale-load-test-design.md`

**Issue AC:**

- [ ] Load test exercises purchase under concurrent users

---

## File map

| File                                                                        | Responsibility                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `tests/stress/shared/profiles.json`                                         | **Single SoT** for profile → `{ attempts, vus }` (order: smoke → standard → full)        |
| `tests/stress/k6/helpers/profiles.js`                                       | Consumes `shared/profiles.json` via `STRESS_PROFILES_FILE`; `resolveProfile(name)`       |
| `tests/stress/lib/comfortable-stock.ts`                                     | Consumes the same `shared/profiles.json`; `comfortableStock` / `resolveComfortableStock` |
| `tests/stress/lib/resolve-comfortable-stock.ts`                             | CLI: stdout is **only** the integer stock (no labels)                                    |
| `tests/stress/lib/comfortable-stock.test.ts`                                | Unit tests for formula + profile mapping                                                 |
| `tests/stress/k6/scenarios/purchase-load.js`                                | Baseline concurrent purchase scenario                                                    |
| `tests/stress/seeder/types.ts`                                              | Add `purchase-load` to `RUNNABLE_K6_SCENARIOS`                                           |
| `tests/stress/seeder/seed-stress.ts`                                        | Update runnable warning text only (list includes purchase-load)                          |
| `scripts/stress-run.sh`                                                     | Map `purchase-load` → script; pass `STRESS_PROFILES_FILE`                                |
| `scripts/stress-test.sh`                                                    | For `purchase-load`, inject `--stock` from resolver when omitted                         |
| `package.json`                                                              | Optional `stress:stock` helper script for docs/split path                                |
| `tests/stress/README.md`                                                    | Document purchase-load primary + split paths + footgun                                   |
| `docs/superpowers/specs/2026-07-31-issue-54-flash-sale-load-test-design.md` | Approved design (already written)                                                        |
| `docs/superpowers/plans/2026-07-31-issue-54-flash-sale-load-test.md`        | This plan                                                                                |

**Expected unchanged:** root `README.md`, `docs/testing-strategy.md`, verifier logic, seeder default stock semantics, apps production code, e2e, CI, #55–#60 scenarios, #134 CSS AC. Do not invent results docs (#71/#60).

---

### Task 1: Shared profiles SoT + comfortable-stock library (TDD)

**Files:**

- Create: `tests/stress/shared/profiles.json`
- Create: `tests/stress/lib/comfortable-stock.ts`
- Create: `tests/stress/lib/comfortable-stock.test.ts`
- Create: `tests/stress/lib/resolve-comfortable-stock.ts`
- Modify: `tests/stress/k6/helpers/profiles.js`
- Modify: `package.json` (add `stress:stock` script)
- Modify: `scripts/stress-run.sh` (pass `STRESS_PROFILES_FILE`)

- [ ] **Step 1: Write the failing unit test**

Create `tests/stress/lib/comfortable-stock.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { comfortableStock, resolveComfortableStock } from './comfortable-stock';

describe('comfortableStock', () => {
  it('never returns less than the generic seeder default (1000)', () => {
    assert.equal(comfortableStock(100), 1000);
    assert.equal(comfortableStock(0), 1000);
  });

  it('applies 20% headroom above attempts when that exceeds 1000', () => {
    assert.equal(comfortableStock(1000), 1200);
    assert.equal(comfortableStock(10000), 12000);
  });

  it('ceils fractional products', () => {
    assert.equal(comfortableStock(1001), Math.max(1000, Math.ceil(1001 * 1.2)));
  });
});

describe('resolveComfortableStock', () => {
  it('maps smoke / standard / full via shared profiles', () => {
    assert.equal(resolveComfortableStock('smoke'), 1000);
    assert.equal(resolveComfortableStock('standard'), 1200);
    assert.equal(resolveComfortableStock('full'), 12000);
  });

  it('rejects unknown profiles', () => {
    assert.throws(() => resolveComfortableStock('nope'), /Unknown profile/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /home/rex/Project/test/app && pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
```

Expected: FAIL (module or exports missing).

- [ ] **Step 3: Add shared profiles JSON**

Create `tests/stress/shared/profiles.json` (smallest → largest, matching the design tables):

```json
{
  "smoke": { "attempts": 100, "vus": 10 },
  "standard": { "attempts": 1000, "vus": 50 },
  "full": { "attempts": 10000, "vus": 100 }
}
```

Both `tests/stress/k6/helpers/profiles.js` and `tests/stress/lib/comfortable-stock.ts` must read this file. Do not reintroduce a hardcoded attempts/VUs table in either consumer.

- [ ] **Step 4: Implement comfortable-stock module + CLI**

Create `tests/stress/lib/comfortable-stock.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERIC_SEEDER_DEFAULT_STOCK = 1000;
export const COMFORTABLE_STOCK_MULTIPLIER = 1.2;

export type StressProfileName = 'full' | 'smoke' | 'standard';

export type StressProfile = {
  attempts: number;
  vus: number;
};

const profilesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../shared/profiles.json',
);

export function loadProfiles(filePath = profilesPath): Record<string, StressProfile> {
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as Record<string, StressProfile>;
}

export function comfortableStock(attempts: number): number {
  if (!Number.isFinite(attempts) || attempts < 0) {
    throw new Error(`attempts must be a non-negative finite number, got: ${String(attempts)}`);
  }
  return Math.max(GENERIC_SEEDER_DEFAULT_STOCK, Math.ceil(attempts * COMFORTABLE_STOCK_MULTIPLIER));
}

export function resolveComfortableStock(profileName: string, filePath = profilesPath): number {
  const profiles = loadProfiles(filePath);
  const profile = profiles[profileName];
  if (!profile) {
    throw new Error(`Unknown profile: ${profileName}`);
  }
  return comfortableStock(profile.attempts);
}
```

Note: if `import.meta.url` is awkward under the repo’s tsx/CJS setup, resolve path via `path.join(__dirname, …)` equivalent that `tsx` accepts in this repo — keep a single absolute path to `tests/stress/shared/profiles.json`.

Create `tests/stress/lib/resolve-comfortable-stock.ts`:

```ts
import { resolveComfortableStock } from './comfortable-stock';

const profile = process.argv[2] ?? 'smoke';
try {
  // stdout must contain only the integer stock value (shell-friendly for STOCK=$(…)).
  process.stdout.write(`${String(resolveComfortableStock(profile))}\n`);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}
```

Add to root `package.json` scripts:

```json
"stress:stock": "pnpm exec tsx tests/stress/lib/resolve-comfortable-stock.ts"
```

Contract: `pnpm stress:stock <profile>` prints a single integer line on stdout (no labels/prefixes). Errors go to stderr.

- [ ] **Step 5: Point k6 profiles.js at the shared JSON**

Replace `tests/stress/k6/helpers/profiles.js` with:

```js
function loadProfiles() {
  const filePath = __ENV.STRESS_PROFILES_FILE;
  if (!filePath) {
    throw new Error('STRESS_PROFILES_FILE env is required');
  }
  let raw;
  try {
    raw = open(filePath);
  } catch (err) {
    throw new Error(`Failed to open STRESS_PROFILES_FILE (${filePath}): ${err}`);
  }
  return JSON.parse(raw);
}

const PROFILES = loadProfiles();

export function resolveProfile(name) {
  const key = name || 'smoke';
  const p = PROFILES[key];
  if (!p) throw new Error(`Unknown profile: ${key}`);
  return { name: key, attempts: p.attempts, vus: p.vus };
}
```

In `scripts/stress-run.sh`, before `k6 run`, set and pass:

```bash
STRESS_PROFILES_FILE="$ROOT/tests/stress/shared/profiles.json"
```

Add `-e "STRESS_PROFILES_FILE=${STRESS_PROFILES_FILE}"` to the `k6 run` invocation (alongside existing `-e` flags). Update the help text to mention it.

- [ ] **Step 6: Run unit tests — expect PASS**

```bash
cd /home/rex/Project/test/app && pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
```

Expected: all tests PASS.

Also smoke the CLI (stdout is only the integer):

```bash
pnpm stress:stock smoke    # stdout: 1000
pnpm stress:stock standard # stdout: 1200
pnpm stress:stock full     # stdout: 12000
```

- [ ] **Step 7: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 2: Wire purchase-load as a runnable scenario + stress:test stock injection

**Files:**

- Modify: `tests/stress/seeder/types.ts`
- Modify: `tests/stress/seeder/seed-stress.ts` (warning string only)
- Modify: `scripts/stress-run.sh`
- Modify: `scripts/stress-test.sh`

- [ ] **Step 1: Mark scenario runnable**

In `tests/stress/seeder/types.ts`, change:

```ts
export const RUNNABLE_K6_SCENARIOS = ['harness-smoke', 'purchase-load'] as const;
```

Update the warning in `seed-stress.ts` so it lists both runnable names (or says “see RUNNABLE_K6_SCENARIOS”) — do not add profile-aware stock logic.

- [ ] **Step 2: Map scenario in stress-run.sh**

In the `case "$SCENARIO"` block, add:

```bash
  purchase-load)
    SCRIPT="tests/stress/k6/scenarios/purchase-load.js"
    ;;
```

Update error/help strings from “harness-smoke only” to “harness-smoke, purchase-load”.

- [ ] **Step 3: Inject comfortable stock in stress-test.sh**

Replace `scripts/stress-test.sh` with logic that builds **separate** argument arrays so each command receives only flags it understands:

| Array         | Contents                                                                               |
| ------------- | -------------------------------------------------------------------------------------- |
| `SEED_ARGS`   | `--scenario`, `--profile`, `--stock` (when applicable), plus any other seed-safe flags |
| `RUN_ARGS`    | `--scenario`, `--profile` (no `--stock`)                                               |
| `VERIFY_ARGS` | `--scenario`, `--profile` (no `--stock`)                                               |

Rules:

1. Parse `--scenario`, `--profile`, and whether `--stock` is already present (same flag style as `stress-run.sh`).
2. Defaults: `SCENARIO=harness-smoke`, `PROFILE=smoke`.
3. If `SCENARIO=purchase-load` and `--stock` was **not** provided, compute:

   ```bash
   STOCK="$(pnpm --silent stress:stock "$PROFILE")"
   ```

   (`pnpm --silent stress:stock` stdout is only the integer — without `--silent`, pnpm banners pollute capture.) Append `--stock "$STOCK"` to **`SEED_ARGS` only**.

4. If the caller already passed `--stock`, honor it exactly on `SEED_ARGS` (no override).
5. For other scenarios (e.g. `harness-smoke`), do not inject stock.
6. Never forward `--stock` to `stress:run` or `stress:verify`.

Concrete implementation sketch:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARGS=("$@")
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
OTHER=()

i=0
while [[ $i -lt ${#ARGS[@]} ]]; do
  arg="${ARGS[$i]}"
  case "$arg" in
    --scenario)
      i=$((i + 1))
      SCENARIO="${ARGS[$i]}"
      ;;
    --profile)
      i=$((i + 1))
      PROFILE="${ARGS[$i]}"
      ;;
    --stock)
      i=$((i + 1))
      HAS_STOCK=1
      STOCK_VALUE="${ARGS[$i]}"
      ;;
    *)
      OTHER+=("$arg")
      ;;
  esac
  i=$((i + 1))
done

if [[ "$SCENARIO" == "purchase-load" && "$HAS_STOCK" -eq 0 ]]; then
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

# Preserve unused passthrough flags on seed only when seeder understands them;
# otherwise drop or route deliberately after inspecting seeder/cli.ts.
SEED_ARGS+=("${OTHER[@]}")

pnpm stress:seed -- "${SEED_ARGS[@]}"
pnpm stress:run -- "${RUN_ARGS[@]}"
pnpm stress:verify -- "${VERIFY_ARGS[@]}"
```

- [ ] **Step 4: Sanity-check wrappers without full API**

```bash
# Resolver path used by stress:test
pnpm exec tsx tests/stress/lib/resolve-comfortable-stock.ts full
# Expect: 12000

# stress-run should fail clearly if script missing until Task 3 lands —
# after Task 3, unknown scenario errors should not mention purchase-load as unsupported.
```

- [ ] **Step 5: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 3: Implement `purchase-load.js`

**Files:**

- Create: `tests/stress/k6/scenarios/purchase-load.js`

- [ ] **Step 1: Add the scenario script**

Create `tests/stress/k6/scenarios/purchase-load.js` modeled on `harness-smoke.js`, with strict thresholds.

Reuse the existing classifier/metric names unchanged (`classifyPurchaseResponse` → `recordBucket` → counters such as `purchase_duplicate` for `ALREADY_PURCHASED`). Do not introduce `purchase_already_purchased` or rename metrics.

```js
import { check } from 'k6';

import { classifyPurchaseResponse } from '../helpers/classify.js';
import { graphqlRequest, PURCHASE_ITEM } from '../helpers/graphql.js';
import { buildHandleSummary, recordBucket } from '../helpers/metrics.js';
import { resolveProfile } from '../helpers/profiles.js';
import { loadState } from '../helpers/state.js';

const profile = resolveProfile(__ENV.PROFILE);
const graphqlUrl = __ENV.GRAPHQL_URL || 'http://localhost:3000/graphql';
const limiterProfile = __ENV.LIMITER_PROFILE || 'correctness';
const environment = __ENV.STRESS_ENVIRONMENT || 'local';

const seededState = loadState();

export const options = {
  scenarios: {
    default: {
      executor: 'shared-iterations',
      iterations: profile.attempts,
      vus: profile.vus,
    },
  },
  thresholds: {
    // Every iteration must result in exactly one successful purchase.
    purchase_success: [`count==${profile.attempts}`],
    purchase_rate_limited: ['count==0'],
    purchase_sold_out: ['count==0'],
    purchase_duplicate: ['count==0'],
    purchase_unexpected: ['count==0'],
  },
};

export function setup() {
  return {
    flashSaleId: seededState.flashSaleId,
    stock: seededState.stock,
    userIdPrefix: seededState.userIdPrefix,
  };
}

export default function (data) {
  const userId = `${data.userIdPrefix}-${__ITER}-${__VU}`;
  const res = graphqlRequest(graphqlUrl, {
    query: PURCHASE_ITEM,
    variables: {
      flashSaleId: data.flashSaleId,
      userId,
    },
  });

  // Existing classifier maps ALREADY_PURCHASED → purchase_duplicate metric.
  const bucket = classifyPurchaseResponse(res.body, res.transportError);
  recordBucket(bucket);

  check(res, {
    'transport ok': (r) => r.transportError === false,
  });
}

export function handleSummary(data) {
  const enrich = buildHandleSummary({
    environment,
    limiterProfile,
    profile: profile.name,
    scenario: 'purchase-load',
  });
  const summary = enrich(data);
  const json = JSON.stringify(summary, null, 2);

  const out = {
    stdout: `${json}\n`,
  };

  const summaryPath = __ENV.STRESS_SUMMARY_PATH;
  if (summaryPath) {
    out[summaryPath] = `${json}\n`;
  }

  return out;
}
```

No stock-sizing logic in this file.

- [ ] **Step 2: Static check**

```bash
# k6 parses the script (needs STRESS_* env or will fail at init on missing state —
# at minimum ensure the file exists and eslint accepts it)
pnpm exec eslint tests/stress/k6/scenarios/purchase-load.js tests/stress/k6/helpers/profiles.js
```

Expected: clean (or only pre-existing unrelated issues).

- [ ] **Step 3: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 4: README + seeder warning polish

**Files:**

- Modify: `tests/stress/README.md`

- [ ] **Step 1: Update README**

Rewrite `tests/stress/README.md` to cover both runnable scenarios. Required content:

````markdown
# Stress testing harness (EPIC-07)

Privileged Prisma seed → k6 GraphQL `purchaseItem` → Prisma verify.

## Prerequisites

- Docker Compose stack (or equivalent) with API + PostgreSQL + Redis
- Official [k6](https://k6.io) binary on `PATH` (`k6 version`)
- API started with the intended limiter profile — see `k6/config/*.env.example`
  (k6 env vars do **not** change API rate limits; put values in Compose/`env_file`)

## Runnable scenarios

| Scenario        | Issue | Notes                                                             |
| --------------- | ----- | ----------------------------------------------------------------- |
| `harness-smoke` | #53   | Harness proof; comfortable default seed stock is fine for `smoke` |
| `purchase-load` | #54   | Baseline concurrent purchase load (strict all-success)            |

Other scenario names may be seeded for later issues, but `pnpm stress:run` / `stress:test` will fail until those scripts land (#55–#57).

## Commands (repo root)

### Primary path (`purchase-load`)

`stress:test` resolves comfortable stock from the shared profile SoT when `--stock` is omitted:

```bash
pnpm stress:test -- --scenario purchase-load --profile smoke
```

Comfortable stock formula: `max(1000, ceil(attempts * 1.2))` (smoke → 1000, standard → 1200, full → 12000).

### Split path (`purchase-load`)

```bash
STOCK=$(pnpm --silent stress:stock standard)
pnpm stress:seed -- --scenario purchase-load --stock "$STOCK"
pnpm stress:run -- --scenario purchase-load --profile standard
pnpm stress:verify -- --scenario purchase-load --profile standard
```

Omitting `--stock` for high-intensity profiles changes the scenario from a comfortable-stock baseline into a stock-constrained run and therefore invalidates the #54 success criteria.

### Harness smoke

```bash
pnpm stress:test -- --scenario harness-smoke --profile smoke
```

`stress:test` exits non-zero if k6 fails or the verifier reports invariant violations.  
`stress:verify` requires `results/<scenario>-<profile>/k6-summary.json` by default (dual oracle).

## Design

See [EPIC-07 design spec](../../docs/superpowers/specs/2026-07-31-epic-07-performance-stress-testing-design.md)
and [#54 design](../../docs/superpowers/specs/2026-07-31-issue-54-flash-sale-load-test-design.md).
Results narrative hub lands with #60.
````

Keep root README thin — do not expand hubs or invent results.

- [ ] **Step 2: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 5: Verification (local proof when stack available)

**Files:** none required (execution only)

- [ ] **Step 1: Unit + lint gates (always)**

```bash
cd /home/rex/Project/test/app
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
pnpm exec eslint tests/stress/lib tests/stress/k6/scenarios/purchase-load.js tests/stress/k6/helpers/profiles.js scripts/stress-test.sh scripts/stress-run.sh
# bash scripts may be outside eslint — lint JS/TS paths that apply
```

Expected: unit tests PASS; eslint clean for touched JS/TS.

- [ ] **Step 2: Optional live smoke (when API + k6 + Compose are up)**

Prerequisites: stack running; API using `tests/stress/k6/config/correctness.env.example` values; `k6` on PATH.

```bash
pnpm stress:test -- --scenario purchase-load --profile smoke
```

Expected live outcome:

- Seed plants stock **1000** for smoke
- k6 exits **0**; all thresholds pass (`purchase_success == 100`, other buckets `0`)
- Verifier exits **0**; purchase rows == k6 successes; remaining stock identity; no duplicate users
- Artifact written: `tests/stress/results/purchase-load-smoke/k6-summary.json`

Do **not** invent or commit fabricated `results/` artifacts. If the stack is unavailable, note that in the handoff and leave live proof for the operator.

- [ ] **Step 3: Confirm seeder still generic**

```bash
pnpm stress:seed -- --scenario purchase-load --profile smoke
# without --stock → stock 1000 in .state/purchase-load.json (generic default)
# (reset afterward if needed; do not rely on this for #54 full-profile acceptance)
```

- [ ] **Step 4: Final review against AC**

- [ ] Load test exercises purchase under concurrent users (`purchase-load` + shared-iterations VUs)
- [ ] No seeder profile coupling
- [ ] No invented #71/#60 results docs
- [ ] No #134 CSS AC changes

- [ ] **Step 5: Commit / PR (only if user asks)**

Do not commit or open a PR unless explicitly requested.

---

## Plan self-review

1. **Spec coverage:** Goal, comfortable stock formula, profile SoT, `purchase-load.js`, runner wiring, README footgun, verifier reuse, strict thresholds — each has a task.
2. **Placeholders:** None; concrete file paths and code included.
3. **Type consistency:** Counter names match `metrics.js` (`purchase_duplicate`). Scenario id `purchase-load` consistent across types, scripts, state, summary.
4. **Profile SoT:** Profile values are defined once (`shared/profiles.json`) and consumed by both Node and k6; no duplicated attempts/VUs tables remain.
5. **Commits:** Deferred to user request per project constraint.
6. **Out of scope preserved:** No #55–#60 scenario bodies, no verifier redesign, no results fabrication.
