# #56 — Add same-user concurrency test (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-07-31
**Issue:** [#56](https://github.com/rexescario-dev/flash-sale-system/issues/56) — Add same-user concurrency test
**Epic:** [#87](https://github.com/rexescario-dev/flash-sale-system/issues/87) (EPIC-07 — Performance & Stress Testing)
**Parent design:** [EPIC-07 performance stress testing](./2026-07-31-epic-07-performance-stress-testing-design.md)
**Sibling designs:** [#54 flash sale load test](./2026-07-31-issue-54-flash-sale-load-test-design.md), [#55 limited inventory concurrency test](./2026-07-31-issue-55-limited-inventory-concurrency-test-design.md)
**Depends on:** [#53](https://github.com/rexescario-dev/flash-sale-system/issues/53) harness + [#54](https://github.com/rexescario-dev/flash-sale-system/issues/54) / [#55](https://github.com/rexescario-dev/flash-sale-system/issues/55) on `main`
**Repository:** `rexescario-dev/flash-sale-system`

## Goal

Prove that concurrent GraphQL `purchaseItem` attempts from **one fixed user** cannot create more than one purchase. Inventory is provisioned only so uniqueness—not stock exhaustion—is the bottleneck. `#54` remains the all-success baseline; `#55` remains the limited-inventory / oversell proof.

## Acceptance criterion

Across smoke, standard, and full profiles, **at most one success** for the fixed user under concurrent same-user attempts. Full profile = 10k attempts (issue AC). Dual oracle: k6 exact outcome gates + Prisma verifier proving a single persisted purchase row.

## Approach

**Thin `duplicate-race` scenario + scenario-policy layer (Approach 1):**

| Surface                                           | Role after #56                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/stress/k6/scenarios/duplicate-race.js`     | Same-user / duplicate-race proof; sibling of `purchase-load.js` / `oversell.js`                                                                             |
| Scenario policy module                            | Canonical SoT for scenario semantics: stock, fixedUserId, `expectsStockExhaustion` — exposing `getScenarioPolicy()` directly or via thin `resolve*` helpers |
| Public `resolveStock(profile, scenario)`          | Extends to `duplicate-race` → profile-independent constant `10`                                                                                             |
| `pnpm stress:stock`                               | Prints resolved stock for profile + scenario (including `duplicate-race`)                                                                                   |
| `scripts/stress-test.sh`                          | Resolves omitted `--stock` via `stress:stock` for `duplicate-race` (same as `#54`/`#55`)                                                                    |
| `scripts/stress-run.sh` + `RUNNABLE_K6_SCENARIOS` | Wire `duplicate-race` as a runnable k6 scenario                                                                                                             |
| `tests/stress/seeder/*`                           | Writes `fixedUserId` from policy for `duplicate-race`; still consumes explicit `--stock` only for inventory                                                 |
| `tests/stress/verifier/*`                         | Existing dual-oracle checks + exhaustion-expectation-aware unused-stock messaging                                                                           |
| `tests/stress/README.md`                          | Thin primary + split-path docs                                                                                                                              |

**Rejected alternatives:**

| Alternative                                                                     | Why rejected                                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Extract shared k6 purchase module now                                           | Premature; `#55` deferred until more scenarios justify it (`#57`/`#58`)  |
| Hardcode stock / fixed user / warning suppress as one-off `if (scenario === …)` | Scenario semantics belong in named policy, not scattered conditionals    |
| `--fixed-user-id` CLI flag                                                      | Unnecessary orchestration surface; fixed user is scenario-defining       |
| Profile-scaled stock for duplicate-race                                         | Valid purchases always = 1; scaling adds noise without isolation benefit |
| Stock = 1                                                                       | Couples uniqueness proof to inventory exhaustion                         |

## Locked decisions

| Area                          | Decision                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenario name / script        | `duplicate-race` → `tests/stress/k6/scenarios/duplicate-race.js`                                                                                               |
| Approach                      | Thin sibling + scenario-policy layer (Approach 1)                                                                                                              |
| Scenario policy module        | Canonical source for stock, fixedUserId, `expectsStockExhaustion` (and room for later fields); expose via `getScenarioPolicy()` and/or thin `resolve*` helpers |
| Stock                         | Profile-independent constant `DUPLICATE_RACE_STOCK = 10` via `resolveStock`                                                                                    |
| Stock ownership               | Policy resolves stock once; the resolved value flows through `--stock` into seeded state. k6 and the verifier consume seeded state and never recompute stock   |
| Fixed user                    | Stable scenario-defined identifier from policy; seeder auto-writes for `duplicate-race`; other scenarios `fixedUserId: null`                                   |
| Fixed user CLI                | No `--fixed-user-id` flag                                                                                                                                      |
| Users in k6                   | Every iteration uses `state.fixedUserId` (do not synthesize per-iteration ids)                                                                                 |
| Limiter                       | Correctness profile on API process; scenario assumes that config and does not modify it                                                                        |
| Hard k6 gates                 | `success == 1`; `duplicate == N - 1`; `sold_out == rate_limited == unexpected == 0`                                                                            |
| Accounting                    | `success + duplicate + sold_out + rate_limited + unexpected == N`                                                                                              |
| Dual oracle (summary present) | `purchase_success == purchase_count == 1`                                                                                                                      |
| Verifier                      | Existing checks + `fixed_user_single_purchase`; remaining stock = stock − 1                                                                                    |
| Unused stock                  | Informational only when the scenario expects stock exhaustion (`expectsStockExhaustion`)                                                                       |
| Exhaustion expectations       | `oversell` → `true`; `duplicate-race` → `false`; `purchase-load` unchanged (no exhaustion warning semantics required for baseline)                             |
| Docs                          | Thin `tests/stress/README.md` only; no invented results (`#71`/`#60`)                                                                                          |
| Freeze                        | Do not weaken `#54` all-success or `#55` oversell gates / stock formulas                                                                                       |
| Out of epic slice             | Shared k6 extraction; `#57`–`#60`; `#134` CSS AC                                                                                                               |

## Scope

### In scope

- Scenario policy module (`getScenarioPolicy()` and/or thin `resolve*` helpers): stock `10`, stable `fixedUserId`, `expectsStockExhaustion`
- `resolveStock(..., 'duplicate-race')` → `10`; unit tests
- Seeder writes policy `fixedUserId` for `duplicate-race`; other scenarios remain `null`
- Wire into `RUNNABLE_K6_SCENARIOS`, `stress-run.sh`, and `stress-test.sh` (auto-`--stock` when omitted)
- `duplicate-race.js` (GraphQL-only, fixed user, exact gates + accounting)
- Verifier: exhaustion-expectation-aware unused-stock messaging; existing `fixed_user_single_purchase`
- Thin `tests/stress/README.md` updates
- Reuse `#53`/`#54`/`#55` seed/verify/helpers/wrappers — do not reimplement

### Out of scope

- Shared k6 purchase-module extraction
- Changes to `purchase-load` / `oversell` gates or stock formulas
- New seeder CLI flag for fixed user id
- `#57`–`#60` (high-volume, metrics hardening, bottlenecks, results narrative)
- Invented k6 results docs (`#71` / `#60`) without real runs
- Reopening `#134` CSS AC
- Root README / hub expansion beyond the existing thin pointer pattern

## Architecture

**Pipeline (unchanged):** `seed → k6 purchaseItem → verify`

**Invariant:** Scenario policy is resolved before seeding. After seeding begins, stock / fixed user / exhaustion expectation are immutable inputs from state + named policy (not recalculated ad hoc in k6).

```text
shared/profiles.json (attempts/VUs)
        │
        ▼
Scenario policy module
(getScenarioPolicy / thin resolve* helpers)
   ├── stock                  → DUPLICATE_RACE_STOCK = 10 (profile-independent)
   ├── fixedUserId            → stable scenario-defined identifier
   ├── expectsStockExhaustion → false for duplicate-race; true for oversell
   └── (room for later fields — do not invent placeholders yet)
        │
        ▼
--stock N ──► stress:seed (generic fixtures; scenario sets fixedUserId from policy)
                    │
                    ▼
           .state/duplicate-race.json
                    │
stress:run ──► duplicate-race.js ──GraphQL──► API ──► Postgres
        │                                    ▲
        └── results/duplicate-race-<profile>/ │
              k6-summary.json                 │
                          stress:verify ─────┘
         (dual oracle; unused-stock informational only when expects exhaustion)
```

| Component                       | Owns                                                                                                 | Does not own           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------- |
| `shared/profiles.json`          | Attempts / VUs                                                                                       | Stock / user           |
| Scenario policy module          | Stock, fixedUserId, `expectsStockExhaustion` (grow only when later issues require fields)            | Seeding / GraphQL      |
| `resolveStock` / `stress:stock` | Public stock CLI; `duplicate-race` → 10                                                              | User ids               |
| Seeder                          | Idempotent `stress-*` fixtures from `--stock`; writes `fixedUserId` from policy for `duplicate-race` | Workload formulas      |
| `duplicate-race.js`             | Same fixed user every iteration; exact outcome gates + accounting                                    | Stock sizing           |
| `purchase-load` / `oversell`    | Unchanged baselines                                                                                  | `#56` uniqueness proof |
| Verifier                        | Persisted correctness; unused-stock informational only when scenario expects stock exhaustion        | Invented results docs  |
| Wrappers                        | Wire runnable + auto-`--stock` via `stress:stock`                                                    | Scenario math          |

### Stock CLI

```bash
pnpm --silent stress:stock --profile=smoke --scenario=duplicate-race      # 10
pnpm --silent stress:stock --profile=standard --scenario=duplicate-race   # 10
pnpm --silent stress:stock --profile=full --scenario=duplicate-race       # 10
```

### Footgun

Running `stress:seed` directly without a resolver-derived `--stock` seeds the generic default (1000). Prefer `stress:test` (or an explicit resolver-derived `--stock`). This is an implementation convenience rather than a supported execution path. For `duplicate-race`, missing `fixedUserId` in state (manual seed bypassing policy) would break the same-user race — seeder must write policy `fixedUserId` whenever `--scenario duplicate-race`.

## Scenario behavior

### Seed

- ACTIVE flash sale in `stress-*` namespace
- Stock from explicit `--stock` (resolver-provided on `stress:test` → **10** for all profiles)
- `fixedUserId` = stable scenario-defined identifier from policy (not `null`)
- `userIdPrefix` still written for schema compatibility; k6 **must not** synthesize per-iteration users for this scenario

### k6 (`duplicate-race.js`)

- Shared-iterations executor; iterations/VUs from the shared profile SoT (`full` = 10_000 attempts)
- GraphQL `purchaseItem` only via existing helpers
- Every iteration uses `state.fixedUserId`
- Classify + record via existing `classify.js` / `metrics.js`
- Correctness limiter assumed on API process; k6 does not reconfigure it

**Invariant:** `stock` and `fixedUserId` are seeded values from `.state/duplicate-race.json`; they are never recalculated from the active profile during execution.

**Hard gates (N = profile attempts):**

| Counter                 | Gate       |
| ----------------------- | ---------- |
| `purchase_success`      | `== 1`     |
| `purchase_duplicate`    | `== N - 1` |
| `purchase_sold_out`     | `== 0`     |
| `purchase_rate_limited` | `== 0`     |
| `purchase_unexpected`   | `== 0`     |

**Accounting:** `purchase_success + purchase_duplicate + purchase_sold_out + purchase_rate_limited + purchase_unexpected == N`

With policy stock 10, leftover 9 is expected. Summary may report leftovers for diagnostics but does **not** treat them as a failure or as an exhaustion warning.

Artifacts follow the existing `#53` contract: `tests/stress/results/duplicate-race-<profile>/k6-summary.json`.

### Verifier

Existing verifier checks, plus the following fixed-user assertions when `fixedUserId` is present (already present as `fixed_user_single_purchase`):

- Exactly one purchase row for `(flashSaleId, fixedUserId)`
- When a k6 summary is available, `purchase_success == purchase_count == 1`
- `remaining_stock == initial_stock - 1` (10 → 9)
- No duplicate `(flashSaleId, userId)` rows

Together with k6, this forms the dual oracle: k6 proves runtime classification; the verifier proves persisted state.

Unused-stock messaging is **informational only when the scenario expects stock exhaustion** (`expectsStockExhaustion === true`). For `duplicate-race`, leftover stock does not produce a warning. For `oversell`, existing unused-stock informational behavior remains.

### API prerequisite

The API must already be running with the correctness limiter (`tests/stress/k6/config/correctness.env.example`). Live runs require raised purchase limiter (e.g. `RATE_LIMIT_PURCHASE_ITEM_MAX=100000`) so `RATE_LIMITED = 0`. k6 env vars do not reconfigure the API rate limiter.

## Documentation

Update `tests/stress/README.md` only:

- Mark `duplicate-race` as runnable
- `stress:test` remains the recommended entry point
- Stock table: add `duplicate-race` → constant `10` (all profiles)
- Note fixed same-user race + correctness limiter prerequisite
- Split path with `pnpm --silent stress:stock --profile … --scenario=duplicate-race`
- Link EPIC-07 and #56 design; do not invent results narrative (`#60` / `#71`)

Keep root README thin; do not expand hubs.

## Relationship to later issues

| Issue   | How #56 relates without overlapping                                                     |
| ------- | --------------------------------------------------------------------------------------- |
| #54     | Unchanged all-success baseline / comfortable stock                                      |
| #55     | Unchanged oversell / exhaustion-aware unused-stock messaging                            |
| #57     | Performance-focused; may extend policy fields; `RATE_LIMITED` becomes a capacity signal |
| #58–#60 | Consume real duplicate-race artifacts later — do not fabricate here                     |

## Design invariants

- Policy → seeder → state → k6 → verifier; no downstream recalculation of scenario semantics.
- GraphQL `purchaseItem` only.
- One fixed user; uniqueness is the sole intended bottleneck (stock = 10 keeps inventory out of the proof).
- Correctness limiter prevents intentional rate limiting.
- Exact classification + accounting at the k6 oracle; single persisted purchase at the verifier oracle.
- When summary present: `purchase_success == purchase_count == 1`.
- Unused stock is informational only when the scenario expects stock exhaustion.
- `#54` and `#55` thresholds and stock formulas remain unchanged.

## Definition of Done

- Runnable via `pnpm stress:test -- --scenario duplicate-race --profile {smoke|standard|full}`
- Full profile = 10k attempts; hard k6 gates + accounting + dual-oracle verifier as specified
- Scenario policy is the SoT for stock / fixedUserId / exhaustion expectation; seeder remains free of workload formulas
- `#54` purchase-load and `#55` oversell behavior unchanged
- Thin README updated; no invented results docs
- No unrelated changes; no `#134` CSS AC reopen

## Implementation sequencing (for the plan)

1. Scenario policy module (+ `resolveStock` `duplicate-race` branch) + unit tests
2. Seeder writes policy `fixedUserId` for `duplicate-race`
3. Runner wiring (`stress-test.sh`, `stress-run.sh`, runnable scenarios)
4. `duplicate-race.js` (gates + accounting)
5. Verifier unused-stock messaging gated by `expectsStockExhaustion`
6. README thin update

## Spec self-review

1. No TBD placeholders for locked decisions.
2. Scope matches GitHub #56 AC (10k same-user requests → at most 1 success) without absorbing `#57`–`#60`.
3. Stock ownership remains execution-side via `resolveStock` / policy; seeder stays free of profile math.
4. Attempts/VUs remain only in `shared/profiles.json`; duplicate-race stock is a deliberate profile-independent constant.
5. Hard gates, accounting, and dual-oracle symmetry (`purchase_success == purchase_count == 1`) are explicit.
6. Unused-stock messaging is expectation-driven, not a one-off suppress-all.
7. `#54` / `#55` behavior and stock formulas are explicitly frozen.
8. No fabricated stress results required to close the design.
9. Does not reopen `#134` CSS AC.
