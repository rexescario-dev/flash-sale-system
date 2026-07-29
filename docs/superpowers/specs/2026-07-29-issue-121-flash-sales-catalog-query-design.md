# Issue #121 — GraphQL Flash Sales Catalog Query (Design Spec)

**Status:** Approved
**Date:** 2026-07-29
**Issue:** [#121](https://github.com/rexescario-dev/flash-sale-system/issues/121)
**Parent epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10 — Milestone 10)
**Repository:** `rexescario-dev/flash-sale-system`
**Baseline:** `main` at/after `4f5865c` (full Compose stack via PR #119)
**Not** an EPIC-01 or #118 scope change — catalog read-model / GraphQL API foundations for EPIC-10

## Goal

Expose a read-only customer-facing catalog so the web app can discover flash sales with nested product details, without deep-linking to a known sale id.

```graphql
type Product {
  id: ID!
  name: String!
  description: String
}

type FlashSale {
  id: ID!
  product: Product!
  startsAt: DateTime!
  endsAt: DateTime!
  totalStock: Int!
  remainingStock: Int!
  status: FlashSaleStatus!
}

type Query {
  flashSale(id: ID!): FlashSale
  flashSales: [FlashSale!]!
}
```

## Architectural principle

> Catalog and single-sale share one GraphQL `FlashSale` representation (Approach A). Product is part of the flash-sale read model, not a separate top-level browse API.

> Catalog load is N+1-safe by construction: one DB query includes the product relationship. No per-row product lookups on the catalog path.

> Redis remains the cache for the existing `flashSale(id)` path. Product fields stored in that snapshot are denormalized read-model data used to satisfy GraphQL without an extra hop — not a second Product source of truth.

> Domain keeps `FlashSale ──productId──> Product`. The GraphQL API read model composes nested `product` without adding `Product` as a field on the `FlashSale` domain entity solely for GraphQL.

## Locked decisions

| Area                         | Decision                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Approach                     | **A** — nested `product` on the shared `FlashSale` GraphQL type                                                                                                                                                                                              |
| Catalog query                | `flashSales: [FlashSale!]!` — unfiltered, non-paginated                                                                                                                                                                                                      |
| Ordering                     | Deterministic `startsAt ASC` (implementation-level; no client sort param)                                                                                                                                                                                    |
| `Product.description`        | Nullable `String` in GraphQL — matches domain/Prisma optional; **no** empty-string normalization at the GraphQL boundary                                                                                                                                     |
| Top-level `products` query   | **Out of scope** — flash sale remains the primary aggregate                                                                                                                                                                                                  |
| Domain relationship          | Keep `FlashSale.productId`; do **not** add `Product` onto the `FlashSale` domain entity solely for GraphQL                                                                                                                                                   |
| Catalog DB access            | Single repository query loading the Product relationship; Prisma adapter uses `findMany` with `include: { product: true }`                                                                                                                                   |
| `product` field resolver     | Prefer already-loaded `parent.product`; must not issue per-sale product lookups when the relationship is loaded                                                                                                                                              |
| `flashSale(id)` cache        | Extend Redis snapshot with product read-model fields `id`, `name`, `description`; populate on DB miss                                                                                                                                                        |
| Stale product-in-snapshot    | On cache hit, nested `product` is whatever was captured when the snapshot was written; #121 does **not** refresh product metadata independently. Accepted limitation; product writes / list+purchase invalidation owned later (#129 / out of EPIC-10 writes) |
| DataLoader                   | Deferred — seam left open for a future by-id product path; not required for catalog                                                                                                                                                                          |
| Purchase / Redis reservation | **Unchanged**                                                                                                                                                                                                                                                |
| Status derivation            | **Unchanged** (`FlashSale.getStatus` + existing mapper)                                                                                                                                                                                                      |
| Scope framing                | Separate EPIC-10 ticket; do not fold into EPIC-01 or #118                                                                                                                                                                                                    |

## GraphQL surface

### Product

Customer-facing read model only:

- `id`, `name`, `description` (nullable)
- No admin fields, no write mutations

### FlashSale (shared)

Existing sale fields plus:

- `product: Product!`

`productId` remains an internal domain/persistence concern and is **not** exposed as a GraphQL field.

### Queries

| Query           | Behavior                                                                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flashSale(id)` | Existing Redis-backed path; on cache hit, nested product is read from the snapshot; on DB miss, FlashSale + Product are loaded together and the snapshot is populated with the product read model. Existing errors/contracts preserved |
| `flashSales`    | All sales with products; empty list when none; ordered by `startsAt ASC`                                                                                                                                                               |

## Loading / N+1

### Catalog (`flashSales`)

Prisma adapter implementation (illustrative — port abstracts Prisma):

```text
prisma.flashSale.findMany({
  include: { product: true },
  orderBy: { startsAt: 'asc' },
})
        │
        ├── FlashSale A ── Product A
        ├── FlashSale B ── Product B
        └── FlashSale C ── Product C
```

Requirements:

- Catalog repository/port returns the product relationship as part of the **same** database query.
- GraphQL `product` resolver uses `parent.product` when present and **must not** perform per-row `Product.findById` (or equivalent) for that path.

### Single sale (`flashSale(id)`)

```text
DB miss
  → load FlashSale + Product
  → build Redis snapshot (sale fields + product read-model)
  → return GraphQL FlashSale

Redis hit
  → snapshot already has sale + product read-model
  → return GraphQL FlashSale (no product DB hop)
```

Ownership:

> Redis remains authoritative for **cached flash-sale read state**. Product fields in the snapshot are **denormalized read-model data** to satisfy the GraphQL response without an additional lookup.

**Minimum product fields in the snapshot** (must satisfy GraphQL `Product` on a cache hit):

```ts
// Additive fields on the existing FlashSaleCacheSnapshot (exact surrounding shape may vary)
{
  product: {
    id: string;
    name: string;
    description: string | null;
  }
}
```

The snapshot must contain `product.id`, `product.name`, and `product.description` sufficient to satisfy the GraphQL `Product` type on a cache hit. Including `productId` at the sale level remains an implementation choice when useful for mapping; it is not exposed via GraphQL.

**Stale product on cache hit:** nested `product` reflects the product read-model data captured when the snapshot was written; #121 does not attempt to refresh product metadata independently.

### Future seam

If a later path resolves products by id independently (without an included relationship), introduce a Product DataLoader then. Catalog must not depend on that path.

## Domain / port changes

```text
Domain
FlashSale ── productId ──> Product

API read model
FlashSale ── product ──> Product
```

Extend the existing repository/port boundary with a **catalog read capability** that returns the flash-sale data required by the catalog, including the associated Product read model/entity where existing mapping permits. Keep `FlashSale.productId` as the domain relationship; do **not** add `Product` as a field on the `FlashSale` domain entity solely for GraphQL.

Composition of sale + product for GraphQL happens in the API layer (adapter result type, resolver parent, and/or mapper) — e.g. a catalog row DTO / Prisma include result — not by expanding the domain aggregate.

Do **not** introduce a standalone Product GraphQL query module beyond what nested resolution needs.

## Existing behavior preserved

- `flashSale(id)` not-found and bad-input semantics
- Redis cache ownership for the by-id sale path
- Status derivation rules
- Purchase flow and Redis reservation authority

The only intentional contract extension on the single-sale query is nested `product { id name description }`.

## Testing

Integration coverage (prefer existing `graphql-api.integration.spec.ts` patterns):

| Query           | Scenario                                                                   |
| --------------- | -------------------------------------------------------------------------- |
| `flashSale(id)` | Nested product returned                                                    |
| `flashSale(id)` | Existing errors / not-found preserved                                      |
| `flashSale(id)` | Product with `description = null` returns `null`                           |
| `flashSales`    | Multiple sales with related products                                       |
| `flashSales`    | Empty catalog → `[]`                                                       |
| `flashSales`    | Status correctly presented                                                 |
| `flashSales`    | Correct product relationship per sale                                      |
| `flashSales`    | Ordered by `startsAt ASC`                                                  |
| Schema          | Introspection includes `flashSales`; `FlashSale.product`; `Product` fields |

Unit/repo tests as needed for list + include mapping and snapshot product fields.

**No N+1 verification:** Catalog retrieval must use the repository's joined/include path and must **not** invoke the per-product lookup path. Prefer spying/mocking `findById` (or equivalent) at the adapter/service level to assert it is not called during catalog resolution. SQL query-count assertions are optional and only if existing test infrastructure already supports them — not a hard acceptance criterion.

## Out of scope

- Pagination, filtering, or client-controlled sorting
- Admin / product write APIs
- AuthN
- Redis **list** caching or purchase-side cache invalidation (#129)
- EPIC-10 UI (#122+)
- Full Product DataLoader implementation
- Changing purchase correctness / Redis concurrency contracts (EPIC-02–04)

## Dependencies / sequencing

```text
#121 Catalog API  →  #122 Catalog UI  →  #124 Sale UX
                     ↗
#123 Local userId  →  #124 …
#125 myPurchases   →  #126 …
… → #129 cache invalidation (catalog + history after buy)
```

#121 has **no** upstream ticket dependency beyond current `main`.

## Success criteria (maps to issue AC)

- [ ] API exposes read-only `flashSales` catalog query
- [ ] Customer-facing product + sale fields available on shared `FlashSale`
- [ ] No admin-only fields exposed
- [ ] Existing `flashSale(id)` remains functional (extended only with nested `product`)
- [ ] Tests: catalog success; empty catalog; status; product relationship; ordering; nullable description; single-sale nested product + preserved errors; catalog path does not call per-product lookup
