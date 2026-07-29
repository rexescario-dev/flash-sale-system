# EPIC-06 — Automated Testing (Design Spec)

**Status:** Approved
**Date:** 2026-07-29
**Epic:** [EPIC-06 #86](https://github.com/rexescario-dev/flash-sale-system/issues/86)
**Child issues:** #41–#52
**Repository:** `rexescario-dev/flash-sale-system`
**Depends on:** EPIC-01–05 on `main` (incl. EPIC-04 Redis @ `f73705e`); Postgres + Redis available for integration/E2E

## Goal

Complete remaining automated-test coverage for the flash-sale system: thin shared fixtures/factories, API-level concurrency proofs, deterministic E2E seeding, and real-stack Playwright (smoke + regression) — without rewriting suites that already prove their acceptance criteria on `main`.

## Architectural principle

> **EPIC-06 is additive.** Existing implementations on `main` that demonstrably satisfy an acceptance criterion are treated as pre-existing completed scope. EPIC-06 must verify and reference that coverage, but must not duplicate or rewrite it. Work is limited to unmet or partially met acceptance criteria and the thin test infrastructure required to prove them.

**Layering corollary:**

> **API concurrency (#47–#48)** proves inventory/uniqueness invariants under contention. **Real-stack E2E (#43 + #49–#52)** proves the user-visible journey across web → API → PostgreSQL + Redis. These tracks are complementary and must not collapse into each other. Playwright is never the primary concurrency harness.

**Redis contract (unchanged from EPIC-04):** Redis remains non-authoritative; Postgres decides purchases. Fail-open including startup. Concurrency and E2E suites must not treat Redis as an inventory oracle.

**Seeder ownership:**

> `seedE2E()` may depend on Prisma because it runs inside the trusted test environment, but no production application code or public API depends on it. It is test infrastructure, not an application capability.

## Locked decisions

| Area                         | Decision                                                                                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Epic shape                   | Approach A: additive delta epic (not a new testing framework, not deferring Playwright)                                                                                                                                                                                     |
| Baseline audit               | Required before closing “verified” children; “verified / satisfied” only after AC↔test mapping                                                                                                                                                                              |
| #45 app service units        | Conditional: map each AC to a concrete test; close or implement missing delta only                                                                                                                                                                                          |
| Fixtures/factories placement | `apps/api/test/fixtures/` + `apps/api/test/factories/`                                                                                                                                                                                                                      |
| Fixtures vs factories        | Fixtures = scenario data definitions; factories = Prisma persistence builders                                                                                                                                                                                               |
| Testing package              | No `@flash-sale/testing` in EPIC-06; promote only if real cross-app reuse demands it                                                                                                                                                                                        |
| Factory API                  | Generic builders + fixture presets (`ACTIVE_STOCK_10`, `SOLD_OUT`, …); no business-state factory methods as the primary API                                                                                                                                                 |
| Fixtures/factories DoD       | **Both** concurrency track and E2E seeder consume shared scenario definitions/factories                                                                                                                                                                                     |
| Extraction                   | Demand-driven; do not migrate existing suites merely for consistency                                                                                                                                                                                                        |
| Concurrency entry            | Prefer GraphQL HTTP through real purchase path; proof is transactional concurrency, not GraphQL quirks                                                                                                                                                                      |
| Concurrency fallback         | Direct flow/reservation allowed if transport obscures the proof; domain-only invocation insufficient                                                                                                                                                                        |
| Concurrency isolation        | Unique flash-sale ID per concurrency case (preferred); must not share mutable sale state across cases or parallel Jest workers                                                                                                                                              |
| #48 contention count         | Fixed concurrent duplicate count; exact `N` defined in the implementation plan (`N` sufficient to exercise overlapping transactions; all issued concurrently)                                                                                                               |
| Rate limiting in #47/#48     | Disabled or raised above concurrency count; classify outcomes; `RATE_LIMITED` must be 0                                                                                                                                                                                     |
| Outcome classification       | Classify `SUCCESS` / `SOLD_OUT` / `DUPLICATE` / `RATE_LIMITED` / `UNEXPECTED_ERROR` (and map GraphQL codes onto these buckets)                                                                                                                                              |
| Concurrency harness          | Jest integration + real Postgres; single-process `Promise.all` first; no k6 in EPIC-06                                                                                                                                                                                      |
| Redis in concurrency         | Environmental only; clear scoped keys — never flush shared Redis instance                                                                                                                                                                                                   |
| E2E seeder                   | CLI/process-local + reusable `seedE2E()` under `apps/api/test/e2e/seed/`; Playwright `globalSetup` invokes the same implementation via documented CLI/process entrypoint — not by importing API test modules/Prisma/factories                                               |
| HTTP seed endpoint           | Out of EPIC-06                                                                                                                                                                                                                                                              |
| E2E ID namespace             | Dedicated E2E-owned IDs/prefixes for safe reset                                                                                                                                                                                                                             |
| Seeder Redis                 | Minimal cleanup of stale cache/rate-limit keys; application repopulates caches                                                                                                                                                                                              |
| Lifecycle dependency         | Postgres/Redis → migrate; seed is Prisma-first (independent of API/web); Playwright requires API/web ready then globalSetup (readiness + CLI seed). Canonical seed invoke = Playwright globalSetup; always write repo-root `e2e/seed-state.json` (or `E2E_SEED_STATE_PATH`) |
| Playwright location          | Top-level `e2e/` (system-owned); `apps/web/e2e` only if conventions force it                                                                                                                                                                                                |
| Playwright stack             | Real web → real GraphQL/API → real PostgreSQL + Redis; no MSW as E2E authority                                                                                                                                                                                              |
| Smoke (#52)                  | View ACTIVE sale + successful purchase only                                                                                                                                                                                                                                 |
| Regression (#51)             | + duplicate purchase + sold-out (+ optional controlled error)                                                                                                                                                                                                               |
| E2E assertions               | UI primary oracle; selective network assertions for sync/observable API response only                                                                                                                                                                                       |
| Page objects                 | Thin selectors/actions; no business assertions; no Prisma/Redis                                                                                                                                                                                                             |
| CI                           | Smoke required on every PR. Full regression is **mandatory for every change entering `main`** (pre-merge blocking check **or** protected post-merge gate if runtime prevents practical pre-merge)                                                                           |
| Out of epic                  | AuthN/AuthZ; sale listing; k6/stress (EPIC-07); testing framework package; HTTP seeder; wholesale suite migration                                                                                                                                                           |

## Verification matrix

| AC / area                          | Current state             | Evidence on `main`                                                                                      | EPIC-06 action                                             |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Domain unit specs (#44)            | Verified / satisfied      | `packages/domain/**/*.spec.ts` covering status/product/purchase                                         | Baseline audit → close; no rewrite                         |
| App service unit tests (#45)       | Likely satisfied / verify | `purchase-flow.service.spec.ts`, resolver/cache specs, etc.                                             | Map ACs to tests; close or implement only missing delta    |
| GraphQL integration (#46)          | Verified / satisfied      | `graphql-api.integration.spec.ts` + Redis/rate-limit suites                                             | Baseline audit → close; no rewrite                         |
| Reservation / purchase integration | Verified / satisfied      | Prisma reservation/purchase/flow integration specs                                                      | Baseline audit → reference; no rewrite                     |
| Redis integration                  | Verified / satisfied      | Redis client, query-cache, rate-limit integration                                                       | Verify against EPIC-04 evidence; no rewrite                |
| Fixtures (#41) / factories (#42)   | Gap                       | Ad-hoc setup in integration specs                                                                       | Implement thin shared fixtures/factories                   |
| E2E seeder (#43)                   | Gap                       | None                                                                                                    | Implement deterministic real-stack E2E setup/reset         |
| Concurrency (#47–#48)              | Gap                       | No limited-inventory concurrency proof (stock=10 × 100 distinct users) or duplicate-purchase race proof | Implement API-level concurrency proofs                     |
| Playwright (#49–#52)               | Gap                       | No Playwright suite                                                                                     | Configure real-stack Playwright + page objects + smoke/E2E |

> **“Satisfied” means the baseline audit confirms that the existing tests prove the exact AC; merely having related tests is insufficient. Any partial coverage is treated as a delta and implemented only to the extent required by the AC.**

## Scope and boundaries

### In scope

- Baseline audit of #41–#52 against `main`
- Thin shared fixtures/factories under `apps/api/test/`
- API concurrency suites (#47, #48) via GraphQL HTTP (preferred)
- Deterministic E2E seeder (#43) as test infrastructure under `apps/api/test/e2e/seed/`
- Top-level Playwright suite (#49–#52) against Compose real stack
- CI wiring: PR smoke + mandatory full regression for changes entering `main` (+ optional nightly)

### Out of scope

- Authentication / authorization
- Sale listing / discovery
- k6 / stress / performance (EPIC-07)
- New `@flash-sale/testing` monorepo package
- Test-only HTTP seed endpoint
- Rewriting EPIC-05 Vitest/MSW unit tests into Playwright
- Using Playwright as the concurrency proof harness
- Migrating all existing integration suites onto factories solely for consistency

## §2 — Shared fixtures / factories (#41–#42)

```text
apps/api/test/
  fixtures/     # scenario definitions (IDs, times, stock presets)
  factories/    # Prisma persistence builders
  e2e/seed/     # seedE2E() + CLI wrapper (API-side infrastructure)
```

```text
                    ┌─────────────────────┐
                    │ Scenario definitions│
                    │ IDs / times / stock │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
        API factories                 E2E seeder
        Prisma writes                 (apps/api/test/e2e/seed)
                 │                           │
                 ▼                           │
          API integration                    │ CLI/process
          concurrency tests                  ▼
                                      Top-level e2e/
                                      (globalSetup → pnpm … e2e:seed)
                                             │
                                             ▼
                                      Playwright → real stack
```

**Principles:**

- Placement colocated with API test infrastructure (no premature cross-app package).
- Factories stay generic: `createFlashSale({ startsAt, endsAt, totalStock, remainingStock, … })`.
- Scenario semantics live in fixture presets (`ACTIVE_STOCK_10`, `ACTIVE_STOCK_1`, `SOLD_OUT`, `UPCOMING`, `ENDED`).
  - **`SOLD_OUT`** = already exhausted sale (`remainingStock = 0`).
  - **`ACTIVE_STOCK_1`** = active sale with one available unit; **preferred for testing the transition into sold-out** after a successful purchase. Do not use `SOLD_OUT` to exercise that transition.
- User identity remains string `userId` (no User table).
- #43 may reuse scenario definitions and, where practical, API-side builders. **Playwright / top-level `e2e/` never import Prisma or factories (or other `apps/api/test` modules) directly** — they invoke the seeder via its documented CLI/process entrypoint.
- **DoD: both the concurrency track and the E2E seeder consume the shared scenario definitions/factories.**

## §3 — API concurrency (#47–#48)

### Outcome classification (required)

Every concurrent response is bucketed as exactly one of:

| Bucket             | Meaning                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| `SUCCESS`          | Purchase committed                                                            |
| `SOLD_OUT`         | Inventory exhaustion / sold-out business rejection                            |
| `DUPLICATE`        | Same-user already-purchased rejection (application or DB uniqueness surfaced) |
| `RATE_LIMITED`     | Rate limiter rejected the request — **must be 0** in these suites             |
| `UNEXPECTED_ERROR` | Anything else — **must be 0**                                                 |

### #47 Limited inventory

- 100 concurrent distinct users against stock=10 via GraphQL `purchaseItem`.
- Assert:
  - `SUCCESS === 10`
  - `RATE_LIMITED === 0`
  - `UNEXPECTED_ERROR === 0`
  - `DUPLICATE === 0` (distinct users)
  - remaining stock === 0
  - purchase row count === 10
  - distinct successful `userId`s === 10
- The other 90 responses must be legitimate inventory/business rejection (typically `SOLD_OUT`).

### #48 Duplicate purchase

- `N` concurrent requests with the **same** `userId` (exact `N` set in the implementation plan; must be large enough for overlapping transactions; all issued concurrently).
- Assert:
  - `SUCCESS === 1`
  - `DUPLICATE === N - 1`
  - `RATE_LIMITED === 0`
  - `UNEXPECTED_ERROR === 0`
  - purchase row count for `(flashSaleId, userId) === 1`
  - remaining stock decreased by exactly 1
- **#48 proves both application-level duplicate rejection and the database-level unique `(flash_sale_id, user_id)` invariant under concurrent requests.** The suite need not assert raw Prisma `P2002` if the production path maps it; the resulting row count invariant is mandatory.

### Harness rules

- Jest integration config; real PostgreSQL; Redis present but not inventory authority.
- Preferred entry: GraphQL HTTP → resolver → purchase orchestration → transaction → Postgres.
- Fallback: direct application flow if transport obscures transactional proof.
- Rate-limit config disabled/raised above concurrency count.
- Clear only test-scoped Redis keys (shared `:6379` / multi-project Redis risk).
- Single-process `Promise.all` first; document limitation if multi-process later required.
- **Isolation:** Each concurrency case uses a **unique flash-sale ID** (preferred) or an explicitly isolated DB reset. Cases must not share mutable sale state across concurrent cases or parallel Jest workers.

## §4 — E2E seeder (#43)

**Ownership layout:**

```text
apps/api/test/
  fixtures/
  factories/
  e2e/seed/
    seed.ts          # exported seedE2E() + CLI wrapper
    scenarios.ts

e2e/                 # top-level Playwright (system-owned)
  global-setup.ts    # spawns documented CLI/process (e.g. pnpm … e2e:seed)
  playwright.config.ts
  pages/
  tests/
```

Preferred boundary:

```text
Playwright globalSetup
    ↓
documented CLI/process (pnpm … e2e:seed)
    ↓
seedE2E()
    ↓
Prisma / factories / Redis cleanup
```

**Lifecycle dependency (logical):**

```text
Postgres + Redis healthy
        ↓
migrate
        ├──────────────→ seedE2E()   (Prisma-first; does NOT need API/web)
        ↓
API + web ready
        ↓
Playwright (globalSetup: readiness → seed via CLI → tests)
```

Compose may start services concurrently. Seed does not depend on API/web readiness; Playwright does. Canonical seed invocation is Playwright `globalSetup` (CLI); CI must not duplicate a separate seed step before Playwright.

- No HTTP seed endpoint in EPIC-06.
- Dedicated E2E-owned ID namespaces for safe reset (`e2e-sale-…`, `e2e-user-…`, etc.).
- Seeder owns only data it can positively identify as E2E-owned.
- `seedE2E()` is test infrastructure only: trusted test env may use Prisma; production code/public API must not depend on it.
- Minimal Redis cleanup of stale keys; application repopulates caches.
- Shared `seedE2E()` implementation used by `pnpm e2e:seed` (or equivalent) and by Playwright `globalSetup` **via that CLI/process entrypoint** — not via importing API test modules into the Playwright process.
- **DoD:** One documented command can safely reset E2E-owned state and seed deterministic scenarios; **repeated execution produces equivalent state**; Playwright `globalSetup` invokes the same CLI/process entrypoint; Playwright reaches the seeded sale through the **real web/UI and GraphQL/API path**.

## §5 — Playwright (#49–#52)

```text
e2e/
  playwright.config.ts
  global-setup.ts
  pages/
  tests/
    smoke/
    regression/
```

| Scenario                                 |  #51 E2E | #52 Smoke |
| ---------------------------------------- | -------: | --------: |
| View seeded ACTIVE sale                  |        ✓ |         ✓ |
| Successful purchase                      |        ✓ |         ✓ |
| Duplicate purchase rejected              |        ✓ |  Optional |
| Sold-out UX (`ACTIVE_STOCK_1` preferred) |        ✓ |  Optional |
| Controlled error surfacing               | Optional |        No |

- UI is primary oracle; selective network assertions allowed for sync/response that drives UI.
- No direct Prisma/Redis assertions as primary oracle.
- No MSW as authoritative E2E stack.
- Top-level `e2e/` invokes the API-side seeder via CLI/process; never imports Prisma/factories or other `apps/api/test` modules.

## §6 — Execution order / CI / DoD

### Delivery DAG

```text
0. Baseline audit (planning/verification gate)
   ├── verified coverage → close / no-impl
   └── identify gaps
          │
          ▼
1. #41–#42 thin fixtures/factories
          │
          ├───────────────┐
          ▼               ▼
      #47–#48          #43 Seeder
    Concurrency            │
                          ▼
                       #49 Config
                          │
                          ▼
                       #50 POM
                          │
                       ┌──┴──┐
                       ▼     ▼
                    #51    #52
                  E2E     Smoke
```

Usable E2E track is gated by the seeder contract. #49 config may start early, but green E2E needs #43.

### CI policy

| Job                             |                    PR | Main / change entering `main` | Purpose                            |
| ------------------------------- | --------------------: | ----------------------------: | ---------------------------------- |
| Unit / lint / typecheck / build |                     ✓ |                             ✓ | Fast baseline                      |
| Integration + concurrency       |                     ✓ |                             ✓ | Persistence/concurrency invariants |
| E2E smoke                       |                     ✓ |                             ✓ | Critical real-stack path           |
| E2E full regression             | Optional if expensive |                             ✓ | Complete user-journey contract     |
| Nightly full E2E                |                     — |                Optional extra | Stability / flake signal           |

> Smoke is a required PR check. **Full E2E regression is mandatory for every change entering `main`**; it may run as a pre-merge blocking check **or** as a protected post-merge gate if runtime prevents practical pre-merge execution. Failures must be visible and actionable — never silent/advisory.

### Epic definition of done

1. Baseline audit completed; matrix filled with evidence; verified children closed or marked no-impl with justification.
2. Thin fixtures/factories landed; consumed by concurrency **and** seeder.
3. #47/#48 green with classified outcomes (`RATE_LIMITED === 0`, `UNEXPECTED_ERROR === 0`); #48 asserts `SUCCESS === 1`, `DUPLICATE === N - 1`, and row-count uniqueness.
4. Documented reproducible `e2e:seed` (or equivalent); Playwright `globalSetup` invokes the same CLI/process; repeated runs produce equivalent E2E-owned state.
5. Playwright smoke + full regression green on real stack; smoke on PR; full mandatory for changes entering `main`.
6. Redis remains non-authoritative; no AuthN / listing / k6 scope creep; seeder remains test-only infrastructure.
7. Design spec + implementation plan committed; delivery via design → plan → worktree → PR.

## Child-issue treatment summary

| Issues                                                  | Treatment                         |
| ------------------------------------------------------- | --------------------------------- |
| #44, #46 (+ reservation/purchase/Redis evidence layers) | Baseline audit → verified / close |
| #45                                                     | Conditional AC↔test map           |
| #41–#42                                                 | Implement thin infra              |
| #47–#48                                                 | Implement concurrency             |
| #43, #49–#52                                            | Implement seeder + Playwright     |

## Open items for the implementation plan (not blocking this design)

- Exact npm script names and Compose service profile for E2E CI.
- Exact `#48` contention count `N` (must be sufficient for overlapping transactions).
- Pre-merge vs protected post-merge topology for full E2E, based on measured runtime.
- Whether sold-out regression seeds `ACTIVE_STOCK_1` then purchases once, or uses a pre-sold-out fixture for a second browser session.
- Precise Jest file names / tags for concurrency suites.
  )
