# EPIC-06 Baseline Audit (2026-07-29)

**Branch / HEAD checked:** `epic-06/automated-testing` @ `f73705e` (main + EPIC-04 Redis)  
**Rule:** Satisfied only when existing tests prove the **exact** AC. Related tests alone are not enough.

## Matrix

| Issue / area               | AC (short)                                                       | Evidence (path + test name)                                                                                                                                                                            | Verdict      | Action                   |
| -------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------ |
| #44 Domain status rules    | Unit tests cover UPCOMING/ACTIVE/SOLD_OUT/ENDED                  | `packages/domain/src/flash-sale/flash-sale.spec.ts` → `FlashSale.getStatus` `it.each` table (10 cases covering all four statuses across window/stock boundaries)                                       | **Verified** | Close                    |
| #45 App service outcomes   | Purchase application outcomes unit tested with fakes/mocks       | See [#45 outcome map](#45-outcome-map) — all purchase outcomes + not-found covered in `purchase-flow.service.spec.ts`                                                                                  | **Verified** | Close                    |
| #46 GraphQL purchase paths | Integration covers purchase success and rejection via GraphQL    | `apps/api/test/graphql/graphql-api.integration.spec.ts`: `returns purchaseItem SUCCESS…`; `covers SALE_NOT_STARTED, SALE_ENDED, ALREADY_PURCHASED, and SOLD_OUT…`; missing-sale / BAD_USER_INPUT cases | **Verified** | Close                    |
| Reservation integration    | Atomic reserve / no oversell                                     | `apps/api/test/flash-sale/prisma-flash-sale.reservation.integration.spec.ts` (incl. `does not oversell under concurrent tryReserve`)                                                                   | **Verified** | Reference only           |
| Purchase flow integration  | Flow outcomes vs Postgres                                        | `apps/api/test/purchase/purchase-flow.integration.spec.ts` (SUCCESS, ALREADY_PURCHASED, SALE_*, SOLD_OUT, not-found)                                                                                   | **Verified** | Reference only           |
| Redis integration          | Cache / rate-limit / fail-open                                   | `redis-query-cache.integration.spec.ts`, `purchase-rate-limit.integration.spec.ts`, `redis-client.integration.spec.ts`                                                                                 | **Verified** | Reference only (EPIC-04) |
| #41 / #42                  | Deterministic fixtures + factories                               | Ad-hoc `seedFlashSale` helpers inlined in integration specs only                                                                                                                                       | **Gap**      | Task 1                   |
| #43                        | E2E seeder                                                       | None                                                                                                                                                                                                   | **Gap**      | Task 3                   |
| #47                        | stock=10 × 100 distinct → 10 purchases / 0 remaining via GraphQL | No suite                                                                                                                                                                                               | **Gap**      | Task 2                   |
| #48                        | 100 same-user concurrent → 1 success / 99 already-purchased      | No suite (note: reservation concurrency exists at tryReserve layer only)                                                                                                                               | **Gap**      | Task 2                   |
| #49–#52                    | Playwright real-stack                                            | None                                                                                                                                                                                                   | **Gap**      | Tasks 4–6                |

## #45 outcome map

| Outcome / case       | Evidence                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Not found            | `throws FlashSaleNotFoundError when findById returns null`                                                 |
| `SALE_NOT_STARTED`   | `returns SALE_NOT_STARTED for UPCOMING without opening a transaction`                                      |
| `SALE_ENDED`         | `returns SALE_ENDED for ENDED without opening a transaction`                                               |
| `SOLD_OUT` (pre-txn) | `returns SOLD_OUT from getStatus without opening a transaction`                                            |
| `SOLD_OUT` (in-txn)  | `returns SOLD_OUT when tryReserve returns false inside the transaction`                                    |
| `SUCCESS`            | `returns SUCCESS when reserve and save succeed inside the transaction` (+ PersistenceContext sharing case) |
| `ALREADY_PURCHASED`  | `maps PurchaseConflictError escaping the transaction callback to ALREADY_PURCHASED`                        |

AC satisfied; no delta required.

## #48 duplicate production mapping (Task 0 Step 2b)

| Step | Contract                                                                                                   | Location                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1    | Composite unique `P2002` → `PurchaseConflictError`                                                         | `apps/api/src/purchase/prisma-purchase.repository.ts` (~lines 66–69)                                        |
| 2    | `PurchaseConflictError` → outcome `'ALREADY_PURCHASED'`                                                    | `apps/api/src/purchase/purchase-flow.service.ts` (~lines 69–70)                                             |
| 3    | GraphQL surfaces `purchaseItem.status === 'ALREADY_PURCHASED'` (data path, not `errors[].extensions.code`) | `graphql-api.integration.spec.ts` → `covers SALE_NOT_STARTED, SALE_ENDED, ALREADY_PURCHASED, and SOLD_OUT…` |

**Classifier lock for Task 2:** `ALREADY_PURCHASED` → bucket `DUPLICATE`. No other legitimate duplicate GraphQL surface found.

## Rate-limit config for concurrency suites

| Piece                                                           | Location                                                |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| Parse `RATE_LIMIT_PURCHASE_ITEM_MAX`                            | `apps/api/src/config/env.validation.ts` (`validateEnv`) |
| Wire via Nest `ConfigModule.forRoot({ validate: validateEnv })` | `apps/api/src/app.module.ts`                            |
| Read at limiter runtime from `ConfigService`                    | `apps/api/src/purchase/purchase-item.rate-limiter.ts`   |

**Implication:** Setting `process.env.RATE_LIMIT_PURCHASE_ITEM_MAX='200'` **before** `Test.createTestingModule({ imports: [AppModule] })` affects the suite. Default without override is `30`.

## Baseline quality / integration run

Recorded during Task 0 in worktree `.worktrees/epic-06-automated-testing` with `REDIS_URL=redis://127.0.0.1:6380`.

| Command                                                       | Result                     |
| ------------------------------------------------------------- | -------------------------- |
| `pnpm format:check` / `lint` / `typecheck` / `test` / `build` | Pass                       |
| `pnpm --filter api test:schema`                               | Pass (11)                  |
| `pnpm --filter api test:integration`                          | Pass (8 suites / 39 tests) |

Note: `pnpm --filter api prisma:generate` required once in the fresh worktree before schema/integration Jest could resolve `.prisma/client`.

## Gaps remaining for EPIC-06 implementation

1. Shared fixtures/factories (#41/#42)
2. GraphQL concurrency (#47/#48)
3. E2E seeder (#43) + Playwright (#49–#52) + CI

No satisfied-child rewrites.

## E2E runtime prerequisites (Task 4 validation)

Discovered while bringing up the **built** NestJS process for real-stack Playwright (not E2E-only workarounds):

1. **`@flash-sale/domain` CJS resolution** — Nest emits CommonJS and `require("@flash-sale/domain")`, but the package export map previously exposed only the ESM `import` condition (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Fixed by emitting CommonJS and advertising `require`/`import`/`default` at the package boundary. Jest path mapping was never a substitute for production start.
2. **API CORS** — SPA on `:5173` calling GraphQL on `:3000`/`:3001` is cross-origin. Without `app.enableCors(...)`, the browser reports a network failure (`Could not load sale`). Enabled reflective CORS in `apps/api/src/main.ts` so the real process matches the intended local/E2E topology.
