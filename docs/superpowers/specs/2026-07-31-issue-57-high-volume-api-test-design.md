# #57 — Add high-volume API test (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-07-31
**Issue:** [#57](https://github.com/rexescario-dev/flash-sale-system/issues/57) — Add high-volume API test
**Epic:** [#87](https://github.com/rexescario-dev/flash-sale-system/issues/87) (EPIC-07 — Performance & Stress Testing)
**Parent design:** [EPIC-07 performance stress testing](./2026-07-31-epic-07-performance-stress-testing-design.md)
**Sibling designs:** [#54 flash sale load test](./2026-07-31-issue-54-flash-sale-load-test-design.md), [#55 limited inventory concurrency test](./2026-07-31-issue-55-limited-inventory-concurrency-test-design.md), [#56 same-user concurrency test](./2026-07-31-issue-56-same-user-concurrency-test-design.md)
**Depends on:** [#53](https://github.com/rexescario-dev/flash-sale-system/issues/53) harness + [#54](https://github.com/rexescario-dev/flash-sale-system/issues/54) / [#55](https://github.com/rexescario-dev/flash-sale-system/issues/55) / [#56](https://github.com/rexescario-dev/flash-sale-system/issues/56) on `main`
**Repository:** `rexescario-dev/flash-sale-system`

## Goal

Observe purchase-flow behavior under high attempt volume with the API on the **performance** limiter profile: record throughput, latency percentiles, and outcome mix (including `RATE_LIMITED` as a capacity signal) while preserving inventory and uniqueness invariants. `#54` remains the all-success baseline; `#55` / `#56` remain correctness proofs under the correctness limiter.

## Acceptance criterion

GitHub AC: **High-volume scenario records throughput and latency.**

Satisfied by a runnable `high-volume` k6 scenario wired through the existing seed → run → verify pipeline that:

- drives concurrent GraphQL `purchaseItem` attempts from shared intensity profiles,
- records counters + latency / request-rate metrics in `tests/stress/results/high-volume-<profile>/k6-summary.json`,
- hard-fails only on the correctness gates defined below,
- leaves `RATE_LIMITED`, latency, RPS, and even `purchase_success == 0` observational.

Do **not** invent results narrative docs (`#60` / `#71`) without real runs.

## Approach

**Thin `high-volume.js` + policy enrichment (Approach 1):**

| Surface                                           | Role after #57                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tests/stress/k6/scenarios/high-volume.js`        | High-volume / performance observation; sibling of `purchase-load.js` / `oversell.js` / `duplicate-race.js` |
| Scenario policy module                            | SoT gains `stockKind` + `expectedLimiterProfile` (keep existing fields)                                    |
| Public `resolveStock(profile, scenario)`          | Switches on `stockKind`; `high-volume` → comfortable formula (same as `#54`)                               |
| `pnpm stress:stock`                               | Prints resolved stock including `high-volume`                                                              |
| `pnpm stress:policy`                              | Generic field reader: `--scenario <s> --field <name>` → single stdout value                                |
| `scripts/stress-test.sh`                          | Auto-`--stock` for `high-volume` via `stress:stock`                                                        |
| `scripts/stress-run.sh` + `RUNNABLE_K6_SCENARIOS` | Wire `high-volume`; default `LIMITER_PROFILE` from policy when unset                                       |
| `tests/stress/seeder/*`                           | Unchanged semantics — explicit `--stock` only; `fixedUserId: null` for high-volume                         |
| `tests/stress/verifier/*`                         | Existing dual-oracle correctness checks; no new `#57`-only failure conditions                              |
| `tests/stress/README.md`                          | Thin run docs + performance-limiter prerequisite                                                           |

**Rejected alternatives:**

| Alternative                                   | Why rejected                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| Extract shared k6 purchase module now         | Touches `#54`–`#56` proofs; defer until multiple scenarios stabilize              |
| Flag/variant on `purchase-load.js`            | Mixes all-success and observation-first contracts; muddies artifacts              |
| New high-volume stock formula                 | Same “inventory must not confound” need as `#54`; extra heuristic with no benefit |
| Constant stock (e.g. 10)                      | Creates inventory contention that obscures limiter / capacity observation         |
| `expectsNoSoldOut` boolean                    | Assertion masquerading as config; drifts from stockKind                           |
| `rateLimitedRole` field now                   | Speculative; `#57` leaves `RATE_LIMITED` ungated without a second enum            |
| Wrapper hardcodes `high-volume → performance` | Duplicates scenario knowledge outside policy                                      |

## Locked decisions

| Area                       | Decision                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Scenario name / script     | `high-volume` → `tests/stress/k6/scenarios/high-volume.js`                                                                      |
| Approach                   | Thin sibling + policy enrichment (Approach 1)                                                                                   |
| Stock                      | `stockKind: 'comfortable'` → `comfortableStock(attempts) = max(1000, ceil(attempts * 1.2))` (shared with `#54`)                 |
| Stock ownership            | `resolveStock` / `stress:stock` before seed; k6/verifier consume seeded stock only                                              |
| Users                      | Distinct ids (`{userIdPrefix}-{__ITER}-{__VU}`), same as `#54`                                                                  |
| Limiter (API)              | Performance profile on API process (`performance.env.example`); k6 does not reconfigure it                                      |
| Limiter metadata (harness) | `expectedLimiterProfile: 'performance'`; wrappers set **summary metadata** `LIMITER_PROFILE` only                               |
| Metadata precedence        | explicit `LIMITER_PROFILE` env → `ScenarioPolicy.expectedLimiterProfile` via `stress:policy` → fallback `correctness`           |
| Hard k6 gates              | `unexpected == 0`; `duplicate == 0`; `sold_out == 0` when `stockKind === 'comfortable'`; `0 <= purchase_success <= seededStock` |
| Accounting                 | `success + sold_out + duplicate + rate_limited + unexpected == attempts` (hard)                                                 |
| Observational              | `RATE_LIMITED`, `purchase_success` (incl. 0), latency percentiles, RPS — never sole fail reason                                 |
| Dual oracle                | Existing verifier inventory + uniqueness checks when summary present                                                            |
| Policy reader              | Generic `stress:policy --scenario <s> --field <name>`; non-zero on unknown scenario/field                                       |
| Docs                       | Thin `tests/stress/README.md` only; no invented throughput/latency claims                                                       |
| Freeze                     | Do not change `#54` / `#55` / `#56` k6 gates, stock formulas, or proofs                                                         |
| Out of epic slice          | Shared k6 extraction; `#58`–`#60` narrative; `#134` CSS AC; limiter auto-detection; `rateLimitedRole`                           |

## Scope

### In scope

- Enrich `ScenarioPolicy` with `stockKind` + `expectedLimiterProfile`
- `resolveStock` switches on `stockKind`; support `high-volume` comfortable branch; unit tests
- Generic `stress:policy` CLI (+ unit coverage as appropriate)
- Wire `high-volume` into `RUNNABLE_K6_SCENARIOS`, `stress-run.sh`, `stress-test.sh`, stock CLI allowlist
- `high-volume.js`: shared profiles, classify once per attempt, emit counters, enforce § hard gates + accounting; no scenario-specific transport/retry
- Wrappers derive `LIMITER_PROFILE` metadata from policy when unset — **never modify API configuration**
- Thin `tests/stress/README.md` updates
- Reuse `#53`–`#56` seed/verify/helpers/wrappers — do not reimplement

### Out of scope

- Shared k6 purchase-module extraction
- Retrofitting `#54`–`#56` k6 scripts to read `stockKind` or adopt new gates
- Seeder profile/scenario stock policy beyond existing `fixedUserId` behavior
- API limiter auto-detection or reconfiguration from wrappers
- `rateLimitedRole` / other speculative policy fields
- `#58` metrics schema hardening, `#59` bottleneck analysis, `#60` results narrative
- Invented k6 results docs (`#71` / `#60`) without real runs
- Reopening `#134` CSS AC
- Root README / hub expansion beyond the existing thin pointer pattern
- Forcing `harness-smoke` through `resolveStock` (no behavioral change required for `#57`)

## Architecture

**Pipeline (unchanged):** `seed → k6 purchaseItem → verify`

**Invariant:** Scenario policy is the single source of truth for stock kind, limiter metadata expectation, fixed user, and exhaustion expectation. After seeding begins, stock is an immutable seeded input.

```text
shared/profiles.json (attempts/VUs)
        │
        ▼
ScenarioPolicy
   ├── stockKind
   ├── expectedLimiterProfile
   ├── fixedUserId / expectsStockExhaustion / stockConstant
        │
        ├── resolveStock(profile, scenario) ──► --stock N ──► stress:seed
        │                                              │
        │                                         .state/high-volume.json
        │                                              ▼
        └── stress:policy → LIMITER_PROFILE metadata
                              │
                       stress:run → high-volume.js ──GraphQL──► API (performance limiter)
                              │                                      │
                              └── results/high-volume-<profile>/     ▼
                                    k6-summary.json ──► stress:verify (existing dual oracle)
```

### Policy shape

```ts
type StockKind = 'comfortable' | 'constrained' | 'constant';
type LimiterProfile = 'correctness' | 'performance';

type ScenarioPolicy = {
  fixedUserId: null | string;
  expectsStockExhaustion: boolean;
  stockConstant: null | number; // when stockKind === 'constant'
  stockKind: StockKind;
  expectedLimiterProfile: LimiterProfile;
};
```

| Scenario         | stockKind   | expectedLimiterProfile | Notes                                  |
| ---------------- | ----------- | ---------------------- | -------------------------------------- |
| `purchase-load`  | comfortable | correctness            | Proofs unchanged                       |
| `high-volume`    | comfortable | performance            | Observation-first scenario             |
| `oversell`       | constrained | correctness            | Proofs unchanged                       |
| `duplicate-race` | constant    | correctness            | `stockConstant = 10`; proofs unchanged |
| `harness-smoke`  | comfortable | correctness            | No `#57` behavioral change required    |

### `resolveStock`

Maps `stockKind` → formula (formulas stay separate from policy declarations):

- `comfortable` → `comfortableStock(attempts)`
- `constrained` → `constrainedStock(attempts)`
- `constant` → `stockConstant` (from policy)

`purchase-load` and `high-volume` both resolve via the comfortable branch.

### Policy CLI

```bash
pnpm --silent stress:policy --scenario=high-volume --field=expectedLimiterProfile
# → performance
```

- Prints a single scalar on stdout
- Non-zero exit for unknown scenario or field
- Analogous to `stress:stock`; intentionally generic for future fields

### Wrapper precedence (`LIMITER_PROFILE`)

```text
explicit LIMITER_PROFILE env
        ↓
ScenarioPolicy.expectedLimiterProfile  (via stress:policy)
        ↓
fallback ('correctness')
```

Wrappers set summary metadata only; they never modify API configuration.

### Stock CLI

```bash
pnpm --silent stress:stock --profile=smoke --scenario=high-volume      # 1000
pnpm --silent stress:stock --profile=standard --scenario=high-volume   # 1200
pnpm --silent stress:stock --profile=full --scenario=high-volume       # 12000
```

### Operator notes

1. Running `stress:seed` without resolver-derived `--stock` seeds the generic default (1000). Prefer `stress:test` (or explicit resolver-derived `--stock`).
2. API still on correctness limiter: the run remains valid for correctness oracles, but is **not representative** of the intended performance-limiter scenario. This is an operator prerequisite and is **not** auto-detected. Metadata records harness expectation only — it does not claim to have inspected server configuration.

## Scenario behavior

### Seed

- ACTIVE flash sale in `stress-*` namespace
- Stock from explicit `--stock` (resolver-provided on `stress:test` → comfortable values above)
- `fixedUserId: null`; distinct users synthesized in k6

### k6 (`high-volume.js`)

Responsibilities:

- Consume shared profile iterations/VUs (`smoke` / `standard` / `full`)
- GraphQL `purchaseItem` only via existing helpers (no scenario-specific transport or retry)
- Classify every attempt exactly once; emit accounting counters
- Enforce hard gates below
- Record observational throughput / latency via existing k6 metrics + summary metadata

**Invariant:** `seededStock` comes from `.state/high-volume.json`; it is never recomputed from the active profile during execution.

**Hard gates (N = profile attempts):**

| Gate       | Rule                                                              |
| ---------- | ----------------------------------------------------------------- |
| Unexpected | `purchase_unexpected == 0`                                        |
| Duplicate  | `purchase_duplicate == 0`                                         |
| Sold-out   | `purchase_sold_out == 0` when `stockKind === 'comfortable'`       |
| Inventory  | `0 <= purchase_success <= seededStock`                            |
| Accounting | `success + sold_out + duplicate + rate_limited + unexpected == N` |

**Derived invariant** (informational — not a separate asserted gate; follows from comfortable stock + hard gates above):

```text
purchase_success + purchase_rate_limited == attempts
```

**Observational only (never sole fail reason):**

- `purchase_rate_limited`
- `purchase_success` (including zero)
- latency percentiles (p50 / p95 / p99)
- request rate / RPS

Artifacts: `tests/stress/results/high-volume-<profile>/k6-summary.json` with `scenario`, `profile`, `limiterProfile` (from metadata), `environment`, `startedAt`, counters. Latency/RPS recorded per the existing `#53` summary pipeline — do not invent a parallel results hub.

### Verifier

Reuse existing dual-oracle checks (purchase count ≤ stock, remaining stock identity, no duplicate user purchases, k6 success count match when summary present). No new high-volume-only verifier failure conditions in this issue. `#54`–`#56` proofs unchanged.

### API prerequisite

Start the API with `tests/stress/k6/config/performance.env.example` values (e.g. `RATE_LIMIT_PURCHASE_ITEM_MAX=30`, window 60) in Compose / `.env`, then recreate the API process. k6 env vars do not reconfigure the API rate limiter.

## Documentation

Update `tests/stress/README.md` only:

- Mark `high-volume` as runnable
- `stress:test` remains the recommended entry point
- Stock table: `high-volume` → same comfortable formula as `purchase-load`
- Note performance limiter prerequisite vs correctness for `#54`–`#56`
- Document hard vs observational outcomes (no expected throughput/latency numbers)
- Mention `stress:policy` for limiter metadata
- Link EPIC-07 and `#54`–`#57` designs; do not invent results narrative (`#60` / `#71`)

Keep root README thin; do not expand hubs.

## Relationship to later issues

| Issue | How #57 relates without overlapping                                             |
| ----- | ------------------------------------------------------------------------------- |
| #54   | Unchanged all-success baseline; shares comfortable stock formula                |
| #55   | Unchanged oversell / constrained stock                                          |
| #56   | Unchanged same-user race / constant stock                                       |
| #58   | May harden metrics schema across scenarios — consume real high-volume artifacts |
| #59   | Bottleneck analysis from real `#57` / `full` runs — no invented numbers here    |
| #60   | Results narrative hub — do not fabricate in `#57`                               |

## Design invariants

- Policy → resolveStock / stress:policy → seed/run metadata → k6 → verifier; no downstream recalculation of stock.
- GraphQL `purchaseItem` only; distinct users; comfortable stock so inventory does not confound capacity observation.
- Performance limiter on API is an operator prerequisite; wrappers only set summary metadata.
- Hard gates = business correctness; `RATE_LIMITED` / latency / RPS = capacity signals.
- Every attempt classified exactly once (`accounting == attempts`).
- `#54` / `#55` / `#56` thresholds and proofs remain unchanged.
- No fabricated stress results required to close the design.

## Definition of Done

- Runnable via `pnpm stress:test -- --scenario high-volume --profile {smoke|standard|full}`
- Summary records throughput, latency metrics, and outcome counters (including `RATE_LIMITED`)
- Hard gates + accounting as specified; dual-oracle verifier still passes
- Scenario policy owns `stockKind` + `expectedLimiterProfile`; seeder stays free of workload formulas
- `#54` / `#55` / `#56` behavior unchanged
- Thin README updated; no invented results docs
- No unrelated changes; no `#134` CSS AC reopen

## Likely file touch list

| Path                                                | Change                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `tests/stress/lib/scenario-policy.ts` (+ test)      | `stockKind`, `expectedLimiterProfile`                      |
| `tests/stress/lib/comfortable-stock.ts` (+ test)    | `stockKind` switch; support `high-volume`                  |
| `tests/stress/lib/resolve-comfortable-stock.ts`     | Allow `--scenario=high-volume`                             |
| `tests/stress/lib/resolve-scenario-policy.ts` (new) | `stress:policy` CLI                                        |
| `package.json`                                      | `stress:policy` script                                     |
| `tests/stress/seeder/types.ts`                      | Add `high-volume` to `RUNNABLE_K6_SCENARIOS`               |
| `scripts/stress-run.sh` / `scripts/stress-test.sh`  | Runnable map; policy-derived `LIMITER_PROFILE`; auto-stock |
| `tests/stress/k6/scenarios/high-volume.js`          | **Create**                                                 |
| `tests/stress/README.md`                            | Thin docs                                                  |

**Expected unchanged:** `#54`/`#55`/`#56` k6 script gates; seeder default-stock semantics; verifier correctness semantics; apps production code; e2e; CI full-scale k6.

## Implementation sequencing (for the plan)

1. Policy enrichment (`stockKind`, `expectedLimiterProfile`) + unit tests
2. `resolveStock` / stock CLI support for `high-volume` + unit tests
3. Generic `stress:policy` CLI + wrapper `LIMITER_PROFILE` precedence
4. Runner wiring (`RUNNABLE_K6_SCENARIOS`, `stress-run.sh`, `stress-test.sh`)
5. `high-volume.js` (gates + accounting + summary)
6. Thin README update

## Spec self-review

1. No TBD placeholders for locked decisions.
2. Scope matches GitHub #57 AC (records throughput and latency) without absorbing `#58`–`#60`.
3. Stock ownership remains execution-side via `resolveStock` / `stockKind`; seeder stays free of profile math.
4. Attempts/VUs remain only in `shared/profiles.json`.
5. Hard gates, accounting identity, comfortable-stock sold-out rule, and observational capacity signals are explicit.
6. Limiter metadata vs API configuration split is explicit; no auto-detection.
7. `#54` / `#55` / `#56` behavior and stock formulas are explicitly frozen.
8. No fabricated stress results required to close the design.
9. Does not reopen `#134` CSS AC.
