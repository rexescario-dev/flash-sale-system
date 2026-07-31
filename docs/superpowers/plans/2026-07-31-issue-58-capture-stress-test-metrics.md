# #58 Capture Stress Test Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a canonical reporting contract so every runnable stress scenario emits consistent `k6-summary.json` (counters + p50/p95/p99 + throughput) and `stress:test` always produces a thin factual `report.md` from real k6 + verifier artifacts — without changing `#54`–`#57` proofs or inventing `#59`/`#60`/`#71` narrative.

**Architecture:** Expand `tests/stress/k6/helpers/metrics.js` so `buildHandleSummary` owns the normative base schema (metadata, counters, nested `performance`, shared diagnostics). All runnable scenarios attach shared trend-stat config and keep only additive summary fields. A pure Node reporter (`tests/stress/reporter/`) reads `k6-summary.json` + `verifier.json` → `report.md`. `stress:test` becomes `seed → run → verify → report` with formal exit precedence.

**Tech Stack:** k6 (external binary), existing stress helpers, Node/`tsx` + `node:test` for reporter + pure summary helpers, bash wrappers, Prisma verifier unchanged for correctness.

**Base:** `main` at `#57` merge tip (`fd120be` or later).

**Commits:** Commit in logical groups per task (or tight task clusters) using `<type>: <MESSAGE>` convention **only when the user explicitly asks to commit**. Open a PR only when requested.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-58-capture-stress-test-metrics-design.md`

**Issue AC:**

- [ ] Metrics include success/failure counts, p95/p99 latency, and throughput

**Task order:** Pure summary helpers (TDD) → enrich `metrics.js` → wire all scenarios → reporter (TDD) → `stress:report` CLI + package script → `stress-test.sh` exit precedence → README → real smoke DoD.

---

## File map

| File                                                                               | Responsibility                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `tests/stress/k6/helpers/summary-fields.js`                                        | **Create** — pure helpers (no k6 imports): performance extract, diagnostics, trend-stat constant |
| `tests/stress/k6/helpers/summary-fields.test.ts`                                   | **Create** — unit tests for pure helpers                                                         |
| `tests/stress/k6/helpers/metrics.js`                                               | Enrich `buildHandleSummary` to emit canonical base; re-export trend-stat config                  |
| `tests/stress/k6/scenarios/harness-smoke.js`                                       | Attach trend stats; pass `attempts`; use enriched base                                           |
| `tests/stress/k6/scenarios/purchase-load.js`                                       | Same                                                                                             |
| `tests/stress/k6/scenarios/oversell.js`                                            | Same; keep additive oversell fields                                                              |
| `tests/stress/k6/scenarios/duplicate-race.js`                                      | Same; drop duplicated diagnostics that base now owns                                             |
| `tests/stress/k6/scenarios/high-volume.js`                                         | Same; delete local performance extract; pass init-context `startedAt`                            |
| `tests/stress/reporter/write-report.ts`                                            | **Create** — pure render: summary + verifier → markdown string                                   |
| `tests/stress/reporter/write-report.test.ts`                                       | **Create** — fixture-based section presence/order tests                                          |
| `tests/stress/reporter/cli.ts`                                                     | **Create** — `stress:report` CLI                                                                 |
| `package.json`                                                                     | Add `stress:report` script                                                                       |
| `scripts/stress-test.sh`                                                           | Invoke report after verify; formal exit precedence                                               |
| `tests/stress/README.md`                                                           | Artifact trio, pipeline, reproduce commands, `#58` link                                          |
| `docs/superpowers/specs/2026-07-31-issue-58-capture-stress-test-metrics-design.md` | Approved design                                                                                  |
| `docs/superpowers/plans/2026-07-31-issue-58-capture-stress-test-metrics.md`        | This plan                                                                                        |

**Expected unchanged:** `#54`–`#57` thresholds / gates / default functions / stock formulas, seeder semantics, verifier correctness checks (still read `counters.purchase_success` + fallbacks), root `README.md`, `docs/testing-strategy.md`, apps production code, e2e, CI, `#59`/`#60`/`#71` bodies, `#134` CSS AC. Do not invent results docs. Do not rename `verifier.json`. Do not add formal JSON Schema validation.

---

### Task 1: Pure summary-field helpers (TDD)

**Files:**

- Create: `tests/stress/k6/helpers/summary-fields.js`
- Create: `tests/stress/k6/helpers/summary-fields.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SUMMARY_TREND_STATS,
  buildSharedDiagnostics,
  extractPerformance,
  getMetricCount,
  getMetricValue,
} from './summary-fields.js';

describe('SUMMARY_TREND_STATS', () => {
  it('includes p(95) and p(99) so canonical latency fields can populate', () => {
    assert.ok(SUMMARY_TREND_STATS.includes('p(95)'));
    assert.ok(SUMMARY_TREND_STATS.includes('p(99)'));
    assert.ok(SUMMARY_TREND_STATS.includes('med'));
  });
});

describe('getMetricCount / getMetricValue', () => {
  it('reads count and named values; returns 0 / null when missing', () => {
    const data = {
      metrics: {
        purchase_success: { values: { count: 7 } },
        http_req_duration: { values: { avg: 12.5, med: 10, 'p(95)': 40, 'p(99)': 90 } },
      },
    };
    assert.equal(getMetricCount(data, 'purchase_success'), 7);
    assert.equal(getMetricCount(data, 'missing'), 0);
    assert.equal(getMetricValue(data, 'http_req_duration', 'avg'), 12.5);
    assert.equal(getMetricValue(data, 'missing', 'avg'), null);
  });
});

describe('extractPerformance', () => {
  it('always returns nested keys; maps med to p50; null when absent', () => {
    const empty = extractPerformance({});
    assert.deepEqual(empty, {
      http_req_duration_ms: { avg: null, p50: null, p95: null, p99: null },
      http_reqs: { count: null, rate: null },
    });

    const data = {
      metrics: {
        http_req_duration: {
          values: { avg: 1, med: 2, 'p(95)': 3, 'p(99)': 4 },
        },
        http_reqs: { values: { count: 100, rate: 25.5 } },
      },
    };
    assert.deepEqual(extractPerformance(data), {
      http_req_duration_ms: { avg: 1, p50: 2, p95: 3, p99: 4 },
      http_reqs: { count: 100, rate: 25.5 },
    });
  });
});

describe('buildSharedDiagnostics', () => {
  it('sums counters and derives accountingOk from attempts', () => {
    const counters = {
      purchase_success: 1,
      purchase_sold_out: 0,
      purchase_duplicate: 99,
      purchase_rate_limited: 0,
      purchase_unexpected: 0,
    };
    assert.deepEqual(buildSharedDiagnostics(counters, 100), {
      attempts: 100,
      classifiedTotal: 100,
      accountingOk: true,
    });
    assert.equal(buildSharedDiagnostics(counters, 99).accountingOk, false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /home/rex/Project/test/app && pnpm exec tsx --test tests/stress/k6/helpers/summary-fields.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement pure helpers**

Create `tests/stress/k6/helpers/summary-fields.js` (no `k6/*` imports):

```js
export const SUMMARY_TREND_STATS = ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'];

export function getMetricCount(data, name) {
  const m = data && data.metrics ? data.metrics[name] : undefined;
  if (!m || !m.values) return 0;
  if (typeof m.values.count === 'number') return m.values.count;
  return 0;
}

export function getMetricValue(data, name, key) {
  const m = data && data.metrics ? data.metrics[name] : undefined;
  if (!m || !m.values) return null;
  const v = m.values[key];
  return typeof v === 'number' ? v : null;
}

export function extractPerformance(data) {
  return {
    http_req_duration_ms: {
      avg: getMetricValue(data, 'http_req_duration', 'avg'),
      p50:
        getMetricValue(data, 'http_req_duration', 'p(50)') ??
        getMetricValue(data, 'http_req_duration', 'med'),
      p95: getMetricValue(data, 'http_req_duration', 'p(95)'),
      p99: getMetricValue(data, 'http_req_duration', 'p(99)'),
    },
    http_reqs: {
      count: getMetricValue(data, 'http_reqs', 'count'),
      rate: getMetricValue(data, 'http_reqs', 'rate'),
    },
  };
}

/**
 * @param {{ purchase_success: number, purchase_sold_out: number, purchase_duplicate: number, purchase_rate_limited: number, purchase_unexpected: number }} counters
 * @param {number} attempts
 */
export function buildSharedDiagnostics(counters, attempts) {
  const classifiedTotal =
    (counters.purchase_success ?? 0) +
    (counters.purchase_sold_out ?? 0) +
    (counters.purchase_duplicate ?? 0) +
    (counters.purchase_rate_limited ?? 0) +
    (counters.purchase_unexpected ?? 0);
  return {
    accountingOk: classifiedTotal === attempts,
    attempts,
    classifiedTotal,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /home/rex/Project/test/app && pnpm exec tsx --test tests/stress/k6/helpers/summary-fields.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add tests/stress/k6/helpers/summary-fields.js tests/stress/k6/helpers/summary-fields.test.ts
git commit -m "$(cat <<'EOF'
test: add pure k6 summary field helpers for #58

EOF
)"
```

---

### Task 2: Enrich `buildHandleSummary` in `metrics.js`

**Files:**

- Modify: `tests/stress/k6/helpers/metrics.js`

- [ ] **Step 1: Refactor the existing file to compose the new pure helpers while preserving existing exports and behavior**

Do **not** wholesale-replace the file. Keep existing Counter exports (`purchaseSuccess`, …), `recordBucket`, and comments that `#54`–`#57` already depend on. Apply a surgical edit:

1. Add imports + re-export at top (after existing `k6/metrics` import):

```js
import {
  SUMMARY_TREND_STATS,
  buildSharedDiagnostics,
  extractPerformance,
  getMetricCount,
} from './summary-fields.js';

export { SUMMARY_TREND_STATS };
```

2. Remove the local `metricCount` function (replaced by `getMetricCount` from `summary-fields.js`).

3. Replace only the body of `buildHandleSummary` so it:
   - requires `attempts` and `startedAt` in meta (scenario captures `startedAt` once at module load — never call `new Date()` inside `enrichSummary` / `handleSummary`),
   - emits `performance` via `extractPerformance`,
   - emits shared diagnostics via `buildSharedDiagnostics`,
   - preserves metadata + counters shape.

```js
/**
 * Canonical base summary for all runnable scenarios.
 * Scenario-specific fields must be spread on by the caller (additive only).
 *
 * @param {{ scenario: string, profile: string, limiterProfile: string, environment: string, attempts: number, startedAt: string }} meta
 * @returns {(data: object) => object}
 */
export function buildHandleSummary({
  attempts,
  environment,
  limiterProfile,
  profile,
  scenario,
  startedAt,
}) {
  return function enrichSummary(data) {
    const counters = {
      purchase_duplicate: getMetricCount(data, 'purchase_duplicate'),
      purchase_rate_limited: getMetricCount(data, 'purchase_rate_limited'),
      purchase_sold_out: getMetricCount(data, 'purchase_sold_out'),
      purchase_success: getMetricCount(data, 'purchase_success'),
      purchase_unexpected: getMetricCount(data, 'purchase_unexpected'),
    };
    const diagnostics = buildSharedDiagnostics(counters, attempts);
    return {
      counters,
      environment,
      limiterProfile,
      performance: extractPerformance(data),
      profile,
      scenario,
      startedAt,
      ...diagnostics,
    };
  };
}
```

- [ ] **Step 2: Sanity-check helper tests still pass**

```bash
cd /home/rex/Project/test/app && pnpm exec tsx --test tests/stress/k6/helpers/summary-fields.test.ts
```

Expected: PASS. (`metrics.js` itself is not Node-importable because of `k6/metrics`.)

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add tests/stress/k6/helpers/metrics.js
git commit -m "$(cat <<'EOF'
feat: emit canonical performance block from buildHandleSummary (#58)

EOF
)"
```

---

### Task 3: Wire all runnable k6 scenarios

**Files:**

- Modify: `tests/stress/k6/scenarios/harness-smoke.js`
- Modify: `tests/stress/k6/scenarios/purchase-load.js`
- Modify: `tests/stress/k6/scenarios/oversell.js`
- Modify: `tests/stress/k6/scenarios/duplicate-race.js`
- Modify: `tests/stress/k6/scenarios/high-volume.js`

**Rules:** Do **not** change `thresholds`, default function / classify / recordBucket, or stock formulas. Only `options.summaryTrendStats` + `handleSummary` wiring.

**`startedAt`:** At the top of each scenario (init / module-load context), capture once and pass through meta:

```js
const startedAt = new Date().toISOString();
```

Never call `new Date()` inside `handleSummary` / `enrichSummary`.

**Top-level `purchaseSuccess` alias:** Keep it only where scenarios already emit it today (`oversell`, `duplicate-race`, `high-volume`) for compatibility. Do **not** introduce it on `purchase-load` / `harness-smoke`. Canonical source remains `counters.purchase_success`.

- [ ] **Step 1: Update `purchase-load.js` pattern (apply analogously to all five)**

Import and options:

```js
import { buildHandleSummary, recordBucket, SUMMARY_TREND_STATS } from '../helpers/metrics.js';

const startedAt = new Date().toISOString();
```

In `export const options`, add (alongside existing `scenarios` / `thresholds` — do not remove thresholds):

```js
  summaryTrendStats: SUMMARY_TREND_STATS,
```

`handleSummary` for `purchase-load.js` / `harness-smoke.js` (minimal additive — no new `purchaseSuccess` top-level field):

```js
export function handleSummary(data) {
  const enrich = buildHandleSummary({
    attempts: profile.attempts,
    environment,
    limiterProfile,
    profile: profile.name,
    scenario: 'purchase-load', // harness-smoke → 'harness-smoke'
    startedAt,
  });
  const summary = enrich(data);
  const json = JSON.stringify(summary, null, 2);
  const out = { stdout: `${json}\n` };
  const summaryPath = __ENV.STRESS_SUMMARY_PATH;
  if (summaryPath) {
    out[summaryPath] = `${json}\n`;
  }
  return out;
}
```

- [ ] **Step 2: Update `oversell.js` handleSummary — keep additive fields (including existing `purchaseSuccess` alias)**

```js
const startedAt = new Date().toISOString(); // module-load (with other scenario consts)

export function handleSummary(data) {
  const enrich = buildHandleSummary({
    attempts: profile.attempts,
    environment,
    limiterProfile,
    profile: profile.name,
    scenario: 'oversell',
    startedAt,
  });
  const base = enrich(data);
  // Existing compatibility alias — do not add to scenarios that never had it.
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
  const out = { stdout: `${json}\n` };
  const summaryPath = __ENV.STRESS_SUMMARY_PATH;
  if (summaryPath) {
    out[summaryPath] = `${json}\n`;
  }
  return out;
}
```

Also add `summaryTrendStats: SUMMARY_TREND_STATS` to `options`.

- [ ] **Step 3: Update `duplicate-race.js` — drop duplicated diagnostics**

Remove local recomputation of `classifiedTotal` / `accountingOk` / `attempts` (base owns them). Keep existing additive fields including `purchaseSuccess` alias:

```js
const startedAt = new Date().toISOString(); // module-load

export function handleSummary(data) {
  const enrich = buildHandleSummary({
    attempts: profile.attempts,
    environment,
    limiterProfile,
    profile: profile.name,
    scenario: 'duplicate-race',
    startedAt,
  });
  const base = enrich(data);
  const purchaseSuccess = base.counters.purchase_success ?? 0;
  const unusedStock = Math.max(0, stock - purchaseSuccess);

  const summary = {
    ...base,
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

Add `summaryTrendStats: SUMMARY_TREND_STATS`. Keep all `thresholds` unchanged.

- [ ] **Step 4: Update `high-volume.js` — delete local performance extraction**

Remove local `getMetricValue`/`metricValue` function and local `performance` object. Keep existing additive `purchaseSuccess` alias + warnings; prefer base diagnostics for accounting:

```js
import { buildHandleSummary, recordBucket, SUMMARY_TREND_STATS } from '../helpers/metrics.js';

const startedAt = new Date().toISOString(); // module-load

// options: keep existing thresholds; replace inline summaryTrendStats array with:
  summaryTrendStats: SUMMARY_TREND_STATS,

export function handleSummary(data) {
  const enrich = buildHandleSummary({
    attempts,
    environment,
    limiterProfile,
    profile: profile.name,
    scenario: 'high-volume',
    startedAt,
  });
  const base = enrich(data);
  const purchaseSuccess = base.counters.purchase_success ?? 0;

  const summary = {
    ...base,
    purchaseSuccess,
    stock: seededStock,
    warnings: base.accountingOk
      ? []
      : [`Accounting mismatch: classifiedTotal=${base.classifiedTotal} attempts=${base.attempts}`],
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

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add tests/stress/k6/scenarios/*.js
git commit -m "$(cat <<'EOF'
feat: wire canonical summary schema across stress scenarios (#58)

EOF
)"
```

---

### Task 4: Reporter render module (TDD)

**Files:**

- Create: `tests/stress/reporter/write-report.ts`
- Create: `tests/stress/reporter/write-report.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderReportMarkdown } from './write-report';

const summary = {
  scenario: 'duplicate-race',
  profile: 'smoke',
  limiterProfile: 'correctness',
  environment: 'local',
  startedAt: '2026-07-31T12:26:36.191Z',
  attempts: 100,
  classifiedTotal: 100,
  accountingOk: true,
  counters: {
    purchase_success: 1,
    purchase_sold_out: 0,
    purchase_duplicate: 99,
    purchase_rate_limited: 0,
    purchase_unexpected: 0,
  },
  performance: {
    http_req_duration_ms: { avg: 10, p50: 8, p95: 20, p99: 40 },
    http_reqs: { count: 100, rate: 50 },
  },
  warnings: ['example warning'],
};

const verifier = {
  ok: true,
  scenario: 'duplicate-race',
  profile: 'smoke',
  checks: [
    { name: 'k6_summary_present', ok: true, detail: 'Loaded k6 summary (1 successes)' },
    { name: 'purchase_count_lte_stock', ok: true, detail: 'purchase_count=1 stock=10' },
  ],
  warnings: [],
};

describe('renderReportMarkdown', () => {
  it('includes major sections in order', () => {
    const md = renderReportMarkdown(summary, verifier);
    const idxMeta = md.indexOf('## Metadata');
    const idxCounters = md.indexOf('## Counters');
    const idxPerf = md.indexOf('## Performance');
    const idxVerify = md.indexOf('## Verification');
    const idxWarn = md.indexOf('## Warnings');
    assert.ok(idxMeta >= 0);
    assert.ok(idxCounters > idxMeta);
    assert.ok(idxPerf > idxCounters);
    assert.ok(idxVerify > idxPerf);
    assert.ok(idxWarn > idxVerify);
  });

  it('renders counters, p95/p99, throughput rate, and verifier PASS', () => {
    const md = renderReportMarkdown(summary, verifier);
    assert.match(md, /purchase_success:\s*1/);
    assert.match(md, /p95:\s*20/);
    assert.match(md, /p99:\s*40/);
    assert.match(md, /throughput \(http_reqs\.rate\):\s*50/);
    assert.match(md, /Result:\s*PASS/);
  });

  it('shows unavailable for null performance values; never invents numbers', () => {
    const md = renderReportMarkdown(
      {
        ...summary,
        performance: {
          http_req_duration_ms: { avg: null, p50: null, p95: null, p99: null },
          http_reqs: { count: null, rate: null },
        },
        warnings: [],
      },
      { ...verifier, ok: false, warnings: ['vwarn'] },
    );
    assert.match(md, /p95:\s*unavailable/);
    assert.match(md, /throughput \(http_reqs\.rate\):\s*unavailable/);
    assert.match(md, /Result:\s*FAIL/);
    assert.match(md, /vwarn/);
  });

  it('prints unavailable for counters when counters object is missing; does not throw', () => {
    const { counters: _omit, ...summaryWithoutCounters } = summary;
    const md = renderReportMarkdown(summaryWithoutCounters, verifier);
    assert.match(md, /purchase_success:\s*unavailable/);
    assert.match(md, /purchase_unexpected:\s*unavailable/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /home/rex/Project/test/app && pnpm exec tsx --test tests/stress/reporter/write-report.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement `write-report.ts`**

```ts
export type SummaryArtifact = {
  scenario?: string;
  profile?: string;
  limiterProfile?: string;
  environment?: string;
  startedAt?: string;
  attempts?: number;
  classifiedTotal?: number;
  accountingOk?: boolean;
  counters?: Record<string, number | undefined>;
  performance?: {
    http_req_duration_ms?: {
      avg?: number | null;
      p50?: number | null;
      p95?: number | null;
      p99?: number | null;
    };
    http_reqs?: {
      count?: number | null;
      rate?: number | null;
    };
  };
  warnings?: string[];
};

export type VerifierArtifact = {
  ok?: boolean;
  scenario?: string;
  profile?: string;
  checks?: Array<{ name?: string; ok?: boolean; detail?: string }>;
  warnings?: string[];
};

function fmt(value: number | null | undefined): string {
  return typeof value === 'number' ? String(value) : 'unavailable';
}

/**
 * Pure renderer. Derives no metrics, performs no verification, invents no values.
 */
export function renderReportMarkdown(summary: SummaryArtifact, verifier: VerifierArtifact): string {
  const c = summary.counters ?? {};
  const dur = summary.performance?.http_req_duration_ms ?? {};
  const reqs = summary.performance?.http_reqs ?? {};
  const warnings = [
    ...(Array.isArray(summary.warnings) ? summary.warnings : []),
    ...(Array.isArray(verifier.warnings) ? verifier.warnings : []),
  ];

  const lines: string[] = [
    '# Stress run report',
    '',
    '## Metadata',
    '',
    `- scenario: ${summary.scenario ?? 'unavailable'}`,
    `- profile: ${summary.profile ?? 'unavailable'}`,
    `- limiterProfile: ${summary.limiterProfile ?? 'unavailable'}`,
    `- environment: ${summary.environment ?? 'unavailable'}`,
    `- startedAt: ${summary.startedAt ?? 'unavailable'}`,
    `- attempts: ${fmt(summary.attempts)}`,
    `- classifiedTotal: ${fmt(summary.classifiedTotal)}`,
    `- accountingOk: ${summary.accountingOk === undefined ? 'unavailable' : String(summary.accountingOk)}`,
    '',
    '## Counters',
    '',
    `- purchase_success: ${fmt(c.purchase_success)}`,
    `- purchase_sold_out: ${fmt(c.purchase_sold_out)}`,
    `- purchase_duplicate: ${fmt(c.purchase_duplicate)}`,
    `- purchase_rate_limited: ${fmt(c.purchase_rate_limited)}`,
    `- purchase_unexpected: ${fmt(c.purchase_unexpected)}`,
    '',
    '## Performance',
    '',
    `- avg: ${fmt(dur.avg)}`,
    `- p50: ${fmt(dur.p50)}`,
    `- p95: ${fmt(dur.p95)}`,
    `- p99: ${fmt(dur.p99)}`,
    `- http_reqs.count: ${fmt(reqs.count)}`,
    `- throughput (http_reqs.rate): ${fmt(reqs.rate)}`,
    '',
    '## Verification',
    '',
    `- Result: ${verifier.ok === true ? 'PASS' : verifier.ok === false ? 'FAIL' : 'unavailable'}`,
  ];

  for (const check of verifier.checks ?? []) {
    const status = check.ok === true ? 'PASS' : check.ok === false ? 'FAIL' : '?';
    lines.push(`- [${status}] ${check.name ?? 'check'}: ${check.detail ?? ''}`);
  }

  lines.push('', '## Warnings', '');
  if (warnings.length === 0) {
    lines.push('- (none)');
  } else {
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /home/rex/Project/test/app && pnpm exec tsx --test tests/stress/reporter/write-report.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add tests/stress/reporter/write-report.ts tests/stress/reporter/write-report.test.ts
git commit -m "$(cat <<'EOF'
feat: add thin stress report markdown renderer (#58)

EOF
)"
```

---

### Task 5: `stress:report` CLI + package script

**Files:**

- Create: `tests/stress/reporter/cli.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement CLI**

```ts
import fs from 'node:fs';
import path from 'node:path';

import { isStressScenario, type StressScenario } from '../seeder/types';
import { renderReportMarkdown, type SummaryArtifact, type VerifierArtifact } from './write-report';

/** Reporter-local results path — do not import seeder/paths (reporting must not depend on seeding). */
function reporterResultsDir(scenario: string, profile: string): string {
  return path.resolve(__dirname, '..', 'results', `${scenario}-${profile}`);
}

function printHelp(): void {
  process.stdout.write(`Usage: tsx tests/stress/reporter/cli.ts [options]

Options:
  --scenario <name>   Stress scenario (default: harness-smoke)
  --profile <name>    Intensity profile (default: smoke)
  --summary <path>    Override k6-summary.json path
  --verifier <path>   Override verifier.json path
  --out <path>        Override report.md path
  --help              Show this help

Reads completed machine artifacts and writes a thin factual report.md.
Never reruns k6 or verification. Explicit path flags override scenario/profile defaults.
Duplicate flags are rejected.
`);
}

function parseArgs(argv: string[]): {
  help: boolean;
  outPath?: string;
  profile: string;
  scenario: StressScenario;
  summaryPath?: string;
  verifierPath?: string;
} {
  let help = false;
  let scenario: StressScenario = 'harness-smoke';
  let profile = 'smoke';
  let summaryPath: string | undefined;
  let verifierPath: string | undefined;
  let outPath: string | undefined;
  const seen = new Set<string>();

  const take = (flag: string): string => {
    if (seen.has(flag)) {
      throw new Error(`duplicate flag: ${flag}`);
    }
    seen.add(flag);
    return flag;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--scenario') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value || !isStressScenario(value)) {
        throw new Error(`--scenario requires a valid scenario (got ${value ?? 'missing'})`);
      }
      scenario = value;
      continue;
    }
    if (arg === '--profile') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value) throw new Error('--profile requires a value');
      profile = value;
      continue;
    }
    if (arg === '--summary') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value) throw new Error('--summary requires a path');
      summaryPath = path.resolve(value);
      continue;
    }
    if (arg === '--verifier') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value) throw new Error('--verifier requires a path');
      verifierPath = path.resolve(value);
      continue;
    }
    if (arg === '--out') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value) throw new Error('--out requires a path');
      outPath = path.resolve(value);
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return { help, outPath, profile, scenario, summaryPath, verifierPath };
}

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing artifact: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function writeReport(options: {
  outPath: string;
  summaryPath: string;
  verifierPath: string;
}): void {
  const summary = readJson<SummaryArtifact>(options.summaryPath);
  const verifier = readJson<VerifierArtifact>(options.verifierPath);
  const md = renderReportMarkdown(summary, verifier);
  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.writeFileSync(options.outPath, md, 'utf8');
}

function main(argv: string[]): number {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }
  const outDir = reporterResultsDir(parsed.scenario, parsed.profile);
  const summaryPath = parsed.summaryPath ?? path.join(outDir, 'k6-summary.json');
  const verifierPath = parsed.verifierPath ?? path.join(outDir, 'verifier.json');
  const outPath = parsed.outPath ?? path.join(outDir, 'report.md');
  writeReport({ outPath, summaryPath, verifierPath });
  process.stdout.write(`Wrote ${outPath}\n`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`stress:report error: ${message}\n`);
  process.exitCode = 1;
}
```

- [ ] **Step 2: Add package script**

In root `package.json` scripts, add next to other stress scripts:

```json
"stress:report": "pnpm exec tsx tests/stress/reporter/cli.ts",
```

- [ ] **Step 3: Smoke the CLI against existing local artifact (if present)**

If `tests/stress/results/duplicate-race-smoke/` still has JSON from a prior run:

```bash
cd /home/rex/Project/test/app && pnpm stress:report -- --scenario duplicate-race --profile smoke
```

Expected: writes `report.md` (or exits 1 with “Missing artifact” if files gone — both acceptable; recreate in Task 7).

- [ ] **Step 4: Commit (only if user asked)**

```bash
git add tests/stress/reporter/cli.ts package.json
git commit -m "$(cat <<'EOF'
feat: add stress:report CLI for thin report.md (#58)

EOF
)"
```

---

### Task 6: Wire `stress-test.sh` exit precedence

**Files:**

- Modify: `scripts/stress-test.sh`

- [ ] **Step 1: Replace the tail of the script**

After building `SEED_ARGS` / `RUN_ARGS` / `VERIFY_ARGS` and optional stock, replace the final three unconditional `pnpm` calls with:

```bash
pnpm stress:seed -- "${SEED_ARGS[@]}"

set +e
pnpm stress:run -- "${RUN_ARGS[@]}"
RUN_EC=$?
set -e

set +e
pnpm stress:verify -- "${VERIFY_ARGS[@]}"
VERIFY_EC=$?
set -e

# Always attempt report after verification completes (best-effort render).
set +e
pnpm stress:report -- --scenario "$SCENARIO" --profile "$PROFILE"
REPORT_EC=$?
set -e

if [[ "$RUN_EC" -ne 0 ]]; then
  echo "stress:test: k6 run failed (exit $RUN_EC)" >&2
  exit "$RUN_EC"
fi
if [[ "$VERIFY_EC" -ne 0 ]]; then
  echo "stress:test: verify failed (exit $VERIFY_EC)" >&2
  exit "$VERIFY_EC"
fi
if [[ "$REPORT_EC" -ne 0 ]]; then
  echo "stress:test: report failed (exit $REPORT_EC)" >&2
  exit "$REPORT_EC"
fi
```

Also update the help text:

```text
Runs stress:seed → stress:run → stress:verify → stress:report with scenario-appropriate flags.
```

And note exit precedence in the help footer:

```text
Exit status: first non-zero from run or verify wins; if both succeed and report fails, report's exit is returned.
```

- [ ] **Step 2: Dry-check bash syntax**

```bash
cd /home/rex/Project/test/app && bash -n scripts/stress-test.sh
```

Expected: no output, exit 0.

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add scripts/stress-test.sh
git commit -m "$(cat <<'EOF'
feat: always generate report.md after stress verify (#58)

EOF
)"
```

---

### Task 7: Thin README + real smoke DoD

**Files:**

- Modify: `tests/stress/README.md`

- [ ] **Step 1: Update README**

Change the opening pipeline line to:

```md
Privileged Prisma seed → k6 GraphQL `purchaseItem` → Prisma verify → thin `report.md`.
```

Add an **Artifacts** section (keep README thin):

````md
## Artifacts

Each run writes under `tests/stress/results/<scenario>-<profile>/` (gitignored):

| File              | Source                         |
| ----------------- | ------------------------------ |
| `k6-summary.json` | k6 `handleSummary` (canonical) |
| `verifier.json`   | Prisma verifier                |
| `report.md`       | `pnpm stress:report` (facts)   |

Canonical summary fields: metadata, counters, `performance` (p50/p95/p99 + `http_reqs.rate` throughput), shared diagnostics (`attempts`, `classifiedTotal`, `accountingOk`). Scenario-specific fields are additive only.

`stress:test` always invokes the reporter after verify. Split path:

```bash
pnpm stress:report -- --scenario oversell --profile smoke
```
````

Do not commit generated artifacts. Results narrative hub lands with #60.

````

Update Design links to include `#58`:

```md
and [#58 design](../../docs/superpowers/specs/2026-07-31-issue-58-capture-stress-test-metrics-design.md).
````

Update exit-note sentence:

```md
`stress:test` exits non-zero if k6 fails, the verifier reports invariant violations, or (when prior stages succeeded) report generation fails.
```

- [ ] **Step 2: Run unit tests**

```bash
cd /home/rex/Project/test/app && pnpm exec tsx --test \
  tests/stress/k6/helpers/summary-fields.test.ts \
  tests/stress/reporter/write-report.test.ts
```

Expected: PASS.

- [ ] **Step 3: Real smoke DoD (requires Compose + API + k6)**

API limiter: use `correctness.env.example` for harness-smoke / purchase-load / oversell / duplicate-race; switch API to `performance.env.example` before high-volume.

```bash
cd /home/rex/Project/test/app

pnpm stress:test -- --scenario harness-smoke --profile smoke
pnpm stress:test -- --scenario purchase-load --profile smoke
pnpm stress:test -- --scenario oversell --profile smoke
pnpm stress:test -- --scenario duplicate-race --profile smoke
# Restart API with performance limiter, then:
pnpm stress:test -- --scenario high-volume --profile smoke
```

For each scenario, assert artifact trio + canonical fields:

```bash
for s in harness-smoke purchase-load oversell duplicate-race high-volume; do
  dir="tests/stress/results/${s}-smoke"
  test -f "$dir/k6-summary.json" && test -f "$dir/verifier.json" && test -f "$dir/report.md" || { echo "MISSING $s"; exit 1; }
  node -e '
    const s=require("./'"$dir"'/k6-summary.json");
    const p=s.performance?.http_req_duration_ms;
    const r=s.performance?.http_reqs;
    if (!s.counters || !p || !r) process.exit(2);
    for (const k of ["p50","p95","p99"]) if (!(k in p)) process.exit(3);
    if (!("rate" in r)) process.exit(4);
    if (typeof s.attempts !== "number") process.exit(5);
    console.log("ok", process.argv[1]);
  ' "$s"
done
```

Expected: each prints `ok <scenario>`. Inspect one `report.md` manually for Metadata → Counters → Performance → Verification → Warnings order. Do **not** commit result artifacts.

- [ ] **Step 4: Lint / typecheck touched surfaces**

```bash
cd /home/rex/Project/test/app && pnpm exec eslint \
  tests/stress/k6/helpers/metrics.js \
  tests/stress/k6/helpers/summary-fields.js \
  tests/stress/k6/scenarios/*.js \
  tests/stress/reporter/*.ts \
  scripts/stress-test.sh 2>/dev/null || true

pnpm exec eslint tests/stress/reporter/write-report.ts tests/stress/reporter/cli.ts tests/stress/k6/helpers/summary-fields.test.ts tests/stress/reporter/write-report.test.ts
```

Run repo typecheck if reporter paths are included by existing config; otherwise rely on `tsx --test` + eslint.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add tests/stress/README.md docs/superpowers/specs/2026-07-31-issue-58-capture-stress-test-metrics-design.md docs/superpowers/plans/2026-07-31-issue-58-capture-stress-test-metrics.md
git commit -m "$(cat <<'EOF'
docs: document stress metrics reporting contract (#58)

EOF
)"
```

---

## Plan self-review

1. **Spec coverage:** Canonical schema → Tasks 1–3; reporter + pipeline → Tasks 4–6; README + real-run DoD → Task 7; freeze on `#54`–`#57` proofs called out in file map + Task 3 rules; no `#59`/`#60`/`#71` narrative tasks.
2. **Placeholders:** None — concrete code, commands, and expected outcomes.
3. **Type consistency:** `SUMMARY_TREND_STATS`, `getMetricCount` / `getMetricValue`, `buildHandleSummary({ attempts, startedAt, … })` (no `new Date()` in `handleSummary`), reporter-local results path (no seeder/paths import), `renderReportMarkdown`, `verifier.json` / `report.md` names consistent. Throughput = `performance.http_reqs.rate`. Keep existing `purchaseSuccess` aliases only where already present.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-31-issue-58-capture-stress-test-metrics.md`.

Your original request already selected **subagent-driven-development**. Two options remain:

1. **Subagent-Driven (recommended / requested)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach? (Defaulting to **1** if you just say “go”.)
