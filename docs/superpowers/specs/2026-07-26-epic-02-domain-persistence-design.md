# EPIC-02 — Flash Sale Domain & Persistence (Design Spec)

**Status:** Approved (#12 Product contract finalized)  
**Date:** 2026-07-26 (updated 2026-07-27 for #12)  
**Epic:** [EPIC-02 #82](https://github.com/rexescario-dev/flash-sale-system/issues/82)  
**Next implementation ticket:** [#12 — Define Product domain model](https://github.com/rexescario-dev/flash-sale-system/issues/12)  
**Completed detailed contracts:** [#11 — FlashSale](https://github.com/rexescario-dev/flash-sale-system/issues/11) (merged to `main` via PR #98)  
**Child issues:** #11–#20  
**Repository:** `rexescario-dev/flash-sale-system`  
**Depends on:** EPIC-01 (#81) and #11 merged to `main`

## Goal

Implement the flash-sale domain, PostgreSQL schema, repositories, and transactional concurrency-safe purchase flow — with a pure domain package as a first-class workspace boundary.

## Architectural principle

> The domain knows business rules; `apps/api` knows infrastructure.

Share intentional domain concepts in `@flash-sale/domain`. Keep Prisma, NestJS, mappers, and repository adapters in `apps/api`. Do not dump domain models into `@flash-sale/types`.

## Locked decisions

| Area                  | Decision                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain package        | `packages/domain` → `@flash-sale/domain`                                                                                                                |
| Domain purity         | `@flash-sale/domain` has **no runtime dependencies** (devDependencies allowed). It must also have zero NestJS/Prisma/Redis/infrastructure dependencies. |
| Shared types          | `@flash-sale/types` remains non-domain (transport/contracts only when both apps need them)                                                              |
| Prisma                | Stays in `apps/api`; schema/migrations/client local to the API                                                                                          |
| Mapping               | Prisma ↔ domain mapping lives outside `@flash-sale/domain`                                                                                              |
| Repository ports      | **No repository-port location is locked by this design.** Deferred to #17–#18; not introduced in #11/#12                                                |
| Repository adapters   | Prisma implementations always in `apps/api`                                                                                                             |
| GraphQL purchase APIs | Out of EPIC-02; deferred to EPIC-03                                                                                                                     |
| Redis client          | Out of EPIC-02; deferred to EPIC-04 (Compose service already exists)                                                                                    |
| #11 modeling style    | Rich `FlashSale` class with private state, `create` / `reconstitute`, getters                                                                           |
| #12 modeling style    | Rich `Product` class with private state, **`create` only**, getters; mirrors #11 without premature shared helpers                                       |
| Value objects         | Not introduced in #11/#12 (`SaleWindow`, `Stock` deferred until justified)                                                                              |
| Spec shape            | EPIC-02 umbrella architecture + detailed #11 and #12 contracts                                                                                          |

## Dependency direction

```text
apps/api
  ├── application / use cases
  ├── mappers                              (Prisma ↔ domain; outside @flash-sale/domain)
  ├── repository ports                     (#17–#18; location TBD)
  ├── Prisma repository adapters           (#17–#18)
  ├── NestJS
  ├── Prisma
  ├── @flash-sale/types                    (non-domain transport/contracts)
  │
  └── depends on
        ▼
@flash-sale/domain
  └── ZERO runtime dependencies
      ├── no NestJS
      ├── no Prisma
      └── no Redis

Prisma repository adapters
        │
        ▼
   PostgreSQL
```

`@flash-sale/types` does **not** depend on `@flash-sale/domain`. The `depends on` edge is from `apps/api` → `@flash-sale/domain`.

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

Repository ports are **not** part of #11 or #12.

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
- Exact implementation details for #13–#20 are deferred until those tickets are planned; architectural boundaries above should not need rediscovery.
- **Follow-up debt (not #12):** `#11` `FlashSale` preserves non-trimmed IDs; `#12` `Product` trims `id` / `name` / provided `description`. Align `FlashSale` ID validation/normalization in a separate ticket so branded identity rules are consistent. Do **not** modify `FlashSale` in #12.

## Target package tree (after #12)

```text
packages/
  domain/                         # @flash-sale/domain
    package.json
    tsconfig.json
    jest.config.cjs
    src/
      index.ts                    # public exports (minimal)
      ids.ts                      # FlashSaleId, ProductId (compile-time brands)
      flash-sale/
        flash-sale.ts
        flash-sale.errors.ts
        flash-sale.spec.ts
      product/
        product.ts
        product.errors.ts
        product.spec.ts
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
- The issue's "entity/value objects" wording is satisfied by the `FlashSale` entity. The domain currently has no value object whose independent invariants or behavior justify a separate abstraction. `FlashSale` owns the current invariants directly; `SaleWindow` and `Stock` remain deferred until their independent behavior warrants extraction.
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
- Mutating a `Date` passed into `create` / `reconstitute` after construction does not mutate entity state (factories store defensive copies)

**`reconstitute()`**

- Valid partial stock → success
- `remainingStock < 0` / non-integer → `INVALID_REMAINING_STOCK`
- `remainingStock > totalStock` → `REMAINING_STOCK_EXCEEDS_TOTAL`
- Applicable shared invariants still enforced
- Same bidirectional `Date` isolation as `create` (input mutation after construction; getter mutation)

Note: if the merged #11 suite lacks the **input-`Date` mutation** coverage above, backfill that test in a follow-up — **not** as part of #12.

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

## #12 — Product domain model (detailed contract)

### Issue acceptance criteria

From GitHub [#12](https://github.com/rexescario-dev/flash-sale-system/issues/12):

- Product domain model includes `id`, `name`, `description`
- Model remains extensible without multi-product over-engineering

### Design interpretation for #12

- Implement a rich `Product` **entity** in `@flash-sale/domain`, mirroring the `#11` style (private state, factory, getters, typed validation errors).
- Domain fields are only `id`, `name`, and optional `description`. No price, SKU, images, categories, or multi-product catalog behavior.
- **Extensibility** means future fields may be added deliberately in later tickets without introducing catalog abstractions in #12. No extension mechanism, plugin surface, or generic metadata bag (e.g. `Record<string, unknown>`) is required or desired here.
- Reuse the existing `ProductId` brand from `ids.ts`; ensure it remains exported from the package public API. Do **not** export public branding constructor helpers.
- `Product.create()` accepts an already-branded `ProductId` (same pattern as #11); runtime validation still verifies the underlying string is non-blank before storing the trimmed value. No public branding constructor is introduced in #12. Callers/tests may obtain a `ProductId` via local casts until a shared branding helper is justified.
- Domain has no NestJS/Prisma/Redis dependencies and **no runtime package dependencies**.
- Do **not** modify `FlashSale` in #12. Record ID-normalization mismatch as follow-up debt (see roadmap notes).

### Entity shape

Rich class with private state:

| Field         | Type                  | Notes                                                           |
| ------------- | --------------------- | --------------------------------------------------------------- |
| `id`          | `ProductId`           | Branded string; trimmed + non-blank                             |
| `name`        | `string`              | Trimmed + non-blank                                             |
| `description` | `string \| undefined` | Optional; when `description !== undefined`, trimmed + non-blank |

No `createdAt`, price, SKU, or media fields on the domain entity.

### Factory

**`Product.create({ id, name, description? })` only**

```ts
type ProductCreateProps = {
  id: ProductId;
  name: string;
  description?: string;
};
```

Sequence: **validate → normalize (trim) → construct**.

There is no derived state and no create-vs-hydrate lifecycle distinction yet, so **`Product.reconstitute` is out of #12** (YAGNI). Add it later only if persistence mapping needs a distinct hydration entry point.

`null` is not part of the TypeScript contract and is not treated as absence. Omitted `description` and `description: undefined` are equivalent: both store `undefined`.

### Normalization & invariants

| Rule                                                   | Stored value                | Error code          |
| ------------------------------------------------------ | --------------------------- | ------------------- |
| After trim, `id` length `> 0`                          | trimmed `id` as `ProductId` | `EMPTY_ID`          |
| After trim, `name` length `> 0`                        | `name.trim()`               | `EMPTY_NAME`        |
| `description === undefined`                            | stored as `undefined`       | —                   |
| `description !== undefined` ⇒ after trim, length `> 0` | `description.trim()`        | `EMPTY_DESCRIPTION` |

Explicit rejects: `""` and whitespace-only strings for `id` / `name`. The same rejects apply to `description` when it is provided (`description !== undefined`).

**`ProductId` branding:** `Product.create()` accepts an already-branded `ProductId`. At runtime: trim the underlying string, validate the trimmed value is non-blank, **then** treat the trimmed value as `ProductId` for storage. Never brand/cast before the trimmed non-blank check. No public branding constructor is introduced in #12.

Examples:

- `"  product-123  "` → stored id `"product-123"`
- `"  Chicken  "` → stored name `"Chicken"`
- `"   "` / `""` for id or name → rejected
- omitted / `undefined` description → `getDescription()` is `undefined`
- `description: "  Fresh  "` → stored `"Fresh"`
- `description: ""` / `"   "` → `EMPTY_DESCRIPTION`

### Domain errors

```ts
type ProductValidationErrorCode = 'EMPTY_ID' | 'EMPTY_NAME' | 'EMPTY_DESCRIPTION';

class ProductValidationError extends Error {
  constructor(
    public readonly code: ProductValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProductValidationError';
  }
}
```

Consumers branch on `code`, not by parsing `message`. Messages are descriptive and may evolve (illustrative only: `"Product id must be non-empty"`, `"Product name must be non-empty"`, `"Product description must be non-empty when provided"`). No Result/Either and no deep error hierarchy in #12. No shared trim helpers with `FlashSale` in #12.

### Public API surface

Export the minimum callers need from `packages/domain/src/index.ts`:

- `Product`
- `ProductCreateProps` (type)
- `ProductValidationError`
- `ProductValidationErrorCode` (type)
- `ProductId` (reuse existing brand from `ids.ts`; retain its package-level public export)

Do not export convenience-only helpers or branding constructors.

### Public getters

- `getId(): ProductId`
- `getName(): string`
- `getDescription(): string | undefined`

Strings are immutable; no defensive copying is required.

### Explicitly out of #12

| Concern                                     | Owner                        |
| ------------------------------------------- | ---------------------------- |
| `Product.reconstitute`                      | Later, if hydration needs it |
| FlashSale ID trim / normalization alignment | Follow-up debt ticket        |
| Shared trim/normalization helpers           | Deferred until justified     |
| Prisma Product table / migrations           | #15–#16                      |
| Repository ports and adapters               | #17–#18                      |
| Purchase model / purchase flow              | #13, #19–#20                 |
| Price, SKU, images, categories, multi-SKU   | Not in #12                   |
| GraphQL / Redis                             | EPIC-03 / EPIC-04            |

### Testing (#12)

Jest in `@flash-sale/domain` (`.spec.ts`). No Nest bootstrap, no database, no Redis. Assert on behavior and `code`; do **not** assert exact message strings. Do not test `FlashSale` behavior in `product.spec.ts`.

Required coverage for `Product.create()`:

**Success**

- Valid `{ id, name }` (description omitted) → getters match; `getDescription()` is `undefined`
- Valid `{ id, name, description: undefined }` → same observable result as omitted description
- Valid with non-blank description → trimmed description returned
- Padded id → `getId()` returns the trimmed branded value (regression coverage for #11 vs #12 ID normalization difference)
- Padded name → `getName()` returns the trimmed value

**Failures (`code` assertions)**

- `""` / whitespace-only `id` → `EMPTY_ID`
- `""` / whitespace-only `name` → `EMPTY_NAME`
- `description: ""` / whitespace-only → `EMPTY_DESCRIPTION`

### Definition of Done (#12)

- Implementation complete for this issue only
- Relevant tests added/updated and passing
- ESLint and typecheck pass where applicable
- No unrelated changes (including no `FlashSale` edits)
- If commits are authorized, commit messages follow `<type>: <MESSAGE>` (no `Co-authored-by`)

## Pre-implementation sequencing (#12)

```text
origin/main (EPIC-01 + #11 merged)
    → sync local checkout
    → finalize this umbrella spec with #12 contract
    → implement #12 on a feature branch
    → run package + workspace quality gates
    → commit: <type>: <MESSAGE>
```

## Explicitly out of scope for #12 delivery

See the **Explicitly out of #12** table in the #12 contract above. In summary:

- Persistence / Prisma
- Repository ports/adapters
- FlashSale changes (including ID-normalization alignment and any #11 Date-input test backfill)
- Purchase model / purchase flow
- Sale status rules
- GraphQL (EPIC-03)
- Redis (EPIC-04)

## Epic success criteria (from #82)

- Sale status rules are enforced in the domain
- `UNIQUE(flash_sale_id, user_id)` is enforced by the database on **Purchase**
- Inventory reservation is atomic and transactional
- No overselling under concurrent load in integration tests

Child acceptance criteria remain on the linked issues; this spec does not duplicate them beyond the #11 and #12 contracts above.
