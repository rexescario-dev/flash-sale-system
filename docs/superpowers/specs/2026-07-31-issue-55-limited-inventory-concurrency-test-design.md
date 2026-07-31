# #55 — Add limited inventory concurrency test (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-07-31
**Issue:** [#55](https://github.com/rexescario-dev/flash-sale-system/issues/55) — Add limited inventory concurrency test
**Epic:** [#87](https://github.com/rexescario-dev/flash-sale-system/issues/87) (EPIC-07 — Performance & Stress Testing)
**Parent design:** [EPIC-07 performance stress testing](./2026-07-31-epic-07-performance-stress-testing-design.md)
**Sibling design:** [#54 flash sale load test](./2026-07-31-issue-54-flash-sale-load-test-design.md)
**Depends on:** [#53](https://github.com/rexescario-dev/flash-sale-system/issues/53) harness + [#54](https://github.com/rexescario-dev/flash-sale-system/issues/54) purchase-load baseline on `main`
**Repository:** `rexescario-dev/flash-sale-system`

## Goal

Demonstrate that, under constrained inventory, concurrent GraphQL `purchaseItem` requests cannot persist more successful purchases than available stock. Constrained inventory intentionally produces `SOLD_OUT` outcomes using distinct users. `purchase-load` (#54) remains the all-success baseline with unchanged thresholds and comfortable stock.

## Acceptance criterion

Across smoke, standard, and full profiles, **persisted successful purchases (equivalently, `purchase_success` after dual-oracle verification) never exceed seeded stock**. Standard and full satisfy the issue's 1k/10k attempt targets; smoke exercises the same invariant locally.

## Approach

**Thin `oversell` scenario + generalized stock resolver (Approach 1):**

| Surface                                           | Role after #55                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `tests/stress/k6/scenarios/oversell.js`           | Limited-inventory / oversell proof; sibling of `purchase-load.js`                |
| Public `resolveStock(profile, scenario)`          | Sole stock-policy API; delegates to internal helpers                             |
| `pnpm stress:stock`                               | Prints resolved stock for profile + scenario                                     |
| `scripts/stress-test.sh`                          | Resolves omitted `--stock` via `stress:stock`; passes explicit `--stock` through |
| `scripts/stress-run.sh` + `RUNNABLE_K6_SCENARIOS` | Wire `oversell` as a runnable k6 scenario                                        |
| `tests/stress/seeder/*`                           | Unchanged semantics — consumes explicit `--stock` only                           |
| `tests/stress/verifier/*`                         | Existing correctness checks + informational unused-stock echo                    |
| `tests/stress/README.md`                          | Thin primary + split-path docs; footgun note                                     |

**Rejected alternatives:**

| Alternative                                            | Why rejected                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Profile-aware seeder / scenario stock defaults         | Couples seeder to benchmark semantics; violates #54 generic-seeder boundary |
| Hardcoded stock or per-profile tables in `oversell.js` | Second source of truth; drifts from shared profiles                         |
| Separate `stress:constrained-stock` script             | Duplicates stock-policy ownership                                           |

## Locked decisions

| Area                         | Decision                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Scenario name / script       | `oversell` → `tests/stress/k6/scenarios/oversell.js`                                                                          |
| Approach                     | Thin sibling of `purchase-load.js` + public `resolveStock(profile, scenario)`                                                 |
| Stock policy API             | `resolveStock` is the only public entry point; `comfortableStock` / `constrainedStock` are internal                           |
| Constrained stock (internal) | `min(100, max(10, floor(attempts * 0.10)))`                                                                                   |
| Comfortable stock (internal) | Unchanged #54: `max(1000, ceil(attempts * 1.2))`                                                                              |
| Stock CLI                    | `stress:stock --profile=<p> --scenario=<s>`; bare `stress:stock <profile>` → `purchase-load` (compat)                         |
| `stress-test.sh`             | Resolves omitted `--stock` via `stress:stock` for `purchase-load` and `oversell`; passes explicit `--stock` through unchanged |
| Seeder                       | Consumes explicit stock only; no workload/profile/scenario policy                                                             |
| Users                        | Distinct ids (`{userIdPrefix}-{__ITER}-{__VU}`)                                                                               |
| Limiter                      | Correctness profile on API process; scenario assumes that config and does not modify it                                       |
| Hard k6 gates                | `0 < purchase_success <= stock`; duplicate / rate_limited / unexpected `== 0`                                                 |
| Soft signal                  | Healthy runs are expected to fully exhaust inventory (`purchase_success == stock`); remaining inventory is informational only |
| Diagnostics                  | k6 summary = canonical structured SoT; verifier echoes unused-stock warning, exit 0                                           |
| Verifier hard checks         | Existing dual-oracle correctness checks only; no additional oversell-specific failure conditions                              |
| Docs                         | Thin `tests/stress/README.md` only; no invented results (#71/#60)                                                             |
| Out of epic slice            | Shared k6 extraction; #56–#60; purchase-load / comfortable-stock changes; #134 CSS AC                                         |

## Scope

### In scope

- `oversell.js` (GraphQL-only, constrained stock assumed, distinct users, hard gates + canonical diagnostics)
- Generalize stock policy: expose `resolveStock(profile, scenario)` as the sole public API; keep `comfortableStock()` / `constrainedStock()` internal
- Evolve `stress:stock` CLI (`--profile` / `--scenario`; bare profile → `purchase-load`)
- Wire into `RUNNABLE_K6_SCENARIOS`, `stress-run.sh`, and `stress-test.sh`
- k6 summary diagnostics SoT + verifier unused-stock informational echo (exit 0)
- Thin `tests/stress/README.md` updates
- Unit tests for constrained stock and `resolveStock` scenario routing
- Reuse `#53`/`#54` seed/verify/helpers/wrappers — do not reimplement

### Out of scope

- Shared k6 purchase-module extraction
- Changes to `purchase-load` behavior or comfortable-stock sizing
- Seeder profile/scenario stock policy
- Changes to verifier correctness semantics beyond the informational unused-stock echo
- `#56`–`#60` (duplicate-race, high-volume, metrics hardening, bottlenecks, results narrative)
- Invented k6 results docs (`#71` / `#60`) without real runs
- Reopening `#134` CSS AC
- Root README / hub expansion beyond the existing thin pointer pattern

## Architecture

**Pipeline (unchanged):** `seed → k6 purchaseItem → verify`

**Invariant:** Stock policy is resolved before seeding. After seeding begins, all downstream components treat stock as immutable input.

```text
shared/profiles.json (attempts/VUs)
        │
        ▼
Stock policy
(resolveStock)
   ├── purchase-load → comfortableStock(attempts)   [internal]
   └── oversell      → constrainedStock(attempts)   [internal]
        │
        ▼
--stock N ──► stress:seed (generic) ──► .state/oversell.json
                                              │
stress:run ──► oversell.js ──GraphQL──► API ──► Postgres
        │                                    ▲
        └── results/oversell-<profile>/      │
              k6-summary.json (diagnostics SoT)
                          stress:verify ─────┘
                    (correctness + unused-stock echo)
```

| Component                                   | Owns                                                                                        | Does not own                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| `shared/profiles.json`                      | Attempts / VUs SoT                                                                          | Stock                               |
| `resolveStock(profile, scenario)`           | Public stock-policy API                                                                     | Seeding / GraphQL                   |
| `comfortableStock()` / `constrainedStock()` | Internal implementation of stock formulas                                                   | Callers outside the resolver module |
| `stress:stock` CLI                          | Prints resolved integer; named `--profile` / `--scenario`; bare profile → `purchase-load`   | Scenario execution                  |
| `stress-test.sh`                            | Resolves omitted `--stock` via `stress:stock`; passes explicit `--stock` through unchanged  | Formula math                        |
| Seeder                                      | Idempotent `stress-*` fixtures from explicit `--stock`; no workload/profile/scenario policy | Stock policy                        |
| `oversell.js`                               | Distinct users; classify/record outcomes; enforce hard gates; emit canonical diagnostics    | Stock sizing                        |
| `purchase-load.js`                          | Unchanged all-success baseline                                                              | Constrained stock                   |
| Verifier                                    | Existing persisted-state correctness checks; informational unused-stock echo only           | New oversell fail gates             |
| `stress-run.sh`                             | Wire `oversell` into runnable scenarios                                                     | Stock resolution                    |

### Resolver internals (non-public)

These formulas may evolve without changing the external `resolveStock` API:

| Helper             | Formula                                     | smoke / standard / full |
| ------------------ | ------------------------------------------- | ----------------------- |
| `comfortableStock` | `max(1000, ceil(attempts * 1.2))`           | 1000 / 1200 / 12000     |
| `constrainedStock` | `min(100, max(10, floor(attempts * 0.10)))` | 10 / 100 / 100          |

### Stock CLI

```bash
pnpm --silent stress:stock --profile=smoke --scenario=oversell        # 10
pnpm --silent stress:stock --profile=standard --scenario=oversell     # 100
pnpm --silent stress:stock --profile=full --scenario=oversell         # 100
pnpm --silent stress:stock --profile=smoke --scenario=purchase-load   # 1000
pnpm --silent stress:stock smoke                                      # 1000 (compat → purchase-load)
```

### Footgun

Running `stress:seed` directly without a resolver-derived `--stock` seeds the generic default (1000), which may prevent the oversell scenario from exercising constrained inventory. Document in the thin README. **Prefer `stress:test`** (or an explicit resolver-derived `--stock`).

## Scenario behavior

### Seed

- ACTIVE flash sale in `stress-*` namespace
- Distinct `userIdPrefix`; `fixedUserId = null`
- Stock from explicit `--stock` (resolver-provided on `stress:test`)

### k6 (`oversell.js`)

- Shared-iterations executor; iterations/VUs from the shared profile SoT
- GraphQL `purchaseItem` only via existing helpers
- Distinct user ids per iteration/VU
- Classify + record via existing `classify.js` / `metrics.js`

**Invariant:** `stock` is the seeded inventory value read from `.state/oversell.json`; it is never recalculated from the active profile during execution.

**Hard gates (CI):**

**Primary correctness invariant:** `0 < purchase_success <= stock`.

| Counter                 | Gate       |
| ----------------------- | ---------- |
| `purchase_success`      | `> 0`      |
| `purchase_success`      | `<= stock` |
| `purchase_duplicate`    | `== 0`     |
| `purchase_rate_limited` | `== 0`     |
| `purchase_unexpected`   | `== 0`     |

Healthy runs are expected to fully exhaust inventory (`purchase_success == stock`). Remaining inventory is reported as an informational warning only; do not fail the scenario.

**Canonical diagnostics** in `results/oversell-<profile>/k6-summary.json` (extend existing summary; keep `#53` metadata):

```json
{
  "stock": 100,
  "purchaseSuccess": 99,
  "unusedStock": 1,
  "oversell": false,
  "warnings": ["Inventory not fully exhausted (1 item remaining)."]
}
```

`oversell` is a derived diagnostic (`purchase_success > stock`) and therefore mirrors the hard gate rather than introducing independent semantics. On passing runs, `oversell` is expected to remain `false`.

Artifacts follow the existing `#53` contract: `tests/stress/results/oversell-<profile>/k6-summary.json`.

### Verifier

Existing dual-oracle correctness checks only; no additional oversell-specific failure conditions:

- `purchase_count <= initial_stock`
- `remaining_stock == initial_stock - purchase_count`
- `purchase_count == k6_success_count` (when summary present)
- no duplicate `(flashSaleId, userId)` rows

If correctness passes and `purchaseCount < stock`, emit a concise human-readable unused-stock warning (stderr and/or verifier artifact) and **exit 0**. Mirrors the unused-stock observation from k6; does not define independent warning policy.

### API prerequisite

The API must already be running with the correctness limiter (`tests/stress/k6/config/correctness.env.example`). The oversell scenario assumes that configuration and does not modify it. k6 env vars do not reconfigure the API rate limiter.

## Documentation

Update `tests/stress/README.md` only:

- Mark `oversell` as runnable
- `stress:test` remains the recommended entry point; split-path commands are documented primarily for debugging and advanced workflows
- Split path with `pnpm --silent stress:stock --profile … --scenario=oversell`
- Footgun: seeding without resolver-derived `--stock` may use generic default 1000 and skip constrained-inventory behavior
- Link EPIC-07 and #55 design; do not invent results narrative (#60 / #71)

Keep root README thin; do not expand hubs.

## Relationship to later issues

| Issue   | How #55 helps without overlapping                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| #54     | Unchanged all-success baseline / comfortable stock                                                                      |
| #56     | Fixed user; expects `ALREADY_PURCHASED` / duplicate classification                                                      |
| #57     | Performance-focused scenario where `RATE_LIMITED` becomes an expected capacity signal rather than a correctness failure |
| #58–#60 | Consume real oversell artifacts later — do not fabricate here                                                           |

## Design invariants

- Stock policy is resolved before seeding; downstream components treat stock as immutable input.
- GraphQL `purchaseItem` only.
- Distinct users eliminate duplicate-purchase behavior as the primary outcome.
- Correctness limiter prevents intentional rate limiting.
- Never oversell: `0 < purchase_success <= stock` (and persisted purchases never exceed seeded stock).
- `purchase-load` thresholds and comfortable-stock sizing remain unchanged.
- Existing verifier correctness semantics remain stable; unused stock is observational only.

## Definition of Done

- `oversell` is runnable via `pnpm stress:test -- --scenario oversell --profile smoke` (and profile wiring for `standard` / `full`)
- Hard k6 gates together with existing verifier dual-oracle checks define a passing run; unused-stock remains informational
- `resolveStock` is the sole public stock-policy API; seeder remains policy-agnostic
- `purchase-load` thresholds and comfortable sizing unchanged
- Thin README updated; no invented results docs
- No unrelated changes; no #134 CSS AC reopen

## Implementation sequencing (for the plan)

1. Stock policy library + resolver CLI + unit tests
2. Runner wiring (`stress-test.sh`, `stress-run.sh`, runnable scenarios)
3. `oversell.js` (gates + summary diagnostics)
4. Verifier informational echo
5. README thin update

## Spec self-review

1. No TBD placeholders for locked decisions.
2. Scope matches GitHub #55 AC (successful purchases ≤ stock for 1k/10k) without absorbing #56–#60.
3. Stock ownership is execution-side via `resolveStock`; seeder stays generic.
4. Attempts/VUs are defined once in profiles; stock is deterministically derived per scenario.
5. Hard gates vs soft unused-stock signal are explicit; `oversell` diagnostic mirrors the hard gate.
6. Verifier correctness policy is unchanged beyond informational echo.
7. `#54` purchase-load behavior and comfortable-stock sizing are explicitly out of scope.
8. No fabricated stress results required to close the design.
9. Does not reopen #134 CSS AC.
