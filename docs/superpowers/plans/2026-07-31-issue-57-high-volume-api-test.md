# #57 High-Volume API Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `#57` high-volume k6 scenario under the existing stress harness so shared-profile purchase attempts under the performance limiter record throughput, latency, and outcome mix (including `RATE_LIMITED` as a capacity signal) while hard-failing only on correctness gates — without changing `#54`/`#55`/`#56` proofs.

**Architecture:** Thin sibling of `purchase-load.js`. Attempts/VUs stay in `tests/stress/shared/profiles.json`. Scenario policy gains `stockKind` + `expectedLimiterProfile`; `resolveStock` switches on `stockKind` (`comfortable` → existing `comfortableStock` for `purchase-load` and `high-volume`). Generic `stress:policy` CLI bridges TS policy → bash for `LIMITER_PROFILE` summary metadata. Seeder remains generic (`--stock` only). k6 enforces correctness gates + accounting; verifier dual-oracle unchanged.

**Tech Stack:** k6 (external binary), existing stress helpers, Node/`tsx` for policy + tests (`node:test`), bash wrappers, Prisma seeder/verifier from `#53`–`#56`.

**Base:** `main` at `#56` merge tip (`40cd6a8` or later).

**Commits:** Commit in logical groups per task (or tight task clusters) using `<type>: <MESSAGE>` convention. Open a PR when implementation + verification complete.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-57-high-volume-api-test-design.md`

**Issue AC:**

- [ ] High-volume scenario records throughput and latency

**Task order:** Policy enrichment → `resolveStock` / stock CLI → `stress:policy` + wrapper metadata → runner wiring → `high-volume.js` → README → verification.

---

## File map

| File                                                                        | Responsibility                                                                                           |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `tests/stress/shared/profiles.json`                                         | Unchanged attempts/VUs SoT                                                                               |
| `tests/stress/lib/scenario-policy.ts`                                       | Add `stockKind`, `expectedLimiterProfile`; keep existing fields                                          |
| `tests/stress/lib/scenario-policy.test.ts`                                  | Assert new fields per scenario                                                                           |
| `tests/stress/lib/comfortable-stock.ts`                                     | `resolveStock` switches on `stockKind`; support `high-volume`                                            |
| `tests/stress/lib/comfortable-stock.test.ts`                                | Route `high-volume` → comfortable; stop expecting unsupported                                            |
| `tests/stress/lib/resolve-comfortable-stock.ts`                             | Allow `--scenario=high-volume`                                                                           |
| `tests/stress/lib/resolve-scenario-policy.ts`                               | **Create** — `stress:policy` CLI                                                                         |
| `tests/stress/lib/resolve-scenario-policy.test.ts`                          | **Create** — CLI/parser unit tests                                                                       |
| `package.json`                                                              | Add `stress:policy` script                                                                               |
| `tests/stress/seeder/types.ts`                                              | Add `high-volume` to `RUNNABLE_K6_SCENARIOS`                                                             |
| `scripts/stress-run.sh`                                                     | Map `high-volume`; default `LIMITER_PROFILE` from `stress:policy` when unset                             |
| `scripts/stress-test.sh`                                                    | Auto `--stock` for `high-volume`                                                                         |
| `tests/stress/k6/scenarios/high-volume.js`                                  | **Create** — observation-first scenario + correctness gates + accounting + performance fields in summary |
| `tests/stress/k6/scenarios/purchase-load.js`                                | **Do not change**                                                                                        |
| `tests/stress/k6/scenarios/oversell.js`                                     | **Do not change**                                                                                        |
| `tests/stress/k6/scenarios/duplicate-race.js`                               | **Do not change**                                                                                        |
| `tests/stress/seeder/*`                                                     | **No behavioral change** (high-volume already a `StressScenario`; `fixedUserId` null via policy)         |
| `tests/stress/verifier/*`                                                   | **No new `#57`-only failure conditions**                                                                 |
| `tests/stress/README.md`                                                    | Thin high-volume docs                                                                                    |
| `docs/superpowers/specs/2026-07-31-issue-57-high-volume-api-test-design.md` | Approved design                                                                                          |
| `docs/superpowers/plans/2026-07-31-issue-57-high-volume-api-test.md`        | This plan                                                                                                |

**Expected unchanged:** root `README.md`, `docs/testing-strategy.md`, seeder default stock semantics (`1000`), `comfortableStock` / `constrainedStock` formulas, `#54`/`#55`/`#56` k6 gates, apps production code, e2e, CI, `#58`–`#60` bodies, `#134` CSS AC. Do not invent results docs (`#71`/`#60`). Do **not** add `rateLimitedRole`. Do **not** extract shared k6 purchase module.

**Filenames:** Keep existing `comfortable-stock.ts` (stock resolution library) and `resolve-comfortable-stock.ts` (CLI) for compatibility; do **not** rename to `stock-policy.ts` / `resolve-stock.ts` in `#57`.

---

### Task 1: Policy enrichment — `stockKind` + `expectedLimiterProfile` (TDD)

**Files:**

- Modify: `tests/stress/lib/scenario-policy.ts`
- Modify: `tests/stress/lib/scenario-policy.test.ts`

- [ ] **Step 1: Extend failing policy tests**

Replace/extend `tests/stress/lib/scenario-policy.test.ts` so every scenario asserts the new fields (keep existing assertions):

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

  it('defines duplicate-race as constant stock, fixed user, correctness limiter, no exhaustion', () => {
    const policy = getScenarioPolicy('duplicate-race');
    assert.equal(policy.stockKind, 'constant');
    assert.equal(policy.stockConstant, DUPLICATE_RACE_STOCK);
    assert.equal(policy.fixedUserId, DUPLICATE_RACE_FIXED_USER_ID);
    assert.equal(policy.expectsStockExhaustion, false);
    assert.equal(policy.expectedLimiterProfile, 'correctness');
  });

  it('defines oversell as constrained, exhaustion-expected, correctness limiter, no fixed user', () => {
    const policy = getScenarioPolicy('oversell');
    assert.equal(policy.stockKind, 'constrained');
    assert.equal(policy.stockConstant, null);
    assert.equal(policy.fixedUserId, null);
    assert.equal(policy.expectsStockExhaustion, true);
    assert.equal(policy.expectedLimiterProfile, 'correctness');
  });

  it('defines purchase-load / harness-smoke as comfortable + correctness', () => {
    for (const scenario of ['purchase-load', 'harness-smoke'] as const) {
      const policy = getScenarioPolicy(scenario);
      assert.equal(policy.stockKind, 'comfortable');
      assert.equal(policy.stockConstant, null);
      assert.equal(policy.fixedUserId, null);
      assert.equal(policy.expectsStockExhaustion, false);
      assert.equal(policy.expectedLimiterProfile, 'correctness');
    }
  });

  it('defines high-volume as comfortable + performance limiter, no fixed user, no exhaustion', () => {
    const policy = getScenarioPolicy('high-volume');
    assert.equal(policy.stockKind, 'comfortable');
    assert.equal(policy.stockConstant, null);
    assert.equal(policy.fixedUserId, null);
    assert.equal(policy.expectsStockExhaustion, false);
    assert.equal(policy.expectedLimiterProfile, 'performance');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/rex/Project/test/app
pnpm exec tsx --test tests/stress/lib/scenario-policy.test.ts
```

Expected: FAIL — `stockKind` / `expectedLimiterProfile` missing on policy objects.

- [ ] **Step 3: Implement policy fields**

Update `tests/stress/lib/scenario-policy.ts`:

```ts
import type { StressScenario } from '../seeder/types';

export const DUPLICATE_RACE_STOCK = 10;
export const DUPLICATE_RACE_FIXED_USER_ID = 'stress-user-duplicate-race';

export type StockKind = 'comfortable' | 'constrained' | 'constant';
export type LimiterProfile = 'correctness' | 'performance';

export type ScenarioPolicy = {
  fixedUserId: null | string;
  expectsStockExhaustion: boolean;
  stockConstant: null | number;
  stockKind: StockKind;
  expectedLimiterProfile: LimiterProfile;
};

export function getScenarioPolicy(scenario: StressScenario): ScenarioPolicy {
  switch (scenario) {
    case 'duplicate-race':
      return {
        fixedUserId: DUPLICATE_RACE_FIXED_USER_ID,
        expectsStockExhaustion: false,
        stockConstant: DUPLICATE_RACE_STOCK,
        stockKind: 'constant',
        expectedLimiterProfile: 'correctness',
      };
    case 'oversell':
      return {
        fixedUserId: null,
        expectsStockExhaustion: true,
        stockConstant: null,
        stockKind: 'constrained',
        expectedLimiterProfile: 'correctness',
      };
    case 'high-volume':
      return {
        fixedUserId: null,
        expectsStockExhaustion: false,
        stockConstant: null,
        stockKind: 'comfortable',
        expectedLimiterProfile: 'performance',
      };
    case 'harness-smoke':
    case 'purchase-load':
      return {
        fixedUserId: null,
        expectsStockExhaustion: false,
        stockConstant: null,
        stockKind: 'comfortable',
        expectedLimiterProfile: 'correctness',
      };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec tsx --test tests/stress/lib/scenario-policy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit (only if user asks)**

Skip unless explicitly requested.

---

### Task 2: `resolveStock` via `stockKind` + high-volume stock CLI (TDD)

**Files:**

- Modify: `tests/stress/lib/comfortable-stock.ts`
- Modify: `tests/stress/lib/comfortable-stock.test.ts`
- Modify: `tests/stress/lib/resolve-comfortable-stock.ts`

- [ ] **Step 1: Update failing resolveStock tests**

In `tests/stress/lib/comfortable-stock.test.ts`, replace the `high-volume` unsupported expectation and add comfortable routing:

```ts
it('routes high-volume to comfortable stock (same as purchase-load)', () => {
  assert.equal(resolveStock('smoke', 'high-volume'), 1000);
  assert.equal(resolveStock('standard', 'high-volume'), 1200);
  assert.equal(resolveStock('full', 'high-volume'), 12000);
  assert.equal(resolveStock('smoke', 'high-volume'), resolveStock('smoke', 'purchase-load'));
});

it('rejects unknown profiles and unsupported scenarios', () => {
  assert.throws(() => resolveStock('nope', 'oversell'), /Unknown profile/);
  assert.throws(() => resolveStock('smoke', 'not-a-scenario'), /Unsupported scenario/);
});
```

Keep purchase-load / oversell / duplicate-race tests unchanged.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
```

Expected: FAIL — `high-volume` still unsupported (or not routed via comfortable).

- [ ] **Step 3: Implement stockKind switch in resolveStock**

In `tests/stress/lib/comfortable-stock.ts`:

- Extend `StockPolicyScenario` to include `'high-volume'`
- Route by `policy.stockKind` (formulas remain separate helpers)

```ts
export type StockPolicyScenario = 'duplicate-race' | 'oversell' | 'purchase-load' | 'high-volume';

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

  switch (policy.stockKind) {
    case 'constant':
      if (policy.stockConstant === null) {
        throw new Error(`stockKind constant requires stockConstant for scenario: ${scenario}`);
      }
      return policy.stockConstant;
    case 'comfortable':
      return comfortableStock(profile.attempts);
    case 'constrained':
      return constrainedStock(profile.attempts);
  }
}
```

Remove the old scenario-name switch that called formulas / `stockConstant` separately (policy owns the kind).

In `tests/stress/lib/resolve-comfortable-stock.ts`:

- Extend help text and allowlist to include `high-volume`
- Update `StockPolicyScenario` cast allowlist:

```ts
if (
  scenario !== 'purchase-load' &&
  scenario !== 'oversell' &&
  scenario !== 'duplicate-race' &&
  scenario !== 'high-volume'
) {
  throw new Error(
    `Unsupported --scenario: ${String(scenario)}. Expected purchase-load | oversell | duplicate-race | high-volume`,
  );
}
```

Update usage banner similarly.

- [ ] **Step 4: Run tests + CLI smoke**

```bash
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
pnpm --silent stress:stock --profile=smoke --scenario=high-volume
pnpm --silent stress:stock --profile=standard --scenario=high-volume
pnpm --silent stress:stock --profile=full --scenario=high-volume
# Expect: 1000 / 1200 / 12000

pnpm --silent stress:stock --profile=standard --scenario=purchase-load   # 1200
pnpm --silent stress:stock --profile=standard --scenario=oversell        # 100
pnpm --silent stress:stock --profile=standard --scenario=duplicate-race  # 10
```

Expected: tests PASS; CLI prints integers above.

- [ ] **Step 5: Commit (only if user asks)**

Skip unless explicitly requested.

---

### Task 3: Generic `stress:policy` CLI + wrapper `LIMITER_PROFILE` precedence (TDD)

**Files:**

- Create: `tests/stress/lib/resolve-scenario-policy.ts`
- Create: `tests/stress/lib/resolve-scenario-policy.test.ts`
- Modify: `package.json`
- Modify: `scripts/stress-run.sh`

- [ ] **Step 1: Write failing CLI tests**

Create `tests/stress/lib/resolve-scenario-policy.test.ts` testing pure helpers exported for testability (parse + resolve field):

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { POLICY_FIELDS, parsePolicyArgs, resolvePolicyField } from './resolve-scenario-policy';

describe('resolvePolicyField', () => {
  it('returns expectedLimiterProfile for high-volume', () => {
    assert.equal(resolvePolicyField('high-volume', 'expectedLimiterProfile'), 'performance');
  });

  it('returns expectedLimiterProfile for purchase-load', () => {
    assert.equal(resolvePolicyField('purchase-load', 'expectedLimiterProfile'), 'correctness');
  });

  it('returns stockKind for oversell', () => {
    assert.equal(resolvePolicyField('oversell', 'stockKind'), 'constrained');
  });

  it('rejects unknown field / scenario', () => {
    assert.throws(() => resolvePolicyField('high-volume', 'notAField'), /Unknown field/);
    assert.throws(
      () => resolvePolicyField('nope', 'stockKind'),
      /Unsupported scenario|Unknown scenario/,
    );
  });
});

describe('parsePolicyArgs', () => {
  it('parses --scenario and --field', () => {
    assert.deepEqual(
      parsePolicyArgs(['--scenario=high-volume', '--field=expectedLimiterProfile']),
      {
        help: false,
        scenario: 'high-volume',
        field: 'expectedLimiterProfile',
      },
    );
  });

  it('requires both flags', () => {
    assert.throws(() => parsePolicyArgs(['--scenario=high-volume']), /--field/);
    assert.throws(() => parsePolicyArgs(['--field=stockKind']), /--scenario/);
  });
});

describe('POLICY_FIELDS', () => {
  it('includes expectedLimiterProfile and stockKind', () => {
    assert.ok(POLICY_FIELDS.includes('expectedLimiterProfile'));
    assert.ok(POLICY_FIELDS.includes('stockKind'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm exec tsx --test tests/stress/lib/resolve-scenario-policy.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement CLI module + package script**

Create `tests/stress/lib/resolve-scenario-policy.ts`:

```ts
import { isStressScenario } from '../seeder/types';
import { getScenarioPolicy, type ScenarioPolicy } from './scenario-policy';

export const POLICY_FIELDS = [
  'expectedLimiterProfile',
  'stockKind',
  'expectsStockExhaustion',
  'fixedUserId',
  'stockConstant',
] as const;

export type PolicyField = (typeof POLICY_FIELDS)[number];

function isPolicyField(value: string): value is PolicyField {
  return (POLICY_FIELDS as readonly string[]).includes(value);
}

export function resolvePolicyField(scenario: string, field: string): string {
  if (!isStressScenario(scenario)) {
    throw new Error(`Unsupported scenario: ${scenario}`);
  }
  if (!isPolicyField(field)) {
    throw new Error(`Unknown field: ${field}. Expected one of ${POLICY_FIELDS.join(', ')}`);
  }
  const policy: ScenarioPolicy = getScenarioPolicy(scenario);
  const value = policy[field];
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function normalizeArgv(argv: string[]): string[] {
  let out = argv;
  while (out[0] === '--') out = out.slice(1);
  return out;
}

function requireFlagValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parsePolicyArgs(argv: string[]): {
  help: boolean;
  scenario: string;
  field: string;
} {
  let help = false;
  let scenario: string | undefined;
  let field: string | undefined;
  const args = normalizeArgv(argv);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg.startsWith('--scenario=')) {
      scenario = requireFlagValue('--scenario', arg.slice('--scenario='.length));
      continue;
    }
    if (arg === '--scenario') {
      scenario = requireFlagValue('--scenario', args[++i]);
      continue;
    }
    if (arg.startsWith('--field=')) {
      field = requireFlagValue('--field', arg.slice('--field='.length));
      continue;
    }
    if (arg === '--field') {
      field = requireFlagValue('--field', args[++i]);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (help) {
    return { help: true, scenario: 'high-volume', field: 'expectedLimiterProfile' };
  }
  if (!scenario) throw new Error('Missing --scenario');
  if (!field) throw new Error('Missing --field');
  return { help: false, scenario, field };
}

function printHelp(): void {
  process.stderr.write(`Usage:
  pnpm stress:policy --scenario=<name> --field=<${POLICY_FIELDS.join('|')}>

Prints a single policy field value on stdout.
`);
}

try {
  // Only run CLI side effects when executed directly (not when imported by tests).
  const isMain = typeof require !== 'undefined' && require.main === module; // may be false under tsx ESM
  // Prefer import.meta / argv check used elsewhere — mirror resolve-comfortable-stock.ts style:
} catch {
  // implemented below without require.main — always use argv entry like stock CLI
}
```

**Important:** Match the existing stock CLI style exactly — top-level try/catch that always runs when the file is executed via `tsx` (tests import named exports only; keep CLI block gated):

Use the same pattern as `resolve-comfortable-stock.ts`: put parse/resolve exports above, and at the bottom:

```ts
const isDirect =
  process.argv[1]?.includes('resolve-scenario-policy') ||
  process.argv[1]?.endsWith('resolve-scenario-policy.ts');

if (isDirect) {
  try {
    const parsed = parsePolicyArgs(process.argv.slice(2));
    if (parsed.help) {
      printHelp();
      process.exit(0);
    }
    process.stdout.write(`${resolvePolicyField(parsed.scenario, parsed.field)}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
```

(If the stock CLI has no `isDirect` gate because tests don't import it, prefer: **export helpers** + keep CLI in the same file with `isDirect`, OR split — keep one file with `isDirect` so tests can import safely.)

Add to root `package.json` scripts:

```json
"stress:policy": "pnpm exec tsx tests/stress/lib/resolve-scenario-policy.ts"
```

Update `scripts/stress-run.sh` — after parsing args, before `k6 run`, resolve metadata default:

```bash
# LIMITER_PROFILE precedence: explicit env → ScenarioPolicy.expectedLimiterProfile → correctness
# Summary metadata only — does NOT reconfigure the API rate limiter.
if [[ -z "${LIMITER_PROFILE+x}" || -z "${LIMITER_PROFILE}" ]]; then
  LIMITER_PROFILE="$(pnpm --silent stress:policy --scenario="$SCENARIO" --field=expectedLimiterProfile)"
fi
LIMITER_PROFILE="${LIMITER_PROFILE:-correctness}"
```

Careful: `[[ -z "${LIMITER_PROFILE+x}" ]]` is wrong for “unset vs empty”. Use:

```bash
if [[ -z "${LIMITER_PROFILE:-}" ]]; then
  LIMITER_PROFILE="$(pnpm --silent stress:policy --scenario="$SCENARIO" --field=expectedLimiterProfile)" || LIMITER_PROFILE="correctness"
fi
LIMITER_PROFILE="${LIMITER_PROFILE:-correctness}"
```

Update help text in `stress-run.sh` to mention policy-derived default and that wrappers never modify API configuration. Add `high-volume` to the supported-scenarios help line when Task 4 lands (can do both here or in Task 4).

- [ ] **Step 4: Run tests + CLI smoke**

```bash
pnpm exec tsx --test tests/stress/lib/resolve-scenario-policy.test.ts
pnpm --silent stress:policy --scenario=high-volume --field=expectedLimiterProfile
# → performance
pnpm --silent stress:policy --scenario=purchase-load --field=expectedLimiterProfile
# → correctness
pnpm --silent stress:policy --scenario=oversell --field=stockKind
# → constrained
```

Expected: PASS; CLI prints values above.

- [ ] **Step 5: Commit (only if user asks)**

Skip unless explicitly requested.

---

### Task 4: Runner wiring — make `high-volume` runnable + auto-stock

**Files:**

- Modify: `tests/stress/seeder/types.ts`
- Modify: `scripts/stress-run.sh`
- Modify: `scripts/stress-test.sh`

- [ ] **Step 1: Add to RUNNABLE_K6_SCENARIOS**

In `tests/stress/seeder/types.ts`:

```ts
export const RUNNABLE_K6_SCENARIOS = [
  'harness-smoke',
  'purchase-load',
  'oversell',
  'duplicate-race',
  'high-volume',
] as const;
```

Update the comment above the array to mention `#57`.

- [ ] **Step 2: Map script in stress-run.sh**

In the `case "$SCENARIO"` block, add:

```bash
  high-volume)
    SCRIPT="tests/stress/k6/scenarios/high-volume.js"
    ;;
```

Update error/help supported-scenario lists to include `high-volume`.

- [ ] **Step 3: Auto-stock in stress-test.sh**

Extend the condition that resolves stock when omitted:

```bash
if [[ ( "$SCENARIO" == "purchase-load" || "$SCENARIO" == "oversell" || "$SCENARIO" == "duplicate-race" || "$SCENARIO" == "high-volume" ) && "$HAS_STOCK" -eq 0 ]]; then
```

Update `--help` text similarly (high-volume uses comfortable stock via `stress:stock`).

- [ ] **Step 4: Sanity-check wiring (script missing until Task 5 is OK)**

```bash
rg -n "high-volume" scripts/stress-run.sh scripts/stress-test.sh tests/stress/seeder/types.ts
# Expect mappings present

# Optional: stress:run should fail with "script not found" until Task 5 creates the file
pnpm stress:run -- --scenario high-volume --profile smoke; echo exit=$?
# Expect non-zero: k6 script not found (or similar) — proves wiring reached the script path
```

- [ ] **Step 5: Commit (only if user asks)**

Skip unless explicitly requested.

---

### Task 5: `high-volume.js` — gates, accounting, performance summary

**Files:**

- Create: `tests/stress/k6/scenarios/high-volume.js`

- [ ] **Step 1: Create scenario script**

Create `tests/stress/k6/scenarios/high-volume.js` modeled on `purchase-load.js` / `oversell.js`, with observation-first thresholds:

```js
import { check } from 'k6';

import { classifyPurchaseResponse } from '../helpers/classify.js';
import { graphqlRequest, PURCHASE_ITEM } from '../helpers/graphql.js';
import { buildHandleSummary, recordBucket } from '../helpers/metrics.js';
import { resolveProfile } from '../helpers/profiles.js';
import { loadState } from '../helpers/state.js';

const profile = resolveProfile(__ENV.PROFILE);
const graphqlUrl = __ENV.GRAPHQL_URL || 'http://localhost:3000/graphql';
// Metadata only — API limiter is operator-configured (performance.env.example).
const limiterProfile = __ENV.LIMITER_PROFILE || 'performance';
const environment = __ENV.STRESS_ENVIRONMENT || 'local';

const seededState = loadState();
const seededStock = seededState.stock;
const attempts = profile.attempts;

export const options = {
  scenarios: {
    default: {
      executor: 'shared-iterations',
      iterations: attempts,
      vus: profile.vus,
    },
  },
  thresholds: {
    // Correctness gates (comfortable stock ⇒ sold_out impossible).
    // purchase_rate_limited intentionally ungated — capacity signal.
    purchase_duplicate: ['count==0'],
    purchase_sold_out: ['count==0'],
    purchase_unexpected: ['count==0'],
    // 0 <= success <= seededStock (k6 count is always >= 0)
    purchase_success: [`count<=${seededStock}`],
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

function metricValue(data, name, key) {
  const m = data && data.metrics ? data.metrics[name] : undefined;
  if (!m || !m.values) return null;
  const v = m.values[key];
  return typeof v === 'number' ? v : null;
}

export function handleSummary(data) {
  const enrich = buildHandleSummary({
    environment,
    limiterProfile,
    profile: profile.name,
    scenario: 'high-volume',
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
  const accountingOk = classifiedTotal === attempts;

  // Record throughput / latency for AC (existing k6 http metrics via #53 graphql helper).
  const performance = {
    http_req_duration_ms: {
      p50: metricValue(data, 'http_req_duration', 'p(50)'),
      p95: metricValue(data, 'http_req_duration', 'p(95)'),
      p99: metricValue(data, 'http_req_duration', 'p(99)'),
      avg: metricValue(data, 'http_req_duration', 'avg'),
    },
    http_reqs: {
      count: metricValue(data, 'http_reqs', 'count'),
      rate: metricValue(data, 'http_reqs', 'rate'),
    },
  };

  const summary = {
    ...base,
    accountingOk,
    attempts,
    classifiedTotal,
    purchaseSuccess,
    stock: seededStock,
    performance,
    warnings: accountingOk
      ? []
      : [`Accounting mismatch: classifiedTotal=${classifiedTotal} attempts=${attempts}`],
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

**Accounting note:** Accounting is intentionally validated as summary metadata (`accountingOk`) because k6 thresholds cannot express cross-counter sums. With `duplicate`/`sold_out`/`unexpected` forced to `0`, a full shared-iterations run that classified every iteration satisfies the derived invariant `success + rate_limited == attempts`. If `accountingOk` is false, include a warning. Do **not** throw from `handleSummary` (does not fail the run). Do **not** change the verifier for this. Incomplete iterations already fail the k6 scenario execution.

**Do not** add scenario-specific transport/retry logic. **Do not** edit `purchase-load.js` / `oversell.js` / `duplicate-race.js`.

- [ ] **Step 2: Static sanity**

```bash
test -f tests/stress/k6/scenarios/high-volume.js
rg -n "purchase_rate_limited|purchase_sold_out|performance|accountingOk" tests/stress/k6/scenarios/high-volume.js
# Expect: rate_limited ungated; sold_out count==0; performance block; accountingOk
rg -n "purchase_success|purchase_rate_limited" tests/stress/k6/scenarios/purchase-load.js
# Expect: purchase-load still requires success==attempts and rate_limited==0 (unchanged)
```

- [ ] **Step 3: Commit (only if user asks)**

Skip unless explicitly requested.

---

### Task 6: Thin README update

**Files:**

- Modify: `tests/stress/README.md`

- [ ] **Step 1: Document high-volume**

Update `tests/stress/README.md`:

1. Add row to runnable scenarios table:

```markdown
| `high-volume` | #57 | Observation-first capacity/latency (performance limiter; `RATE_LIMITED` allowed) |
```

2. Remove or revise the “Other scenario names… until #57” sentence (high-volume is now runnable).

3. Under primary path, add:

```bash
# #57 high-volume (comfortable stock auto-resolved; API must use performance limiter)
pnpm stress:test -- --scenario high-volume --profile smoke
```

4. Stock table — add:

```markdown
| `high-volume` | `max(1000, ceil(attempts * 1.2))` (same as purchase-load) | 1000 / 1200 / 12000 |
```

5. Prerequisites / notes:

- `#57` requires API started with `k6/config/performance.env.example` (not correctness).
- Hard gates: unexpected/duplicate/sold_out `== 0`, `success <= seededStock`, accounting identity; `RATE_LIMITED` / latency / RPS observational (success may be 0).
- Mention `pnpm --silent stress:policy --scenario=high-volume --field=expectedLimiterProfile` → `performance` (summary metadata only).
- Wrappers never reconfigure the API limiter.

6. Design links — add `#57` design path alongside `#54`–`#56`.

Do **not** document expected RPS/latency numbers. Do **not** invent `#60`/`#71` results narrative.

- [ ] **Step 2: Skim for scope creep**

```bash
rg -n "high-volume|performance" tests/stress/README.md
# Expect thin docs only — no fabricated metrics
```

- [ ] **Step 3: Commit (only if user asks)**

Skip unless explicitly requested.

---

### Task 7: Verification + optional live smoke

**Files:** none (commands only)

- [ ] **Step 1: Unit tests + lint touched paths**

```bash
cd /home/rex/Project/test/app
pnpm exec tsx --test tests/stress/lib/scenario-policy.test.ts
pnpm exec tsx --test tests/stress/lib/comfortable-stock.test.ts
pnpm exec tsx --test tests/stress/lib/resolve-scenario-policy.test.ts

pnpm exec eslint \
  tests/stress/lib \
  tests/stress/k6/scenarios/high-volume.js \
  tests/stress/seeder/types.ts
```

Expected: unit tests PASS; eslint clean for touched JS/TS.

- [ ] **Step 2: Confirm `#54` / `#55` / `#56` not weakened + CLI matrix**

```bash
rg -n "purchase_success|purchase_rate_limited" tests/stress/k6/scenarios/purchase-load.js
# Expect: success == attempts; rate_limited == 0

rg -n "purchase_success|purchase_sold_out|purchase_rate_limited" tests/stress/k6/scenarios/oversell.js
# Expect: success bounds; rate_limited == 0; sold_out ungated

rg -n "purchase_success|purchase_duplicate" tests/stress/k6/scenarios/duplicate-race.js
# Expect: success == 1; duplicate == N-1

pnpm --silent stress:stock --profile=standard --scenario=purchase-load   # 1200
pnpm --silent stress:stock --profile=standard --scenario=oversell        # 100
pnpm --silent stress:stock --profile=standard --scenario=duplicate-race  # 10
pnpm --silent stress:stock --profile=standard --scenario=high-volume     # 1200
pnpm --silent stress:policy --scenario=high-volume --field=expectedLimiterProfile  # performance
pnpm --silent stress:policy --scenario=duplicate-race --field=expectedLimiterProfile  # correctness
```

**Regression invariants (collect for review):**

- [ ] `purchase-load` / `high-volume` both `stockKind === 'comfortable'` and same stock numbers
- [ ] `oversell` still `constrained`; `duplicate-race` still `constant` / fixed user
- [ ] Only `high-volume` has `expectedLimiterProfile === 'performance'`
- [ ] `stress:policy` reports limiter profiles: `purchase-load` / `oversell` / `duplicate-race` → `correctness`; `high-volume` → `performance`
- [ ] `#54`/`#55`/`#56` k6 scripts byte-stable in gates (no edits)

- [ ] **Step 3: Optional live smoke (when API + k6 + Compose are up)**

Prerequisites:

- Stack running; `k6` on `PATH`
- API using `tests/stress/k6/config/performance.env.example` values (`RATE_LIMIT_PURCHASE_ITEM_MAX=30`) — **switch off** correctness `100000` if still set from `#56` smoke
- `pnpm --filter api run prisma:generate` after install if needed

```bash
pnpm --silent stress:stock --profile=smoke --scenario=high-volume   # 1000
pnpm stress:test -- --scenario high-volume --profile smoke
```

Expected live outcome:

- Seed plants comfortable stock **1000**
- k6 exits **0**; `purchase_sold_out == purchase_duplicate == purchase_unexpected == 0`
- `purchase_rate_limited` may be `> 0` (capacity signal); `purchase_success` may be `0`
- `accountingOk: true`; summary includes `performance.http_req_duration_ms` + `performance.http_reqs`
- Summary metadata `limiterProfile: performance` (unless env override)
- Verifier exits **0** (inventory + uniqueness dual oracle)
- Artifact: `tests/stress/results/high-volume-smoke/k6-summary.json`

Do **not** invent or commit fabricated `results/` artifacts. If the stack is unavailable, note that in the handoff.

- [ ] **Step 4: Final review against AC / DoD**

- [ ] Runnable via `pnpm stress:test -- --scenario high-volume --profile {smoke|standard|full}`
- [ ] Summary records throughput, latency metrics, and outcome counters
- [ ] Hard gates + accounting as specified; dual-oracle verifier still passes
- [ ] Policy owns `stockKind` + `expectedLimiterProfile`; wrappers set metadata only
- [ ] `#54` / `#55` / `#56` unchanged
- [ ] No invented `#71`/`#60` results docs
- [ ] No `#134` CSS AC changes

- [ ] **Step 5: Commit / PR (only if user asks)**

Do not commit or open a PR unless explicitly requested.

---

## Plan self-review

1. **Spec coverage:** Goal/AC, comfortable stock via `stockKind`, `expectedLimiterProfile` + `stress:policy`, wrapper metadata precedence, `high-volume.js` gates + accounting + performance fields, runner wiring, thin README, `#54`–`#56` freeze, operator performance-limiter prerequisite — each has a task.
2. **Placeholders:** None; concrete paths and code included. No `rateLimitedRole`.
3. **Type consistency:** Scenario id `high-volume`; `StockKind` / `LimiterProfile`; `StockPolicyScenario` includes `high-volume`; policy fields match CLI `POLICY_FIELDS`.
4. **Sequencing:** Policy → resolveStock → stress:policy/wrappers → runner → k6 → README → verify.
5. **Accounting:** Explicit sum in summary (`accountingOk`); k6 thresholds enforce sold_out/duplicate/unexpected `== 0` and `success <= seededStock`; derived `success + rate_limited == attempts` under those gates.
6. **Profile SoT:** Attempts/VUs remain only in `shared/profiles.json`.
7. **Commits:** Deferred to user request per project constraint.
8. **Out of scope preserved:** No shared k6 extraction, no `#54`–`#56` script edits, no limiter auto-detection, no fabricated results, no `#134` reopen.
