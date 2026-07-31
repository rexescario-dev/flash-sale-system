# EPIC-07 — Performance & Stress Testing (Design Spec)

**Status:** Approved
**Date:** 2026-07-31
**Epic:** [EPIC-07 #87](https://github.com/rexescario-dev/flash-sale-system/issues/87)
**Child issues:** #53–#60
**Repository:** `rexescario-dev/flash-sale-system`
**Depends on:** EPIC-01–06 on `main` (purchase GraphQL boundary, Postgres source of truth, Redis non-authoritative); local Compose/API available for runs
**Does not replace:** Jest unit/integration concurrency proofs (EPIC-06); Playwright smoke/regression user journeys

## Goal

Prove purchase-flow correctness under contention and measure capacity behavior under load, using the real GraphQL purchase boundary, without replacing existing correctness or user-journey test layers.

## Assumptions

- API and PostgreSQL (and Redis for the running app) are available locally or in an equivalent environment before stress runs.
- `purchaseItem` already exists and returns structured outcomes (dependency [#23](https://github.com/rexescario-dev/flash-sale-system/issues/23) closed).
- PostgreSQL remains the source of truth for inventory and purchases.
- Redis is a non-authoritative cache / rate-limit layer only — never the inventory oracle.
- Official k6 binary is installed on the machine that executes `pnpm stress:run` (or provided by CI when a stress job exists).
- Operators start the API with the intended limiter profile env; k6 env vars do not reconfigure the API process.

## Architectural principle

> **EPIC-07 is a validation layer over concurrency guarantees already established in EPIC-06.** Jest remains the primary domain/integration proof harness. Playwright remains the user-journey harness. Stress/k6 proves the same inventory and uniqueness invariants under larger attempt volumes and observes capacity — it does not become the sole correctness authority.

**Dual-oracle corollary:**

> k6 classifies every `purchaseItem` response at the GraphQL boundary. A privileged Prisma verifier asserts persisted invariants after the run. Scenario pass requires both.

**Execution corollary:**

> The seeder may create and clean test state via Prisma/Redis. **k6 must only interact with the public purchase GraphQL API.**

**Redis contract (unchanged):** Redis remains non-authoritative; Postgres decides purchases. Stress tooling clears only stress-scoped keys — never `FLUSHALL` / global flush.

## Core invariants

The stress suite must prove:

| Invariant         | Statement                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Inventory         | `successful purchases <= flash sale stock` (persisted and classified)                                        |
| Stock consistency | `remaining_stock = initial_stock - persisted_purchases`                                                      |
| User uniqueness   | `count(purchases where flash_sale_id, user_id) <= 1` (and `== 1` after a successful `#56` run for that user) |
| Execution         | k6 executes purchases only through GraphQL `purchaseItem`                                                    |

## Locked decisions

| Area                            | Decision                                                                                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Epic shape                      | Approach 1: dual-oracle stress harness under `tests/stress/`                                                                                                                           |
| Child map                       | Follow GitHub ACs for #53–#60 (no renumbering / no `tests/load` path)                                                                                                                  |
| Path                            | `tests/stress/` (k6, seeder, verifier, state, results)                                                                                                                                 |
| k6 runtime                      | Official k6 **binary** (developer/CI install); not vendored; not an npm dependency                                                                                                     |
| Scripts                         | Root `pnpm stress:seed` / `stress:run` / `stress:verify` / `stress:test` wrappers                                                                                                      |
| Workspace package               | No `@flash-sale/stress` in this epic (extract later only if needed)                                                                                                                    |
| Purchase path                   | GraphQL `purchaseItem` only (`flashSaleId`, `userId`)                                                                                                                                  |
| Seeding                         | Privileged Node + Prisma stress seeder; `stress-*` namespace; idempotent per scenario/run                                                                                              |
| State handoff                   | Seeder writes `tests/stress/.state/<scenario>.json`; k6 reads via env                                                                                                                  |
| User ids in state               | Prefix / fixed `#56` userId — **do not** embed 10k user ids in state; generate in k6                                                                                                   |
| Dual oracle                     | k6 response classification + Prisma post-run verifier                                                                                                                                  |
| Classification                  | Business: `SUCCESS` / `SOLD_OUT` / `ALREADY_PURCHASED` (→ duplicate) / `RATE_LIMITED`; transport/HTTP/malformed → unexpected — keep transport failures separate from business statuses |
| Workload meaning                | “1k / 10k users” in ACs = **purchase attempts**, not literal VU count                                                                                                                  |
| Load model                      | Shared-iterations (or equivalent); VU count environment-tunable                                                                                                                        |
| Intensity profiles              | `smoke` (100) / `standard` (1_000) / `full` (10_000) attempts                                                                                                                          |
| Local default                   | `smoke` or `standard`; acceptance proof uses `full`                                                                                                                                    |
| Limiter — correctness (#54–#56) | Raise `RATE_LIMIT_PURCHASE_ITEM_MAX` / window on the **API process**; expect `RATE_LIMITED = 0`                                                                                        |
| Limiter — performance (#57)     | Production-like API limiter settings; `RATE_LIMITED` is a capacity signal                                                                                                              |
| Env split                       | k6 env ≠ API env — limiter knobs are not k6 `--env` overrides of the app                                                                                                               |
| Sold-out                        | Folded into #55 (no new child issue)                                                                                                                                                   |
| #54 role                        | Baseline concurrent purchase load — not the oversell proof                                                                                                                             |
| #55 role                        | Limited inventory / oversell; primary invariant is no extra purchase rows after exhaustion                                                                                             |
| #56 role                        | Same `userId`, N attempts (`full` = 10k) → ≤1 success / exactly one DB row                                                                                                             |
| #57 role                        | Observation-first capacity/latency; still preserve correctness invariants; not an arbitrary latency fail gate                                                                          |
| Metrics (#58)                   | Standard counters + latency percentiles + artifact metadata                                                                                                                            |
| Bottlenecks (#59)               | Local-run evidence only; no invented numbers                                                                                                                                           |
| Results docs (#60)              | Scenarios, expected vs actual, environment limits, reproduce commands                                                                                                                  |
| CI                              | No **full-scale** k6 on every PR; stress not a required PR gate this epic; optional later smoke/scheduled jobs                                                                         |
| Out of epic                     | Admin create-sale GraphQL for seeding; Dockerized k6 as primary DX; inventing results; thin README/#71 expansion (docs epic); reopening #134 CSS AC                                    |

## Child map

| Issue | Role                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------- |
| #53   | Harness foundation: layout, GraphQL helpers, configuration, stress seed/state handoff, execution wrappers |
| #54   | Baseline concurrent purchase load                                                                         |
| #55   | Limited inventory correctness: `SUCCESS ≤ stock`, no oversell, sold-out behavior                          |
| #56   | Same-user race: ≤1 success under repeated purchase attempts                                               |
| #57   | High-volume throughput and latency using production-like limiter settings                                 |
| #58   | Metrics schema and reporting                                                                              |
| #59   | Bottleneck analysis using local-run evidence                                                              |
| #60   | Results documentation: scenarios, expected vs actual, environment limits                                  |

## Scope and boundaries

### In scope (#53–#60)

- k6 project under `tests/stress/`
- GraphQL client helpers targeting `purchaseItem`
- Dedicated privileged Prisma stress seeder + dual oracle (k6 response classification + Prisma post-run verification)
- Intensity and limiter profiles
- Scenarios #54–#57 per GitHub ACs
- Metrics artifacts, bottleneck analysis, results documentation
- Cross-cutting CI stance (documented; optional scheduled workflow)

### Out of scope

- Authentication / authorization product work
- Public admin mutations solely to support seeding
- Vendoring k6 or adding a stress workspace package
- Full-scale k6 workloads on every PR
- Replacing Jest concurrency suites or Playwright E2E
- Fabricated stress results or bottleneck claims without runs
- EPIC-08 README/#71 thin-runbook work (beyond what #60 needs as the stress results hub)
- Reopening #134 CSS AC

## Directory layout

```text
tests/stress/
  README.md
  k6/
    scenarios/
      purchase-load.js      # #54
      oversell.js           # #55
      duplicate-race.js     # #56
      high-volume.js        # #57
    helpers/
      graphql.js
      classify.js
      metrics.js
      state.js
      profiles.js
    config/
      correctness.env.example
      performance.env.example
  seeder/
    seed-stress.ts
    reset-stress.ts
  verifier/
    verify-stress.ts
  .state/                   # gitignored
  results/                  # gitignored
```

`#53` lands layout, helpers, seed/state, wrappers; scenario scripts may be minimal until `#54`–`#57`.

## Tooling ownership

| Component              | Owner                      |
| ---------------------- | -------------------------- |
| k6 scenarios / helpers | Repository                 |
| k6 binary              | Developer / CI environment |
| Seeder / verifier      | pnpm + Node + Prisma       |
| Purchase execution     | GraphQL only               |
| Limiter configuration  | API process environment    |

Example script surface:

```json
{
  "scripts": {
    "stress:seed": "...",
    "stress:run": "k6 run ...",
    "stress:verify": "...",
    "stress:test": "pnpm stress:seed && pnpm stress:run && pnpm stress:verify"
  }
}
```

**Exit codes:** `pnpm stress:test` (and the composed seed → run → verify path) exits non-zero if k6 execution fails or the verifier reports invariant violations. Individual `stress:seed` / `stress:run` / `stress:verify` likewise exit non-zero on their own failures so CI and local automation can rely on shell status.

## Runtime state schema

Canonical file: `tests/stress/.state/<scenario>.json` (gitignored). Seeder writes; k6 and verifier read.

```json
{
  "scenario": "oversell",
  "runId": "20260731-123456",
  "flashSaleId": "stress-sale-oversell-20260731-123456",
  "productId": "stress-product-oversell-20260731-123456",
  "stock": 100,
  "userIdPrefix": "stress-user-oversell",
  "fixedUserId": null
}
```

| Field                       | Notes                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `scenario`                  | One of `purchase-load` \| `oversell` \| `duplicate-race` \| `high-volume` (plus harness names if needed for #53) |
| `runId`                     | Opaque run identifier for isolation / idempotent reset                                                           |
| `flashSaleId` / `productId` | `stress-*` namespace                                                                                             |
| `stock`                     | Initial `totalStock` / `remainingStock` planted for the sale                                                     |
| `userIdPrefix`              | k6 generates distinct ids as `{prefix}-{iteration}`                                                              |
| `fixedUserId`               | Set for `#56` (same-user race); otherwise `null`                                                                 |

Do **not** embed large user id arrays in state.

## Artifact naming

Under `tests/stress/results/` (gitignored), use a per-scenario directory:

```text
results/
  <scenario>-<profile>/
    k6-summary.json
    verifier.json
    report.md
```

Example: `results/oversell-full/k6-summary.json`. Every JSON artifact includes the metrics metadata block (`scenario`, `profile`, `limiterProfile`, `startedAt`, `environment`). `#58` may harden fields; `#53` establishes the directory and filename contract.

## GraphQL client strategy

- Endpoint: `GRAPHQL_URL` (default `http://localhost:3000/graphql`).
- Helper: `graphqlRequest({ query, variables })` posts and parses the body.
- Shared `PURCHASE_ITEM` mutation; no embedded GraphQL strings scattered without a helper.
- Map `data.purchaseItem.status` and `errors[].extensions.code === 'RATE_LIMITED'` consistently with existing integration classification patterns.
- **Transport failures** (network error, non-success HTTP, malformed body) are counted as unexpected / transport failure — never silently folded into `SOLD_OUT` / `ALREADY_PURCHASED`.

## Seeder strategy

- Node + Prisma; isolated `stress-*` ids (`stress-sale-{scenario}-…`, `stress-product-…`).
- Lifecycle: reset stress-owned namespace for the scenario/run → create product + ACTIVE flash sale with known stock → clear **scoped** Redis keys for that sale → write state JSON.
- **Idempotent** for the same scenario/run namespace (re-seed must not leave duplicate fixtures).
- State includes at least: `scenario`, `runId`, `flashSaleId`, `productId`, `stock`, `userIdPrefix` and/or fixed `userId` for `#56`.
- May follow API test factory patterns; must not take ownership of E2E seed prefixes or require Playwright.

## Verifier strategy

After k6:

- The verifier compares persisted purchase rows against the successful purchase counter emitted by the k6 summary (when the summary is present).
- `purchase_count <= initial_stock`.
- `remaining_stock == initial_stock - purchase_count`.
- For all scenarios: **no duplicate** `(flashSaleId, userId)` rows (duplicate purchase rows = 0 beyond the uniqueness invariant).
- For `#56`: `count(flashSaleId, userId) == 1`.
- Fail closed on mismatch.

Pass/fail ownership:

| Concern                                     | Owner           |
| ------------------------------------------- | --------------- |
| Request behavior / latency / classification | k6              |
| Persisted correctness                       | Prisma verifier |
| Final scenario result                       | Combined report |

## Intensity profiles

| Profile    | Attempts (default) | Purpose            |
| ---------- | ------------------ | ------------------ |
| `smoke`    | 100                | Developer feedback |
| `standard` | 1_000              | Normal validation  |
| `full`     | 10_000             | Acceptance proof   |

VU count is **execution-environment tunable**. Correctness semantics remain attempt-based.

## Limiter profiles

| Profile     | Used by | API configuration                                                    |
| ----------- | ------- | -------------------------------------------------------------------- |
| correctness | #54–#56 | Raised `RATE_LIMIT_PURCHASE_ITEM_MAX` / window so `RATE_LIMITED = 0` |
| performance | #57     | Production-like defaults (see `.env.example`)                        |

Document API prerequisites in `tests/stress/k6/config/*.env.example`. k6 does not change application limiter settings via its own env alone.

## Scenario definitions (#54–#57)

Shared pipeline: `seed → k6 purchaseItem → verify`.

### #54 — Concurrent purchase load (`purchase-load.js`)

**Question:** Does the purchase flow survive normal concurrent buyers?

**Seed:** ACTIVE sale with comfortable stock (not an oversell case); distinct user ids.

**k6 (correctness limiter):** Mostly `SUCCESS`; `RATE_LIMITED = 0`; unexpected/transport = 0.

**Verifier:** Purchase rows match successful responses; remaining stock identity holds; no duplicate `(flashSaleId, userId)` rows; no unexpected inventory mutation.

Oversell proof remains `#55`.

### #55 — Limited inventory / oversell (`oversell.js`)

**Question:** Can attempts ≫ stock create purchases beyond stock?

**Seed:** Constrained stock (e.g. 100); distinct users; `standard` = 1k attempts, `full` = 10k.

**k6 (correctness limiter):**

- `SUCCESS <= stock`
- `RATE_LIMITED = 0`
- Unexpected/transport = 0
- Business rejections after depletion are classified and reported (exact `SOLD_OUT` count is **not** the primary pass criterion)

**Verifier:** `purchase_count <= stock`; stock identity; persisted purchases match k6 successful-purchase counter when summary present; no duplicate rows; no extra rows after exhaustion.

### #56 — Same-user race (`duplicate-race.js`)

**Question:** Can one user obtain more than one purchase under concurrency?

**Seed:** ACTIVE sale with stock ≥ 1; **one** fixed `userId`; `full` = 10k attempts.

**k6 (correctness limiter):** `SUCCESS = 1`; remainder classified as already-purchased/duplicate; `RATE_LIMITED = 0`; unexpected = 0.

**Verifier:** Exactly one purchase row for `(flashSaleId, userId)`; stock decremented by 1.

### #57 — High-volume performance (`high-volume.js`)

**Question:** How does the system behave under extreme traffic?

**#57 is not primarily a correctness gate;** it measures system behavior under load while preserving the correctness invariants. It must not fail solely because latency crossed an arbitrary threshold unless an explicit, documented threshold is later adopted.

**Seed:** Dedicated sale; API on **performance** limiter profile.

**k6:** Record RPS, p50/p95/p99, outcome mix **including** `RATE_LIMITED`.

**Verifier:** Inventory and uniqueness invariants still hold.

## Metrics and artifacts (#58)

Counters: success, sold_out, duplicate, rate_limited, unexpected (transport/HTTP/malformed).

Performance: request rate; p50/p95/p99 latency.

Every artifact includes metadata:

```json
{
  "scenario": "oversell",
  "profile": "full",
  "limiterProfile": "correctness",
  "startedAt": "...",
  "environment": "local"
}
```

Write under `tests/stress/results/<scenario>-<profile>/` per [Artifact naming](#artifact-naming). `#58` hardens the schema across scenarios; helpers may appear from `#53`/`#54`.

## Bottleneck analysis (#59)

- Based on local (or designated runner) evidence from real runs — especially `#57` / `full`.
- Identify constraints (API, Postgres, Redis, rate limiter, connection pool, machine limits) with pointers into result artifacts.
- No invented metrics.

## Results documentation (#60)

Canonical hub (preferred: `docs/stress-testing.md`, linked thinly from `tests/stress/README.md`):

- Scenario matrix (purpose, intensity profile, limiter profile)
- Expected vs actual from real runs
- Environment limitations
- Reproduce commands (`pnpm stress:*`)
- Reproducibility criterion: documented commands recreate the same seed → run → verify loop

EPIC-08 `#71` may later thin-link from README/testing strategy; `#60` owns the stress results narrative for this epic.

## CI stance

| Lane               | Policy                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| PR CI              | No full-scale k6 by default; stress **not** a required PR gate in this epic                                  |
| Local              | Primary execution lane (`smoke` / `standard` / `full`)                                                       |
| Scheduled / manual | Optional workflow installing k6 + stack for `standard`/`full` — nice-to-have, not a substitute for child ACs |

A tiny optional PR `smoke` stress job may be considered later; it is not required to close EPIC-07.

## Control flow

```text
pnpm stress:seed   →  Postgres (+ scoped Redis cleanup)  →  .state/<scenario>.json
pnpm stress:run    →  k6 → GraphQL purchaseItem          →  results/*.json
pnpm stress:verify →  Prisma (+ k6 summary)              →  PASS / FAIL
```

```text
Seeder --Prisma--> Database
                      ^
k6 ----GraphQL----> API ----transaction----┘
                      |
Verifier --Prisma--> Database (+ results metadata)
```

## Dependency / delivery order

```text
#53 → #54 → #55 → #56 → #57 → #58 → #59 → #60
```

After this epic design is approved, generate child implementation plans in that order (EPIC-06 pattern), starting with `#53`.

## Epic success criteria mapping

| Epic criterion                                                     | Covered by     |
| ------------------------------------------------------------------ | -------------- |
| k6 scenarios for limited inventory and same-user concurrency exist | #55, #56       |
| Successful purchases never exceed stock                            | #55 + verifier |
| Per-user purchases never exceed one                                | #56 + verifier |
| Results and bottlenecks are documented                             | #59, #60       |
| Stress runs are reproducible from documented commands              | #53 + #60      |

## Relationship to other docs / epics

- [Testing strategy](../../testing-strategy.md) — stress remains planned until harness lands; update when `#60`/`#71` wire discoverability (do not invent results early).
- [Concurrency model](../../concurrency-model.md) — invariants under test; unchanged by stress tooling.
- EPIC-08 `#71` — k6 runbook/README discoverability after EPIC-07 artifacts exist.
- EPIC-08 `#74` — release readiness waits on stress evidence from this epic.

## Spec self-review checklist

1. No TBD placeholders for locked decisions.
2. Child map matches GitHub #53–#60 ACs.
3. Path is `tests/stress/`, not `tests/load/`.
4. Dual oracle and GraphQL-only execution are explicit.
5. 1k/10k means attempts; profiles named.
6. Limiter split correctness vs performance; API vs k6 env split.
7. CI: no full-scale required PR gate.
8. No fabricated results required before runs.
9. Delivery order `#53`→`#60` clear for writing-plans.
