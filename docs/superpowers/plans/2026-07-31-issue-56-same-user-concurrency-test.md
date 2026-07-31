# #56 Same-User Concurrency Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `#56` same-user / duplicate-race k6 scenario under the existing stress harness so 10k concurrent attempts from one fixed user yield exactly one SUCCESS and `N-1` duplicates, without weakening `#54` or `#55`.

**Architecture:** Thin sibling of `oversell.js` / `purchase-load.js`. Attempts/VUs stay in `tests/stress/shared/profiles.json`. A scenario policy module owns stock constant (`10`), stable `fixedUserId`, and `expectsStockExhaustion`. Seeder still takes explicit `--stock` for inventory and writes `fixedUserId` from policy for `duplicate-race`. k6 enforces exact outcome gates + accounting; verifier dual-oracle requires `purchase_success == purchase_count == 1` when summary present; unused-stock warnings only when the scenario expects stock exhaustion.

**Tech Stack:** k6 (external binary), existing stress helpers, Node/`tsx` for policy + tests (`node:test`), bash wrappers, Prisma seeder/verifier from `#53`–`#55`.

**Base:** `main` at `#55` merge tip (`0c8f2f7` or later).

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review; skip per-task commit steps or treat them as “stage only when asked.”

**Spec:** `docs/superpowers/specs/2026-07-31-issue-56-same-user-concurrency-test-design.md`

**Issue AC:**

- [ ] 10k same-user requests yield at most 1 success

**Task order:** Policy → runner wiring → seeder → k6 → verifier → README → verification.

---

## File map

| File                                                                              | Responsibility                                                                                                                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/stress/shared/profiles.json`                                               | Unchanged attempts/VUs SoT                                                                                                                                 |
| `tests/stress/lib/scenario-policy.ts`                                             | **Create** — scenario policy module: `getScenarioPolicy(scenario: StressScenario)`, `DUPLICATE_RACE_STOCK`, stable fixed user id, `expectsStockExhaustion` |
| `tests/stress/lib/scenario-policy.test.ts`                                        | **Create** — unit tests for policy (sole place asserting `DUPLICATE_RACE_STOCK === 10`)                                                                    |
| `tests/stress/lib/comfortable-stock.ts`                                           | Extend `resolveStock` → `duplicate-race` returns `DUPLICATE_RACE_STOCK` (via policy); keep `#54`/`#55` formulas                                            |
| `tests/stress/lib/comfortable-stock.test.ts`                                      | Add duplicate-race routing via `DUPLICATE_RACE_STOCK`; stop expecting unsupported for `duplicate-race`                                                     |
| `tests/stress/lib/resolve-comfortable-stock.ts`                                   | Allow `--scenario=duplicate-race` in CLI                                                                                                                   |
| `tests/stress/seeder/types.ts`                                                    | Add `duplicate-race` to `RUNNABLE_K6_SCENARIOS`                                                                                                            |
| `scripts/stress-run.sh`                                                           | Map `duplicate-race` → script                                                                                                                              |
| `scripts/stress-test.sh`                                                          | Auto `--stock` for `duplicate-race` via `stress:stock`                                                                                                     |
| `tests/stress/seeder/seed-stress.ts`                                              | Write `fixedUserId` from `getScenarioPolicy(scenario)`                                                                                                     |
| `tests/stress/k6/scenarios/duplicate-race.js`                                     | **Create** — same-user scenario + exact gates + accounting diagnostic                                                                                      |
| `tests/stress/k6/scenarios/purchase-load.js`                                      | **Do not change**                                                                                                                                          |
| `tests/stress/k6/scenarios/oversell.js`                                           | **Do not change**                                                                                                                                          |
| `tests/stress/verifier/unused-stock-warning.ts`                                   | Gate warnings on `expectsStockExhaustion`                                                                                                                  |
| `tests/stress/verifier/unused-stock-warning.test.ts`                              | Expectation-driven cases                                                                                                                                   |
| `tests/stress/verifier/verify-stress.ts`                                          | Pass scenario into unused-stock helper                                                                                                                     |
| `tests/stress/README.md`                                                          | Thin duplicate-race docs                                                                                                                                   |
| `docs/superpowers/specs/2026-07-31-issue-56-same-user-concurrency-test-design.md` | Approved design                                                                                                                                            |
| `docs/superpowers/plans/2026-07-31-issue-56-same-user-concurrency-test.md`        | This plan                                                                                                                                                  |

**Expected unchanged:** root `README.md`, `docs/testing-strategy.md`, seeder default stock semantics (`1000`), comfortable/constrained formulas, `purchase-load.js` / `oversell.js` gates, apps production code, e2e, CI, `#57`–`#60` scenario bodies, `#134` CSS AC. Do not invent results docs (`#71`/`#60`). Do not add speculative policy fields (`expectedSuccessCount`, etc.). Do **not** merge scenario policy into `comfortable-stock.ts`.

---

### Task 1: Scenario policy module + `resolveStock('duplicate-race')` (TDD)

**Files:**

- Create: `tests/stress/lib/scenario-policy.ts`
- Create: `tests/stress/lib/scenario-policy.test.ts`
- Modify: `tests/stress/lib/comfortable-stock.ts`
- Modify: `tests/stress/lib/comfortable-stock.test.ts`
- Modify: `tests/stress/lib/resolve-comfortable-stock.ts`

- [ ] **Step 1: Write failing policy + resolveStock tests**

Create `tests/stress/lib/scenario-policy.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DUPLICATE_RACE_FIXED_USER_ID,
  DUPLICATE_RACE_STOCK,
  getScenarioPolicy,
} from './scenario-policy';

describe('getScenarioPolicy', () => {
  it('defines DUPLICATE_RACE_STOCK as 10 (canonical literal)', () => {
    assert.equal(DUPLICATE_RACE_STOCK, 10);
  });

  it('defines duplicate-race as constant stock, fixed user, no exhaustion expectation', () => {
    const policy = getScenarioPolicy('duplicate-race');
    assert.equal(policy.stockConstant, DUPLICATE_RACE_STOCK);
    assert.equal(policy.fixedUserId, DUPLICATE_RACE_FIXED_USER_ID);
    assert.equal(policy.expectsStockExhaustion, false);
    assert.ok(typeof policy.fixedUserId === 'string' && policy.fixedUserId.length > 0);
  });

  it('defines oversell as exhaustion-expected with no fixed user', () => {
    const policy = getScenarioPolicy('oversell');
    assert.equal(policy.stockConstant, null);
    assert.equal(policy.fixedUserId, null);
    assert.equal(policy.expectsStockExhaustion, true);
  });

  it('defines purchase-load / harness / high-volume without fixed user or exhaustion expectation', () => {
    for (const scenario of ['purchase-load', 'harness-smoke', 'high-volume'] as const) {
      const policy = getScenarioPolicy(scenario);
      assert.equal(policy.stockConstant, null);
      assert.equal(policy.fixedUserId, null);
      assert.equal(policy.expectsStockExhaustion, false);
    }
  });
});
```

Update the `resolveStock` describe in `tests/stress/lib/comfortable-stock.test.ts` — import `DUPLICATE_RACE_STOCK`, replace the unsupported-scenario assertion for `duplicate-race`, and add:

```ts
import { DUPLICATE_RACE_STOCK } from './scenario-policy';

// inside describe('resolveStock'):
it('routes duplicate-race to profile-independent DUPLICATE_RACE_STOCK', () => {
  assert.equal(resolveStock('smoke', 'duplicate-race'), DUPLICATE_RACE_STOCK);
  assert.equal(resolveStock('standard', 'duplicate-race'), DUPLICATE_RACE_STOCK);
  assert.equal(resolveStock('full', 'duplicate-race'), DUPLICATE_RACE_STOCK);
});

it('rejects unknown profiles and unsupported scenarios', () => {
  assert.throws(() => resolveStock('nope', 'oversell'), /Unknown profile/);
  assert.throws(() => resolveStock('smoke', 'high-volume'), /Unsupported scenario/);
});
```

Keep all existing comfortable / constrained / purchase-load / oversell tests unchanged. Do **not** re-assert the literal `10` in comfortable-stock tests — `scenario-policy.test.ts` owns that.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/rex/Project/test/app
pnpm exec tsx --test tests/stress/lib/scenario-policy.test.ts
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
```

Expected: FAIL — `scenario-policy` missing; `duplicate-race` still unsupported in `resolveStock`.

- [ ] **Step 3: Implement scenario policy + wire resolveStock**

Create `tests/stress/lib/scenario-policy.ts`. Type the argument as `StressScenario` from `../seeder/types` so the switch is exhaustiveness-checked at compile time:

```ts
import type { StressScenario } from '../seeder/types';

export const DUPLICATE_RACE_STOCK = 10;
export const DUPLICATE_RACE_FIXED_USER_ID = 'stress-user-duplicate-race';

export type ScenarioPolicy = {
  /** When non-null, resolveStock returns this constant (profile-independent). */
  stockConstant: number | null;
  fixedUserId: string | null;
  expectsStockExhaustion: boolean;
};

export function getScenarioPolicy(scenario: StressScenario): ScenarioPolicy {
  switch (scenario) {
    case 'duplicate-race':
      return {
        stockConstant: DUPLICATE_RACE_STOCK,
        fixedUserId: DUPLICATE_RACE_FIXED_USER_ID,
        expectsStockExhaustion: false,
      };
    case 'oversell':
      return {
        stockConstant: null,
        fixedUserId: null,
        expectsStockExhaustion: true,
      };
    case 'harness-smoke':
    case 'purchase-load':
    case 'high-volume':
      return {
        stockConstant: null,
        fixedUserId: null,
        expectsStockExhaustion: false,
      };
  }
}
```

In `tests/stress/lib/comfortable-stock.ts`:

- Import `getScenarioPolicy` and `isStressScenario`
- Extend `StockPolicyScenario` to `'oversell' | 'purchase-load' | 'duplicate-race'`
- After profile lookup, narrow scenario then consult policy

```ts
import { getScenarioPolicy } from './scenario-policy';
import { isStressScenario } from '../seeder/types';

export type StockPolicyScenario = 'oversell' | 'purchase-load' | 'duplicate-race';

export function resolveStock(profileName: string, scenario: string): number {
  const profiles = loadProfiles();
  const profile = profiles[profileName];
  if (!profile) {
    throw new Error(`Unknown profile: ${profileName}`);
  }

  if (!isStressScenario(scenario)) {
    throw new Error(`Unsupported scenario for stock policy: ${scenario}`);
  }

  const policy = getScenarioPolicy(scenario);
  if (policy.stockConstant !== null) {
    return policy.stockConstant;
  }

  switch (scenario) {
    case 'purchase-load':
      return comfortableStock(profile.attempts);
    case 'oversell':
      return constrainedStock(profile.attempts);
    default:
      throw new Error(`Unsupported scenario for stock policy: ${scenario}`);
  }
}
```

Update `resolve-comfortable-stock.ts` help + validation to include `duplicate-race`:

```ts
  pnpm stress:stock --profile=<name> --scenario=<purchase-load|oversell|duplicate-race>
```

```ts
if (scenario !== 'purchase-load' && scenario !== 'oversell' && scenario !== 'duplicate-race') {
  throw new Error(
    `Unsupported --scenario: ${String(scenario)}. Expected purchase-load | oversell | duplicate-race`,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec tsx --test tests/stress/lib/scenario-policy.test.ts
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
pnpm --silent stress:stock --profile=smoke --scenario=duplicate-race
pnpm --silent stress:stock --profile=full --scenario=duplicate-race
pnpm --silent stress:stock --profile=standard --scenario=purchase-load
pnpm --silent stress:stock --profile=standard --scenario=oversell
```

Expected: tests PASS; stdout `10`, `10`, `1200`, `100`.

- [ ] **Step 5: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 2: Runner wiring (`RUNNABLE`, `stress-run`, `stress-test`)

**Files:**

- Modify: `tests/stress/seeder/types.ts`
- Modify: `scripts/stress-run.sh`
- Modify: `scripts/stress-test.sh`

- [ ] **Step 1: Mark scenario runnable**

In `tests/stress/seeder/types.ts`:

```ts
export const RUNNABLE_K6_SCENARIOS = [
  'harness-smoke',
  'purchase-load',
  'oversell',
  'duplicate-race',
] as const;
```

Also update the comment above `RUNNABLE_K6_SCENARIOS` to mention `#56`.

- [ ] **Step 2: Wire `stress-run.sh`**

Add case alongside `oversell`:

```bash
  duplicate-race)
    SCRIPT="tests/stress/k6/scenarios/duplicate-race.js"
    ;;
```

Update help / error strings to list `duplicate-race`.

- [ ] **Step 3: Wire `stress-test.sh` auto-stock**

Extend the auto-resolve condition and help text:

```bash
if [[ ( "$SCENARIO" == "purchase-load" || "$SCENARIO" == "oversell" || "$SCENARIO" == "duplicate-race" ) && "$HAS_STOCK" -eq 0 ]]; then
  STOCK_VALUE="$(pnpm --silent stress:stock --profile="$PROFILE" --scenario="$SCENARIO")"
  HAS_STOCK=1
  echo "stress:test: ${SCENARIO} stock=$STOCK_VALUE (profile=$PROFILE)"
fi
```

Help: mention `duplicate-race` in `--stock` / auto-resolve docs.

- [ ] **Step 4: Sanity-check wrappers (script missing is OK until Task 4)**

```bash
pnpm --silent stress:stock --profile=smoke --scenario=duplicate-race
# Expect: 10
```

Confirm `stress-run.sh` case maps to `tests/stress/k6/scenarios/duplicate-race.js` (file lands in Task 4).

- [ ] **Step 5: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 3: Seeder writes policy `fixedUserId`

**Files:**

- Modify: `tests/stress/seeder/seed-stress.ts`

- [ ] **Step 1: Set fixedUserId from scenario policy**

In `seed-stress.ts`, import `getScenarioPolicy` and replace the hard-coded `fixedUserId: null` with policy:

```ts
import { getScenarioPolicy } from '../lib/scenario-policy';

// ... inside seedStress, when building state:
const policy = getScenarioPolicy(scenario);

const state: StressState = {
  fixedUserId: policy.fixedUserId,
  flashSaleId,
  productId,
  runId,
  scenario,
  stock,
  userIdPrefix,
};
```

Do **not** add a CLI `--fixed-user-id` flag. Do **not** change stock default / `--stock` semantics. Seeder still does not call `resolveStock` itself.

- [ ] **Step 2: Smoke-check seed state shape (optional if DB up; otherwise unit-level review)**

If Compose/DB available:

```bash
STOCK=$(pnpm --silent stress:stock --profile=smoke --scenario=duplicate-race)
pnpm stress:seed -- --scenario duplicate-race --stock "$STOCK"
node -e "const s=require('./tests/stress/.state/duplicate-race.json'); const {DUPLICATE_RACE_FIXED_USER_ID,DUPLICATE_RACE_STOCK}=require('./tests/stress/lib/scenario-policy.ts'); if(s.fixedUserId!=='stress-user-duplicate-race'||s.stock!==10) process.exit(1); console.log('ok', s.fixedUserId, s.stock)"
```

Expected: `ok stress-user-duplicate-race 10`.

(If `require` of `.ts` is awkward in the shell one-liner, assert the string/number literals that match the constants — the unit tests remain the canonical check that those literals equal the named constants.)

Also confirm other scenarios still get `fixedUserId: null` (e.g. seed `purchase-load` with any stock and inspect state).

- [ ] **Step 3: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 4: `duplicate-race.js` (exact gates + accounting diagnostic)

**Files:**

- Create: `tests/stress/k6/scenarios/duplicate-race.js`

- [ ] **Step 1: Implement scenario**

Create `tests/stress/k6/scenarios/duplicate-race.js` modeled on `purchase-load.js` / `oversell.js`, with these differences:

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
const stock = seededState.stock;
const attempts = profile.attempts;

if (!seededState.fixedUserId) {
  throw new Error('duplicate-race requires fixedUserId in stress state');
}

export const options = {
  scenarios: {
    default: {
      executor: 'shared-iterations',
      iterations: attempts,
      vus: profile.vus,
    },
  },
  thresholds: {
    purchase_success: ['count==1'],
    purchase_duplicate: [`count==${attempts - 1}`],
    purchase_sold_out: ['count==0'],
    purchase_rate_limited: ['count==0'],
    purchase_unexpected: ['count==0'],
  },
};

export function setup() {
  return {
    flashSaleId: seededState.flashSaleId,
    fixedUserId: seededState.fixedUserId,
    stock: seededState.stock,
  };
}

export default function (data) {
  const res = graphqlRequest(graphqlUrl, {
    query: PURCHASE_ITEM,
    variables: {
      flashSaleId: data.flashSaleId,
      userId: data.fixedUserId,
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
    scenario: 'duplicate-race',
  });
  const base = enrich(data);
  const c = base.counters;
  const purchaseSuccess = c.purchase_success ?? 0;
  const purchaseDuplicate = c.purchase_duplicate ?? 0;
  const purchaseSoldOut = c.purchase_sold_out ?? 0;
  const purchaseRateLimited = c.purchase_rate_limited ?? 0;
  const purchaseUnexpected = c.purchase_unexpected ?? 0;
  const classifiedTotal =
    purchaseSuccess +
    purchaseDuplicate +
    purchaseSoldOut +
    purchaseRateLimited +
    purchaseUnexpected;
  // The five exact thresholds imply the accounting invariant;
  // accountingOk is retained solely as a diagnostic field.
  const accountingOk = classifiedTotal === attempts;
  const unusedStock = Math.max(0, stock - purchaseSuccess);

  const summary = {
    ...base,
    accountingOk,
    attempts,
    classifiedTotal,
    fixedUserId: seededState.fixedUserId,
    purchaseSuccess,
    stock,
    unusedStock,
    warnings: [],
  };

  const json = JSON.stringify(summary, null, 2);
  const out = { stdout: `${json}\n` };
  const summaryPath = __ENV.STRESS_SUMMARY_PATH;
  if (summaryPath) {
    out[summaryPath] = `${json}\n`;
  }
  return out;
}
```

Notes:

- Do **not** emit exhaustion unused-stock warnings here (`expectsStockExhaustion === false`).
- Leftover stock may appear as `unusedStock` diagnostic only.
- The five exact thresholds imply the accounting invariant; `accountingOk` is retained solely as a diagnostic field. Do **not** throw from `handleSummary`.

- [ ] **Step 2: Static review**

```bash
# Must use fixedUserId, not per-iteration synthesis
rg -n "fixedUserId|userIdPrefix|__ITER" tests/stress/k6/scenarios/duplicate-race.js
# Expect: fixedUserId used; no `${userIdPrefix}-${__ITER}` pattern

# Baselines untouched
rg -n "purchase_success|purchase_sold_out" tests/stress/k6/scenarios/purchase-load.js
rg -n "purchase_success|purchase_sold_out" tests/stress/k6/scenarios/oversell.js
```

- [ ] **Step 3: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 5: Verifier — expectation-driven unused-stock warnings

**Files:**

- Modify: `tests/stress/verifier/unused-stock-warning.ts`
- Modify: `tests/stress/verifier/unused-stock-warning.test.ts`
- Modify: `tests/stress/verifier/verify-stress.ts`

- [ ] **Step 1: Write failing tests**

Replace `unused-stock-warning.test.ts` with expectation-aware API (keep name `unusedStockWarnings` — rename not required):

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { unusedStockWarnings } from './unused-stock-warning';

describe('unusedStockWarnings', () => {
  it('is empty when inventory is exhausted', () => {
    assert.deepEqual(unusedStockWarnings(100, 100, true), []);
  });

  it('is empty when purchaseCount exceeds stock', () => {
    assert.deepEqual(unusedStockWarnings(100, 101, true), []);
  });

  it('emits a warning when purchases are below stock and exhaustion is expected', () => {
    assert.deepEqual(unusedStockWarnings(100, 99, true), [
      'WARNING: Inventory not fully exhausted. stock=100 purchaseCount=99 unusedStock=1',
    ]);
  });

  it('is empty when leftover stock is expected (no exhaustion expectation)', () => {
    assert.deepEqual(unusedStockWarnings(10, 1, false), []);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm exec tsx --test tests/stress/verifier/unused-stock-warning.test.ts
```

Expected: FAIL (arity / signature mismatch).

- [ ] **Step 3: Implement**

```ts
export function unusedStockWarnings(
  stock: number,
  purchaseCount: number,
  expectsStockExhaustion: boolean,
): string[] {
  if (!expectsStockExhaustion) return [];
  if (purchaseCount >= stock) return [];
  const unused = stock - purchaseCount;
  return [
    `WARNING: Inventory not fully exhausted. stock=${stock} purchaseCount=${purchaseCount} unusedStock=${unused}`,
  ];
}
```

In `verify-stress.ts`:

```ts
import { getScenarioPolicy } from '../lib/scenario-policy';

// where warnings are computed:
const policy = getScenarioPolicy(state.scenario);
const warnings = unusedStockWarnings(state.stock, purchaseCount, policy.expectsStockExhaustion);
```

Do **not** add new fail gates. Existing `fixed_user_single_purchase` already fires when `fixedUserId` is set.

- [ ] **Step 4: Run tests**

```bash
pnpm exec tsx --test tests/stress/verifier/unused-stock-warning.test.ts
pnpm exec tsx --test tests/stress/lib/scenario-policy.test.ts
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 6: Thin README update

**Files:**

- Modify: `tests/stress/README.md`

- [ ] **Step 1: Update runnable table + commands + stock table + design links**

Apply edits so README includes:

1. Runnable row for `duplicate-race` | #56 | Same-user race (`SUCCESS=1`, `DUPLICATE=N-1`)
2. Primary path example:

```bash
# #56 same-user / duplicate-race (constant stock 10 auto-resolved)
pnpm stress:test -- --scenario duplicate-race --profile smoke
```

3. Stock table row:

| `duplicate-race` | constant `10` (profile-independent) | 10 / 10 / 10 |

4. Split-path example using `pnpm --silent stress:stock --profile=… --scenario=duplicate-race`
5. Design link to `#56` spec alongside EPIC-07 / #54 / #55
6. Note: correctness limiter required; leftover stock expected (no exhaustion warning)
7. Keep thin — no invented results narrative

Do not expand root README.

- [ ] **Step 2: Commit (only if user asks)**

Do not commit unless explicitly requested.

---

### Task 7: Verification (local proof when stack available)

**Files:** none required (execution only)

- [ ] **Step 1: Unit + lint gates (always)**

```bash
cd /home/rex/Project/test/app
pnpm exec tsx --test tests/stress/lib/scenario-policy.test.ts
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
pnpm exec tsx --test tests/stress/verifier/unused-stock-warning.test.ts

pnpm exec eslint \
  tests/stress/lib \
  tests/stress/seeder/seed-stress.ts \
  tests/stress/k6/scenarios/duplicate-race.js \
  tests/stress/verifier/unused-stock-warning.ts \
  tests/stress/verifier/verify-stress.ts
```

Expected: unit tests PASS; eslint clean for touched JS/TS.

- [ ] **Step 2: Confirm `#54` / `#55` not weakened + stock CLI + regression invariants**

```bash
rg -n "purchase_success|purchase_sold_out|purchase_duplicate" tests/stress/k6/scenarios/purchase-load.js
# Expect: success == attempts; sold_out/duplicate/rate_limited/unexpected == 0

rg -n "purchase_success|purchase_sold_out" tests/stress/k6/scenarios/oversell.js
# Expect: 0 < success <= stock; duplicate/rate_limited/unexpected == 0

pnpm --silent stress:stock --profile=standard --scenario=purchase-load   # 1200 (comfortableStock)
pnpm --silent stress:stock --profile=standard --scenario=oversell        # 100  (constrainedStock)
pnpm --silent stress:stock --profile=standard --scenario=duplicate-race  # 10   (DUPLICATE_RACE_STOCK)
pnpm --silent stress:stock smoke                                         # 1000 compat
```

**Regression invariants (collect for review):**

- [ ] `purchase-load` still resolves via `comfortableStock()`
- [ ] `oversell` still resolves via `constrainedStock()`
- [ ] `duplicate-race` is the only scenario with `fixedUserId != null`
- [ ] `duplicate-race` is the only scenario with constant stock (`stockConstant != null`)

- [ ] **Step 3: Optional live smoke (when API + k6 + Compose are up)**

Prerequisites: stack running; API using `tests/stress/k6/config/correctness.env.example` values (`RATE_LIMIT_PURCHASE_ITEM_MAX=100000`); `k6` on PATH.

```bash
pnpm stress:test -- --scenario duplicate-race --profile smoke
```

Expected live outcome:

- Seed plants stock **10** (`DUPLICATE_RACE_STOCK`), `fixedUserId=stress-user-duplicate-race`
- k6 exits **0**; `purchase_success == 1`; `purchase_duplicate == attempts - 1`; sold_out/rate_limited/unexpected `== 0`
- Summary: `accountingOk: true`, `unusedStock: stock - 1`, no exhaustion warning
- Verifier exits **0**; `purchase_success == purchase_count == 1`; remaining `stock - 1`; `fixed_user_single_purchase` ok; **no** unused-stock warning
- Artifact: `tests/stress/results/duplicate-race-smoke/k6-summary.json`

Optional regression smokes (do not weaken):

```bash
pnpm stress:test -- --scenario purchase-load --profile smoke
pnpm stress:test -- --scenario oversell --profile smoke
```

Do **not** invent or commit fabricated `results/` artifacts. If the stack is unavailable, note that in the handoff and leave live proof for the operator.

- [ ] **Step 4: Final review against AC / DoD**

- [ ] Runnable via `pnpm stress:test -- --scenario duplicate-race --profile {smoke|standard|full}`
- [ ] Full wiring = 10k attempts; exact gates + dual oracle
- [ ] Scenario policy module is SoT for stock / fixedUserId / exhaustion expectation
- [ ] `#54` / `#55` unchanged
- [ ] No invented `#71`/`#60` results docs
- [ ] No `#134` CSS AC changes

- [ ] **Step 5: Commit / PR (only if user asks)**

Do not commit or open a PR unless explicitly requested.

---

## Plan self-review

1. **Spec coverage:** Goal, `DUPLICATE_RACE_STOCK=10`, stable fixed user, scenario policy module, seeder fixedUserId, runner wiring, `duplicate-race.js` exact gates + accounting diagnostic, expectation-driven unused-stock, README, `#54`/`#55` freeze — each has a task.
2. **Placeholders:** None; concrete file paths and code included. No speculative policy fields.
3. **Type consistency:** Scenario id `duplicate-race`; `getScenarioPolicy(scenario: StressScenario)` for exhaustiveness; fixed user constant `stress-user-duplicate-race`; counters match `metrics.js`; `StockPolicyScenario` includes `duplicate-race`.
4. **Sequencing:** Policy → runner → seeder → k6 → verifier → README.
5. **Constants:** Literal `10` asserted once in policy tests; comfortable-stock tests use `DUPLICATE_RACE_STOCK`.
6. **Accounting:** Five thresholds imply the invariant; `accountingOk` is diagnostic only (no `handleSummary` throw).
7. **Profile SoT:** Attempts/VUs remain only in `shared/profiles.json`; duplicate-race stock is a deliberate constant via policy.
8. **Commits:** Deferred to user request per project constraint.
9. **Out of scope preserved:** No shared k6 extraction, no merge of policy into comfortable-stock, no `#57`–`#60` bodies, no purchase-load/oversell threshold changes, no results fabrication, no `#134` reopen.
