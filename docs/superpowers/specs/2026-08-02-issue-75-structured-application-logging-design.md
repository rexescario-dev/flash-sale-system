# #75 — Add structured application logging (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-08-02
**Issue:** [#75](https://github.com/rexescario-dev/flash-sale-system/issues/75) — Add structured application logging
**Epic:** [#89](https://github.com/rexescario-dev/flash-sale-system/issues/89) (EPIC-09 — Observability & Operational Readiness)
**Sibling issues:** [#76](https://github.com/rexescario-dev/flash-sale-system/issues/76) (correlation IDs — depends on #75), [#80](https://github.com/rexescario-dev/flash-sale-system/issues/80) (metrics — depends on #75), [#77](https://github.com/rexescario-dev/flash-sale-system/issues/77)/[#78](https://github.com/rexescario-dev/flash-sale-system/issues/78)/[#79](https://github.com/rexescario-dev/flash-sale-system/issues/79) (health track — shipped; frozen)
**Depends on:** [#2](https://github.com/rexescario-dev/flash-sale-system/issues/2) (existing Nest API)
**Repository:** `rexescario-dev/flash-sale-system`
**Frozen context (do not reopen):** [`2026-08-01-issue-77-health-check-endpoint-design.md`](./2026-08-01-issue-77-health-check-endpoint-design.md), [`2026-08-01-issue-78-database-health-check-design.md`](./2026-08-01-issue-78-database-health-check-design.md), [`2026-08-01-issue-79-redis-health-check-design.md`](./2026-08-01-issue-79-redis-health-check-design.md)

## Goal

Establish an application logging **contract** (thin `AppLogger` wrapper + dotted `event` taxonomy) and emit structured events on GraphQL request lifecycle and key purchase paths, without introducing a new logging backend, redesigning `/health`, or migrating existing Redis fail-open logs.

## Acceptance criteria

GitHub AC: **Structured logs are emitted for key request/purchase paths.**

Satisfied when:

1. An injectable `AppLogger` exposes `info|warn|error|debug(event, fields?)` and always emits a structured payload `{ ...fields, event }` through the Nest `Logger` backend (`event` cannot be overridden by `fields`).
2. New application events use the dotted taxonomy (`graphql.request.*`, `purchase.*`) via shared `LogEvent` constants (no free-form success messages).
3. An Apollo GraphQL logging plugin emits `graphql.request.completed` or `graphql.request.failed` for GraphQL operations that begin execution, with `operationName`, `operationType`, and `durationMs`. Requests that fail during parsing or validation before execution emit no `graphql.request.*` event.
4. `PurchaseResolver` emits purchase domain events for `purchaseItem` outcomes and lightweight `purchase.query.completed` for `myPurchase` / `myPurchases`.
5. `PurchaseFlowService` emits no logs.
6. Expected business outcomes always emit `graphql.request.completed` and never emit `graphql.request.failed` or `purchase.failed`.
7. Existing Redis fail-open structured logs remain unchanged (legacy snake_case `event` values).
8. `GET /health` and `GET /health/ready` contracts are unchanged; no health logging redesign.
9. No pino/winston/`nestjs-pino`; no correlation IDs (#76); no metrics exporters (#80).

## Approach

**Thin `AppLogger` + Apollo plugin + resolver-owned domain events (Approach 1):**

| Unit                   | Role                                                |
| ---------------------- | --------------------------------------------------- |
| `AppLogger`            | Logging contract and Nest backend abstraction       |
| `LogEvent` constants   | Dotted event name taxonomy for new application logs |
| `GraphqlLoggingPlugin` | GraphQL request lifecycle envelope events           |
| `PurchaseResolver`     | Purchase/read domain event emission                 |
| `PurchaseFlowService`  | Purchase business logic only (no observability)     |
| Redis / Health         | Unchanged                                           |

**Rejected alternatives:**

| Alternative                                       | Why rejected                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Raw Nest `Logger` at every callsite (no wrapper)  | Event shape drifts; weaker foundation for #76/#80                                                 |
| Introduce pino / nestjs-pino in #75               | Backend swap is larger than AC; defer to a dedicated logging-backend issue                        |
| Nest GraphQL interceptor for envelope             | Weaker operation lifecycle/error hooks vs Apollo plugin; #76 naturally wants plugin/`req` context |
| Emit purchase outcomes from `PurchaseFlowService` | Splits logging ownership across resolver (rate-limit/attempted) and service (outcomes)            |
| Migrate Redis snake_case events in #75            | Mixes introducing the contract with renaming an existing taxonomy; dedicated future cleanup       |
| Log every resolver/service/repository step        | Noise; duplicates envelope + domain signals                                                       |

## Locked decisions

| Area                     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approach                 | Approach 1: `AppLogger` + Apollo plugin + resolver-owned purchase events                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Call-site API            | Event string + fields: `logger.info(event, fields?)` (also `warn` / `error` / `debug`); object-first and dual overloads rejected                                                                                                                                                                                                                                                                                                                                                             |
| Backend                  | Nest `Logger` backend today; wrapper isolates a future pino swap                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `error` signature        | `error(event, fields?, err?)` → `{ ...fields, event, error: string }` when `err` present; **no stack** in structured payload                                                                                                                                                                                                                                                                                                                                                                 |
| Event constants          | Shared `LogEvent` constants; prefer constants over string literals at callsites                                                                                                                                                                                                                                                                                                                                                                                                              |
| Event name stability     | Event names are stable identifiers for future correlation (#76) and metrics (#80); renaming requires an intentional migration                                                                                                                                                                                                                                                                                                                                                                |
| Naming rules             | lowercase, dot-separated, past-tense outcomes, `domain.outcome` / noun.verb                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `fields` values          | MUST be JSON-serializable (no `req`/`res`/Prisma clients/circular graphs)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| GraphQL envelope         | `graphql.request.completed` \| `graphql.request.failed` only                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Envelope semantics       | `completed` = GraphQL operation completed without unexpected failure (domain outcome irrelevant); `failed` = unexpected execution failure                                                                                                                                                                                                                                                                                                                                                    |
| Expected GraphQL errors  | If execution began and the response only contains expected GraphQL error codes from the existing public contract (`RATE_LIMITED`, `BAD_USER_INPUT`, `NOT_FOUND`), emit `graphql.request.completed`. Emit `graphql.request.failed` for unexpected failures (e.g. `INTERNAL_SERVER_ERROR` or unclassified thrown errors). This preserves AC semantics when expected outcomes are currently expressed as thrown GraphQL errors (notably `purchase.rate_limited` via `GraphqlRateLimitedError`). |
| Parse/validation         | If GraphQL execution never begins (parse or validation failure before operation execution), **no** `graphql.request.*` event is emitted                                                                                                                                                                                                                                                                                                                                                      |
| Purchase mutation events | `purchase.attempted`, `purchase.completed`, `purchase.duplicate`, `purchase.sold_out`, `purchase.sale_not_started`, `purchase.sale_ended`, `purchase.rate_limited`, `purchase.failed`                                                                                                                                                                                                                                                                                                        |
| Purchase read events     | `purchase.query.completed` for `myPurchase` / `myPurchases`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `purchase.failed`        | Unexpected errors only; **mutually exclusive** with all expected `purchase.*` outcome events                                                                                                                                                                                                                                                                                                                                                                                                 |
| Complementary streams    | A successful GraphQL purchase emits a GraphQL request envelope event **and** exactly one purchase outcome event (plus `purchase.attempted` when applicable); relative ordering is an implementation detail and must not be relied upon by consumers                                                                                                                                                                                                                                          |
| `durationMs`             | Elapsed wall-clock time **within the emitting component** (plugin ≈ full GraphQL execution; resolver ≈ that purchase/query path)                                                                                                                                                                                                                                                                                                                                                             |
| Purchase query fields    | `userId`, `resultCount?`, `durationMs` — **no** `operationName` (envelope owns request metadata)                                                                                                                                                                                                                                                                                                                                                                                             |
| Purchase attempt timing  | Immediately before purchase processing begins (exact placement vs validation/rate-limit is an implementation detail)                                                                                                                                                                                                                                                                                                                                                                         |
| Redis logs               | Legacy; leave unchanged for backward compatibility; may migrate + rename in a future dedicated refactoring                                                                                                                                                                                                                                                                                                                                                                                   |
| Health                   | Frozen; do not redesign `/health` or `/health/ready`; do not add health logging in this issue                                                                                                                                                                                                                                                                                                                                                                                                |
| Config                   | No `LOG_LEVEL` in #75                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Out of slice             | pino; Redis taxonomy migration; correlation IDs (#76); metrics (#80); EPIC-07 k6 results invention; `#134` CSS AC                                                                                                                                                                                                                                                                                                                                                                            |

## Logging invariants

1. Every emitted **application** log via `AppLogger` contains an `event` field.
2. All **new** application events use the dotted taxonomy (`graphql.request.*`, `purchase.*`).
3. Expected business outcomes never produce `graphql.request.failed`.
4. `purchase.failed` is only emitted for unexpected failures and is mutually exclusive with expected `purchase.*` outcomes.
5. Redis fail-open logs and health contracts are unchanged by this issue.

## Architecture & ownership

```text
┌─────────────────────────────────────────────────────┐
│ GraphQL (Apollo)                                      │
│  GraphqlLoggingPlugin                                 │
│    → graphql.request.completed | failed               │
│       fields: operationName, operationType, durationMs│
└───────────────────────┬─────────────────────────────┘
                        │
        ┌───────────────▼───────────────┐
        │ PurchaseResolver               │
        │  AppLogger + LogEvent.*        │
        │  purchase.attempted / outcomes │
        │  purchase.query.completed      │
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │ PurchaseFlowService            │
        │  (no logging)                  │
        └───────────────────────────────┘

AppLogger → Nest `Logger` backend with structured `{ ...fields, event }`
Redis / Health → out of scope
```

| Layer                | Owns                                           | Does not own                          |
| -------------------- | ---------------------------------------------- | ------------------------------------- |
| AppLogger            | Logging contract and Nest `Logger` abstraction | Business semantics, request lifecycle |
| GraphqlLoggingPlugin | GraphQL request lifecycle events               | Domain outcomes                       |
| PurchaseResolver     | Purchase/read domain event emission            | Business logic implementation         |
| PurchaseFlowService  | Purchase business logic                        | Observability/logging                 |

## AppLogger contract

```ts
info(event: string, fields?: Record<string, unknown>): void
warn(event: string, fields?: Record<string, unknown>): void
error(event: string, fields?: Record<string, unknown>, err?: unknown): void
debug(event: string, fields?: Record<string, unknown>): void
```

Implementation always produces a structured payload of `{ ...fields, event }` through the Nest `Logger` backend (`event` is applied last so caller fields cannot override it). `fields` MUST be JSON-serializable values (primitives, plain objects/arrays of serializable data — never request/response objects, Prisma clients, or other non-serializable handles).

When `err` is provided to `error`:

```ts
{
  event,
  ...fields,
  error: err instanceof Error ? err.message : String(err), // error: string
}
```

Do not embed stacks in the structured payload. Do not mutate the caller-provided `fields` object.

Call sites use `LogEvent` constants:

```ts
appLogger.info(LogEvent.PURCHASE_COMPLETED, {
  flashSaleId,
  userId,
  durationMs,
  purchaseId,
});
```

## Event taxonomy

### Naming rules

- lowercase
- dot-separated
- past-tense for outcomes
- `domain.outcome` (or noun.verb)

Avoid free-form messages (`"Purchase successful"`).

Event names are treated as **stable identifiers** for future correlation and metrics. Renaming them requires an intentional migration.

### New events (`LogEvent`)

| Constant                    | Value                       |
| --------------------------- | --------------------------- |
| `GRAPHQL_REQUEST_COMPLETED` | `graphql.request.completed` |
| `GRAPHQL_REQUEST_FAILED`    | `graphql.request.failed`    |
| `PURCHASE_ATTEMPTED`        | `purchase.attempted`        |
| `PURCHASE_COMPLETED`        | `purchase.completed`        |
| `PURCHASE_DUPLICATE`        | `purchase.duplicate`        |
| `PURCHASE_SOLD_OUT`         | `purchase.sold_out`         |
| `PURCHASE_SALE_NOT_STARTED` | `purchase.sale_not_started` |
| `PURCHASE_SALE_ENDED`       | `purchase.sale_ended`       |
| `PURCHASE_RATE_LIMITED`     | `purchase.rate_limited`     |
| `PURCHASE_FAILED`           | `purchase.failed`           |
| `PURCHASE_QUERY_COMPLETED`  | `purchase.query.completed`  |

### Legacy Redis events (unchanged)

Existing fail-open logs continue to use snake_case values such as `redis_cache_degraded`, `redis_connection_degraded`, `redis_rate_limit_degraded`, `redis_cache_invalidation_failed`. They are outside #75 scope. A future refactoring may migrate them onto `AppLogger` **and** rename them to dotted form in one intentional change.

## Event emission points

### GraphQL request lifecycle (`GraphqlLoggingPlugin`)

| Situation                                              | Event                       | Fields                                                  |
| ------------------------------------------------------ | --------------------------- | ------------------------------------------------------- |
| Operation execution completes without unexpected throw | `graphql.request.completed` | `operationName`, `operationType`, `durationMs`          |
| Unexpected execution failure / thrown error            | `graphql.request.failed`    | `operationName`, `operationType`, `durationMs`, `error` |
| Parse/validation failure before execution begins       | _(none)_                    | —                                                       |

Expected domain outcomes (e.g. `SOLD_OUT`, `ALREADY_PURCHASED`) still emit `graphql.request.completed`.

### Purchase mutation (`PurchaseResolver.purchaseItem`)

| Moment                                        | Event                         | Typical fields                                                      |
| --------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Immediately before purchase processing begins | `purchase.attempted`          | `flashSaleId`, `userId`                                             |
| Rate limited                                  | `purchase.rate_limited`       | `flashSaleId`, `userId`, `durationMs`                               |
| Expected domain outcome                       | matching `purchase.*` outcome | `flashSaleId`, `userId`, `durationMs` (+ `purchaseId` on completed) |
| Unexpected error                              | `purchase.failed`             | `flashSaleId`, `userId`, `durationMs`, `error`                      |

### Purchase reads (`myPurchase` / `myPurchases`)

| Moment  | Event                      | Fields                                 |
| ------- | -------------------------- | -------------------------------------- |
| Success | `purchase.query.completed` | `userId`, `durationMs`, `resultCount?` |

Do not log every returned entity. Do not include `operationName` on this domain event.

## Error matrix

| Situation                                                           | Domain event(s)                     | Envelope                    |
| ------------------------------------------------------------------- | ----------------------------------- | --------------------------- |
| Expected business outcome (sold out, duplicate, rate limit, window) | matching expected `purchase.*` only | `graphql.request.completed` |
| Unexpected error in purchase path                                   | `purchase.failed`                   | `graphql.request.failed`    |
| Unexpected error outside purchase (e.g. catalog)                    | no `purchase.*`                     | `graphql.request.failed`    |
| Parse/validation failure before execution                           | none                                | none                        |

## Testing

Match existing Nest unit style (`*.spec.ts`, spies, direct construction / `TestingModule` as already used in `apps/api`):

1. **`AppLogger`** — assert structured payload `{ ...fields, event }`; assert `fields.event` cannot override the contract event; assert `error` message extraction; assert no stack field in structured payload; assert caller-provided `fields` are preserved without mutation.
2. **`GraphqlLoggingPlugin`** — completed vs failed paths; required fields; `graphql.request.failed` includes safe `error` and **does not** include a stack in the structured payload; no event when execution never begins (where testable).
3. **`PurchaseResolver`** — spy `AppLogger`; assert correct `LogEvent` + fields per outcome; assert `purchase.failed` is mutually exclusive with expected outcomes; assert `purchase.query.completed` fields exclude `operationName`.
4. No assertions that rename Redis events; no `/health` contract changes.

## Future work

- **#76:** Enrich AppLogger fields with `requestId` (via GraphQL plugin context / request middleware). Do not invent correlation in #75.
- **#80:** Derive metrics from the established event taxonomy without renaming events.
- **Later (optional):** Replace Nest logging backend with pino behind `AppLogger` without changing application callsites.
- **Later (optional):** Migrate Redis fail-open logs onto `AppLogger` and rename to dotted taxonomy in one dedicated change.

## Non-goals

- Redesigning or logging `/health` / `/health/ready`
- Introducing Terminus, OpenTelemetry, or Prometheus clients
- Inventing k6 / stress-test results
- Reopening `#134` CSS acceptance criteria
- Committing to a production log shipper or aggregation platform
