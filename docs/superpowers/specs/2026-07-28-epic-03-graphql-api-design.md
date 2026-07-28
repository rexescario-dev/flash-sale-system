# EPIC-03 — GraphQL API (Design Spec)

**Status:** Draft (umbrella contract — approved; pending commit)
**Date:** 2026-07-28
**Epic:** [EPIC-03 #83](https://github.com/rexescario-dev/flash-sale-system/issues/83)
**Next implementation ticket:** [#21 — Implement flash sale status query](https://github.com/rexescario-dev/flash-sale-system/issues/21)
**Child issues:** #21–#26
**Repository:** `rexescario-dev/flash-sale-system`
**Depends on:** EPIC-01 GraphQL scaffolding (#6), EPIC-02 domain & persistence (#11–#20) merged to `main` (baseline `c0055df+`)

## Goal

Expose a small, typed NestJS GraphQL API for flash-sale status, user purchase lookup, and purchase orchestration — with GraphQL-specific DTOs, a hybrid result/error model, input validation, and GraphQL ↔ PostgreSQL contract/integration coverage.

## Architectural principle

> GraphQL is a delivery edge over existing domain ports. Resolvers map arguments and DTOs; they do not own business rules, persistence, or purchase orchestration.

Keep `@flash-sale/domain` free of Nest/GraphQL types. Keep all domain port implementations in `apps/api`; GraphQL resolvers consume ports and do not implement them. Application-side `PurchaseFlowService` orchestrates domain ports; Prisma repositories/reservation adapters are infrastructure adapters. Do not introduce GraphQL-specific port implementations, a generic GraphQL framework, BaseResolver, CQRS query layer, or Product API surface in this epic.

## Locked decisions

| Area                        | Decision                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                       | Three operations only: `flashSale`, `myPurchase`, `purchaseItem`                                                                                                                                              |
| Product API                 | **Out** — no Product query, nested Product type, or `productId` field                                                                                                                                         |
| Identity                    | Caller-supplied `userId: ID!` on `myPurchase` / `purchaseItem`; **no authentication or authorization guarantee**                                                                                              |
| Auth migration path         | Future auth epic replaces only how `UserId` is extracted at the GraphQL edge; domain ports stay unchanged                                                                                                     |
| Layering                    | Thin feature-owned resolvers in `FlashSaleModule` / `PurchaseModule`; inject domain tokens directly                                                                                                           |
| Dependency direction        | Resolver → domain port → `apps/api` implementation (application-side `PurchaseFlowService` and/or infrastructure Prisma adapters). Resolver never calls Prisma and never reimplements `PurchaseFlow`          |
| Purchase orchestration      | `purchaseItem` calls `PURCHASE_FLOW` only; `#20` semantics unchanged                                                                                                                                          |
| `purchaseId`                | API/application edge generates a new `PurchaseId` before `PurchaseFlow.execute` (resolver need not own the UUID mechanism); returned only on `SUCCESS`; **not** an idempotency key                            |
| Clock                       | Injectable authoritative UTC clock shared by `flashSale` (`getStatus`) and `purchaseItem` (`PurchaseFlow.execute.nowUtc` — already part of the #20 port); no client-supplied `now`; no GraphQL `nowUtc` field |
| Result model                | Hybrid: five `PurchaseOutcome` values in `PurchaseItemResult!`; missing sale / validation / unexpected → GraphQL errors                                                                                       |
| Public error codes          | Exactly three: `NOT_FOUND`, `BAD_USER_INPUT`, `INTERNAL_SERVER_ERROR`                                                                                                                                         |
| Missing FlashSale           | All three ops: normalize to `FlashSaleNotFoundError` → `extensions.code = NOT_FOUND`                                                                                                                          |
| `myPurchase` negative state | Existing sale + no purchase → `purchased: false` (not an error)                                                                                                                                               |
| Validation                  | Reject empty / whitespace-only IDs; **no silent trim/normalize**; GraphQL non-null handles missing/null args                                                                                                  |
| Shared edge                 | Minimal filter/mapper + ID validation helpers only; #24/#25 own and complete/harden those concerns                                                                                                            |
| Implementation strategy     | Approach 1: umbrella contract → shared edge foundations early → #21 → #22 → #23 → #24/#25 complete/harden → #26                                                                                               |
| Testing                     | Unit (mocked ports) per feature; #26 splits real-Postgres persistence integration vs controlled-error mapping (same `test:integration` Postgres conventions)                                                  |
| Out of epic                 | Redis, rate limits, dataloader framework, browser E2E, concurrent purchase storm (stays #19/#20), schema-only tests                                                                                           |

## Dependency direction

```text
flashSale
  Resolver → FLASH_SALE_REPOSITORY → PrismaFlashSaleRepository → PostgreSQL

myPurchase
  Resolver
    → FLASH_SALE_REPOSITORY.findById
         ├── null → FlashSaleNotFoundError
         └── found
              → PURCHASE_REPOSITORY.findByFlashSaleAndUser
                   ├── found → purchased: true
                   └── null  → purchased: false

purchaseItem
  Resolver
    → API/application edge: generate PurchaseId
    → PURCHASE_FLOW.execute({ flashSaleId, userId, purchaseId, nowUtc })
         → Application-side: PurchaseFlowService
              ├── FlashSaleRepository (pre-txn)
              ├── FlashSaleReservation (in txn)
              └── PurchaseRepository (in txn)
                   └── Infrastructure: Prisma adapters
```

Invariant: **the resolver never reaches Prisma directly and never reimplements PurchaseFlow orchestration.** GraphQL resolvers consume domain ports; they do not implement them.

Suggested layout (illustrative):

```text
apps/api/src/
  flash-sale/
    flash-sale.module.ts
    flash-sale.resolver.ts
    graphql/
      flash-sale.object-type.ts
      flash-sale-status.enum.ts
  purchase/
    purchase.module.ts
    purchase.resolver.ts
    graphql/
      my-purchase-result.object-type.ts
      purchase-item-result.object-type.ts
      purchase-outcome.enum.ts
  graphql/   # optional shared edge helpers (#24 / #25)
    graphql-exception.filter.ts   # or equivalent formatError wiring
    id-validation.ts
    clock.ts                      # injectable Clock / UtcClock
    purchase-id.ts                # optional thin PurchaseId generator helper
```

---

## Section 1 — Architecture & boundaries

### In scope

- Nest code-first GraphQL DTOs/enums under `apps/api`
- Thin resolvers owned by feature modules
- Minimal shared GraphQL edge utilities (error mapping + ID validation)
- Injectable authoritative UTC clock (for `flashSale` status and for `#20` `PurchaseFlow.execute.nowUtc`)
- API/application-edge generation of `PurchaseId` for `purchaseItem`
- Caller-supplied `userId: ID!` for `myPurchase` and `purchaseItem` with **no authentication guarantee**

### Out of scope

- Product query / nested Product / exposing `productId`
- AuthN/AuthZ
- Idempotency keys / client-supplied `purchaseId`
- Redis, rate limits, N+1 dataloader framework
- Generic BaseResolver / use-case executor / CQRS wrappers
- Changing `PurchaseFlow` orchestration semantics
- Domain package importing Nest/GraphQL

### Ticket ownership

| Ticket | Owns                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------- |
| #21    | `flashSale` query                                                                                       |
| #22    | `myPurchase` query                                                                                      |
| #23    | `purchaseItem` mutation                                                                                 |
| #24    | Error semantics + shared error mapping (foundations may land early; ticket completes/hardens)           |
| #25    | Validation semantics + shared validation helpers (foundations may land early; ticket completes/hardens) |
| #26    | GraphQL ↔ PostgreSQL contract/integration tests                                                         |

---

## Section 2 — Schema & operations

### Identity

```text
userId: ID!  →  opaque domain UserId
```

Documented as **caller-supplied user identity**. EPIC-03 provides no authentication or authorization guarantees. A future auth epic may replace the source of `UserId` at the API boundary without changing domain ports.

### Schema

```graphql
enum FlashSaleStatus {
  UPCOMING
  ACTIVE
  SOLD_OUT
  ENDED
}

enum PurchaseOutcome {
  SUCCESS
  ALREADY_PURCHASED
  SALE_NOT_STARTED
  SALE_ENDED
  SOLD_OUT
}

type FlashSale {
  id: ID!
  status: FlashSaleStatus!
  remainingStock: Int!
  totalStock: Int!
  startsAt: DateTime!
  endsAt: DateTime!
}

type MyPurchaseResult {
  purchased: Boolean!
  purchaseId: ID
  purchasedAt: DateTime
}

type PurchaseItemResult {
  status: PurchaseOutcome!
  message: String!
  purchaseId: ID
}

type Query {
  flashSale(id: ID!): FlashSale!
  myPurchase(flashSaleId: ID!, userId: ID!): MyPurchaseResult!
}

type Mutation {
  purchaseItem(flashSaleId: ID!, userId: ID!): PurchaseItemResult!
}
```

`PurchaseOutcome` mirrors the domain `PurchaseOutcome` string union — no semantic rename at the GraphQL edge.

**`PurchaseItemResult.purchaseId` invariant:** `purchaseId` is non-null **iff** `status = SUCCESS`; it is null for all other `PurchaseOutcome` values. It represents only the newly created purchase from the current successful mutation — not an idempotency key and not a reference to an existing purchase for `ALREADY_PURCHASED`.

```text
SUCCESS              → purchaseId != null
ALREADY_PURCHASED    → purchaseId == null
SALE_NOT_STARTED     → purchaseId == null
SALE_ENDED           → purchaseId == null
SOLD_OUT             → purchaseId == null
```

### `flashSale` (#21)

```text
Validate id → construct FlashSaleId
  → FLASH_SALE_REPOSITORY.findById
       ├── null → throw FlashSaleNotFoundError
       └── FlashSale
              → status = getStatus(serverNowUtc)
              → map to FlashSale GraphQL type
```

- Backend clock is authoritative; clients must not compute status from local time.
- Expose window timestamps; omit `productId` and any `nowUtc` field.

### `myPurchase` (#22)

```text
Validate flashSaleId + userId → construct opaque domain IDs
  → FLASH_SALE_REPOSITORY.findById
       └── null → FlashSaleNotFoundError → NOT_FOUND
  → PURCHASE_REPOSITORY.findByFlashSaleAndUser
       ├── found     → purchased: true, purchaseId, purchasedAt
       └── not found → purchased: false, purchaseId: null, purchasedAt: null
```

Invariant: missing FlashSale is always `NOT_FOUND`; absence of a purchase is a valid negative state. Do **not** treat a missing purchase row as proof that the FlashSale exists — always check the sale first.

### `purchaseItem` (#23)

```text
Validate flashSaleId + userId
  → API/application edge generates PurchaseId
  → PURCHASE_FLOW.execute({ flashSaleId, userId, purchaseId, nowUtc })
       ├── SUCCESS | ALREADY_PURCHASED | SALE_NOT_STARTED | SALE_ENDED | SOLD_OUT
       │      → PurchaseItemResult { status, message, purchaseId? }
       ├── FlashSaleNotFoundError → NOT_FOUND
       └── unexpected → INTERNAL_SERVER_ERROR (scrubbed)
```

`nowUtc` is already part of the existing #20 `PurchaseFlowExecuteInput` contract; EPIC-03 supplies it from the same authoritative injectable clock used by `flashSale`. This does **not** change `#20` semantics.

- Mutation args are only `flashSaleId` and `userId`.
- `purchaseId` is non-null **iff** `status = SUCCESS` (see schema invariant above); never populate it for `ALREADY_PURCHASED` or other non-success outcomes.
- Every `PurchaseOutcome` must produce a **non-empty** human-facing `message`; the exact text is not a machine contract and may evolve. **`status` is the stable machine discriminator**.
- Client retries are not an idempotency-key contract in EPIC-03; uniqueness remains `(flashSaleId, userId)` via `#16` / `#20`.

### Resolver / API-edge responsibilities

- Validate IDs and construct the appropriate opaque domain IDs (#25) — **no silent trim/normalize**
- Obtain backend UTC time via injectable clock
- Ensure a new `PurchaseId` is generated at the API/application edge before invoking `PURCHASE_FLOW` (thin helper allowed; resolver need not own the UUID mechanism itself)
- Call domain ports only
- Map domain objects/outcomes to GraphQL DTOs
- Throw typed domain/app errors for the shared mapper (#24)

---

## Section 3 — Errors & validation

### Hybrid surface

| Condition                                                   | GraphQL surface                                         |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| `SUCCESS`                                                   | `PurchaseItemResult`                                    |
| `ALREADY_PURCHASED`                                         | `PurchaseItemResult`                                    |
| `SALE_NOT_STARTED`                                          | `PurchaseItemResult`                                    |
| `SALE_ENDED`                                                | `PurchaseItemResult`                                    |
| `SOLD_OUT`                                                  | `PurchaseItemResult`                                    |
| Missing FlashSale                                           | GraphQL error `extensions.code = NOT_FOUND`             |
| Empty / whitespace-only IDs; domain ID construction failure | GraphQL error `extensions.code = BAD_USER_INPUT`        |
| Unexpected application/port failure                         | GraphQL error `extensions.code = INTERNAL_SERVER_ERROR` |

Do **not** put purchase business outcomes in `errors`. Do **not** use `message` as the machine contract.

### Public error shape

```text
errors[].message              — safe, human-facing (may evolve)
errors[].extensions.code      — NOT_FOUND | BAD_USER_INPUT | INTERNAL_SERVER_ERROR
```

Only these three public codes. Do not introduce `FLASH_SALE_NOT_FOUND`, `INVALID_USER_ID`, etc. in EPIC-03.

### Missing-sale normalization

```text
FlashSaleNotFoundError → NOT_FOUND
```

| Operation      | Path                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| `flashSale`    | `findById() === null` → throw `FlashSaleNotFoundError` → `NOT_FOUND`      |
| `myPurchase`   | sale `findById() === null` → throw `FlashSaleNotFoundError` → `NOT_FOUND` |
| `purchaseItem` | `PurchaseFlow` throws `FlashSaleNotFoundError` → `NOT_FOUND`              |

### Validation (#25)

- GraphQL native non-null validation rejects missing/null required arguments before the resolver runs — do not re-implement that check in application code.
- Application-level validation rejects **empty** and **whitespace-only** strings, then constructs opaque domain IDs without trimming non-empty values:
  - `"   "` → `BAD_USER_INPUT`
  - `" abc "` → preserved as `" abc "` when constructing the domain ID
- Invalid input never reaches repositories or `PurchaseFlow`.

### Unexpected errors (#24)

```text
Unexpected Error
    ├── server logs → original error / stack / context
    └── GraphQL response → INTERNAL_SERVER_ERROR + safe message only
```

Scrubbing applies to the **client-facing** response; it must not prevent server-side observability. No Prisma / SQL / stack details in the GraphQL response.

### Implementation mechanism

Prefer a Nest GraphQL exception filter if it reliably covers the required error classes; Apollo `formatError` is an acceptable alternative. The contract matters more than the mechanism:

> All known domain/application errors map to the stable public codes; unexpected errors are scrubbed to `INTERNAL_SERVER_ERROR`.

### Suggested human messages (non-normative)

| Outcome             | Suggested `message`                    |
| ------------------- | -------------------------------------- |
| `SUCCESS`           | Purchase completed                     |
| `ALREADY_PURCHASED` | User already purchased this flash sale |
| `SALE_NOT_STARTED`  | Flash sale has not started             |
| `SALE_ENDED`        | Flash sale has ended                   |
| `SOLD_OUT`          | Flash sale is sold out                 |

These strings may evolve; clients must switch on `status`. Every outcome still requires a non-empty `message`.

---

## Section 4 — Testing & sequencing

### Test matrix

| Layer                            | What                                                                                                                                                                                            | Ownership                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Unit (Jest, mocked ports/clock)  | Resolver mapping; ID validators; error mapper; outcome → `PurchaseItemResult`; `FlashSale.getStatus(serverNowUtc)` mapping with **injected clock** (does not re-prove EPIC-02 status algorithm) | Per-ticket as features land; #24/#25 own shared helper suites                                                           |
| #26 real persistence integration | Nest GraphQL HTTP / Apollo test client → resolvers → domain ports → **real** Prisma adapters → **real** PostgreSQL                                                                              | Success, not-found, `myPurchase` true/false, purchase persistence + stock decrement, outcome payloads, `BAD_USER_INPUT` |
| #26 error-mapping integration    | Nest GraphQL → resolvers → **controlled failing port/adapter** → error mapper                                                                                                                   | Deterministic unexpected application/port failure → `INTERNAL_SERVER_ERROR` with scrubbed response                      |
| Explicitly out of #26            | Concurrent purchase storm (#19/#20); browser E2E; schema-only catalog tests                                                                                                                     | —                                                                                                                       |

### #26 harness

- Prefer extending the existing `pnpm --filter api test:integration` harness.
- If a sibling GraphQL integration config is needed, reuse the **same Postgres lifecycle / `DATABASE_URL` conventions** — do not invent a separate database lifecycle.
- Keep lint / typecheck / unit jobs DB-independent.

### #26 required assertions (minimum)

**Real persistence — `purchaseItem` SUCCESS:**

```text
GraphQL
 → Resolver
 → Port
 → Real Prisma adapter
 → Real PostgreSQL

Assert:
  GraphQL response → SUCCESS + purchaseId
  Purchase row exists for (flashSaleId, userId) / returned purchaseId
  remainingStock reflects reservation (decremented)
```

**Error-mapping — scrubbed unexpected failure (deterministic):**

```text
GraphQL
 → Resolver
 → Controlled failing port/adapter
 → Error mapper
```

> The suite must force a deterministic unexpected **application/port** failure (e.g. test-only failing port stub) without relying on fragile DB corruption or environment failures.

Verify:

```text
extensions.code = INTERNAL_SERVER_ERROR
No Prisma / SQL / stack details in the response
```

Also cover (persistence path): `NOT_FOUND`, `BAD_USER_INPUT`, and `myPurchase` purchased true/false.

**Five `PurchaseOutcome` payloads:** The #26 suite must verify all five `PurchaseOutcome` values through the GraphQL contract. Where an outcome is difficult or inappropriate to deterministically induce through the real persistence path, use controlled test fixtures or a test-specific port boundary rather than weakening coverage. Persistence behavior (SUCCESS row + stock decrement) is verified separately on the real-DB path; not every outcome must be proven through real PostgreSQL.

### Sequencing (Approach 1)

```text
Umbrella EPIC-03 design (this document)
        │
        ▼
Shared edge foundations (minimal)
  ├── error mapping / filter (#24 foundation)
  └── ID validation helpers (#25 foundation)
        │
        ▼
#21 flashSale
        │
        ▼
#22 myPurchase
        │
        ▼
#23 purchaseItem
        │
        ▼
#24 complete/harden error semantics + tests
        │
        ▼
#25 complete/harden validation semantics + tests
        │
        ▼
#26 GraphQL ↔ PostgreSQL contract/integration tests
```

Foundations may land early so #21–#23 stay consistent; **#24 and #25 remain the authoritative owners** that complete and harden those concerns.

### Epic Definition of Done

- [ ] `flashSale`, `myPurchase`, and `purchaseItem` match the locked schema
- [ ] GraphQL DTOs used (not raw DB entities / Prisma models)
- [ ] Hybrid result/error model with exactly three public error codes
- [ ] Caller-supplied `userId` documented; no AuthN/AuthZ claims
- [ ] Resolvers → domain ports only; `PurchaseFlow` semantics unchanged (`nowUtc` supplied from injectable clock per existing #20 port)
- [ ] No Product / `productId` / idempotency-key / Redis scope creep
- [ ] Unit tests + #26 persistence integration + #26 controlled-error mapping tests passing
- [ ] ESLint + typecheck pass; Turbo `^build` preserved
- [ ] Ticket-scoped PRs; commit messages `<type>: <MESSAGE>`

---

## Roadmap

| Issue | Focus                                                                 |
| ----- | --------------------------------------------------------------------- |
| #21   | `flashSale` status query (server clock, stock + window)               |
| #22   | `myPurchase` query (`MyPurchaseResult`, sale-first lookup)            |
| #23   | `purchaseItem` mutation (`PurchaseItemResult`, API-edge `purchaseId`) |
| #24   | Shared error mapping complete/harden                                  |
| #25   | Shared input validation complete/harden                               |
| #26   | GraphQL ↔ PostgreSQL contract/integration tests                       |

Per-ticket implementation plans are derived from this umbrella after the design is approved (same workflow as EPIC-02).

## Self-review checklist (spec)

- [x] No TBD/TODO placeholders in normative contracts
- [x] Schema, error model, and operation flows agree
- [x] Scope limited to #21–#26 / three operations
- [x] Ambiguities resolved: identity, hybrid errors, enum name `PurchaseOutcome`, no ID trim, #20 `nowUtc` confirmed, sale-first `myPurchase` diagram, #26 persistence vs controlled-error split, API-edge `PurchaseId` generation, `purchaseId` iff SUCCESS, all five outcomes covered via GraphQL contract
