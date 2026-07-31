# #54 — Add flash sale load test (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-07-31
**Issue:** [#54](https://github.com/rexescario-dev/flash-sale-system/issues/54) — Add flash sale load test
**Epic:** [#87](https://github.com/rexescario-dev/flash-sale-system/issues/87) (EPIC-07 — Performance & Stress Testing)
**Parent design:** [EPIC-07 performance stress testing](./2026-07-31-epic-07-performance-stress-testing-design.md)
**Depends on:** [#53](https://github.com/rexescario-dev/flash-sale-system/issues/53) harness on `main` (`tests/stress/`)
**Repository:** `rexescario-dev/flash-sale-system`

## Goal

Prove the purchase flow survives normal concurrent buyers via GraphQL `purchaseItem` under **comfortable stock** and **distinct users**. This is a clean baseline load, not an oversell, duplicate-purchase, or rate-limit proof.

## Acceptance criteria (issue)

- [ ] Load test exercises purchase under concurrent users

Satisfied by a runnable `purchase-load` k6 scenario that drives concurrent GraphQL `purchaseItem` attempts with distinct users, wired through the existing `#53` seed → run → verify pipeline, with strict all-success gates under comfortable stock and the correctness limiter.

## Approach

**Thin scenario + shared comfortable-stock resolver (Approach 1):**

| Surface                                           | Role after #54                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `tests/stress/k6/scenarios/purchase-load.js`      | Baseline concurrent purchase load; sibling of `harness-smoke.js`                  |
| Shared profile + comfortable-stock resolver       | Attempts/VUs defined once; resolver derives recommended stock for `purchase-load` |
| `scripts/stress-test.sh`                          | For `purchase-load`, injects resolver `--stock` when omitted                      |
| `scripts/stress-run.sh` + `RUNNABLE_K6_SCENARIOS` | Wire `purchase-load` as a runnable k6 scenario                                    |
| `tests/stress/seeder/*`                           | Unchanged semantics — generic `--stock` default `1000`                            |
| `tests/stress/verifier/*`                         | Reuse without behavioral changes                                                  |
| `tests/stress/README.md`                          | Thin primary + split-path docs; footgun note                                      |

**Rejected alternatives:**

| Alternative                                           | Why rejected                                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Profile-aware seeder defaults / `--comfortable-stock` | Hidden behavior; muddies #55; seeder must stay infrastructure-only                              |
| Extract shared k6 purchase module in #54              | Speculative refactor; revisit after #55/#56 create real duplication                             |
| Soft “mostly SUCCESS” thresholds                      | Baseline intentionally eliminates legitimate business failures; any non-success is a regression |

## Locked decisions

| Area                   | Decision                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Scenario name / script | `purchase-load` → `tests/stress/k6/scenarios/purchase-load.js`                                        |
| Approach               | Thin sibling of `harness-smoke.js` + shared stock resolver                                            |
| Seeder                 | Profile-agnostic; default `--stock=1000`; honor explicit `--stock`; no `--comfortable-stock`          |
| Stock ownership        | Scenario execution (`stress:test` + documented split path), not seeder or k6 script                   |
| Stock formula          | `comfortableStock(attempts) = max(1000, ceil(attempts * 1.2))`                                        |
| Profile SoT            | Attempts/VUs are defined once and consumed by both the k6 scenario and the comfortable-stock resolver |
| Split path             | Explicit: operator/docs invoke resolver, then `stress:seed -- --stock …`                              |
| Users                  | Distinct ids (`{userIdPrefix}-{__ITER}-{__VU}`)                                                       |
| Limiter                | Correctness profile on API process; expect no intentional rate limiting                               |
| Pass criteria          | Every iteration must result in exactly one successful purchase; all other buckets `== 0`              |
| Verifier               | Reuse existing dual-oracle checks; no new verifier behavior                                           |
| Docs                   | Thin `tests/stress/README.md` only; no invented results (#71/#60)                                     |
| Out of epic slice      | Shared k6 extraction; #55–#60 work; #134 CSS AC; fabricated metrics                                   |

## Scope

### In scope

- `purchase-load.js` (GraphQL-only, comfortable stock assumed, distinct users, strict thresholds)
- Shared comfortable-stock resolver + profile attempts/VUs SoT consumption
- Wire into `RUNNABLE_K6_SCENARIOS`, `stress-run.sh`, and `stress-test.sh` (auto `--stock` when omitted for `purchase-load`)
- Thin `tests/stress/README.md` updates (primary `stress:test`, explicit split path, footgun note)
- Reuse `#53` seed/verify/helpers/wrappers — do not reimplement

### Out of scope

- Seeder profile knowledge or scenario-specific seed flags
- Shared k6 purchase-module extraction
- Oversell (#55), same-user race (#56), high-volume/perf limiter (#57)
- Metrics schema hardening (#58), bottleneck analysis (#59), results narrative (#60)
- EPIC-08 `#71` / `#74` docs; inventing k6 results without real runs
- Reopening #134 CSS AC
- README hub expansion beyond a thin stress README pointer pattern already established

## Architecture

**Pipeline (unchanged):** `seed → k6 purchaseItem → verify`

```text
profiles (attempts/VUs) ──► comfortableStock() ──► --stock N ──► stress:seed
                                      │                              │
                                      │                         .state/purchase-load.json
                                      ▼                              ▼
                              stress:run ──► purchase-load.js ──GraphQL──► API ──► Postgres
                                      │                                         ▲
                                      └── results/.../k6-summary.json           │
                                                      stress:verify (existing) ─┘
```

| Component                  | Responsibility                                                                |
| -------------------------- | ----------------------------------------------------------------------------- |
| Profile SoT                | Defines attempts/VUs once                                                     |
| Comfortable-stock resolver | `comfortableStock(attempts)`; used by `stress:test` and documented split path |
| Seeder                     | Consumes explicit `--stock`; generic default `1000`                           |
| `stress-run.sh`            | Selects k6 script for scenario                                                |
| `purchase-load.js`         | Generates concurrent purchase load; no stock-sizing logic                     |
| Verifier                   | Existing dual-oracle validation                                               |

## Comfortable stock

**Rule:** Attempts/VUs are defined once and consumed by both the k6 scenario and the comfortable-stock resolver. The resolver computes:

```text
comfortableStock(attempts) = max(1000, ceil(attempts * 1.2))
```

| Profile  | Attempts | Resolver stock |
| -------- | -------: | -------------: |
| smoke    |      100 |           1000 |
| standard |     1000 |           1200 |
| full     |    10000 |          12000 |

**Primary path:** `pnpm stress:test -- --scenario purchase-load --profile <profile>`  
→ `stress-test.sh` resolves stock when `--stock` is omitted and passes it to `stress:seed`.

**Split path (explicit):**

```bash
STOCK=$(node …/resolve-comfortable-stock.mjs <profile>)  # or equivalent helper
pnpm stress:seed -- --scenario purchase-load --stock "$STOCK"
pnpm stress:run -- --scenario purchase-load --profile <profile>
pnpm stress:verify -- --scenario purchase-load --profile <profile>
```

Bare `stress:seed -- --scenario purchase-load` remains valid generic seeding (default stock `1000`). Omitting `--stock` for high-intensity profiles changes the scenario from a comfortable-stock baseline into a stock-constrained run and therefore invalidates the #54 success criteria — document that footgun.

## Scenario behavior

### Seed

- ACTIVE flash sale in `stress-*` namespace
- Distinct `userIdPrefix`; `fixedUserId = null`
- Stock from explicit `--stock` (resolver-provided on `stress:test`)

### k6 (`purchase-load.js`)

- Shared-iterations executor; iterations/VUs from the shared profile SoT
- GraphQL `purchaseItem` only via existing helpers
- Distinct user ids per iteration/VU
- Classify + record via existing `classify.js` / `metrics.js`

**Invariant:** Every iteration must result in exactly one successful purchase. Under comfortable stock, distinct users, and the correctness limiter, no business failure outcomes are expected.

Concrete thresholds (counter names match existing metrics helpers):

| Counter                 | Gate                                         |
| ----------------------- | -------------------------------------------- |
| `purchase_success`      | `count == attempts`                          |
| `purchase_rate_limited` | `count == 0`                                 |
| `purchase_sold_out`     | `count == 0`                                 |
| `purchase_duplicate`    | `count == 0` (maps from `ALREADY_PURCHASED`) |
| `purchase_unexpected`   | `count == 0`                                 |

Artifacts: `tests/stress/results/purchase-load-<profile>/k6-summary.json` per existing `#53` contract.

### Verifier

Reuse the existing verifier without behavioral changes. `#54` relies on existing dual-oracle validation:

- `purchase_count == k6_success_count`
- `remaining_stock == initial_stock - purchase_count`
- no duplicate `(flashSaleId, userId)` rows

## API prerequisite

Start the API with correctness limiter settings from `tests/stress/k6/config/correctness.env.example`. k6 env vars do not reconfigure the API rate limiter.

## Documentation

Update `tests/stress/README.md` only:

- Mark `purchase-load` as runnable
- Primary command via `stress:test`
- Split path with resolver-derived `--stock`
- Footgun: Omitting `--stock` for high-intensity profiles changes the scenario from a comfortable-stock baseline into a stock-constrained run and therefore invalidates the #54 success criteria
- Link EPIC-07 design; do not invent results narrative (#60 / #71)

Keep root README thin; do not expand hubs.

## Relationship to later issues

| Issue   | How #54 helps without overlapping                                                                |
| ------- | ------------------------------------------------------------------------------------------------ |
| #55     | Intentionally sizes stock **below** attempts; intentionally expects `SOLD_OUT` business outcomes |
| #56     | Fixed user; expects `ALREADY_PURCHASED` / duplicate classification                               |
| #57     | Performance limiter; `RATE_LIMITED` is a capacity signal                                         |
| #58–#60 | Consume real run artifacts later — do not fabricate here                                         |

## Design invariants

- GraphQL `purchaseItem` only.
- Comfortable stock is computed outside the seeder and outside k6.
- Distinct users eliminate duplicate-purchase behavior.
- Correctness limiter prevents intentional rate limiting.
- Every iteration is expected to succeed.
- Existing verifier remains unchanged.

## Definition of Done

- `purchase-load` is runnable via `pnpm stress:test -- --scenario purchase-load --profile smoke` (and profile wiring for `standard` / `full`)
- Strict k6 thresholds + existing verifier form the dual-oracle pass
- Comfortable-stock resolver is the single documented SoT for recommended stock
- Seeder remains profile-agnostic
- Thin README updated; no invented results docs
- No unrelated changes; no #134 CSS AC reopen

## Spec self-review

1. No TBD placeholders for locked decisions.
2. Scope matches GitHub #54 AC (concurrent purchase load) without absorbing #55–#60.
3. Stock ownership is execution-side; seeder stays generic.
4. Attempts/VUs are defined once and consumed by both k6 and the resolver.
5. Threshold counter names match existing `metrics.js` (`purchase_duplicate`, not a separate already-purchased metric).
6. Verifier is reuse-only; acceptance story uses equality checks, not “≤ stock” as the headline.
7. No fabricated stress results required to close the design.
8. Does not reopen #134 CSS AC.
