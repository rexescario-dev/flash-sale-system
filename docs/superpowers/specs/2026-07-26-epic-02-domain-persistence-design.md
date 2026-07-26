# EPIC-02 — Flash Sale Domain & Persistence (Design Spec)

**Status:** Revised (awaiting approval)  
**Date:** 2026-07-26  
**Epic:** [EPIC-02 #82](https://github.com/rexescario-dev/flash-sale-system/issues/82)  
**First implementation ticket:** [#11 — Define FlashSale domain model](https://github.com/rexescario-dev/flash-sale-system/issues/11)  
**Child issues:** #11–#20  
**Repository:** `rexescario-dev/flash-sale-system`  
**Depends on:** EPIC-01 (#81) merged to `main`

## Goal

Implement the flash-sale domain, PostgreSQL schema, repositories, and transactional concurrency-safe purchase flow — with a pure domain package as a first-class workspace boundary.

## Architectural principle

> The domain knows business rules; `apps/api` knows infrastructure.

Share intentional domain concepts in `@flash-sale/domain`. Keep Prisma, NestJS, mappers, and repository adapters in `apps/api`. Do not dump domain models into `@flash-sale/types`.

## Locked decisions

| Area                  | Decision                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain package        | `packages/domain` → `@flash-sale/domain`                                                                                                                       |
| Domain purity         | `@flash-sale/domain` has **no runtime dependencies** in #11 (devDependencies allowed). It must also have zero NestJS/Prisma/Redis/infrastructure dependencies. |
| Shared types          | `@flash-sale/types` remains non-domain (transport/contracts only when both apps need them)                                                                     |
| Prisma                | Stays in `apps/api`; schema/migrations/client local to the API                                                                                                 |
| Mapping               | Prisma ↔ domain mapping lives outside `@flash-sale/domain`                                                                                                     |
| Repository ports      | **No repository-port location is locked by this design.** Deferred to #17–#18; not introduced in #11                                                           |
| Repository adapters   | Prisma implementations always in `apps/api`                                                                                                                    |
| GraphQL purchase APIs | Out of EPIC-02; deferred to EPIC-03                                                                                                                            |
| Redis client          | Out of EPIC-02; deferred to EPIC-04 (Compose service already exists)                                                                                           |
| #11 modeling style    | Rich `FlashSale` class with private state, `create` / `reconstitute`, getters                                                                                  |
| Value objects         | Not introduced in #11 (`SaleWindow`, `Stock` deferred until justified)                                                                                         |
| Spec shape            | EPIC-02 umbrella architecture + detailed #11 contract                                                                                                          |

## Dependency direction

```text
apps/api
  ├── @flash-sale/domain
  ├── @flash-sale/types
  ├── NestJS
  ├── Prisma
  ├── Mappers
  └── Repositories (ports + adapters; #17–#18)
        │
        ▼
   PostgreSQL

@flash-sale/domain
  └── ZERO runtime dependencies in #11
      ├── no NestJS
      ├── no Prisma
      └── no Redis
```

## Persistence boundary (epic-level)

```text
Prisma record
    → Mapper (apps/api)
    → Domain entity (@flash-sale/domain)
    → Business rules
    → Application use case (apps/api)
    → API response
```

Domain entities do not know Prisma. Mapping is always outside `@flash-sale/domain`.

### Repository ports (#17–#18)

Repository ports are **not** part of #11.

**No repository-port location is locked by EPIC-02 design yet. This decision belongs to #17–#18.**

They may later be defined in the application layer (`apps/api`) or, if required by the use-case architecture, behind a thin domain-facing interface. Prisma repository implementations remain in `apps/api`. Mapping remains outside `@flash-sale/domain`.

## EPIC-02 roadmap

| Issues  | Focus                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| #11     | `FlashSale` entity + `@flash-sale/domain` package                                                                  |
| #12     | `Product` domain model                                                                                             |
| #13     | `Purchase` domain model                                                                                            |
| #14     | UTC status rules: `UPCOMING` / `ACTIVE` / `SOLD_OUT` / `ENDED`                                                     |
| #15–#16 | PostgreSQL/Prisma schema for FlashSale/Product/Purchase + `Purchase(flash_sale_id, user_id)` uniqueness constraint |
| #17–#18 | Repository ports + Prisma repository adapters                                                                      |
| #19–#20 | Atomic reservation + transactional purchase + concurrency tests                                                    |

Notes:

- The uniqueness constraint is specifically on **Purchase**: `UNIQUE(flash_sale_id, user_id)`. It prevents duplicate purchases; it does **not** by itself make stock reservation concurrency-safe. Atomic reservation and oversell protection are owned by #19–#20.
- Exact implementation details for #12–#20 are deferred until those tickets are planned; architectural boundaries above should not need rediscovery.

## Target package tree (after #11)

```text
packages/
  domain/                         # @flash-sale/domain
    package.json
    tsconfig.json
    jest.config.cjs               # if/as needed to mirror api Jest
    src/
      index.ts
      ids.ts                      # FlashSaleId, ProductId (compile-time brands)
      flash-sale/
        flash-sale.ts
        flash-sale.errors.ts
        flash-sale.spec.ts        # .spec.ts to match apps/api Jest convention
  types/                          # @flash-sale/types (unchanged role)
  typescript-config/
  eslint-config/
```

## #11 — FlashSale domain model (detailed contract)

### Issue acceptance criteria

From GitHub [#11](https://github.com/rexescario-dev/flash-sale-system/issues/11):

- FlashSale entity/value objects exist in the domain layer
- Domain has no NestJS/Prisma/Redis dependencies

### Design interpretation for #11

- Implement a rich `FlashSale` **entity** in `@flash-sale/domain`.
- Do **not** introduce separate value objects (`SaleWindow`, `Stock`, etc.) in #11.
- The issue's "entity/value objects" wording is satisfied by the `FlashSale` entity; separate `SaleWindow`/`Stock` value objects are intentionally deferred per this design.
- Domain has no NestJS/Prisma/Redis dependencies and **no runtime package dependencies**.

### Entity shape

Rich class with private state:

| Field            | Type          | Notes                                        |
| ---------------- | ------------- | -------------------------------------------- |
| `id`             | `FlashSaleId` | Branded string; compile-time identity        |
| `productId`      | `ProductId`   | Branded string; full `Product` entity is #12 |
| `startsAt`       | `Date`        | Absolute instant                             |
| `endsAt`         | `Date`        | Absolute instant                             |
| `totalStock`     | `number`      | Positive integer                             |
| `remainingStock` | `number`      | Non-negative integer ≤ total                 |

No `createdAt` on the domain entity (persistence/audit metadata, not a core invariant).

### Timestamp semantics

`startsAt` and `endsAt` are JavaScript `Date` instances representing absolute instants. The domain compares UTC timestamps via `Date#getTime()`. Timezone formatting and parsing are outside the domain.

For #11, the sale-window invariant is:

```ts
startsAt.getTime() < endsAt.getTime();
```

Invalid `Date` instances yield `NaN` from `getTime()`, so the comparison fails and they are rejected as `INVALID_SALE_WINDOW`. That behavior is intentional.

#14 will define status boundaries against the same instant semantics.

### Factories

**`FlashSale.create({ id, productId, startsAt, endsAt, totalStock })`**

- Validates applicable entity invariants for a new sale.
- Sets `remainingStock = totalStock`.
- Callers cannot create a brand-new sale with partial stock.

**`FlashSale.reconstitute({ id, productId, startsAt, endsAt, totalStock, remainingStock })`**

- Restores persisted state and validates all applicable entity invariants, including persisted remaining-stock constraints.

### Invariants

Both factories enforce the invariants that apply to the fields they accept:

| Rule                                                      | Error code                      |
| --------------------------------------------------------- | ------------------------------- |
| `id.trim().length > 0`                                    | `EMPTY_ID`                      |
| `productId.trim().length > 0`                             | `EMPTY_PRODUCT_ID`              |
| `startsAt.getTime() < endsAt.getTime()`                   | `INVALID_SALE_WINDOW`           |
| `Number.isInteger(totalStock) && totalStock > 0`          | `INVALID_TOTAL_STOCK`           |
| `Number.isInteger(remainingStock) && remainingStock >= 0` | `INVALID_REMAINING_STOCK`       |
| `remainingStock <= totalStock`                            | `REMAINING_STOCK_EXCEEDS_TOTAL` |

`Number.isInteger` rejects `NaN` and `Infinity`.

IDs must contain at least one non-whitespace character. The domain does **not** trim or otherwise normalize valid IDs; it preserves the supplied identity value.

### Branded IDs

```ts
type FlashSaleId = string & { readonly __brand: 'FlashSaleId' };
type ProductId = string & { readonly __brand: 'ProductId' };
```

Branding is **compile-time only**. Runtime validation of non-empty ids is performed by entity invariant checks. Export the **types** from `src/index.ts` for consumers. Do **not** export public branding constructor helpers (e.g. `toFlashSaleId` / `toProductId`) in #11 — tests may use local casts.

### Domain errors

```ts
type FlashSaleValidationErrorCode =
  | 'EMPTY_ID'
  | 'EMPTY_PRODUCT_ID'
  | 'INVALID_SALE_WINDOW'
  | 'INVALID_TOTAL_STOCK'
  | 'INVALID_REMAINING_STOCK'
  | 'REMAINING_STOCK_EXCEEDS_TOTAL';

class FlashSaleValidationError extends Error {
  constructor(
    public readonly code: FlashSaleValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FlashSaleValidationError';
  }
}
```

Consumers branch on `code`, not by parsing `message`. Messages are descriptive and may evolve. No Result/Either and no deep error hierarchy in #11.

### Public getters

- `getId()`, `getProductId()`, `getStartsAt()`, `getEndsAt()`, `getTotalStock()`, `getRemainingStock()`

`getStartsAt()` and `getEndsAt()` return **defensive copies** of the internal `Date` values so callers cannot mutate the entity's private timestamp state through a returned `Date`:

```ts
getStartsAt(): Date {
  return new Date(this.startsAt.getTime());
}
```

Factories also store defensive copies of the supplied `Date` values so callers cannot mutate entity state via the original references they passed to `create` / `reconstitute`.

### Explicitly out of #11

| Concern                               | Owner                        |
| ------------------------------------- | ---------------------------- |
| `getStatus(nowUtc)`                   | #14                          |
| Stock mutation / reserve / purchase   | Later EPIC-02 tickets        |
| Value objects (`SaleWindow`, `Stock`) | Deferred until justified     |
| Prisma / Nest / Redis / GraphQL       | Infrastructure / later epics |
| Repository ports and adapters         | #17–#18                      |
| Application use cases                 | Later tickets                |

### Testing (#11)

Jest in `@flash-sale/domain`, aligned with `apps/api` Jest/`ts-jest` conventions (use `.spec.ts`). No Nest bootstrap, no database, no Redis.

Required coverage:

**`create()`**

- Valid sale → success and `getRemainingStock() === getTotalStock()`
- Empty / whitespace-only `id` → `EMPTY_ID`
- Empty / whitespace-only `productId` → `EMPTY_PRODUCT_ID`
- Valid id with surrounding whitespace is preserved (not trimmed)
- `startsAt === endsAt` / `startsAt > endsAt` → `INVALID_SALE_WINDOW`
- `totalStock === 0` / `< 0` / non-integer (including `NaN` / `Infinity`) → `INVALID_TOTAL_STOCK`
- Mutating a `Date` returned from `getStartsAt()` / `getEndsAt()` does not change subsequent getter results

**`reconstitute()`**

- Valid partial stock → success
- `remainingStock < 0` / non-integer → `INVALID_REMAINING_STOCK`
- `remainingStock > totalStock` → `REMAINING_STOCK_EXCEEDS_TOTAL`
- Applicable shared invariants still enforced

### Package tooling (#11)

- Mirror `@flash-sale/types` package configuration and root Turbo scripts wherever possible.
- Do not introduce new root-level tooling or workspace configuration unless required (`packages/*` already covers the folder).
- Runtime `dependencies`: **none**. DevDependencies may include TypeScript, shared tsconfig, Jest, `ts-jest`, `@types/jest`.
- Reuse existing Jest/`ts-jest` conventions from `apps/api` rather than inventing a divergent runner.
- `apps/api` may add `"@flash-sale/domain": "workspace:*"` so the dependency graph is real, without wiring domain into Nest modules in #11.

### Definition of Done (#11)

- Implementation complete for this issue only
- Relevant tests added/updated and passing
- ESLint and typecheck pass where applicable
- No unrelated changes
- If commits are authorized, commit messages follow `<type>: <MESSAGE>`

## Pre-implementation sequencing

```text
origin/main (EPIC-01 complete)
    → sync local checkout (do not start from stale epic-01/* tip)
    → implement #11 on a feature branch
    → run package + workspace quality gates
    → commit: <type>: <MESSAGE>
```

## Explicitly out of scope for this design’s first delivery (#11)

- Prisma schema and migrations
- Repository ports/adapters
- Sale status rules (`getStatus`)
- Purchase flow and concurrency integration tests
- GraphQL flash-sale APIs (EPIC-03)
- Redis client / caching / rate limiting (EPIC-04)

## Epic success criteria (from #82)

- Sale status rules are enforced in the domain
- `UNIQUE(flash_sale_id, user_id)` is enforced by the database on **Purchase**
- Inventory reservation is atomic and transactional
- No overselling under concurrent load in integration tests

Child acceptance criteria remain on the linked issues; this spec does not duplicate them beyond the #11 contract above.

```

```
