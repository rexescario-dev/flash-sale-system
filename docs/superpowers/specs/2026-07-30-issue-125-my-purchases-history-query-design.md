# Issue #125 — GraphQL myPurchases History Query (Design Spec)

**Status:** Approved
**Date:** 2026-07-30
**Issue:** [#125](https://github.com/rexescario-dev/flash-sale-system/issues/125)
**Parent epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10 — Milestone 10)
**Repository:** `rexescario-dev/flash-sale-system`
**Baseline:** `main` at/after `3dd0415` (#124 sale details/purchase UX via [PR #137](https://github.com/rexescario-dev/flash-sale-system/pull/137); local identity via #123 / [PR #136](https://github.com/rexescario-dev/flash-sale-system/pull/136))
**Not** AuthN/AuthZ — opaque caller-supplied `userId` only
**Not** #126 UI — this ticket is the GraphQL history API only

## 1. Goal

Add an uncached GraphQL `myPurchases(userId)` query that returns a user's purchase history for downstream consumers (starting with #126). Identity remains an opaque caller-supplied `userId`; no authentication or authorization is introduced.

Existing `myPurchase(flashSaleId, userId)` answers eligibility for a single sale and is insufficient for `/purchases`.

## 2. Scope / Non-goals

### In scope

- `PurchaseHistoryQuery` read-model query port
- Prisma adapter loading `Purchase → FlashSale → Product` in a single query
- GraphQL `myPurchases(userId): [PurchaseHistoryItem!]!`
- `@@index([userId])` migration supporting the canonical history lookup (`WHERE user_id = ? ORDER BY purchased_at DESC`)
- Unit and GraphQL integration tests

### Non-goals

See **§10 Out of scope**.

## 3. Locked decisions

| Area             | Decision                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approach         | **1** — dedicated query port → read model → resolver maps to GraphQL (no GraphQL field resolvers that hit the DB; port not GraphQL-shaped)              |
| Cache            | Uncached Postgres read only (mirror `flashSales`). Redis left entirely untouched; #129 owns history cache + SUCCESS invalidation                        |
| GraphQL shape    | `PurchaseHistoryItem { id, purchasedAt, flashSale, product }` with slim `FlashSaleRef { id }` and reuse of existing `Product`                           |
| Naming           | History entity = `PurchaseHistoryItem` with `id`. Keep `MyPurchaseResult` / optional `purchaseId` for the per-sale eligibility query                    |
| Port             | Dedicated `PurchaseHistoryQuery` (CQRS-style read-model query port). `PurchaseRepository` remains aggregate persistence (save / findByFlashSaleAndUser) |
| Read model       | `PurchaseHistoryReadModel` with `id` (not GraphQL-specific naming)                                                                                      |
| Mapping          | `PurchaseHistoryReadModel → PurchaseHistoryItem` (GraphQL) at the resolver edge only                                                                    |
| Index            | `@@index([userId])` on `Purchase` for the canonical history lookup. No composite `(userId, purchasedAt DESC)` unless later measured                     |
| Ordering         | `purchasedAt DESC`; ordering is defined by the query implementation (no client-controlled sorting)                                                      |
| Pagination       | None — unfiltered list like `flashSales`                                                                                                                |
| Identity         | Opaque `userId: ID!`; validate via existing `requireUserId` (empty/whitespace → `BAD_USER_INPUT`; no trim/normalize)                                    |
| Security framing | Demo-scope discoverability by known `userId` is accepted; UI must not claim private/authenticated history                                               |

## 4. Architecture

### Application flow

```text
Query.myPurchases(userId)
  → requireUserId
  → PurchaseHistoryQuery.findByUser(UserId)
  → PurchaseHistoryReadModel[]
  → map → [PurchaseHistoryItem!]!
```

### Infrastructure implementation

```text
PurchaseHistoryQuery
  → PrismaPurchaseHistoryQuery
  → findMany(
      where: { userId },
      orderBy: { purchasedAt: 'desc' },
      include: {
        flashSale: {
          include: { product: true }
        }
      }
    )
```

Prisma is an implementation detail of the adapter, not part of the logical application flow.

### Separation of responsibilities

```text
PurchaseHistoryQuery (read-model query port)
  └── findByUser → PurchaseHistoryReadModel[]

PrismaPurchaseHistoryQuery (adapter)
  └── single findMany + map to read model

PurchaseResolver (or dedicated history resolver)
  └── validate userId, call port, map to GraphQL

PurchaseRepository
  └── unchanged aggregate save / by-sale lookup
```

### Architectural principles

> History is a **read projection**, not an expansion of the `Purchase` aggregate API. Aggregate persistence stays on `PurchaseRepository`.

> Exactly one repository/adapter call and one Prisma query should satisfy a history request. That query includes `FlashSale → Product` and maps into `PurchaseHistoryReadModel`; no additional database queries are performed.

> All nested `flashSale` and `product` fields are populated from the read model returned by `PurchaseHistoryQuery`; no additional database access occurs during GraphQL field resolution.

> Export the DI token alongside the query port (same package pattern as other ports). Resolvers depend only on the query port.

> Redis remains untouched in #125. Incomplete caching without invalidation is worse than no cache.

## 5. Read-model query port

```ts
/** Runtime Nest DI token. Owned by @flash-sale/domain (same pattern as other ports). */
export const PURCHASE_HISTORY_QUERY = Symbol('PURCHASE_HISTORY_QUERY');

export interface PurchaseHistoryQuery {
  findByUser(userId: UserId): Promise<PurchaseHistoryReadModel[]>;
}

/**
 * Read-composition transport at the port boundary only.
 * Not a domain entity; not a GraphQL type.
 */
export type PurchaseHistoryReadModel = {
  id: PurchaseId;
  purchasedAt: Date;
  flashSaleId: FlashSaleId;
  product: {
    id: ProductId;
    name: string;
    description: string | null;
  };
};
```

Notes:

- `PurchaseRepository` is **not** extended with history/include methods.
- Product relationship is composed through FlashSale in persistence; the read model flattens the product fields needed by consumers without exposing mutable sale state (status, stock, window).
- Export the DI token alongside the query port from `@flash-sale/domain`, matching existing port exports.

## 6. GraphQL surface

```graphql
type FlashSaleRef {
  id: ID!
}

type PurchaseHistoryItem {
  id: ID!
  purchasedAt: DateTime!
  flashSale: FlashSaleRef!
  product: Product!
}

extend type Query {
  myPurchases(userId: ID!): [PurchaseHistoryItem!]!
}
```

| Element               | Behavior                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `myPurchases(userId)` | Purchases for that `userId` only; newest-first (`purchasedAt DESC`) regardless of insertion order                                              |
| Empty history         | Returns an empty list when the user has no purchases. The field never returns `null`.                                                          |
| Unknown but valid id  | Treated as empty history (`[]`), not an error                                                                                                  |
| `product`             | Reuses the existing GraphQL `Product` type (`id`, `name`, `description` nullable) to avoid introducing a history-specific duplicate projection |
| `flashSale`           | Slim `FlashSaleRef { id }` for routing; additive expansion later without changing the history item contract                                    |
| `MyPurchaseResult`    | Unchanged — eligibility for a single sale (`purchased` / `purchasedAt` / optional `purchaseId`)                                                |

Resolver mapping (illustrative):

```ts
{
  id: row.id,
  purchasedAt: row.purchasedAt,
  flashSale: { id: row.flashSaleId },
  product: {
    id: row.product.id,
    name: row.product.name,
    description: row.product.description,
  },
}
```

## 7. Persistence / migration

### Adapter

Execute a single `findMany` using:

- `where: { userId }`
- `orderBy: { purchasedAt: 'desc' }`
- `include: { flashSale: { include: { product: true } } }`

Map the Prisma result into `PurchaseHistoryReadModel`; no additional database queries are performed.

`flashSaleId` is mapped from the related `FlashSale.id`. Product fields come from `flashSale.product`.

### Migration

Add `@@index([userId])` to `Purchase` to support the canonical history lookup (`WHERE user_id = ? ORDER BY purchased_at DESC`).

The existing `@@unique([flashSaleId, userId])` is ordered by `(flash_sale_id, user_id)` and is **not** a substitute for filtering solely on `user_id`.

No other schema changes. No composite `(user_id, purchased_at DESC)` index in #125.

### Redis / purchase mutation path

No changes to:

- `MyPurchaseQueryCache`
- `FlashSaleQueryCache`
- `purchaseItem` SUCCESS invalidation set
- Redis key helpers

**Future extension (#129):** introduce a `myPurchases` cache and invalidate it after successful purchases. #125 intentionally introduces no cache interface or invalidation hooks.

## 8. Errors / security

### Errors

| Case                        | Result                                      |
| --------------------------- | ------------------------------------------- |
| Empty / whitespace `userId` | `BAD_USER_INPUT` via `requireUserId`        |
| Valid `userId`, zero rows   | `[]`                                        |
| Persistence / infra failure | Same failure surfacing as other query paths |

No trim/normalize of `userId` after validation — exact string is used for lookup (consistent with #123 / purchase APIs).

### Security note

`userId` remains an opaque caller-supplied identifier. This query performs no authentication or authorization. History is therefore discoverable by anyone who knows a valid `userId`. This is intentional for the current demo scope and should not be presented as private history in the UI.

## 9. Testing

Prefer existing `graphql-api.integration.spec.ts` patterns plus focused unit/adapter tests.

| Layer                    | Coverage                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resolver unit            | Validates `userId`; calls port once; maps read model → GraphQL; empty list                                                                                                     |
| Adapter unit/integration | Asserts Prisma `where` / `orderBy` / `include`; maps nested product; empty → `[]`; does not call unrelated repository methods                                                  |
| GraphQL integration      | none / one / many; isolation across users; newest-first (`purchasedAt DESC`) regardless of insertion order; nested `flashSale.id` + `product`; bad `userId` → `BAD_USER_INPUT` |
| Schema                   | Introspection exposes `Query.myPurchases`, `PurchaseHistoryItem`, and `FlashSaleRef`                                                                                           |
| Unchanged                | Existing `myPurchase` / `purchaseItem` / Redis cache suites remain green without history-cache wiring                                                                          |

**No N+1:** Exactly one repository/adapter call and one Prisma query should satisfy a history request. Prefer asserting the port/adapter is called once and that GraphQL field resolution does not issue further DB access. SQL query-count assertions are optional.

## 10. Out of scope

- AuthN / AuthZ; encrypting or hiding purchases without auth
- Pagination, filtering, or client-controlled sorting
- Nesting full mutable `FlashSale` (status, stock, window) on history rows
- Redis caching or purchase-side invalidation for history (#129)
- #126 My Purchases UI / #127 global nav
- #133 official Tailwind packages / #134 catalog review follow-ups
- Changing purchase correctness / Redis concurrency contracts (EPIC-02–04)
- Web client GraphQL operation modules (owned by #126 unless deliberately pulled in later)

## 11. Dependencies / sequencing

```text
#123 Local identity  →  #126 Purchases UI
#125 myPurchases API →  #126 Purchases UI
#122 / #126         →  #127 Navigation
#121 / #122 / #125 / #126 / #124 → #129 cache invalidation
```

#125 has **no** upstream ticket dependency beyond current `main` (identity and sale UX already merged). It unblocks #126.

## 12. Success criteria (maps to issue AC)

- [ ] Returns purchases for a given User ID only
- [ ] Includes fields needed by history UI (`id`, `purchasedAt`, sale id via `flashSale.id`, product `id`/`name`/`description`)
- [ ] Deterministic ordering: newest-first (`purchasedAt DESC`) regardless of insertion order
- [ ] Integration tests: none / one / many; isolation across users
- [ ] Empty/whitespace `userId` → `BAD_USER_INPUT`; empty history → `[]`
- [ ] Schema exposes `Query.myPurchases`, `PurchaseHistoryItem`, `FlashSaleRef`
- [ ] Single database read (no N+1 field resolution)
- [ ] No Redis / cache invalidation changes in this ticket
- [ ] `PurchaseRepository` aggregate API unchanged
