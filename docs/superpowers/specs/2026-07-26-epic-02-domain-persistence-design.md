# EPIC-02 — Flash Sale Domain & Persistence (Design Spec)

**Status:** Draft (#14 sale-status contract — pending review)
**Date:** 2026-07-26 (updated 2026-07-27 for #14)
**Epic:** [EPIC-02 #82](https://github.com/rexescario-dev/flash-sale-system/issues/82)
**Next implementation ticket:** [#14 — Implement sale status rules](https://github.com/rexescario-dev/flash-sale-system/issues/14)
**Completed detailed contracts:** [#11 — FlashSale](https://github.com/rexescario-dev/flash-sale-system/issues/11) (merged via PR #98), [#12 — Product](https://github.com/rexescario-dev/flash-sale-system/issues/12) (merged via PR #99), [#13 — Purchase](https://github.com/rexescario-dev/flash-sale-system/issues/13) (merged via PR #100)
**Child issues:** #11–#20
**Repository:** `rexescario-dev/flash-sale-system`
**Depends on:** EPIC-01 (#81), #11, #12, and #13 merged to `main`

## Goal

Implement the flash-sale domain, PostgreSQL schema, repositories, and transactional concurrency-safe purchase flow — with a pure domain package as a first-class workspace boundary.

## Architectural principle

> The domain defines business rules and invariants; application and infrastructure layers coordinate enforcement that requires external state or persistence.

Share intentional domain concepts in `@flash-sale/domain`. Keep Prisma, NestJS, mappers, and repository adapters in `apps/api`. Do not dump domain models into `@flash-sale/types`.

## Locked decisions

| Area                  | Decision                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain package        | `packages/domain` → `@flash-sale/domain`                                                                                                                |
| Domain purity         | `@flash-sale/domain` has **no runtime dependencies** (devDependencies allowed). It must also have zero NestJS/Prisma/Redis/infrastructure dependencies. |
| Shared types          | `@flash-sale/types` remains non-domain (transport/contracts only when both apps need them)                                                              |
| Prisma                | Stays in `apps/api`; schema/migrations/client local to the API                                                                                          |
| Mapping               | Prisma ↔ domain mapping lives outside `@flash-sale/domain`                                                                                              |
| Repository ports      | **No repository-port location is locked by this design.** Deferred to #17–#18; not introduced in #11–#14                                                |
| Repository adapters   | Prisma implementations always in `apps/api`                                                                                                             |
| GraphQL purchase APIs | Out of EPIC-02; deferred to EPIC-03                                                                                                                     |
| Redis client          | Out of EPIC-02; deferred to EPIC-04 (Compose service already exists)                                                                                    |
| #11 modeling style    | Rich `FlashSale` class with private state, `create` / `reconstitute`, getters                                                                           |
| #12 modeling style    | Rich `Product` class with private state, **`create` only**, getters; mirrors #11 without premature shared helpers                                       |
| #13 modeling style    | Rich `Purchase` class with private state, **`create` only**, getters; IDs preserved (no trim); defensive `purchasedAt`                                  |
| #14 status style      | Instance method `FlashSale.getStatus(nowUtc)`; string-union `FlashSaleStatus`; temporal-first precedence; no purchase-gate helpers                      |
| Value objects         | Not introduced in #11–#14 (`SaleWindow`, `Stock` deferred until justified)                                                                              |
| Spec shape            | EPIC-02 umbrella architecture + detailed #11, #12, #13, and #14 contracts                                                                               |

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

Repository ports are **not** part of #11, #12, #13, or #14.

**No repository-port location is locked by EPIC-02 design yet. This decision belongs to #17–#18.**

They may later be defined in the application layer (`apps/api`) or, if required by the use-case architecture, behind a thin domain-facing interface. Prisma repository implementations remain in `apps/api`. Mapping remains outside `@flash-sale/domain`.

## EPIC-02 roadmap

| Issues | Focus                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------- |
| #11    | `FlashSale` entity + `@flash-sale/domain` package                                                  |
| #12    | `Product` domain model                                                                             |
| #13    | `Purchase` domain model (rule documented; no uniqueness enforcement API)                           |
| #14    | UTC status rules: `UPCOMING` / `ACTIVE` / `SOLD_OUT` / `ENDED`                                     |
| #15    | PostgreSQL/Prisma schema for FlashSale / Product / Purchase                                        |
| #16    | Purchase uniqueness constraint + persistence uniqueness invariants                                 |
| #17    | Repository ports (location TBD)                                                                    |
| #18    | Prisma repository adapters; map DB uniqueness violations to typed repository/infrastructure errors |
| #19    | Atomic inventory reservation                                                                       |
| #20    | Transactional purchase flow; typed outcomes including `ALREADY_PURCHASED`; concurrency tests       |

Intended implementation sequence after domain models:

```text
#11 FlashSale
      │
      ├── sale-window invariant (create / reconstitute)
      │
      └── #14 derived status (getStatus)   ← next
               │
#12 Product    │
#13 Purchase   │
               ▼
#15 Persistence schema (FlashSale / Product / Purchase)
      ↓
#16 Purchase uniqueness constraint UNIQUE(flash_sale_id, user_id)
      ↓
#17 Repository ports
      ↓
#18 Prisma adapters (map uniqueness violation → typed repository/infrastructure error)
      ↓
#19 Atomic stock reservation
      ↓
#20 Transactional purchase flow
      ├── status / purchase eligibility (uses getStatus; no purchase-gate helpers in #14)
      ├── ALREADY_PURCHASED
      ├── reservation
      └── concurrency safety
```

Notes:

- The uniqueness constraint is specifically on **Purchase**: `UNIQUE(flash_sale_id, user_id)`. It prevents duplicate purchases; it does **not** by itself make stock reservation concurrency-safe. Atomic reservation and oversell protection are owned by #19–#20.
- Exact implementation details for #15–#20 are deferred until those tickets are planned; ownership boundaries above should not need rediscovery. The detailed `#14` contract is below (`#11`–`#13` contracts remain above/earlier in this file).
- **Temporary identity-normalization inconsistency:** `#11` `FlashSale` and `#13` `Purchase` **preserve** non-trimmed IDs; `#12` `Product` **trims** `id` / `name` / provided `description`. This is an **acknowledged cross-entity inconsistency, not a desired domain convention**. Until a dedicated identity-normalization ticket resolves it, each entity must preserve its existing contract. New tickets must **not** silently normalize or de-normalize IDs for consistency — including `#14` (do not modify `FlashSale` ID normalization).

## Target package tree (after #14)

```text
packages/
  domain/                         # @flash-sale/domain
    package.json
    tsconfig.json
    jest.config.cjs
    src/
      index.ts                    # public exports (minimal); re-exports all ID brands
      ids.ts                      # compile-time brands only (no runtime ID VOs):
                                  #   FlashSaleId, ProductId, PurchaseId, UserId
      flash-sale/
        flash-sale.ts             # entity; FlashSaleStatus type (top-level); getStatus(#14)
        flash-sale.errors.ts      # includes INVALID_NOW (#14)
        flash-sale.spec.ts        # create/reconstitute + getStatus coverage
                                  # (no flash-sale.status.ts)
      product/
        product.ts
        product.errors.ts
        product.spec.ts
      purchase/
        purchase.ts
        purchase.errors.ts
        purchase.spec.ts
  types/                          # @flash-sale/types (unchanged role)
  typescript-config/
  eslint-config/
```

`ids.ts` is the single source of truth for branded ID types. `index.ts` re-exports all four. Entity contracts below only state which IDs they use. `#14` does **not** add a new package folder; status lives on `FlashSale`.

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

`startsAt` and `endsAt` are JavaScript `Date` instances representing absolute instants. The domain compares absolute instants via `Date#getTime()` (epoch milliseconds). Timezone parsing and formatting are outside the domain.

For #11, the sale-window invariant is:

```ts
startsAt.getTime() < endsAt.getTime();
```

Invalid `Date` instances yield `NaN` from `getTime()`, so the comparison fails and they are rejected as `INVALID_SALE_WINDOW`. That behavior is intentional.

#14 will define status boundaries against the same absolute-instant semantics.

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

## #13 — Purchase domain model (detailed contract)

### Issue acceptance criteria

From GitHub [#13](https://github.com/rexescario-dev/flash-sale-system/issues/13):

- Purchase model includes flash sale and user identity
- One-purchase-per-user invariant is expressed in domain language

### Design interpretation for #13

- Implement a rich `Purchase` **entity** in `@flash-sale/domain`, mirroring the `#11`/`#12` style (private state, factory, getters, typed validation errors).
- Domain fields are `id`, `flashSaleId`, `userId`, and `purchasedAt`. No `productId`, no `quantity`, no purchase-status enum, no stock mutation.
- A `Purchase` represents a successful purchase by one user for one flash sale at a specific point in time (`purchasedAt`).
- **Domain rule (documented, not entity-enforced):** a user may have at most one purchase for a given flash sale, identified by the `(flashSaleId, userId)` pair. This rule describes the business invariant; **#13 does not provide an entity-level API for checking or enforcing it.** `Purchase` validates only its own field invariants. Do **not** add `assertUniquePurchase`, `isSameBuyerSale`, or any multi-instance uniqueness helper in `#13`.
- Uniqueness ownership (layered):
  - **#13** — document the rule in domain language; shape fields that make `(flashSaleId, userId)` explicit
  - **#16** — database `UNIQUE(flash_sale_id, user_id)`
  - **#18** — repository adapter maps DB uniqueness violations to a typed repository/infrastructure error
  - **#20** — application/use-case layer translates that into the purchase outcome `ALREADY_PURCHASED`
- Uses ID brands from `ids.ts`: `PurchaseId`, `FlashSaleId`, `UserId`. `#13` adds `PurchaseId` and `UserId` to that compile-time-only collection (no runtime ID value objects). Do **not** export public branding constructor helpers.
- `Purchase.create()` accepts already-branded ids (same pattern as `#11`/`#12`); runtime validation still verifies each underlying string is non-blank. Callers/tests may obtain branded ids via local casts until a shared branding helper is justified.
- Domain has no NestJS/Prisma/Redis dependencies and **no runtime package dependencies**.
- Do **not** modify `FlashSale` (including ID normalization) in `#13`.

### Entity shape

Rich class with private state:

| Field         | Type          | Notes                                                                             |
| ------------- | ------------- | --------------------------------------------------------------------------------- |
| `id`          | `PurchaseId`  | Branded string; non-blank; stored unchanged                                       |
| `flashSaleId` | `FlashSaleId` | Branded string; non-blank; stored unchanged                                       |
| `userId`      | `UserId`      | Branded string; non-blank; stored unchanged                                       |
| `purchasedAt` | `Date`        | Valid JavaScript `Date` representing an absolute instant; defensive copies in/out |

No `productId`, `quantity`, `createdAt`, or purchase-status fields on the domain entity. Product association remains via the flash sale (`FlashSale.productId`), not denormalized onto `Purchase`.

### Factory

**`Purchase.create({ id, flashSaleId, purchasedAt, userId })` only**

```ts
type PurchaseCreateProps = {
  id: PurchaseId;
  flashSaleId: FlashSaleId;
  purchasedAt: Date;
  userId: UserId;
};
```

Sequence: **validate → construct** (no ID normalization / trim-for-storage step).

There is no derived state and no create-vs-hydrate lifecycle distinction yet, so **`Purchase.reconstitute` is out of #13** (YAGNI). Add it later only if persistence mapping needs a distinct hydration entry point.

### Validation & invariants

| Field         | Validation                             | Stored value                      | Error code             |
| ------------- | -------------------------------------- | --------------------------------- | ---------------------- |
| `id`          | `id.trim().length > 0`                 | original `id`, unchanged          | `EMPTY_ID`             |
| `flashSaleId` | `flashSaleId.trim().length > 0`        | original `flashSaleId`, unchanged | `EMPTY_FLASH_SALE_ID`  |
| `userId`      | `userId.trim().length > 0`             | original `userId`, unchanged      | `EMPTY_USER_ID`        |
| `purchasedAt` | `!Number.isNaN(purchasedAt.getTime())` | defensive copy of `purchasedAt`   | `INVALID_PURCHASED_AT` |

**Validation trims only for the purpose of determining blankness; it never normalizes the stored identity.**

Explicit rejects: `""` and whitespace-only strings for `id` / `flashSaleId` / `userId`. Valid ids that contain surrounding whitespace are **preserved** (not trimmed).

`Purchase.flashSaleId` preserves the supplied value because `FlashSale.id` currently preserves its supplied value. Therefore `#13` does not introduce a new normalization policy for cross-entity identity. The existing `#11`/`#12` normalization inconsistency remains explicit technical debt.

**`purchasedAt`:** must be a valid JavaScript `Date` whose `getTime()` is not `NaN`. Invalid `Date` instances are rejected. Future timestamps are allowed. Whether a purchase may occur at a given wall-clock time is an application/sale-window concern (`#14` / `#20`), not an intrinsic `Purchase` validity rule.

**Branded IDs:** `Purchase.create()` accepts already-branded `PurchaseId`, `FlashSaleId`, and `UserId`. At runtime: check blankness with `trim().length > 0`, then store the **original** supplied string (cast/brand retained). Never assign a trimmed string to entity state. No public branding constructor is introduced in `#13`.

Examples:

- `"  purchase-1  "` → stored id `"  purchase-1  "` (preserved)
- `"   "` / `""` for any id field → rejected with the matching empty-code
- `new Date('not-a-date')` → `INVALID_PURCHASED_AT`
- `purchasedAt` in the future → accepted when the `Date` is valid

### Domain rule: one purchase per user per flash sale

> A user may have at most one purchase for a given flash sale, identified by the `(flashSaleId, userId)` pair.

This rule is the `#13` expression of the acceptance criterion “one-purchase-per-user invariant is expressed in domain language.” It describes the business invariant; **#13 does not provide an entity-level API for checking or enforcing it.** A single `Purchase` instance cannot observe other purchases.

Enforcement ownership:

| Layer                                   | Owner | Mechanism                                                           |
| --------------------------------------- | ----- | ------------------------------------------------------------------- |
| Domain language / model shape           | #13   | Fields + documented rule; no uniqueness helper / check API          |
| Database                                | #16   | `UNIQUE(flash_sale_id, user_id)`                                    |
| Repository / infrastructure adapter     | #18   | Map DB uniqueness violation → typed repository/infrastructure error |
| Application / use-case purchase outcome | #20   | Translate repository uniqueness error → `ALREADY_PURCHASED`         |

`ALREADY_PURCHASED` is **not** a `PurchaseValidationErrorCode`.

### Domain errors

```ts
type PurchaseValidationErrorCode =
  'EMPTY_FLASH_SALE_ID' | 'EMPTY_ID' | 'EMPTY_USER_ID' | 'INVALID_PURCHASED_AT';

class PurchaseValidationError extends Error {
  constructor(
    public readonly code: PurchaseValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PurchaseValidationError';
  }
}
```

Consumers branch on `code`, not by parsing `message`. Messages are descriptive and may evolve (illustrative only: `"Purchase id must be non-empty"`, `"Purchase flashSaleId must be non-empty"`, `"Purchase userId must be non-empty"`, `"Purchase purchasedAt must be a valid Date"`). No Result/Either and no deep error hierarchy in `#13`. No uniqueness / `ALREADY_PURCHASED` error in `#13`. ESLint perfectionist: keep the union members sorted A→Z.

### Public API surface

Export the minimum callers need from `packages/domain/src/index.ts`:

- `Purchase`
- `PurchaseCreateProps` (type)
- `PurchaseValidationError`
- `PurchaseValidationErrorCode` (type)
- ID brands used by this entity (re-exported from `ids.ts`): `PurchaseId`, `FlashSaleId`, `UserId`
  - Also keep re-exporting `ProductId` from the package public API (existing `#12` surface)

Do not export convenience-only helpers, uniqueness helpers, or branding constructors.

### Public getters

- `getFlashSaleId(): FlashSaleId`
- `getId(): PurchaseId`
- `getPurchasedAt(): Date`
- `getUserId(): UserId`

`getPurchasedAt()` returns a **defensive copy** of the internal `Date` so callers cannot mutate the entity's private timestamp state through a returned `Date`:

```ts
getPurchasedAt(): Date {
  return new Date(this.purchasedAt.getTime());
}
```

`Purchase.create` also stores a defensive copy of the supplied `purchasedAt` so callers cannot mutate entity state via the original reference they passed in.

### Explicitly out of #13

| Concern                                         | Owner                                   |
| ----------------------------------------------- | --------------------------------------- |
| `Purchase.reconstitute`                         | Later, if hydration needs it            |
| Uniqueness helpers / multi-purchase check APIs  | Not in domain entity; deferred past #13 |
| DB `UNIQUE(flash_sale_id, user_id)`             | #16                                     |
| Map DB uniqueness violation → repository error  | #18                                     |
| Typed `ALREADY_PURCHASED` purchase outcome      | #20                                     |
| FlashSale ID trim / normalization alignment     | Follow-up debt ticket                   |
| Shared trim/normalization helpers               | Deferred until justified                |
| Prisma Purchase table / migrations              | #15                                     |
| Repository ports                                | #17                                     |
| Prisma repository adapters                      | #18                                     |
| Atomic stock reservation                        | #19                                     |
| Transactional purchase flow + concurrency tests | #20                                     |
| Sale status rules                               | #14                                     |
| `productId` / `quantity` on Purchase            | Not in #13                              |
| GraphQL / Redis                                 | EPIC-03 / EPIC-04                       |

### Testing (#13)

Jest in `@flash-sale/domain` (`.spec.ts`). No Nest bootstrap, no database, no Redis. Assert on behavior and `code`; do **not** assert exact message strings. Do not test `FlashSale` or `Product` behavior in `purchase.spec.ts`.

Required coverage for `Purchase.create()`:

**Success**

- A valid `Purchase` preserves `id`, `flashSaleId`, and `userId` exactly as supplied, including surrounding whitespace; getters return those exact values
- Mutating a `Date` returned from `getPurchasedAt()` does not change subsequent getter results
- Mutating a `Date` passed into `create` after construction does not mutate entity state (factory stores a defensive copy) — e.g. capture `originalTimestamp`, call `create`, then `purchasedAt.setTime(0)`, then assert `getPurchasedAt().getTime() === originalTimestamp`
- A future `purchasedAt` with a valid `Date` is accepted

**Failures (`code` assertions)**

- `""` / whitespace-only `id` → `EMPTY_ID`
- `""` / whitespace-only `flashSaleId` → `EMPTY_FLASH_SALE_ID`
- `""` / whitespace-only `userId` → `EMPTY_USER_ID`
- Invalid `Date` (`Number.isNaN(purchasedAt.getTime())`) → `INVALID_PURCHASED_AT`

### Definition of Done (#13)

- Implementation complete for this issue only
- Relevant tests added/updated and passing
- ESLint and typecheck pass where applicable
- No unrelated changes (do not edit `FlashSale` / `Product` entity files; add brands only in `ids.ts` + public exports in `index.ts`)
- If commits are authorized, commit messages follow `<type>: <MESSAGE>` (no `Co-authored-by`)

## #14 — Implement sale status rules (detailed contract)

### Issue acceptance criteria

From GitHub [#14](https://github.com/rexescario-dev/flash-sale-system/issues/14):

- Status resolves to `UPCOMING`, `ACTIVE`, `SOLD_OUT`, `ENDED` using UTC
- Unit tests cover all status transitions

Issue AC language may say “UTC”; the detailed contract below clarifies that the domain compares **absolute instants** (epoch milliseconds) and performs **no timezone conversion**.

For `#14`, “all status transitions” means all **observable status outcomes and temporal/inventory boundaries** of `getStatus(nowUtc)`. It does **not** require implementing or testing state mutation between statuses; stock mutation is owned by `#19`–`#20`.

### Design interpretation for #14

- Add status resolution as **instance behavior** on the existing `FlashSale` entity in `@flash-sale/domain`.
- **Status is derived, not persisted.** Persisted / reconstituted fields remain `startsAt`, `endsAt`, `totalStock`, and `remainingStock` (plus ids). `#14` does **not** add a `status` field on the entity or in later persistence work under this ticket. Time passing and stock changes naturally change the result of `getStatus(now)` without a duplicated status column or in-memory status mutation.
- Declare `FlashSaleStatus` as a top-level exported type in `flash-sale.ts` (same file as the entity). Do **not** add `flash-sale.status.ts` or another status module.
- Canonical status vocabulary (no aliases such as `NOT_STARTED`):

```ts
type FlashSaleStatus = 'ACTIVE' | 'ENDED' | 'SOLD_OUT' | 'UPCOMING';
```

Union members are listed A→Z for ESLint perfectionist sorting. **Runtime precedence is not alphabetical** (see below).

- Public API is only:

```ts
flashSale.getStatus(nowUtc: Date): FlashSaleStatus;
```

- **Do not** add purchase-gate helpers (`isPurchaseOpen`, `assertPurchaseOpen`, `canPurchase`, etc.). Callers that need a simple open check may derive `getStatus(nowUtc) === 'ACTIVE'`. Purchase eligibility policy belongs to `#20` (or a later application/domain layer) and may eventually depend on more than status alone.
- **Do not** introduce stock mutation / reserve APIs in `#14`.
- Preserve existing `FlashSale` ID contract (see umbrella note on temporary identity-normalization inconsistency); do not change ID normalization in `#14`.
- Domain remains free of NestJS/Prisma/Redis and has **no runtime package dependencies**.
- Approach: keep logic inside `FlashSale` (reads private `startsAt` / `endsAt` / `remainingStock`). Do **not** extract a free-function resolver or status policy engine in `#14`.

### Instant semantics (`nowUtc` naming)

`nowUtc`, `startsAt`, and `endsAt` are JavaScript `Date` instances representing absolute instants. The domain compares epoch milliseconds via `Date#getTime()`. No timezone conversion occurs inside the domain — same absolute-instant model as `#11`.

`nowUtc` represents the current absolute instant. The name follows the umbrella / issue wording; `Date#getTime()` provides timezone-independent comparison. Callers may construct equivalent instants with any offset (e.g. `…T10:00:00+08:00` vs `…T02:00:00Z`); both compare equal when they denote the same epoch millisecond.

Sale window for `ACTIVE` / `SOLD_OUT` is half-open: **`[startsAt, endsAt)`**.

`getStatus()` relies on the `FlashSale` entity invariant that `startsAt` and `endsAt` are valid instants and `startsAt.getTime() < endsAt.getTime()`; these are guaranteed by `create()` / `reconstitute()` and are **not** revalidated by `#14`.

### Status precedence

> **Status precedence is temporal first, inventory second.** Once `now >= endsAt`, the flash sale is `ENDED`; `SOLD_OUT` is only returned when the sale is currently within its active window and `remainingStock === 0`.

Ordered rules (first match wins):

1. Invalid `nowUtc` (`Number.isNaN(nowUtc.getTime())`) → throw `FlashSaleValidationError` with code `INVALID_NOW`
2. `nowUtc.getTime() < startsAt.getTime()` → `UPCOMING`
3. `nowUtc.getTime() >= endsAt.getTime()` → `ENDED`
4. `remainingStock === 0` → `SOLD_OUT`
5. Otherwise → `ACTIVE`

Implications:

| Scenario                                       | Status     |
| ---------------------------------------------- | ---------- |
| Before `startsAt`, any stock including zero    | `UPCOMING` |
| `now === startsAt`, stock `> 0`                | `ACTIVE`   |
| `now === startsAt`, stock `=== 0`              | `SOLD_OUT` |
| Inside window, stock `> 0`                     | `ACTIVE`   |
| Inside window, stock `=== 0`                   | `SOLD_OUT` |
| `now === endsAt`, any stock                    | `ENDED`    |
| After `endsAt`, stock `=== 0`                  | `ENDED`    |
| After `endsAt`, stock `> 0`                    | `ENDED`    |
| Invalid `nowUtc` (`new Date('invalid')`, etc.) | throw      |

`SOLD_OUT` describes an inventory state that prevents further purchases **during the open sale window**. `ENDED` describes a sale window that is no longer open **regardless of inventory**.

Because `getStatus` is a pure resolver over current entity fields + `nowUtc`, a change such as “ACTIVE → SOLD_OUT” appears when the same sale is queried again with different `remainingStock` (future stock APIs) or at a different `nowUtc` — `#14` does not mutate stock.

### Method contract

```ts
getStatus(nowUtc: Date): FlashSaleStatus {
  if (Number.isNaN(nowUtc.getTime())) {
    throw new FlashSaleValidationError(
      'INVALID_NOW',
      'FlashSale nowUtc must be a valid Date',
    );
  }

  if (nowUtc.getTime() < this.startsAt.getTime()) {
    return 'UPCOMING';
  }

  if (nowUtc.getTime() >= this.endsAt.getTime()) {
    return 'ENDED';
  }

  if (this.remainingStock === 0) {
    return 'SOLD_OUT';
  }

  return 'ACTIVE';
}
```

Behavioral contract:

- `getStatus()` is a **pure read** operation. It does **not** mutate `FlashSale` state, including `remainingStock`, timestamps, ids, or any other entity field. It does not assign or cache a status on the entity.
- Runtime validation of `nowUtc` is `Number.isNaN(nowUtc.getTime())` → `INVALID_NOW`. Do **not** add `instanceof Date` (or similar) checks unless the package later adopts a broader defensive runtime-typing convention. The TypeScript parameter type is `Date`.

Notes:

- Prefer `getTime()` comparisons (as above) rather than relying on `Date` relational operators alone, for consistency with `#11` window validation.
- `getStatus` only **reads** `nowUtc.getTime()`; it does not store `nowUtc` and does not need a defensive copy of the argument.
- Illustrative error message may evolve; consumers branch on `code`, not message text.

### Domain errors (#14 delta)

Extend the existing `#11` error union (keep members sorted A→Z):

```ts
type FlashSaleValidationErrorCode =
  | 'EMPTY_ID'
  | 'EMPTY_PRODUCT_ID'
  | 'INVALID_NOW'
  | 'INVALID_REMAINING_STOCK'
  | 'INVALID_SALE_WINDOW'
  | 'INVALID_TOTAL_STOCK'
  | 'REMAINING_STOCK_EXCEEDS_TOTAL';
```

`FlashSaleValidationError` class shape is unchanged. `#14` does **not** introduce a separate status-error type.

### Public API surface (#14 delta)

Export from `packages/domain/src/index.ts` (in addition to existing FlashSale exports):

- `FlashSaleStatus` (type)

Retain existing exports of `FlashSale`, `FlashSaleCreateProps`, `FlashSaleReconstituteProps`, `FlashSaleValidationError`, and `FlashSaleValidationErrorCode` (now including `INVALID_NOW`).

Do not export purchase-gate helpers, status aliases, or branding constructors.

### Explicitly out of #14

| Concern                                      | Owner                          |
| -------------------------------------------- | ------------------------------ |
| Purchase-gate helpers / eligibility policy   | #20 (or later)                 |
| Stock mutation / reserve / purchase          | #19–#20                        |
| Purchase uniqueness / `ALREADY_PURCHASED`    | #16 / #18 / #20                |
| FlashSale ID trim / normalization alignment  | Follow-up debt ticket          |
| Value objects (`SaleWindow`, `Stock`)        | Deferred until justified       |
| Prisma / Nest / Redis / GraphQL              | #15+ / later epics             |
| Repository ports and adapters                | #17–#18                        |
| Persisted `status` field / status column     | Not in #14 (status is derived) |
| `instanceof Date` runtime checks on `nowUtc` | Not required                   |

### Testing (#14)

Jest in `@flash-sale/domain` (`.spec.ts`). Prefer adding a dedicated `describe('FlashSale.getStatus', …)` block in `flash-sale.spec.ts`. No Nest bootstrap, no database, no Redis. Assert on returned status strings and error `code`; do **not** assert exact message strings. Use explicit `nowUtc` fixtures rather than a live clock. Zero-stock cases use `FlashSale.reconstitute` (no stock mutation API in `#14`).

Required matrix (time × stock → result):

| Time relative to window | `remainingStock` | Result              |
| ----------------------- | ---------------- | ------------------- |
| Before `startsAt`       | `> 0`            | `UPCOMING`          |
| Before `startsAt`       | `0`              | `UPCOMING`          |
| At `startsAt`           | `> 0`            | `ACTIVE`            |
| At `startsAt`           | `0`              | `SOLD_OUT`          |
| During window           | `> 0`            | `ACTIVE`            |
| During window           | `0`              | `SOLD_OUT`          |
| At `endsAt`             | `> 0`            | `ENDED`             |
| At `endsAt`             | `0`              | `ENDED`             |
| After `endsAt`          | `> 0`            | `ENDED`             |
| After `endsAt`          | `0`              | `ENDED`             |
| Invalid `Date`          | any              | throw `INVALID_NOW` |

This matrix is the authoritative reading of the issue’s “all status transitions” for `#14`: all observable outcomes and temporal/inventory boundaries of `getStatus(nowUtc)`, not mutation between statuses.

### Definition of Done (#14)

- Implementation complete for this issue only
- Relevant tests added/updated and passing
- ESLint and typecheck pass where applicable
- No unrelated changes (no Purchase uniqueness helpers; no GraphQL; no Redis; no silent ID normalization changes)
- If commits are authorized, commit messages follow `<type>: <MESSAGE>` (no `Co-authored-by`)

## Pre-implementation sequencing (#14)

```text
origin/main (EPIC-01 + #11 + #12 + #13 merged)
    → sync local checkout
    → finalize this umbrella spec with #14 contract
    → implement #14 on a feature branch
    → run package + workspace quality gates
    → commit: <type>: <MESSAGE>
```

## Explicitly out of scope for #14 delivery

See the **Explicitly out of #14** table in the #14 contract above. In summary:

- Purchase-gate helpers / purchasability policy (#20)
- Stock mutation / reservation (#19–#20)
- Purchase uniqueness / `ALREADY_PURCHASED` (#16 / #18 / #20)
- FlashSale ID normalization alignment
- Persistence / Prisma (#15+)
- Repository ports/adapters (#17–#18)
- GraphQL (EPIC-03)
- Redis (EPIC-04)

## Epic success criteria (from #82)

- Sale status rules are enforced in the domain
- `UNIQUE(flash_sale_id, user_id)` is enforced by the database on **Purchase**
- Inventory reservation is atomic and transactional
- No overselling under concurrent load in integration tests

Child acceptance criteria remain on the linked issues; this spec does not duplicate them beyond the #11, #12, #13, and #14 contracts above.
