# #55 Limited Inventory Concurrency Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `#55` limited-inventory / oversell k6 scenario under the existing stress harness, with a generalized `resolveStock(profile, scenario)` policy so `stress:test` plants constrained stock below attempts while leaving `#54` purchase-load unchanged.

**Architecture:** Thin sibling of `purchase-load.js`. Attempts/VUs stay in `tests/stress/shared/profiles.json`. Public stock policy is `resolveStock(profile, scenario)` (comfortable vs constrained). Seeder stays generic (`--stock` only). `stress:test` auto-resolves omitted `--stock` for both `purchase-load` and `oversell`. k6 enforces `0 < purchase_success <= stock`; unused stock is informational in k6 summary (SoT) and verifier echo (exit 0).

**Tech Stack:** k6 (external binary), existing stress helpers, Node/`tsx` for stock policy + tests (`node:test`), bash wrappers, Prisma seeder/verifier from `#53`/`#54`.

**Base:** `main` at `#54` merge tip (`d4e7876` or later).

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review; skip per-task commit steps or treat them as “stage only when asked.”

**Spec:** `docs/superpowers/specs/2026-07-31-issue-55-limited-inventory-concurrency-test-design.md`

**Issue AC:**

- [ ] Scenario asserts successful purchases <= stock for 1k/10k user cases

---

## File map

| File                                                                                      | Responsibility                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/stress/shared/profiles.json`                                                       | Unchanged attempts/VUs SoT                                                                                                                                                                    |
| `tests/stress/lib/comfortable-stock.ts`                                                   | Evolve into stock-policy module: internal `comfortableStock` / `constrainedStock`; public `resolveStock`; keep `resolveComfortableStock` as thin wrapper → `resolveStock(p, 'purchase-load')` |
| `tests/stress/lib/comfortable-stock.test.ts`                                              | Extend with constrained + `resolveStock` routing tests                                                                                                                                        |
| `tests/stress/lib/resolve-comfortable-stock.ts`                                           | Evolve CLI: `--profile` / `--scenario`; bare profile → `purchase-load`; stdout integer only                                                                                                   |
| `tests/stress/k6/scenarios/oversell.js`                                                   | Limited-inventory scenario + hard gates + canonical diagnostics                                                                                                                               |
| `tests/stress/k6/scenarios/purchase-load.js`                                              | **Do not change** thresholds or behavior                                                                                                                                                      |
| `tests/stress/seeder/types.ts`                                                            | Add `oversell` to `RUNNABLE_K6_SCENARIOS`                                                                                                                                                     |
| `tests/stress/seeder/seed-stress.ts`                                                      | Runnable warning text only                                                                                                                                                                    |
| `scripts/stress-run.sh`                                                                   | Map `oversell` → script                                                                                                                                                                       |
| `scripts/stress-test.sh`                                                                  | Auto `--stock` for `purchase-load` **and** `oversell` via scenario-aware `stress:stock`                                                                                                       |
| `package.json`                                                                            | Keep `stress:stock` script name (CLI path may stay or point at same file)                                                                                                                     |
| `tests/stress/verifier/verify-stress.ts`                                                  | Informational unused-stock warning fields; **no new fail gates**                                                                                                                              |
| `tests/stress/verifier/cli.ts`                                                            | Print unused-stock warning when present; exit code still based on `ok` only                                                                                                                   |
| `tests/stress/README.md`                                                                  | Thin oversell docs + footgun + `stress:stock` examples                                                                                                                                        |
| `docs/superpowers/specs/2026-07-31-issue-55-limited-inventory-concurrency-test-design.md` | Approved design                                                                                                                                                                               |
| `docs/superpowers/plans/2026-07-31-issue-55-limited-inventory-concurrency-test.md`        | This plan                                                                                                                                                                                     |

**Expected unchanged:** root `README.md`, `docs/testing-strategy.md`, seeder default stock semantics (`1000`), comfortable-stock **formula**, `purchase-load.js` gates, apps production code, e2e, CI, `#56`–`#60` scenario bodies, `#134` CSS AC. Do not invent results docs (`#71`/`#60`).

---

### Task 1: Stock policy — `constrainedStock` + `resolveStock` (TDD)

**Files:**

- Modify: `tests/stress/lib/comfortable-stock.ts`
- Modify: `tests/stress/lib/comfortable-stock.test.ts`
- Modify: `tests/stress/lib/resolve-comfortable-stock.ts`

- [ ] **Step 1: Extend the failing unit tests**

Replace / extend `tests/stress/lib/comfortable-stock.test.ts` so existing comfortable tests still pass, and add:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  comfortableStock,
  constrainedStock,
  resolveComfortableStock,
  resolveStock,
} from './comfortable-stock';

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

describe('constrainedStock', () => {
  it('uses 10% of attempts clamped to [10, 100]', () => {
    assert.equal(constrainedStock(100), 10);
    assert.equal(constrainedStock(1000), 100);
    assert.equal(constrainedStock(10000), 100);
  });

  it('floors fractional products before clamp', () => {
    assert.equal(constrainedStock(199), 19); // floor(19.9)
    assert.equal(constrainedStock(50), 10); // max(10, floor(5))
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

describe('resolveStock', () => {
  it('routes purchase-load to comfortable stock', () => {
    assert.equal(resolveStock('smoke', 'purchase-load'), 1000);
    assert.equal(resolveStock('standard', 'purchase-load'), 1200);
    assert.equal(resolveStock('full', 'purchase-load'), 12000);
  });

  it('routes oversell to constrained stock', () => {
    assert.equal(resolveStock('smoke', 'oversell'), 10);
    assert.equal(resolveStock('standard', 'oversell'), 100);
    assert.equal(resolveStock('full', 'oversell'), 100);
  });

  it('rejects unknown profiles and unsupported scenarios', () => {
    assert.throws(() => resolveStock('nope', 'oversell'), /Unknown profile/);
    assert.throws(() => resolveStock('smoke', 'duplicate-race'), /Unsupported scenario/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL on new exports**

```bash
cd /home/rex/Project/test/app && pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
```

Expected: FAIL (`constrainedStock` / `resolveStock` missing).

- [ ] **Step 3: Implement stock policy API**

Update `tests/stress/lib/comfortable-stock.ts` (keep filename to minimize churn; this module is the stock-policy home):

```ts
import fs from 'node:fs';
import path from 'node:path';

export const GENERIC_SEEDER_DEFAULT_STOCK = 1000;
export const COMFORTABLE_STOCK_MULTIPLIER = 1.2;
export const CONSTRAINED_STOCK_RATIO = 0.1;
export const CONSTRAINED_STOCK_MIN = 10;
export const CONSTRAINED_STOCK_MAX = 100;

export type StockPolicyScenario = 'oversell' | 'purchase-load';

type Profile = {
  attempts: number;
  vus: number;
};

type Profiles = Record<string, Profile>;

function profilesPath(): string {
  return path.resolve(__dirname, '../shared/profiles.json');
}

export function loadProfiles(): Profiles {
  const raw = fs.readFileSync(profilesPath(), 'utf8');
  return JSON.parse(raw) as Profiles;
}

/** @internal formula — callers must use resolveStock */
export function comfortableStock(attempts: number): number {
  return Math.max(GENERIC_SEEDER_DEFAULT_STOCK, Math.ceil(attempts * COMFORTABLE_STOCK_MULTIPLIER));
}

/** @internal formula — callers must use resolveStock */
export function constrainedStock(attempts: number): number {
  return Math.min(
    CONSTRAINED_STOCK_MAX,
    Math.max(CONSTRAINED_STOCK_MIN, Math.floor(attempts * CONSTRAINED_STOCK_RATIO)),
  );
}

/** Public stock-policy API: sole entry point for recommended seed stock. */
export function resolveStock(profileName: string, scenario: StockPolicyScenario): number {
  const profiles = loadProfiles();
  const profile = profiles[profileName];
  if (!profile) {
    throw new Error(`Unknown profile: ${profileName}`);
  }

  switch (scenario) {
    case 'purchase-load':
      return comfortableStock(profile.attempts);
    case 'oversell':
      return constrainedStock(profile.attempts);
    default: {
      const _exhaustive: never = scenario;
      throw new Error(`Unsupported scenario for stock policy: ${String(_exhaustive)}`);
    }
  }
}

/** Thin wrapper for #54 callers/tests — prefer resolveStock. */
export function resolveComfortableStock(profileName: string): number {
  return resolveStock(profileName, 'purchase-load');
}
```

Note: `comfortableStock` / `constrainedStock` remain exported **for unit testing only**; production callers must use `resolveStock()` (via CLI / orchestration). Do not import the formula helpers from runners, seeder, scenarios, or verifier.

- [ ] **Step 4: Evolve CLI to scenario-aware `stress:stock`**

Replace `tests/stress/lib/resolve-comfortable-stock.ts` with:

```ts
import { resolveStock, type StockPolicyScenario } from './comfortable-stock';

function printHelp(): void {
  process.stderr.write(`Usage:
  pnpm stress:stock --profile=<name> --scenario=<purchase-load|oversell>
  pnpm stress:stock <profile>   # compat: scenario defaults to purchase-load

Prints a single integer stock value on stdout.
`);
}

function parseArgs(argv: string[]): {
  help: boolean;
  profile: string;
  scenario: StockPolicyScenario;
} {
  let help = false;
  let profile: string | undefined;
  let scenario: StockPolicyScenario = 'purchase-load';
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg.startsWith('--profile=')) {
      profile = arg.slice('--profile='.length);
      continue;
    }
    if (arg === '--profile') {
      profile = argv[++i];
      continue;
    }
    if (arg.startsWith('--scenario=')) {
      scenario = arg.slice('--scenario='.length) as StockPolicyScenario;
      continue;
    }
    if (arg === '--scenario') {
      scenario = argv[++i] as StockPolicyScenario;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    positionals.push(arg);
  }

  if (help) {
    return { help: true, profile: 'smoke', scenario: 'purchase-load' };
  }

  if (!profile) {
    if (positionals.length === 1) {
      profile = positionals[0];
    } else {
      throw new Error('Missing --profile (or positional profile)');
    }
  } else if (positionals.length > 0) {
    throw new Error('Do not mix positional profile with --profile');
  }

  if (scenario !== 'purchase-load' && scenario !== 'oversell') {
    throw new Error(
      `Unsupported --scenario: ${String(scenario)}. Expected purchase-load | oversell`,
    );
  }

  return { help: false, profile, scenario };
}

const parsed = parseArgs(process.argv.slice(2));
if (parsed.help) {
  printHelp();
  process.exit(0);
}

try {
  process.stdout.write(`${resolveStock(parsed.profile, parsed.scenario)}\n`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
```

Keep `package.json` script as:

```json
"stress:stock": "pnpm exec tsx tests/stress/lib/resolve-comfortable-stock.ts"
```

- [ ] **Step 5: Run unit tests + CLI smoke — expect PASS**

```bash
cd /home/rex/Project/test/app
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts

pnpm --silent stress:stock smoke
# 1000

pnpm --silent stress:stock --profile=smoke --scenario=purchase-load
# 1000

pnpm --silent stress:stock --profile=smoke --scenario=oversell
# 10

pnpm --silent stress:stock --profile=standard --scenario=oversell
# 100

pnpm --silent stress:stock --profile=full --scenario=oversell
# 100
```

- [ ] **Step 6: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 2: Wire `oversell` into runners + auto stock injection

**Files:**

- Modify: `tests/stress/seeder/types.ts`
- Modify: `tests/stress/seeder/seed-stress.ts` (warning string only)
- Modify: `scripts/stress-run.sh`
- Modify: `scripts/stress-test.sh`

- [ ] **Step 1: Mark scenario runnable**

In `tests/stress/seeder/types.ts`:

```ts
export const RUNNABLE_K6_SCENARIOS = ['harness-smoke', 'purchase-load', 'oversell'] as const;
```

Update the warning in `seed-stress.ts` so it lists runnable names (or points at `RUNNABLE_K6_SCENARIOS`). **Do not** add scenario-aware stock logic to the seeder.

- [ ] **Step 2: Map scenario in `stress-run.sh`**

In the `case "$SCENARIO"` block, add:

```bash
  oversell)
    SCRIPT="tests/stress/k6/scenarios/oversell.js"
    ;;
```

Update help/error strings to: `harness-smoke, purchase-load, oversell`.

- [ ] **Step 3: Auto-resolve stock for `purchase-load` and `oversell` in `stress-test.sh`**

Replace the stock-injection branch so both scenarios use scenario-aware `stress:stock`. Honor explicit `--stock`. Use `pnpm --silent`.

```bash
if [[ ( "$SCENARIO" == "purchase-load" || "$SCENARIO" == "oversell" ) && "$HAS_STOCK" -eq 0 ]]; then
  # --silent: pnpm otherwise prints script banners to stdout and breaks integer capture.
  STOCK_VALUE="$(pnpm --silent stress:stock --profile="$PROFILE" --scenario="$SCENARIO")"
  HAS_STOCK=1
  echo "stress:test: ${SCENARIO} stock=$STOCK_VALUE (profile=$PROFILE)"
fi
```

Update `--help` text:

```text
  --stock <n>         Seed stock override (purchase-load / oversell; auto-resolved when omitted)
```

Keep separate `SEED_ARGS` / `RUN_ARGS` / `VERIFY_ARGS` (stock only on seed). Never forward stock math into k6.

Backward compat check: bare `pnpm --silent stress:stock smoke` still works for docs that have not migrated; `stress:test` should use the named-flag form.

- [ ] **Step 4: Sanity-check wrappers (no API required)**

```bash
pnpm --silent stress:stock --profile=smoke --scenario=oversell
# Expect: 10

# after Task 3, unsupported-scenario errors must not list oversell as unsupported.
bash scripts/stress-run.sh --help | grep -q oversell
```

- [ ] **Step 5: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 3: Implement `oversell.js`

**Files:**

- Create: `tests/stress/k6/scenarios/oversell.js`

- [ ] **Step 1: Add the scenario script**

Create `tests/stress/k6/scenarios/oversell.js` modeled on `purchase-load.js`, but with oversell gates and diagnostics.

**Do not** change `purchase-load.js`.

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

// Stock is immutable input from seed state — never recalculated from profile here.
const seededState = loadState();
const stock = seededState.stock;

export const options = {
  scenarios: {
    default: {
      executor: 'shared-iterations',
      iterations: profile.attempts,
      vus: profile.vus,
    },
  },
  thresholds: {
    // Primary correctness invariant: 0 < purchase_success <= stock
    purchase_success: [`count>0`, `count<=${stock}`],
    purchase_duplicate: ['count==0'],
    purchase_rate_limited: ['count==0'],
    purchase_unexpected: ['count==0'],
    // purchase_sold_out intentionally ungated — expected business outcomes under constrained stock
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
    scenario: 'oversell',
  });
  const base = enrich(data);
  const purchaseSuccess = base.counters.purchase_success ?? 0;
  const unusedStock = Math.max(0, stock - purchaseSuccess);
  const oversold = purchaseSuccess > stock;
  const warnings = [];
  if (!oversold && unusedStock > 0) {
    warnings.push(
      `Inventory not fully exhausted (${unusedStock} item${unusedStock === 1 ? '' : 's'} remaining).`,
    );
  }

  const summary = {
    ...base,
    oversell: oversold,
    purchaseSuccess,
    stock,
    unusedStock,
    warnings,
  };

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

Notes:

- Threshold expressions interpolate `stock` from seeded state at init (same pattern as `#54` interpolating `profile.attempts`).
- Do **not** gate `purchase_sold_out` to `0`.
- Do **not** put stock-sizing formulas in this file.
- Keep existing metric names (`purchase_duplicate` for `ALREADY_PURCHASED`).

- [ ] **Step 2: Static check**

```bash
cd /home/rex/Project/test/app
pnpm exec eslint tests/stress/k6/scenarios/oversell.js tests/stress/lib/comfortable-stock.ts tests/stress/lib/resolve-comfortable-stock.ts
```

Expected: clean for touched files.

- [ ] **Step 3: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 4: Verifier informational unused-stock echo

**Files:**

- Create: `tests/stress/verifier/unused-stock-warning.ts`
- Create: `tests/stress/verifier/unused-stock-warning.test.ts`
- Modify: `tests/stress/verifier/verify-stress.ts`
- Modify: `tests/stress/verifier/cli.ts`

- [ ] **Step 1: Add pure warning helper (TDD)**

Create `tests/stress/verifier/unused-stock-warning.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { unusedStockWarnings } from './unused-stock-warning';

describe('unusedStockWarnings', () => {
  it('is empty when inventory is exhausted', () => {
    assert.deepEqual(unusedStockWarnings(100, 100), []);
  });

  it('is empty when purchaseCount exceeds stock (oversell handled by hard gates)', () => {
    assert.deepEqual(unusedStockWarnings(100, 101), []);
  });

  it('emits a single warning when purchases are below stock', () => {
    assert.deepEqual(unusedStockWarnings(100, 99), [
      'WARNING: Inventory not fully exhausted. stock=100 purchaseCount=99 unusedStock=1',
    ]);
  });
});
```

Run (expect FAIL):

```bash
pnpm exec tsx --test tests/stress/verifier/unused-stock-warning.test.ts
```

Create `tests/stress/verifier/unused-stock-warning.ts`:

```ts
export function unusedStockWarnings(stock: number, purchaseCount: number): string[] {
  if (purchaseCount >= stock) return [];
  const unused = stock - purchaseCount;
  return [
    `WARNING: Inventory not fully exhausted. stock=${stock} purchaseCount=${purchaseCount} unusedStock=${unused}`,
  ];
}
```

Run again — expect PASS.

- [ ] **Step 2: Add non-fatal warning fields (no new fail gates)**

In `verify-stress.ts`, extend `VerifyResult`:

```ts
export type VerifyResult = {
  // ...existing fields...
  warnings: string[];
};
```

Import and use the helper after correctness checks are computed (and **without** adding any check that sets `ok: false` for unused stock):

```ts
import { unusedStockWarnings } from './unused-stock-warning';

// ... after purchaseCount / stock are known:
const warnings = unusedStockWarnings(state.stock, purchaseCount);
```

Include `warnings` in the returned `VerifyResult` and in the written `verifier.json` artifact (top-level `warnings` array). Do **not** fold warnings into `checks` as failing items.

`ok` remains `checks.every((c) => c.ok)` only.

- [ ] **Step 3: Echo warnings in CLI (exit 0 when ok)**

In `verifier/cli.ts` `formatResult`, after the check lines and before the artifact line:

```ts
for (const warning of result.warnings) {
  lines.push(warning);
}
```

Ensure `main` still only sets `process.exitCode = 1` when `!result.ok`.

- [ ] **Step 4: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 5: README thin update

**Files:**

- Modify: `tests/stress/README.md`

- [ ] **Step 1: Update README**

Rewrite `tests/stress/README.md` to include `oversell` while keeping the doc thin. Required content:

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
| `oversell`      | #55   | Limited inventory / oversell (`0 < purchase_success <= stock`)    |

Other scenario names may be seeded for later issues, but `pnpm stress:run` / `stress:test` will fail until those scripts land (#56–#57).

## Commands (repo root)

`stress:test` remains the recommended entry point; split-path commands are documented primarily for debugging and advanced workflows.

### Primary path

```bash
# #54 baseline (comfortable stock auto-resolved)
pnpm stress:test -- --scenario purchase-load --profile smoke

# #55 limited inventory (constrained stock auto-resolved)
pnpm stress:test -- --scenario oversell --profile smoke
```

Stock policy via shared profiles + `resolveStock(profile, scenario)`:

| Scenario        | Formula (internal)                          | smoke / standard / full |
| --------------- | ------------------------------------------- | ----------------------- |
| `purchase-load` | `max(1000, ceil(attempts * 1.2))`           | 1000 / 1200 / 12000     |
| `oversell`      | `min(100, max(10, floor(attempts * 0.10)))` | 10 / 100 / 100          |

### Split path

```bash
STOCK=$(pnpm --silent stress:stock --profile=standard --scenario=oversell)
pnpm stress:seed -- --scenario oversell --stock "$STOCK"
pnpm stress:run -- --scenario oversell --profile standard
pnpm stress:verify -- --scenario oversell --profile standard
```

Bare `pnpm --silent stress:stock <profile>` still resolves **purchase-load** comfortable stock (compat).

Running `stress:seed` directly without a resolver-derived `--stock` seeds the generic default (1000), which may prevent the oversell scenario from exercising constrained inventory. **Prefer `stress:test`** (or an explicit resolver-derived `--stock`).

### Harness smoke

```bash
pnpm stress:test -- --scenario harness-smoke --profile smoke
```

`stress:test` exits non-zero if k6 fails or the verifier reports invariant violations.  
Unused stock on oversell is an informational warning (exit 0) when correctness gates pass.  
`stress:verify` requires `results/<scenario>-<profile>/k6-summary.json` by default (dual oracle).

## Design

See [EPIC-07 design spec](../../docs/superpowers/specs/2026-07-31-epic-07-performance-stress-testing-design.md),
[#54 design](../../docs/superpowers/specs/2026-07-31-issue-54-flash-sale-load-test-design.md),
and [#55 design](../../docs/superpowers/specs/2026-07-31-issue-55-limited-inventory-concurrency-test-design.md).
Results narrative hub lands with #60.
````

Keep root README thin — do not expand hubs or invent results.

- [ ] **Step 2: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 6: Verification (local proof when stack available)

**Files:** none required (execution only)

- [ ] **Step 1: Unit + lint gates (always)**

```bash
cd /home/rex/Project/test/app
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
pnpm exec tsx --test tests/stress/verifier/unused-stock-warning.test.ts

pnpm exec eslint \
  tests/stress/lib \
  tests/stress/k6/scenarios/oversell.js \
  tests/stress/verifier/verify-stress.ts \
  tests/stress/verifier/cli.ts
```

Expected: unit tests PASS; eslint clean for touched JS/TS.

- [ ] **Step 2: Confirm `#54` baseline not weakened + CLI compat**

```bash
# Thresholds must still require full success — spot-check source
rg -n "purchase_success|purchase_sold_out" tests/stress/k6/scenarios/purchase-load.js
# Expect: purchase_success count==attempts; purchase_sold_out count==0

pnpm --silent stress:stock --profile=standard --scenario=purchase-load
# Expect: 1200 (comfortable formula unchanged)

# Backward-compat CLI (bare profile → purchase-load)
pnpm --silent stress:stock smoke
# Expect: 1000
pnpm --silent stress:stock --profile=smoke --scenario=purchase-load
# Expect: 1000
```

- [ ] **Step 3: Optional live smoke (when API + k6 + Compose are up)**

Prerequisites: stack running; API using `tests/stress/k6/config/correctness.env.example` values; `k6` on PATH.

```bash
pnpm stress:test -- --scenario oversell --profile smoke
```

Expected live outcome:

- Seed plants stock **10** for smoke oversell
- k6 exits **0**; `0 < purchase_success <= 10`; duplicate/rate_limited/unexpected `== 0`; `SOLD_OUT` observed in counters
- Summary includes `stock`, `purchaseSuccess`, `unusedStock`, `oversell: false`, `warnings` (empty if fully exhausted)
- Verifier exits **0**; `purchase_count <= stock`; stock identity; dual-oracle match; unused-stock warning only if `purchaseCount < stock`
- Artifact: `tests/stress/results/oversell-smoke/k6-summary.json`

Do **not** invent or commit fabricated `results/` artifacts. If the stack is unavailable, note that in the handoff and leave live proof for the operator.

- [ ] **Step 4: Final review against AC / DoD**

- [ ] Successful purchases ≤ stock for 1k/10k attempt cases (profile wiring for `standard`/`full`; smoke proves locally)
- [ ] `resolveStock` is sole public stock-policy API; seeder remains policy-agnostic
- [ ] `purchase-load` thresholds and comfortable sizing unchanged
- [ ] No invented `#71`/`#60` results docs
- [ ] No `#134` CSS AC changes

- [ ] **Step 5: Commit / PR (only if user asks)**

Do not commit or open a PR unless explicitly requested.

---

## Plan self-review

1. **Spec coverage:** Goal, constrained formula, `resolveStock` public API, CLI flags + compat, runner wiring, `oversell.js` gates + diagnostics, verifier informational echo, README footgun, `#54` freeze — each has a task.
2. **Placeholders:** None; concrete file paths and code included.
3. **Type consistency:** Scenario id `oversell`; counters match `metrics.js`; CLI scenarios limited to `purchase-load` \| `oversell` for stock policy (other scenarios remain seedable but not stock-resolved).
4. **Profile SoT:** Attempts/VUs remain only in `shared/profiles.json`; stock derived via `resolveStock`.
5. **Commits:** Deferred to user request per project constraint.
6. **Out of scope preserved:** No `#56`–`#60` bodies, no seeder policy, no purchase-load threshold changes, no results fabrication, no `#134` reopen.
