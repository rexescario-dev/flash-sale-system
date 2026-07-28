# EPIC-02 — Flash Sale Domain & Persistence (Design Spec)

**Status:** Draft (#20 transactional purchase flow contract — pending review)
**Date:** 2026-07-26 (updated 2026-07-28 for #20)
**Epic:** [EPIC-02 #82](https://github.com/rexescario-dev/flash-sale-system/issues/82)
**Next implementation ticket:** [#20 — Implement transactional purchase flow](https://github.com/rexescario-dev/flash-sale-system/issues/20)
**Completed detailed contracts:** [#11 — FlashSale](https://github.com/rexescario-dev/flash-sale-system/issues/11) (merged via PR #98), [#12 — Product](https://github.com/rexescario-dev/flash-sale-system/issues/12) (merged via PR #99), [#13 — Purchase](https://github.com/rexescario-dev/flash-sale-system/issues/13) (merged via PR #100), [#14 — Sale status rules](https://github.com/rexescario-dev/flash-sale-system/issues/14) (merged via PR #101), [#15 — Database schema](https://github.com/rexescario-dev/flash-sale-system/issues/15) (merged via PR #102), [#16 — Unique purchase constraint](https://github.com/rexescario-dev/flash-sale-system/issues/16) (merged via PR #103), [#17 — Flash-sale repository](https://github.com/rexescario-dev/flash-sale-system/issues/17) (merged via PR #104 at `432c142+`), [#18 — Purchase repository](https://github.com/rexescario-dev/flash-sale-system/issues/18) (merged via PR #105 at `56f5a3e+`), [#19 — Atomic inventory reservation](https://github.com/rexescario-dev/flash-sale-system/issues/19) (merged via PR #106 at `3f474c4+`)
**Child issues:** #11–#20
**Repository:** `rexescario-dev/flash-sale-system`
**Depends on:** EPIC-01 (#81), #11–#19 merged to `main`

## Goal

Implement the flash-sale domain, PostgreSQL schema, repositories, and transactional concurrency-safe purchase flow — with a pure domain package as a first-class workspace boundary.

## Architectural principle

> The domain defines business rules and invariants; application and infrastructure layers coordinate enforcement that requires external state or persistence.

Share intentional domain concepts in `@flash-sale/domain`. Keep Prisma, NestJS, mappers, and repository adapters in `apps/api`. Do not dump domain models into `@flash-sale/types`.

## Locked decisions

| Area                  | Decision                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain package        | `packages/domain` → `@flash-sale/domain`                                                                                                                                                                               |
| Domain purity         | `@flash-sale/domain` has **no runtime dependencies** (devDependencies allowed). It must also have zero NestJS/Prisma/Redis/infrastructure dependencies.                                                                |
| Shared types          | `@flash-sale/types` remains non-domain (transport/contracts only when both apps need them)                                                                                                                             |
| Prisma                | Stays in `apps/api`; schema/migrations/client local to the API                                                                                                                                                         |
| Mapping               | Prisma ↔ domain mapping lives outside `@flash-sale/domain`                                                                                                                                                             |
| Repository ports      | **Locked in #17:** ports live in `@flash-sale/domain` as thin interfaces + Nest injection tokens (no Prisma/Nest types on the port). `#18`/`#19`/`#20` follow the same location.                                       |
| Repository adapters   | Prisma implementations, mappers, and Nest feature modules always in `apps/api`                                                                                                                                         |
| #17 load style        | `FlashSaleRepository.findById` → `Promise<FlashSale \| null>`; Prisma read adapter + mapper/`reconstitute`; **read-only**; unit + PostgreSQL integration proof                                                         |
| #18 purchase repo     | `PurchaseRepository.save` + `findByFlashSaleAndUser`; domain `PurchaseConflictError` for composite uniqueness only; `Purchase.reconstitute`; dedicated `apps/api/src/purchase/` Nest slice                             |
| #19 reservation       | Dedicated `FlashSaleReservation.tryReserve` → `Promise<boolean>`; `$executeRaw` conditional `UPDATE`; `FlashSaleRepository` stays read-only; Nest wiring extends `FlashSaleModule`; concurrent PG proof                |
| #20 purchase flow     | Domain `PurchaseFlow` + `PurchaseOutcome` + opaque `PersistenceContext`; Nest `PurchaseFlowService` in `PurchaseModule`; compose `#14`/`#17`/`#18`/`#19`; Prisma `$transaction` with shared ctx; unit + sequential PG  |
| GraphQL purchase APIs | Out of EPIC-02; deferred to EPIC-03                                                                                                                                                                                    |
| Redis client          | Out of EPIC-02; deferred to EPIC-04 (Compose service already exists)                                                                                                                                                   |
| #11 modeling style    | Rich `FlashSale` class with private state, `create` / `reconstitute`, getters                                                                                                                                          |
| #12 modeling style    | Rich `Product` class with private state, **`create` only**, getters; mirrors #11 without premature shared helpers                                                                                                      |
| #13 modeling style    | Rich `Purchase` class with private state, **`create`** + entity invariants (IDs preserved / defensive `purchasedAt`). `#18` adds `reconstitute` because persistence hydration now exists — not a retroactive `#13` gap |
| #14 status style      | Instance method `FlashSale.getStatus(nowUtc)`; string-union `FlashSaleStatus`; temporal-first precedence; no purchase-gate helpers                                                                                     |
| #15 schema style      | Prisma-first in `apps/api`; domain-aligned columns; app-supplied `String @id`; snake_case SQL maps; `timestamptz(3)`; `onDelete: Restrict`; FK indexes; audit timestamps; named CHECKs via edited migration            |
| #16 uniqueness style  | Prisma-first `@@unique([flashSaleId, userId])`; drop redundant `@@index([flashSaleId])`; one new append-only migration; catalog + behavioral proof; no `ALREADY_PURCHASED` mapping                                     |
| Value objects         | Not introduced in #11–#20 (`SaleWindow`, `Stock` deferred until justified)                                                                                                                                             |
| Spec shape            | EPIC-02 umbrella architecture + detailed #11–#20 contracts                                                                                                                                                             |

## Dependency direction

```text
apps/api
  ├── flash-sale/ (Nest feature slice)     (#17 read adapter; #19 reservation adapter; shared module)
  ├── purchase/   (Nest feature slice)     (#18 persistence; #20 PurchaseFlowService + module wiring)
  ├── NestJS
  ├── Prisma                               (#20: $transaction + PersistenceContext binder)
  ├── @flash-sale/types                    (non-domain transport/contracts)
  │
  └── depends on
        ▼
@flash-sale/domain
  └── ZERO runtime dependencies
      ├── entities / domain errors (incl. PurchaseConflictError, FlashSaleNotFoundError)
      ├── repository / reservation / purchase-flow ports (interfaces + injection tokens)
      ├── PurchaseOutcome + structurally opaque PersistenceContext (runtime-branded for infra)
      ├── no NestJS
      ├── no Prisma
      └── no Redis

PurchaseFlowService (apps/api)
        │ implements PurchaseFlow; opens Prisma $transaction; passes PersistenceContext
        ├── FlashSaleRepository.findById (pre-txn)
        ├── FlashSale.getStatus (pre-txn)
        ├── FlashSaleReservation.tryReserve(..., ctx)
        └── PurchaseRepository.save(..., ctx)

PrismaFlashSaleRepository (apps/api)     PrismaFlashSaleReservation (apps/api)     PrismaPurchaseRepository (apps/api)
        │ implements FlashSaleRepository         │ implements FlashSaleReservation            │ implements PurchaseRepository
        ▼                                        ▼                                            ▼
   PostgreSQL (read)                    PostgreSQL (conditional UPDATE)                  PostgreSQL
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

Atomic stock reservation (`#19`) is a **command port**, not a mapper/`reconstitute` path: one conditional SQL `UPDATE` answers success via affected-row count.

Transactional purchase (`#20`) is a **domain use-case port** (`PurchaseFlow`) implemented by a Nest service that opens a Prisma `$transaction` and passes an opaque `PersistenceContext` into the `#19` / `#18` write ports so reserve + save share one unit of work.

### Repository / reservation / flow ports (#17–#20)

**Port location is locked by #17:**

| Concern                         | Location                                                                  |
| ------------------------------- | ------------------------------------------------------------------------- |
| Repository / reservation / flow | `@flash-sale/domain`                                                      |
| Nest injection token for a port | `@flash-sale/domain` (exported `Symbol` beside the interface)             |
| Prisma adapter / Nest service   | `apps/api` (Nest feature slice)                                           |
| Prisma ↔ domain mapper          | `apps/api` (same feature slice; N/A for `#19` reservation / `#20` flow)   |
| Nest composition module         | `apps/api` (`FlashSaleModule` / `PurchaseModule`; `#20` extends purchase) |

`#17` introduced `FlashSaleRepository` + `PrismaFlashSaleRepository` (**read**/`findById` only — stays read-only). `#18` introduced `PurchaseRepository` + Prisma adapter (`save` + `findByFlashSaleAndUser`) and maps **composite** uniqueness violations to domain-owned `PurchaseConflictError`. `#19` introduces `FlashSaleReservation` + Prisma `$executeRaw` conditional decrement (boolean success). `#20` composes `#14` `getStatus` + `#17` load + `#19` reserve + `#18` save in a transaction, maps `PurchaseConflictError` → `ALREADY_PURCHASED`, and returns typed `PurchaseOutcome` values.

## EPIC-02 roadmap

| Issues | Focus                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------- |
| #11    | `FlashSale` entity + `@flash-sale/domain` package                                                     |
| #12    | `Product` domain model                                                                                |
| #13    | `Purchase` domain model (rule documented; no uniqueness enforcement API)                              |
| #14    | UTC status rules: `UPCOMING` / `ACTIVE` / `SOLD_OUT` / `ENDED`                                        |
| #15    | PostgreSQL/Prisma schema for FlashSale / Product / Purchase                                           |
| #16    | Purchase uniqueness constraint + persistence uniqueness invariants                                    |
| #17    | `FlashSaleRepository` port in domain + Prisma read adapter (`findById`) + mapper                      |
| #18    | `PurchaseRepository` + Prisma adapters; map DB uniqueness violations to typed repo/infra errors       |
| #19    | Atomic inventory reservation                                                                          |
| #20    | Transactional purchase flow; typed outcomes including `ALREADY_PURCHASED`; sequential atomicity proof |

Intended implementation sequence after domain models:

```text
#11 FlashSale
      │
      ├── sale-window invariant (create / reconstitute)
      │
      └── #14 derived status (getStatus)
               │
#12 Product    │
#13 Purchase   │
               ▼
#15 Persistence schema (FlashSale / Product / Purchase)   ← done (PR #102)
      ↓
#16 Purchase uniqueness constraint UNIQUE(flash_sale_id, user_id)   ← done (PR #103)
      ↓
#17 FlashSaleRepository port + Prisma findById load path   ← done (PR #104)
      ↓
#18 PurchaseRepository + uniqueness → PurchaseConflictError   ← done (PR #105)
      ↓
#19 Atomic stock reservation   ← done (PR #106)
      ↓
#20 Transactional purchase flow   ← next
      ├── status / purchase eligibility (uses getStatus; no purchase-gate helpers on FlashSale)
      ├── ALREADY_PURCHASED (PurchaseConflictError → outcome; txn rollback)
      ├── reservation (composes #19 via PersistenceContext)
      └── sequential PG proof of atomicity + status gates
```

Notes:

- The uniqueness constraint is specifically on **Purchase**: `UNIQUE(flash_sale_id, user_id)`. It prevents duplicate purchases; it does **not** by itself make stock reservation concurrency-safe. Atomic reservation is owned by `#19`; full purchase-transaction composition and `ALREADY_PURCHASED` are owned by `#20`.
- Exact implementation details for `#20` are in the detailed `#20` contract below (`#11`–`#19` contracts remain above/earlier in this file).
- **Temporary identity-normalization inconsistency:** `#11` `FlashSale` and `#13` `Purchase` **preserve** non-trimmed IDs; `#12` `Product` **trims** `id` / `name` / provided `description`. This is an **acknowledged cross-entity inconsistency, not a desired domain convention**. Until a dedicated identity-normalization ticket resolves it, each entity must preserve its existing contract. New tickets must **not** silently normalize or de-normalize IDs for consistency — including `#17`/`#18`/`#19`/`#20` (map/persist/query IDs exactly as stored; do not trim IDs). Uniqueness and reservation match exact stored strings.

## Target package tree (after #20)

```text
packages/
  domain/                         # @flash-sale/domain
    package.json
    tsconfig.json
    jest.config.cjs
    src/
      index.ts                    # public exports (minimal); re-exports ports + ID brands
      ids.ts                      # compile-time brands only
      persistence-context.ts      # structurally opaque PersistenceContext + runtime brand (#20)
      flash-sale/
        flash-sale.ts
        flash-sale.errors.ts
        flash-sale-not-found.error.ts  # FlashSaleNotFoundError (#20)
        flash-sale.spec.ts
        flash-sale.repository.ts   # FlashSaleRepository + FLASH_SALE_REPOSITORY (#17; read-only)
        flash-sale.reservation.ts  # FlashSaleReservation + FLASH_SALE_RESERVATION (#19; ctx? in #20)
      product/
        product.ts
        product.errors.ts
        product.spec.ts
      purchase/
        purchase.ts               # create + reconstitute (#18)
        purchase.errors.ts
        purchase-conflict.error.ts  # PurchaseConflictError (#18)
        purchase.repository.ts      # PurchaseRepository + PURCHASE_REPOSITORY (#18; save ctx? in #20)
        purchase.outcome.ts         # PurchaseOutcome (#20)
        purchase.flow.ts            # PurchaseFlow + PURCHASE_FLOW (#20)
        purchase.spec.ts
  types/
  typescript-config/
  eslint-config/

apps/api/
  src/
    flash-sale/                   # Nest feature slice (#17 + #19)
      flash-sale.mapper.ts
      flash-sale.mapper.spec.ts
      prisma-flash-sale.repository.ts
      prisma-flash-sale.repository.spec.ts
      prisma-flash-sale.reservation.ts
      prisma-flash-sale.reservation.spec.ts
      flash-sale.module.ts        # exports FLASH_SALE_REPOSITORY + FLASH_SALE_RESERVATION
    purchase/                     # Nest feature slice (#18 + #20)
      purchase.mapper.ts
      purchase.mapper.spec.ts
      prisma-purchase.repository.ts
      prisma-purchase.repository.spec.ts
      purchase-flow.service.ts
      purchase-flow.service.spec.ts
      purchase.module.ts          # imports FlashSaleModule; exports PURCHASE_REPOSITORY + PURCHASE_FLOW
    prisma/                       # PrismaModule / PrismaService + PersistenceContext binder
      prisma.service.ts
      prisma-persistence-context.ts
    app.module.ts                 # imports FlashSaleModule + PurchaseModule
  test/
    schema/                       # #15/#16 catalog + uniqueness behavioral tests
    flash-sale/                   # #17 read round-trip + #19 reservation / concurrency
      prisma-flash-sale.repository.integration.spec.ts
      prisma-flash-sale.reservation.integration.spec.ts
    purchase/                     # #18 purchase repo + #20 purchase-flow sequential integration
      prisma-purchase.repository.integration.spec.ts
      purchase-flow.integration.spec.ts
```

`#20` does **not** add a new Nest module. Domain gains the purchase-flow port, outcomes, opaque context, and not-found error; API extends the existing purchase feature slice + Prisma binder + integration tests. `#19` reservation concurrency proof remains authoritative for oversell of the reservation primitive.

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
| Prisma Product table / migrations           | #15                          |
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

There is no derived state in `#13`, so **`Purchase.reconstitute` is out of #13** (YAGNI). Ownership timeline:

```text
#13 Purchase          → create + entity invariants (complete for that ticket)
#18 Purchase repository → introduces reconstitute because persistence hydration now exists
```

`reconstitute()` is a domain API needed by the repository adapter; its implementation is **delivered in `#18`**, not a sign that `#13` was incomplete.

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
| `Purchase.reconstitute`                         | `#18`                                   |
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

## #15 — Implement database schema (detailed contract)

### Issue acceptance criteria

From GitHub [#15](https://github.com/rexescario-dev/flash-sale-system/issues/15):

- Product, FlashSale, and Purchase tables exist via Prisma migrations
- Timestamps and relations are correct

### Design interpretation for #15

- Implement the PostgreSQL persistence foundation in `apps/api` using Prisma (`schema.prisma` + **exactly one new migration** appended to the existing Prisma migration history — creating that history if it is still empty after EPIC-01).
- **Domain contracts (`#11`–`#13`) are the source of truth for persisted business columns.** Do not invent `price`, product-level `stock`, `quantity`, purchase status enums, or other fields absent from the domain.
- **IDs are application/domain supplied.** Persist `String @id` with **no** Prisma/DB `@default(cuid())` / `@default(uuid())`. Domain factories already accept branded IDs; Prisma must persist the supplied values as-is and must not trim or otherwise normalize them. Broader ID-format strategy (UUIDv7/ULID/etc.) is deferred to a future identity ticket.
- **Status is derived, not persisted.** Do **not** add a `status` column on `FlashSale` (or elsewhere). Status continues to come from `FlashSale.getStatus(nowUtc)` (`#14`).
- **Purchase uniqueness is owned by `#16`.** Do **not** add `@@unique([flashSaleId, userId])` / `UNIQUE(flash_sale_id, user_id)` in `#15` (neither in `schema.prisma` nor in the `#15` migration SQL). `#16` adds the positive uniqueness schema test; `#15` does **not** require a runtime “unique constraint absent” assertion.
- **No repositories, mappers, GraphQL, or Redis client** in `#15`.
- **No domain package changes** in `#15`.
- Approach: **Prisma models + one new edited migration** for named CHECK constraints Prisma cannot express first-class.

### Locked decisions (#15)

| Decision            | Choice                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Column sets         | Domain-aligned Product / FlashSale / Purchase + audit timestamps                                                    |
| Audit timestamps    | `createdAt` + `updatedAt` on all three models                                                                       |
| Domain timestamps   | `FlashSale.startsAt` / `endsAt`, `Purchase.purchasedAt` (exposed by domain); audit timestamps stay persistence-only |
| IDs                 | `String @id` with **no** DB `@default`; application/domain supplies IDs before persist                              |
| FK delete behavior  | Explicit `onDelete: Restrict` on both relations (historical integrity)                                              |
| FK indexes          | `@@index([productId])` on FlashSale; `@@index([flashSaleId])` on Purchase; **no** standalone `@@index([userId])`    |
| SQL naming          | Snake_case tables/columns via `@@map` / `@map`; Prisma Client remains camelCase                                     |
| DateTime storage    | Every `DateTime` is `@db.Timestamptz(3)`                                                                            |
| CHECK constraints   | Four named FlashSale structural CHECKs in migration SQL (see below)                                                 |
| Purchase uniqueness | Deferred to `#16` (no `@@unique` and no composite unique index in `#15`)                                            |
| Persisted status    | **None**                                                                                                            |
| Delivery approach   | Prisma-first schema; one new migration appended to history; manually add named CHECKs                               |
| Verification        | Lightweight PostgreSQL schema inspection test (catalog facts)                                                       |
| CI                  | Dedicated `schema-test` job + branch-protection/ruleset requirement                                                 |

### Persistence vs domain timestamps

| Kind                         | Fields                              | Exposed on domain entities?                      |
| ---------------------------- | ----------------------------------- | ------------------------------------------------ |
| Domain timestamps            | `startsAt`, `endsAt`, `purchasedAt` | Yes                                              |
| Persistence/audit timestamps | `createdAt`, `updatedAt`            | **No** — Prisma-only at the persistence boundary |

```prisma
createdAt DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
updatedAt DateTime @updatedAt @db.Timestamptz(3) @map("updated_at")
```

**`updatedAt` semantics:** `@updatedAt` is maintained by **Prisma Client** on Prisma-managed updates. It is **not** a PostgreSQL trigger and is **not** used for business decisions. Any future raw SQL / `updateMany` / database-level update path (notably `#19`–`#20` inventory reservation) that mutates these rows must explicitly maintain `updated_at` if audit semantics require it.

**Mapper implication (for `#17`–`#18`, not implemented in `#15`):** mappers may discard `createdAt` / `updatedAt` when converting Prisma records to domain entities because these fields are persistence/audit metadata and are not represented by domain entities. Domain factories such as `Product.create` / `Purchase.create` / `Purchase.reconstitute` / `FlashSale.reconstitute` do not accept audit timestamps.

### Target Prisma schema (`apps/api/prisma/schema.prisma`)

Authoritative model contract for `#15` (generator/datasource unchanged from EPIC-01):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id          String   @id
  name        String
  description String?
  createdAt   DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt   DateTime @updatedAt @db.Timestamptz(3) @map("updated_at")

  flashSales FlashSale[]

  @@map("products")
}

model FlashSale {
  id             String   @id
  productId      String   @map("product_id")
  startsAt       DateTime @db.Timestamptz(3) @map("starts_at")
  endsAt         DateTime @db.Timestamptz(3) @map("ends_at")
  totalStock     Int      @map("total_stock")
  remainingStock Int      @map("remaining_stock")
  createdAt      DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt      DateTime @updatedAt @db.Timestamptz(3) @map("updated_at")

  product   Product    @relation(fields: [productId], references: [id], onDelete: Restrict)
  purchases Purchase[]

  @@index([productId])
  @@map("flash_sales")
}

model Purchase {
  id          String   @id
  flashSaleId String   @map("flash_sale_id")
  userId      String   @map("user_id")
  purchasedAt DateTime @db.Timestamptz(3) @map("purchased_at")
  createdAt   DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt   DateTime @updatedAt @db.Timestamptz(3) @map("updated_at")

  flashSale FlashSale @relation(fields: [flashSaleId], references: [id], onDelete: Restrict)

  @@index([flashSaleId])
  @@map("purchases")
}
```

Relation graph:

```text
products
   │ onDelete: Restrict
   ▼
flash_sales
   │ onDelete: Restrict
   ▼
purchases
```

**`onDelete: Restrict` rationale:** parent deletion is intentionally restricted because flash-sale and purchase rows represent historical business data; cascading deletion is not appropriate for the initial persistence model. Configure `Restrict` explicitly (do not rely on Prisma/PostgreSQL defaults). Schema tests must verify the actual catalog delete action is `RESTRICT` (not merely “non-cascade”).

There is **no** `User` table. `Purchase.userId` is a plain `String` identity reference owned by authentication/identity concerns outside EPIC-02. Do **not** add `@@index([userId])` in `#15`; the `#16` unique composite `(flash_sale_id, user_id)` will cover the “has this user purchased this sale?” lookup.

### Migration & CHECK constraints

`#15` ships **exactly one new** Prisma migration (appended to existing history) that creates all three tables, columns, primary keys, foreign keys with `ON DELETE RESTRICT`, and explicit indexes on `flash_sales(product_id)` and `purchases(flash_sale_id)`.

Because Prisma does not first-class these structural invariants, **manually add** the following **named** PostgreSQL `CHECK` constraints to that migration SQL (on `flash_sales`):

```sql
CONSTRAINT flash_sales_total_stock_positive
  CHECK (total_stock > 0),

CONSTRAINT flash_sales_remaining_stock_non_negative
  CHECK (remaining_stock >= 0),

CONSTRAINT flash_sales_remaining_stock_lte_total
  CHECK (remaining_stock <= total_stock),

CONSTRAINT flash_sales_starts_before_ends
  CHECK (starts_at < ends_at)
```

These are defense-in-depth for universally true **row-local** structural rules. They do **not** replace domain factories or later purchase/reservation behavior.

**Migration preservation rules:**

> The `#15` migration contains manually added named PostgreSQL CHECK constraints that are not represented in `schema.prisma`. Never delete, regenerate, squash, or replace the `#15` migration without first preserving or reintroducing these constraints.

> The schema verification test is the regression guard for these manually maintained constraints (assert by **constraint name**).

**Explicitly not CHECK-enforced in `#15`:**

| Rule                                              | Owner                     |
| ------------------------------------------------- | ------------------------- |
| Sale lifecycle / purchasability                   | `#14` / `#20`             |
| Atomic stock decrement / reservation              | `#19`–`#20`               |
| One purchase per user per flash sale              | `#16` (+ `#18` / `#20`)   |
| “Sale must not start in the past” creation policy | Not a current domain rule |

### Naming convention

```text
Domain / Prisma Client / TypeScript     PostgreSQL
────────────────────────────────────────────────────
Product                                 products
FlashSale                               flash_sales
Purchase                                purchases
createdAt                               created_at
updatedAt                               updated_at
productId                               product_id
flashSaleId                             flash_sale_id
userId                                  user_id
purchasedAt                             purchased_at
totalStock                              total_stock
remainingStock                          remaining_stock
startsAt                                starts_at
endsAt                                  ends_at
```

### Target tree (after #15)

```text
apps/api/
  prisma/
    schema.prisma
    migrations/
      <timestamp>_init_flash_sale_schema/
        migration.sql          # tables + PKs + FKs + Restrict + indexes + named CHECKs
  src/
    prisma/                    # existing PrismaModule / PrismaService (unchanged role)
  test/
    schema/                    # lightweight DB schema verification (name may vary)
      ...schema*.spec.ts
  package.json                 # add test:schema (and migrate deploy helper if needed)
.github/workflows/ci.yml       # add dedicated schema-test job
```

`@flash-sale/domain` package tree is unchanged by `#15`.

### Testing (#15)

Lightweight **PostgreSQL-backed schema inspection** tests (not repository/mapper round-trips). Prefer catalog facts via `information_schema` and `pg_catalog` / `pg_constraint` over inserting business rows.

Required coverage after `prisma migrate deploy`:

**Structure**

- Tables `products`, `flash_sales`, `purchases` exist
- Each table has `id` as its **PRIMARY KEY**
- Expected columns exist with snake_case names
- Nullability:

| Table         | Column            | Nullable |
| ------------- | ----------------- | -------- |
| `products`    | `id`              | NO       |
| `products`    | `name`            | NO       |
| `products`    | `description`     | YES      |
| `products`    | `created_at`      | NO       |
| `products`    | `updated_at`      | NO       |
| `flash_sales` | `id`              | NO       |
| `flash_sales` | `product_id`      | NO       |
| `flash_sales` | `starts_at`       | NO       |
| `flash_sales` | `ends_at`         | NO       |
| `flash_sales` | `total_stock`     | NO       |
| `flash_sales` | `remaining_stock` | NO       |
| `flash_sales` | `created_at`      | NO       |
| `flash_sales` | `updated_at`      | NO       |
| `purchases`   | `id`              | NO       |
| `purchases`   | `flash_sale_id`   | NO       |
| `purchases`   | `user_id`         | NO       |
| `purchases`   | `purchased_at`    | NO       |
| `purchases`   | `created_at`      | NO       |
| `purchases`   | `updated_at`      | NO       |

**Types / relations / indexes**

- Timestamp columns report `data_type = timestamp with time zone` and `datetime_precision = 3` via `information_schema.columns`
- `flash_sales.product_id` FK → `products.id` with delete action `RESTRICT`
- `purchases.flash_sale_id` FK → `flash_sales.id` with delete action `RESTRICT`
- Index exists on `flash_sales(product_id)`
- Index exists on `purchases(flash_sale_id)`

**CHECK constraints (by name)**

- `flash_sales_total_stock_positive`
- `flash_sales_remaining_stock_non_negative`
- `flash_sales_remaining_stock_lte_total`
- `flash_sales_starts_before_ends`

**Ticket-boundary notes (not runtime “absence” tests)**

- `#15` `schema.prisma` and migration must not introduce `@@unique([flashSaleId, userId])`
- `#16` owns the positive assertion that `UNIQUE(flash_sale_id, user_id)` exists

Do **not** assert repository ports, domain mappers, GraphQL, Redis, or purchase-flow outcomes in `#15`.

### CI (#15)

Add a dedicated CI job (e.g. `schema-test`) that:

1. Provisions a PostgreSQL service
2. Sets `DATABASE_URL`
3. Installs workspace deps
4. Runs `prisma generate` + `prisma migrate deploy` for `apps/api`
5. Runs the schema verification tests (e.g. `pnpm --filter api test:schema`)

Keep existing lint / typecheck / unit-test / build jobs **DB-independent**. The job must fail if PKs/nullability/FKs/`Restrict`/indexes/`timestamptz(3)`/named CHECKs regress (including accidental CHECK removal after migration regeneration).

**Repository configuration prerequisite:** adding the workflow job alone does not make it merge-blocking. Configure GitHub branch protection / rulesets so `schema-test` is required for PR merge to the protected default branch. If that settings change is outside the code PR, track it as a repo-config prerequisite for `#15` DoD.

Exact YAML should follow existing `.github/workflows/ci.yml` conventions (pnpm, Node from `.nvmrc`, frozen lockfile).

### Explicitly out of #15

| Concern                                                                                 | Owner                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `@@unique([flashSaleId, userId])` / positive uniqueness schema + duplicate-insert tests | `#16`                                                   |
| Repository ports                                                                        | `#17`                                                   |
| Prisma repository adapters / mappers / uniqueness error mapping                         | `#18`                                                   |
| Atomic inventory reservation (and any raw-SQL `updated_at` maintenance)                 | `#19`                                                   |
| Transactional purchase flow / `ALREADY_PURCHASED`                                       | `#20`                                                   |
| Persisted `status` column                                                               | Not in EPIC-02 (status is derived)                      |
| Domain entity changes / cross-entity ID normalization alignment                         | Follow-up debt ticket / not `#15`                       |
| GraphQL purchase APIs                                                                   | EPIC-03                                                 |
| Redis client                                                                            | EPIC-04                                                 |
| Seed data / admin CRUD APIs                                                             | Later tickets                                           |
| UUIDv7/ULID generator standardization                                                   | Later identity ticket (IDs remain app-supplied strings) |
| Standalone `@@index([userId])`                                                          | Deferred until a user-purchase listing use case exists  |

### Definition of Done (#15)

- Implementation complete for this issue only
- Prisma models + one new migration create Product / FlashSale / Purchase with correct PKs, nullability, timestamps, relations, maps, `Restrict`, FK indexes, `timestamptz(3)`, and named FlashSale CHECKs
- Schema inspection tests added and passing
- Dedicated CI `schema-test` job runs migrations + schema tests against PostgreSQL; branch protection/ruleset requirement documented or applied
- ESLint and typecheck pass where applicable
- No unrelated changes (no uniqueness constraint; no repos/mappers; no GraphQL; no Redis; no domain package changes)
- If commits are authorized, commit messages follow `<type>: <MESSAGE>` (no `Co-authored-by`)

### Pre-implementation sequencing (#15)

```text
origin/main (EPIC-01 + #11 + #12 + #13 + #14 merged at 350dedf+)
    → sync local checkout
    → finalize this umbrella spec with #15 contract
    → write implementation plan
    → implement #15 on a feature branch
    → run schema-test + workspace quality gates
    → commit: <type>: <MESSAGE>
```

## #16 — Add unique purchase constraint (detailed contract)

### Issue acceptance criteria

From GitHub [#16](https://github.com/rexescario-dev/flash-sale-system/issues/16), interpreted for this contract:

- `UNIQUE(flash_sale_id, user_id)` exists in the database as a database-enforced unique constraint/invariant (PostgreSQL may expose this as a unique constraint and/or unique index depending on Prisma-generated DDL — tests assert the uniqueness invariant via catalog metadata, not a specific object type)
- Duplicate inserts for the same `(flash_sale_id, user_id)` pair fail at the DB layer

### Design interpretation for #16

- Enforce the one-purchase-per-user-per-flash-sale invariant at the **PostgreSQL** layer for `purchases`, aligning with the `#13` documented domain rule and the `#15` deferral of uniqueness.
- Deliver via **Prisma-first** schema change in `apps/api/prisma/schema.prisma`, then **exactly one new append-only** Prisma migration after the merged `#15` migration (`20260727005938_init_flash_sale_schema`). **Do not** rewrite, squash, or regenerate the `#15` migration.
- Replace the `#15` non-unique `@@index([flashSaleId])` with `@@unique([flashSaleId, userId])`. The resulting unique B-tree index on `(flash_sale_id, user_id)` also supports leftmost-prefix lookups on `flash_sale_id`, so the single-column index is redundant and must be removed in the same change.
- **Required migration SQL review gate:** after `prisma migrate` creates the migration (`--create-only` or equivalent), inspect the generated SQL. Stop/fail the ticket if Prisma generates unexpected DDL (for example: fails to drop the non-unique `purchases(flash_sale_id)` index, adds uniqueness on the wrong column order, renames unrelated objects, or rewrites `#15` artifacts). Only then apply via `prisma migrate deploy` (or the workspace’s established deploy path) and run tests.
- Prove both **catalog shape** and **runtime enforcement** (see Testing). Assert the uniqueness invariant by **ordered columns + uniqueness properties** in catalog metadata, not by Prisma-generated constraint/index names and not by assuming a specific PostgreSQL object type (constraint vs unique index). Do **not** introduce an explicit Prisma `map:` constraint name unless a project-wide naming convention already requires it (none today).
- Behavioral failure for a repeated exact `(flashSaleId, userId)` pair is asserted as Prisma **`P2002`** / PostgreSQL unique violation. The behavioral suite must also prove the constraint is **composite** (see Testing). Do **not** map that to `ALREADY_PURCHASED` or any typed repository/application error in `#16` (`#18` / `#20`).
- **No repositories, mappers, GraphQL, or Redis client** in `#16`.
- **No domain package changes** in `#16` (no Purchase uniqueness helpers; no `ALREADY_PURCHASED`; no FlashSale ID normalization changes).
- Status remains derived via `FlashSale.getStatus` — no persisted status column.

### Locked decisions (#16)

| Decision                                       | Choice                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Composite uniqueness                           | `@@unique([flashSaleId, userId])` → database-enforced uniqueness on `(flash_sale_id, user_id)` |
| Column order                                   | `(flash_sale_id, user_id)` — not `(user_id, flash_sale_id)`                                    |
| Redundant `#15` index                          | Remove `@@index([flashSaleId])` / drop non-unique `purchases(flash_sale_id)` index             |
| Standalone `user_id` index introduced by `#16` | **None**                                                                                       |
| Delivery approach                              | Prisma-first schema; one new append-only migration; required SQL review before apply           |
| `#15` migration                                | Immutable                                                                                      |
| Catalog identification                         | By ordered columns + uniqueness metadata; not by generated name or assumed object type         |
| Proof                                          | Catalog + behavioral (duplicate pair + composite cross-pair)                                   |
| Behavioral failure assertion                   | Prisma `P2002` / unique violation for repeated `(flashSaleId, userId)`                         |
| `ALREADY_PURCHASED` mapping                    | Deferred to `#18` / `#20`                                                                      |
| Persistence semantics                          | Unchanged from `#15`; `#16` introduces no trimming or normalization                            |
| Persisted status                               | **None**                                                                                       |
| CI                                             | Reuse existing dedicated `schema-test` job (migrate deploy + schema tests against PostgreSQL)  |

### Target Prisma `Purchase` model (after #16)

`Product` and `FlashSale` models remain as in the `#15` contract. Only `Purchase` index/unique declarations change:

```prisma
model Purchase {
  id          String   @id
  flashSaleId String   @map("flash_sale_id")
  userId      String   @map("user_id")
  purchasedAt DateTime @db.Timestamptz(3) @map("purchased_at")
  createdAt   DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt   DateTime @updatedAt @db.Timestamptz(3) @map("updated_at")

  flashSale FlashSale @relation(fields: [flashSaleId], references: [id], onDelete: Restrict)

  @@unique([flashSaleId, userId])
  @@map("purchases")
}
```

**Index rationale:** PostgreSQL can use the unique index on `(flash_sale_id, user_id)` for predicates filtering by the leftmost prefix `flash_sale_id`. Keeping `@@index([flashSaleId])` would create a redundant index with extra storage and write overhead. `#16` leaves the database in this intended final state — no follow-up cleanup ticket.

**Not equivalent:** a unique index on `(user_id, flash_sale_id)` would enforce the same uniqueness set but would **not** be the intended sale-scoped lookup shape. Catalog tests must assert ordered columns `[flash_sale_id, user_id]`.

### Migration (#16)

`#16` ships **exactly one new** Prisma migration appended after `#15`.

**Expected migration scope (only these intended index/unique changes):**

1. Drop the existing non-unique index on `purchases(flash_sale_id)` created by `#15` (Prisma name from `#15`: `purchases_flash_sale_id_idx`).
2. Add database-enforced uniqueness on ordered columns `(flash_sale_id, user_id)` (Prisma may emit `CREATE UNIQUE INDEX` and/or a unique constraint for `@@unique` — either is acceptable if the invariant is enforced).
3. **No** unrelated table, column, foreign key, CHECK, or index changes.

**Migration preservation rules:**

> Never delete, regenerate, squash, or replace the `#15` migration to “fold in” uniqueness. `#16` is append-only relative to `main`.

> The generated `#16` migration SQL is a review gate artifact: unexpected DDL (anything outside the expected migration scope above) is a stop condition, not something to apply blindly.

### Testing (#16)

Extend the existing PostgreSQL-backed schema/persistence tests under `apps/api/test/schema/` (same `test:schema` / `schema-test` CI path as `#15`). Tests may use `PrismaClient` directly for inserts; they must **not** introduce repositories, mappers, or application error types.

Required coverage after `prisma migrate deploy`:

**Catalog**

- A database-enforced uniqueness invariant exists on `purchases` whose **ordered** columns are exactly `[flash_sale_id, user_id]` (assert via catalog metadata that proves uniqueness on that ordered column set; do not require a specific PostgreSQL object type of “constraint” vs “unique index”).
- No non-unique index remains on `purchases` whose ordered columns are exactly `[flash_sale_id]`.
- Do **not** hard-code Prisma-generated names such as `purchases_flash_sale_id_user_id_key` as the primary identification strategy.
- `#16` must not introduce a new standalone index on `(user_id)` alone.

**Behavioral**

1. Seed a minimal valid graph: `Product` → `FlashSale` (and a second flash sale if needed for cross-pair coverage).
2. Insert first `Purchase` with exact pair `(flashSaleId = X, userId = Y)` — succeeds.
3. Insert a second `Purchase` with the same exact pair `(flashSaleId = X, userId = Y)` but a different `id` — fails with Prisma **`P2002`** (or equivalent unique-violation signal from the client used in the test).
4. Prove the constraint is **composite**, not accidental single-column uniqueness: at least one cross-pair insert must succeed. Recommended minimum:
   - `(flashSaleId = X, userId = Z)` succeeds (different user, same flash sale), **and/or**
   - `(flashSaleId = W, userId = Y)` succeeds (same user, different flash sale).
5. Do **not** assert `ALREADY_PURCHASED`, repository error codes, GraphQL errors, or purchase-flow outcomes.

**Ticket-boundary notes**

- `#16` owns positive uniqueness + removal of the redundant single-column index.
- `#18` owns mapping uniqueness violations to typed repository/infrastructure errors.
- `#20` owns translating that into the purchase outcome `ALREADY_PURCHASED`.
- Concurrent multi-client oversell / reservation races remain `#19`–`#20` (a sequential duplicate insert plus composite cross-pair coverage is sufficient for `#16`).

Update any `#15` schema assertions that assumed a non-unique `purchases(flash_sale_id)` index as the sale-scoped access path so they remain accurate after the unique composite replaces it (presence of an index usable for `flash_sale_id` lookups may still hold via the unique index; absence of a standalone non-unique `(flash_sale_id)` index becomes a `#16` requirement).

### CI (#16)

Reuse the dedicated `schema-test` job introduced in `#15`:

1. Provision PostgreSQL
2. Set `DATABASE_URL`
3. Install workspace deps
4. `prisma generate` + `prisma migrate deploy` for `apps/api` (must apply `#15` then `#16`)
5. Run schema/persistence verification tests (`pnpm --filter api test:schema`)

No new CI job is required unless the workspace script layout changes. Keep lint / typecheck / unit-test / build jobs DB-independent.

### Explicitly out of #16

| Concern                                                       | Owner                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| Rewrite / squash `#15` migration                              | Forbidden                                              |
| Repository ports                                              | `#17`                                                  |
| Prisma repository adapters / uniqueness → typed repo error    | `#18`                                                  |
| Typed `ALREADY_PURCHASED` purchase outcome                    | `#20`                                                  |
| Purchase uniqueness helpers in `@flash-sale/domain`           | Not in `#16` (owned past `#13`; not `#16`)             |
| Atomic inventory reservation                                  | `#19`                                                  |
| Transactional purchase flow / concurrency oversell tests      | `#20`                                                  |
| Persisted `status` column                                     | Not in EPIC-02 (status is derived)                     |
| Domain entity / FlashSale ID normalization alignment          | Dedicated follow-up; not `#16`                         |
| GraphQL purchase APIs                                         | EPIC-03                                                |
| Redis client                                                  | EPIC-04                                                |
| Explicit Prisma `map:` unique constraint name (naming policy) | Not required for `#16`                                 |
| Standalone `@@index([userId])`                                | Deferred until a user-purchase listing use case exists |

### Definition of Done (#16)

- Implementation complete for this issue only
- `schema.prisma` has `@@unique([flashSaleId, userId])` and no `@@index([flashSaleId])` on `Purchase`
- Exactly one new append-only migration after `#15`; generated SQL reviewed and accepted before deploy (scope limited to dropping the redundant `(flash_sale_id)` index and adding uniqueness on `(flash_sale_id, user_id)`)
- Catalog tests prove unique ordered `(flash_sale_id, user_id)` and absence of standalone non-unique `(flash_sale_id)` index
- Behavioral tests prove: repeated exact `(flash_sale_id, user_id)` fails with Prisma `P2002` / unique violation, and the constraint is composite (cross-pair purchase still succeeds)
- Existing `schema-test` CI path remains green against PostgreSQL with both migrations applied
- ESLint and typecheck pass where applicable
- No unrelated changes (no repos/mappers; no GraphQL; no Redis; no domain uniqueness helpers / `ALREADY_PURCHASED`; no FlashSale ID normalization changes)
- If commits are authorized, commit messages follow `<type>: <MESSAGE>` (no `Co-authored-by`)

### Pre-implementation sequencing (#16)

```text
origin/main (EPIC-01 + #11–#15 merged at 8e64323+)
    → sync local checkout
    → finalize this umbrella spec with #16 contract
    → write implementation plan
    → implement #16 on a feature branch
    → generate one migration; REQUIRED SQL review gate
    → migrate deploy + schema-test + workspace quality gates
    → commit: <type>: <MESSAGE>
```

## #17 — Implement flash-sale repository (detailed contract)

### Issue acceptance criteria

From GitHub [#17](https://github.com/rexescario-dev/flash-sale-system/issues/17), interpreted for this contract:

- Repository interface lives in the domain/application-facing boundary → **locked as `@flash-sale/domain` port**
- Prisma implementation can load flash sale state → **`findById` via Prisma adapter + mapper/`reconstitute`**

### Design interpretation for #17

- Deliver a **read-only** flash-sale persistence load path that returns a domain `FlashSale` (or `null` when missing).
- **Port ownership:** `FlashSaleRepository` interface + Nest injection token live in `@flash-sale/domain`. The domain package remains free of NestJS/Prisma/Redis and has **no runtime package dependencies**.
- **Adapter ownership:** `PrismaFlashSaleRepository`, `FlashSaleMapper`, and a minimal `FlashSaleModule` live in `apps/api` under `src/flash-sale/`.
- **Scope:** `findById` only. **No** `create` / `save` / `update` / `delete` on the port or adapter in `#17`.
- **Out of #17:** `PurchaseRepository`, uniqueness → typed repository error, `ALREADY_PURCHASED`, GraphQL, Redis client, controllers, application use cases, stock mutation.
- Approach: **thin domain port + focused Nest feature slice** (composition root for FlashSale persistence only).

### Locked decisions (#17)

| Decision                        | Choice                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Port location                   | `@flash-sale/domain` (`flash-sale.repository.ts`)                                                                                       |
| DI token ownership              | `FLASH_SALE_REPOSITORY` Symbol defined and exported from `@flash-sale/domain` (same file as the port; YAGNI for a separate `.token.ts`) |
| Port vs token roles             | `FlashSaleRepository` = domain port (compile-time); `FLASH_SALE_REPOSITORY` = runtime Nest DI token only                                |
| Adapter / mapper / Nest module  | `apps/api/src/flash-sale/`                                                                                                              |
| Read API                        | `findById(id: FlashSaleId): Promise<FlashSale \| null>`                                                                                 |
| Missing row                     | `null` (not an error)                                                                                                                   |
| Corrupt / invalid persisted row | `FlashSale.reconstitute` throws → `FlashSaleValidationError` **propagates unchanged** (no catch/remap/`null`)                           |
| Writes                          | Deferred (not in `#17`)                                                                                                                 |
| Purchase repo / uniqueness map  | `#18` / `#20`                                                                                                                           |
| Nest module surface             | Register concrete adapter + `useExisting` token alias; export token; register from `AppModule`                                          |
| Controllers / use cases         | **None** in `#17`                                                                                                                       |
| ID branding in mapper           | Local casts to `FlashSaleId` / `ProductId`; no public branding helpers                                                                  |
| Audit timestamps                | Discarded at mapper (`createdAt` / `updatedAt` are persistence-only; not on domain `FlashSale`)                                         |
| ID normalization                | Preserve stored strings; do not trim in mapper                                                                                          |
| Verification                    | Unit tests (mocked Prisma + corrupt reconstitution) **and** PostgreSQL hit/miss integration                                             |

### Port contract

`FlashSaleRepository` is the **domain port**. `FLASH_SALE_REPOSITORY` is its **runtime DI token**, exported from the domain package for infrastructure composition. TypeScript interfaces are erased at runtime; Nest needs the Symbol. The domain must **not** import Nest decorators (`@Injectable`, `@Inject`, `@Module`) on the port or token.

Keep both in one file (`flash-sale.repository.ts`) unless a later ticket justifies a split:

```ts
import type { FlashSaleId } from '../ids.js';
import type { FlashSale } from './flash-sale.js';

/** Runtime Nest DI token for FlashSaleRepository. Owned by @flash-sale/domain. */
export const FLASH_SALE_REPOSITORY = Symbol('FLASH_SALE_REPOSITORY');

export interface FlashSaleRepository {
  findById(id: FlashSaleId): Promise<FlashSale | null>;
}
```

Behavioral contract:

- `findById` is a **pure load**. It does not mutate domain state beyond constructing a reconstituted entity.
- Callers pass an already-branded `FlashSaleId` (same pattern as domain factories). Runtime blankness is not re-validated by the port; the adapter queries by the underlying string.
- Lookup uses exact string equality on `flash_sales.id` (Prisma `findUnique({ where: { id } })`).

### Error semantics (locked)

```text
Missing row:
  → Promise resolves to null

Existing row with invalid domain state:
  → FlashSaleValidationError propagates unchanged

No catch / rethrow as persistence / infrastructure error
No conversion of domain validation failure to null
```

### Mapper contract

> The mapper translates the Prisma `FlashSale` persistence record into the arguments required by `FlashSale.reconstitute()`. It does **not** perform independent domain validation or silently normalize invalid data.

`FlashSaleMapper.toDomain(row)` (name may vary; single direction is enough for `#17`):

| Prisma field     | Domain `reconstitute` input | Notes                                   |
| ---------------- | --------------------------- | --------------------------------------- |
| `id`             | `id: FlashSaleId`           | Local cast; preserve exact string       |
| `productId`      | `productId: ProductId`      | Local cast; preserve exact string       |
| `startsAt`       | `startsAt: Date`            | Absolute instant from Prisma `DateTime` |
| `endsAt`         | `endsAt: Date`              | Absolute instant                        |
| `totalStock`     | `totalStock: number`        |                                         |
| `remainingStock` | `remainingStock: number`    |                                         |
| `createdAt`      | —                           | **Discarded** (persistence/audit only)  |
| `updatedAt`      | —                           | **Discarded** (persistence/audit only)  |

- Mapper must **not** import Nest decorators.
- Mapper may accept the Prisma `FlashSale` model type **or** an equivalent plain object with the same business fields; it must not accept GraphQL DTOs.
- Mapper calls `FlashSale.reconstitute(...)` and does **not** catch its errors.

### Prisma adapter

`PrismaFlashSaleRepository` implements `FlashSaleRepository`. Mark the class `@Injectable()` (Nest). Inject `PrismaService`. Keep the adapter intentionally boring:

```text
findById(id)
  → prisma.flashSale.findUnique({ where: { id } })
  → null? return null
  → mapper.toDomain(row)   # → FlashSale.reconstitute(...)
  → return FlashSale
```

Do **not** include related `product` / `purchases` in `#17` queries (domain `FlashSale` only needs its own fields). Do **not** catch `FlashSaleValidationError`.

### Nest wiring

```ts
// FlashSaleModule — minimal composition root
@Module({
  exports: [FLASH_SALE_REPOSITORY],
  providers: [
    PrismaFlashSaleRepository,
    {
      provide: FLASH_SALE_REPOSITORY,
      useExisting: PrismaFlashSaleRepository,
    },
  ],
})
export class FlashSaleModule {}
```

- Prefer `useExisting` so the concrete adapter is a first-class provider and the domain token aliases it (avoids binding Nest DI metadata onto the domain interface).
- `PrismaModule` is already `@Global()`; `FlashSaleModule` does not need to import or re-export Prisma.
- `AppModule` imports `FlashSaleModule`.
- No controllers, resolvers, or application services in `#17`.

### Public API surface (#17 delta)

Export from `packages/domain/src/index.ts` (in addition to existing FlashSale exports):

- `FlashSaleRepository` (type) — domain port
- `FLASH_SALE_REPOSITORY` — runtime DI token (must be the domain-owned Symbol; never redefine in `apps/api`)

Do not export mapper, Prisma adapter, or Nest module from `@flash-sale/domain`.

### Testing (#17)

**Unit (no DB)** — under `apps/api/src/flash-sale/*.spec.ts`, run by the default API Jest suite (`pnpm --filter api test` / root `pnpm test`):

- Mapper: valid Prisma-shaped row → domain getters match (including exact IDs; audit fields ignored)
- Adapter: Prisma `findUnique` returns `null` → `findById` returns `null`
- Adapter: Prisma returns a row → mapper/`reconstitute` → `FlashSale`
- **Corrupt path (unit only):** invalid persisted state → `FlashSaleValidationError` propagates (`code` assertion; do not assert exact message strings). Do **not** weaken PostgreSQL CHECKs or schema to force an invalid insert for this case.
- Mock `PrismaService` / Prisma client — no PostgreSQL required

**PostgreSQL integration** — under `apps/api/test/flash-sale/`, dedicated Jest config + script (`jest.integration.config.cjs` / `pnpm --filter api test:integration`), same `DATABASE_URL` default pattern as `test:schema`:

1. `prisma migrate deploy` (CI) / assume migrated local DB
2. Seed minimal graph: `Product` row → `FlashSale` row (FK `Restrict` requires product)
3. Existing valid row → `findById` returns `FlashSale` (assert getters)
4. Missing id → `null`
5. Cleanup rows in `afterEach` / transaction rollback pattern consistent with existing schema tests where practical

Integration proves the real DB round-trip and missing-row semantics. Corrupt reconstitution stays a **unit** responsibility (CHECK constraints make invalid inserts impractical without weakening the schema).

Do **not** assert GraphQL, Redis, purchase uniqueness mapping, or `ALREADY_PURCHASED` in `#17`.

### CI (#17)

**What “extend schema-test” means:** keep the existing `.github/workflows/ci.yml` job named `schema-test` (same Postgres 16 service + `DATABASE_URL`). After the current migrate + schema steps, add one step that runs repository integration tests. Concrete sequence:

1. Provision PostgreSQL (unchanged service block)
2. `DATABASE_URL=postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale` (unchanged)
3. `pnpm install --frozen-lockfile`
4. `pnpm --filter api prisma:generate`
5. `pnpm --filter api prisma:migrate:deploy`
6. `pnpm --filter api test:schema` (unchanged `#15`/`#16` catalog + uniqueness tests)
7. **New:** `pnpm --filter api test:integration` (flash-sale repository hit/miss round-trip)

Do **not** invent a second Postgres service job unless the existing job becomes unreasonably slow. Default unit tests remain in the DB-independent `quality` job (`pnpm test`). Keep lint / typecheck / unit-test / build DB-independent.

### Explicitly out of #17

| Concern                                                    | Owner                      |
| ---------------------------------------------------------- | -------------------------- |
| `create` / `save` / write methods on `FlashSaleRepository` | Later persistence ticket   |
| `PurchaseRepository`                                       | `#18`                      |
| Map uniqueness violation → typed repository error          | `#18`                      |
| `ALREADY_PURCHASED` purchase outcome                       | `#20`                      |
| Controllers / GraphQL resolvers / use cases                | Later / EPIC-03            |
| Redis client                                               | EPIC-04                    |
| Stock mutation / reservation                               | `#19`–`#20`                |
| FlashSale ID normalization alignment                       | Follow-up debt ticket      |
| Schema / migration changes                                 | Not in `#17` (schema done) |
| Domain entity behavior changes                             | Not in `#17`               |

### Definition of Done (#17)

- Implementation complete for this issue only
- `FlashSaleRepository` (port) + `FLASH_SALE_REPOSITORY` (domain-owned DI token) exported from `@flash-sale/domain` — token not redefined in `apps/api`
- Prisma adapter can load flash-sale state via `findById` (hit → domain entity; miss → `null`)
- Mapper only builds `FlashSale.reconstitute` args; invalid rows propagate `FlashSaleValidationError` unchanged (unit-proven; no schema weakening)
- Minimal `FlashSaleModule` uses `useExisting` token alias and is imported by `AppModule`
- Unit tests + PostgreSQL hit/miss integration tests added and passing; `schema-test` CI job runs `test:schema` then `test:integration`
- ESLint and typecheck pass where applicable
- No unrelated changes (no writes; no purchase repo; no GraphQL; no Redis; no uniqueness/`ALREADY_PURCHASED` mapping; no schema/migration edits)
- If commits are authorized, commit messages follow `<type>: <MESSAGE>` (no `Co-authored-by`)

### Pre-implementation sequencing (#17)

```text
origin/main (EPIC-01 + #11–#16 merged at 10279ca+)
    → sync local checkout
    → finalize this umbrella spec with #17 contract
    → write implementation plan
    → implement #17 on a feature branch
    → unit + integration + workspace quality gates
    → commit: <type>: <MESSAGE>
```

## #18 — Implement purchase repository (detailed contract)

### Issue acceptance criteria

From GitHub [#18](https://github.com/rexescario-dev/flash-sale-system/issues/18), interpreted for this contract:

- Purchase create/lookup is implemented → **`save(purchase)` + `findByFlashSaleAndUser(flashSaleId, userId)`**
- Unique constraint violations map to domain/application results → **adapter maps composite `P2002` → domain `PurchaseConflictError`**; application outcome `ALREADY_PURCHASED` remains **`#20`**

### Design interpretation for #18

- Deliver a purchase persistence port with **insert** (`save`) and **composite-key lookup** (`findByFlashSaleAndUser`).
- **Port ownership:** `PurchaseRepository` interface + Nest injection token live in `@flash-sale/domain`. Domain remains free of NestJS/Prisma/Redis and has **no runtime package dependencies**.
- **Conflict ownership:** domain-owned `PurchaseConflictError` (`code: 'PURCHASE_CONFLICT'`) is the stable typed error that crosses the port. It is **not** named `AlreadyPurchasedError` and does **not** use `ALREADY_PURCHASED`.
- **Hydration:** `#18` adds `Purchase.reconstitute(...)` so load paths are distinct from `Purchase.create(...)` (symmetry with `FlashSale`).
- **Adapter ownership:** `PrismaPurchaseRepository`, `PurchaseMapper`, and a minimal `PurchaseModule` live in `apps/api` under `src/purchase/` (dedicated slice; do **not** fold into `FlashSaleModule`).
- **Out of #18:** `findById`, `ALREADY_PURCHASED`, GraphQL, Redis client, controllers, application use cases, transactions, stock mutation, schema/migration edits.
- Approach: **thin domain port + focused Nest feature slice** (composition root for Purchase persistence only).

### Locked decisions (#18)

| Decision                          | Choice                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Port location                     | `@flash-sale/domain` (`purchase.repository.ts`)                                                                                                                                                                    |
| DI token ownership                | `PURCHASE_REPOSITORY` Symbol defined and exported from `@flash-sale/domain` (same file as the port; YAGNI for a separate `.token.ts`)                                                                              |
| Port vs token roles               | `PurchaseRepository` = domain port (compile-time); `PURCHASE_REPOSITORY` = runtime Nest DI token only                                                                                                              |
| Port methods                      | `save(purchase)` + `findByFlashSaleAndUser(flashSaleId, userId)` only — **no `findById`**                                                                                                                          |
| ID types on port                  | Branded `FlashSaleId` + `UserId` (and `Purchase` entity for `save`)                                                                                                                                                |
| Conflict error                    | Domain-owned `PurchaseConflictError` with `readonly code = 'PURCHASE_CONFLICT'`                                                                                                                                    |
| Conflict file                     | `packages/domain/src/purchase/purchase-conflict.error.ts` (separate from `PurchaseValidationError`)                                                                                                                |
| Which `P2002` maps                | Exact set `{flashSaleId, userId}` **or** `{flash_sale_id, user_id}` (order-independent). Prisma 6 on this project emits SQL column names in `meta.target` (verified against PostgreSQL); accept both naming forms. |
| Other `P2002` (e.g. duplicate id) | Propagate as unexpected persistence error (do **not** remap)                                                                                                                                                       |
| `ALREADY_PURCHASED`               | **`#20` only**                                                                                                                                                                                                     |
| Hydration                         | `Purchase.reconstitute` added in `#18`; mapper calls it (not `create`)                                                                                                                                             |
| Corrupt / invalid persisted row   | `Purchase.reconstitute` throws → `PurchaseValidationError` **propagates unchanged**                                                                                                                                |
| Adapter / mapper / Nest module    | `apps/api/src/purchase/`                                                                                                                                                                                           |
| Nest module surface               | Register concrete adapter + `useExisting` token alias; export token; register from `AppModule`                                                                                                                     |
| Controllers / use cases           | **None** in `#18`                                                                                                                                                                                                  |
| ID branding in mapper             | Local casts to `PurchaseId` / `FlashSaleId` / `UserId`; no public branding helpers                                                                                                                                 |
| Audit timestamps                  | Discarded at `toDomain` (`createdAt` / `updatedAt` are persistence-only)                                                                                                                                           |
| ID normalization                  | Preserve stored strings; do not trim in mapper or adapter                                                                                                                                                          |
| `save` semantics                  | Insert-only (`prisma.purchase.create`); return `Promise<void>`; no update/upsert                                                                                                                                   |
| Verification                      | Unit tests (mocked Prisma + conflict targeting + corrupt reconstitution) **and** PostgreSQL save/lookup/conflict integration                                                                                       |
| Typecheck                         | Turbo `typecheck` already depends on `^build` (workspace deps must build before typecheck; keep this invariant)                                                                                                    |

### Port contract

`PurchaseRepository` is the **domain port**. `PURCHASE_REPOSITORY` is its **runtime DI token**. The domain must **not** import Nest decorators on the port or token.

Keep both in one file (`purchase.repository.ts`) unless a later ticket justifies a split:

```ts
import type { FlashSaleId, UserId } from '../ids.js';
import type { Purchase } from './purchase.js';

/** Runtime Nest DI token for PurchaseRepository. Owned by @flash-sale/domain. */
export const PURCHASE_REPOSITORY = Symbol('PURCHASE_REPOSITORY');

export interface PurchaseRepository {
  save(purchase: Purchase): Promise<void>;

  findByFlashSaleAndUser(flashSaleId: FlashSaleId, userId: UserId): Promise<Purchase | null>;
}
```

Behavioral contract:

- `save` persists a new `Purchase`. It does not mutate domain state. On success it resolves to `void`.
- `save` maps **only** composite uniqueness violations to `PurchaseConflictError`. Other persistence failures propagate.
- `findByFlashSaleAndUser` is a **pure load**. Missing row → `null` (not an error).
- Callers pass already-branded IDs. Runtime blankness is not re-validated by the port; the adapter queries by the underlying strings.
- Lookup uses Prisma composite unique: `findUnique({ where: { flashSaleId_userId: { flashSaleId, userId } } })`.
- Exact string equality (no trim).

### `Purchase.reconstitute` contract

Add alongside `Purchase.create`:

```ts
export type PurchaseReconstituteProps = {
  id: PurchaseId;
  flashSaleId: FlashSaleId;
  purchasedAt: Date;
  userId: UserId;
};
```

- Same field invariants as `create` (non-blank IDs via trim-for-blankness-only; valid `purchasedAt`; store original IDs unchanged; defensive `Date` copies).
- Prefer sharing private validation with `create` (e.g. `assertValid`) rather than duplicating checks — same pattern as `FlashSale`.
- Export `PurchaseReconstituteProps` from `@flash-sale/domain`.
- Domain unit tests cover `reconstitute` success + failure `code`s (mirror `create` coverage; do not assert exact message strings).

### `PurchaseConflictError` contract

```ts
export class PurchaseConflictError extends Error {
  readonly code = 'PURCHASE_CONFLICT' as const;

  constructor(message = 'Purchase conflicts with an existing purchase') {
    super(message);
    this.name = 'PurchaseConflictError';
  }
}
```

- Consumers branch on `code` / `instanceof`, not by parsing `message`.
- **Not** a `PurchaseValidationErrorCode`.
- **Not** `ALREADY_PURCHASED`.
- Export from `packages/domain/src/index.ts`.

Error boundary:

```text
Prisma P2002
    │
    ├── set(target) === { flashSaleId, userId }   (order-independent)
    │       └──→ PurchaseConflictError
    │                 └── #20 → ALREADY_PURCHASED
    │
    └── target = [id] / unknown / other
            └──→ propagate as unexpected persistence error
```

### Mapper contract

> The mapper translates between Prisma `Purchase` persistence records and domain `Purchase` arguments. It does **not** perform independent domain validation or silently normalize invalid data.

**`PurchaseMapper.toDomain(row)`**

| Prisma field  | Domain `reconstitute` input | Notes                                  |
| ------------- | --------------------------- | -------------------------------------- |
| `id`          | `id: PurchaseId`            | Local cast; preserve exact string      |
| `flashSaleId` | `flashSaleId: FlashSaleId`  | Local cast; preserve exact string      |
| `userId`      | `userId: UserId`            | Local cast; preserve exact string      |
| `purchasedAt` | `purchasedAt: Date`         | Absolute instant from Prisma DateTime  |
| `createdAt`   | —                           | **Discarded** (persistence/audit only) |
| `updatedAt`   | —                           | **Discarded** (persistence/audit only) |

**`PurchaseMapper.toPersistence(purchase)`** (for `save`)

| Domain getter      | Prisma create field     | Notes                         |
| ------------------ | ----------------------- | ----------------------------- |
| `getId()`          | `id`                    | Exact string                  |
| `getFlashSaleId()` | `flashSaleId`           | Exact string                  |
| `getUserId()`      | `userId`                | Exact string                  |
| `getPurchasedAt()` | `purchasedAt`           | Absolute instant              |
| —                  | `createdAt`/`updatedAt` | Omitted; DB / Prisma defaults |

- Mapper must **not** import Nest decorators.
- Mapper may accept the Prisma `Purchase` model type **or** an equivalent plain object with the same business fields; it must not accept GraphQL DTOs.
- `toDomain` calls `Purchase.reconstitute(...)` and does **not** catch its errors.
- `Purchase.getPurchasedAt()` is expected to return a defensive copy; `toPersistence()` must not expose mutable domain state (using the getter is sufficient).

### Prisma adapter

`PrismaPurchaseRepository` implements `PurchaseRepository`. Mark `@Injectable()`. Inject `PrismaService`. Keep it boring:

```text
save(purchase)
  → data = PurchaseMapper.toPersistence(purchase)
  → try prisma.purchase.create({ data })
  → catch Prisma P2002:
        if set(meta.target) === { flashSaleId, userId }   # order-independent
          throw PurchaseConflictError
        else
          rethrow
  → resolve void

findByFlashSaleAndUser(flashSaleId, userId)
  → prisma.purchase.findUnique({
       where: { flashSaleId_userId: { flashSaleId, userId } }
     })
  → null? return null
  → PurchaseMapper.toDomain(row)
  → return Purchase
```

**P2002 target inspection (locked):** do **not** remap every `P2002`. Inspect Prisma `meta.target`. Treat the violation as composite when the target is an **exact set** equal to either naming form — **order must not matter**:

```text
isComposite =
  set(target) === { flashSaleId, userId }
  OR
  set(target) === { flash_sale_id, user_id }
```

Required proof points:

- `['flashSaleId', 'userId']` → `PurchaseConflictError`
- `['userId', 'flashSaleId']` → `PurchaseConflictError` (order independence)
- `['flash_sale_id', 'user_id']` (or reversed) → `PurchaseConflictError` — **runtime shape on Prisma 6 + PostgreSQL in this project**
- `['id']` → rethrow original error
- unknown/other target → rethrow original error

Do **not** use ordered array equality such as `target === ['flashSaleId', 'userId']`.

Do **not** catch `PurchaseValidationError`. Do **not** include related `flashSale` in `#18` queries.

### Nest wiring

```ts
@Module({
  exports: [PURCHASE_REPOSITORY],
  providers: [
    PrismaPurchaseRepository,
    {
      provide: PURCHASE_REPOSITORY,
      useExisting: PrismaPurchaseRepository,
    },
  ],
})
export class PurchaseModule {}
```

- Prefer `useExisting` so the concrete adapter is a first-class provider and the domain token aliases it.
- `PrismaModule` is already `@Global()`; `PurchaseModule` does not need to import or re-export Prisma.
- `AppModule` imports `PurchaseModule` (alongside existing `FlashSaleModule`).
- No controllers, resolvers, or application services in `#18`.

### Public API surface (#18 delta)

Export from `packages/domain/src/index.ts` (in addition to existing Purchase / FlashSale exports):

- `PurchaseRepository` (type)
- `PURCHASE_REPOSITORY` (runtime DI token — domain-owned Symbol; never redefine in `apps/api`)
- `PurchaseConflictError`
- `PurchaseReconstituteProps` (type)

Do not export mapper, Prisma adapter, or Nest module from `@flash-sale/domain`.

### Testing (#18)

**Domain unit** — `@flash-sale/domain` `purchase.spec.ts`:

- `reconstitute` success preserves exact IDs + defensive `purchasedAt`
- `reconstitute` failures assert `code` only (`EMPTY_*` / `INVALID_PURCHASED_AT`)

**API unit (no DB)** — under `apps/api/src/purchase/*.spec.ts`, default API Jest suite:

- Mapper `toDomain`: valid row → getters match; audit fields ignored
- Mapper `toPersistence`: domain entity → Prisma create shape
- Adapter: `findUnique` returns `null` → `findByFlashSaleAndUser` returns `null`
- Adapter: row → mapper/`reconstitute` → `Purchase`
- Adapter: `create` succeeds → `save` resolves
- Adapter P2002 mapping (unit — **required minimum**):
  - `P2002` + `['flashSaleId', 'userId']` → `PurchaseConflictError` (`code === 'PURCHASE_CONFLICT'`)
  - `P2002` + `['userId', 'flashSaleId']` → `PurchaseConflictError` (proves **order independence**)
  - `P2002` + `['id']` → original Prisma error rethrown (not `PurchaseConflictError`)
  - `P2002` + unknown/other target → original Prisma error rethrown (not `PurchaseConflictError`)
- SQL-column targets (`flash_sale_id` / `user_id`) are **not** required unit coverage for `#18`
- **Corrupt path (unit only):** invalid persisted state → `PurchaseValidationError` propagates (`code` assertion)
- Mock `PrismaService` / Prisma client — no PostgreSQL required

**PostgreSQL integration** — under `apps/api/test/purchase/`, existing `jest.integration.config.cjs` / `pnpm --filter api test:integration` (extend suite; do not invent a second Postgres job):

1. Seed minimal graph: `Product` → `FlashSale` (FK `Restrict`) → `Purchase` via repo `save`
2. `save` then `findByFlashSaleAndUser` → domain getters match
3. Missing pair → `null`
4. Second `save` with same `(flashSaleId, userId)` but different `id` → `PurchaseConflictError`
5. Cleanup in `afterEach` / `finally` consistent with `#17` integration style

Do **not** assert `ALREADY_PURCHASED`, GraphQL, or Redis in `#18`.

### CI (#18)

Reuse the `#17` `schema-test` job sequence (Postgres 16 + migrate + `test:schema` + `test:integration`). Purchase integration specs ride the existing `test:integration` step — **no new CI job**. Keep lint / typecheck / unit-test / build DB-independent. Preserve Turbo `typecheck` → `^build` so workspace packages are built before dependent typecheck.

### Explicitly out of #18

| Concern                                                   | Owner                         |
| --------------------------------------------------------- | ----------------------------- |
| `findById` on `PurchaseRepository`                        | Later, if a use case needs it |
| `ALREADY_PURCHASED` purchase outcome                      | `#20`                         |
| Transactional purchase flow / concurrency                 | `#20`                         |
| Atomic stock reservation                                  | `#19`–`#20`                   |
| Controllers / GraphQL resolvers / use cases               | Later / EPIC-03               |
| Redis client                                              | EPIC-04                       |
| Schema / migration changes                                | Not in `#18` (schema done)    |
| FlashSale / Product domain or repository changes          | Not in `#18`                  |
| Remapping non-composite `P2002` / duplicate purchase `id` | Not typed in `#18`            |

### Definition of Done (#18)

- Implementation complete for this issue only
- `PurchaseRepository` + domain-owned `PURCHASE_REPOSITORY` exported from `@flash-sale/domain`
- `PurchaseConflictError` exported; composite uniqueness only maps to it; `ALREADY_PURCHASED` absent
- `Purchase.reconstitute` added and used by mapper; corrupt rows propagate `PurchaseValidationError`
- Prisma adapter implements `save` + `findByFlashSaleAndUser`; inspects `P2002` `meta.target` as an **order-independent exact set** `{flashSaleId, userId}` (Prisma field names)
- Minimal `PurchaseModule` uses `useExisting` token alias and is imported by `AppModule`
- Unit + PostgreSQL integration tests added and passing under existing `test` / `test:integration`
- ESLint (incl. perfectionist) and typecheck pass; Turbo `^build` dependency preserved for typecheck
- No unrelated changes (no GraphQL; no Redis; no `#20` outcomes; no schema/migration edits; no `findById`)
- If commits are authorized, commit messages follow `<type>: <MESSAGE>` (no `Co-authored-by`); author `rex.escario.jr@gmail.com`

### Pre-implementation sequencing (#18)

```text
origin/main (EPIC-01 + #11–#17 merged at 432c142+)
    → sync local checkout
    → finalize this umbrella spec with #18 contract
    → write implementation plan
    → implement #18 on a feature branch
    → unit + integration + workspace quality gates
    → commit: <type>: <MESSAGE>
```

## #19 — Implement atomic inventory reservation (detailed contract)

### Issue acceptance criteria

From GitHub [#19](https://github.com/rexescario-dev/flash-sale-system/issues/19), interpreted for this contract:

- Inventory decrement is atomic with `remaining_stock > 0` and active time window → **one conditional SQL `UPDATE`** with `remaining_stock > 0` **and** half-open window `[starts_at, ends_at)` evaluated against caller-supplied `nowUtc`
- No read-modify-write race pattern is used → **no** `SELECT` then mutate then `save`; success is solely `affected rows === 1`

### Design interpretation for #19

- Deliver a **dedicated reservation command port** separate from the read/`reconstitute` port.
- **`FlashSaleRepository` stays read-only** (`findById` only). Do **not** add write methods to it.
- **Port ownership:** `FlashSaleReservation` interface + Nest injection token live in `@flash-sale/domain`. Domain remains free of NestJS/Prisma/Redis and has **no runtime package dependencies**.
- **Adapter ownership:** `PrismaFlashSaleReservation` lives in `apps/api/src/flash-sale/` and is registered from the existing `FlashSaleModule` (same Nest slice as `#17`).
- **Success signal:** `tryReserve` returns `Promise<boolean>` — `true` iff exactly one row was updated; `false` for every expected miss (missing sale, outside window, sold out / zero stock). **No** failure-reason classification in `#19`.
- **Concurrency:** PostgreSQL serializes the conditional `UPDATE`. `#19` proves no oversell for the reservation primitive under concurrent callers. Full purchase-transaction composition remains `#20`.
- **Out of #19:** purchase insert, `PurchaseConflictError` / `ALREADY_PURCHASED`, GraphQL, Redis, controllers, application use cases, schema/migration edits, `FlashSale.reserve()` entity mutation, extending `FlashSaleRepository` with writes.
- Approach: **thin domain command port + `$executeRaw` adapter in the existing FlashSale Nest slice**.

### Locked decisions (#19)

| Decision                | Choice                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Port location           | `@flash-sale/domain` (`flash-sale.reservation.ts`)                                                                                                                                                                                                                                                                                         |
| Port vs read repository | **Separate** `FlashSaleReservation`; `FlashSaleRepository` remains read-only                                                                                                                                                                                                                                                               |
| DI token ownership      | `FLASH_SALE_RESERVATION` Symbol defined and exported from `@flash-sale/domain` (same file as the port; YAGNI for a separate `.token.ts`)                                                                                                                                                                                                   |
| Port vs token roles     | `FlashSaleReservation` = domain port (compile-time); `FLASH_SALE_RESERVATION` = runtime Nest DI token only                                                                                                                                                                                                                                 |
| Port method             | `tryReserve(flashSaleId, nowUtc): Promise<boolean>` only                                                                                                                                                                                                                                                                                   |
| ID type on port         | Branded `FlashSaleId`                                                                                                                                                                                                                                                                                                                      |
| Return on miss          | `false` (do **not** classify `NOT_FOUND` / `NOT_ACTIVE` / `SOLD_OUT`)                                                                                                                                                                                                                                                                      |
| Business-outcome throws | **None** for expected reservation misses                                                                                                                                                                                                                                                                                                   |
| `PurchaseConflictError` | **Not** used by `#19`                                                                                                                                                                                                                                                                                                                      |
| `ALREADY_PURCHASED`     | **`#20` only**                                                                                                                                                                                                                                                                                                                             |
| Atomicity mechanism     | Single parameterized Prisma `$executeRaw` conditional `UPDATE` (not `$executeRawUnsafe`; not Client `updateMany`)                                                                                                                                                                                                                          |
| Window predicate        | Half-open `[starts_at, ends_at)` — `starts_at <= nowUtc AND ends_at > nowUtc` (matches `#14`)                                                                                                                                                                                                                                              |
| Stock predicate         | `remaining_stock > 0` in the same `WHERE`; decrement `remaining_stock = remaining_stock - 1`                                                                                                                                                                                                                                               |
| `updated_at`            | Set explicitly in the same `UPDATE` to the **same bound `nowUtc`** used for the window (do not mix DB `NOW()`)                                                                                                                                                                                                                             |
| Invalid `nowUtc`        | Adapter input guard: if `Number.isNaN(nowUtc.getTime())`, throw `FlashSaleValidationError` with code `INVALID_NOW` **before** SQL (same `#14` code/type; do **not** move validation onto `FlashSale` or add a VO). **No** timezone conversion or Date normalization — caller `Date` used **as-is** for window predicates and `updated_at`. |
| Return / affected rows  | `affectedRows === 1` → `true`; **`affectedRows !== 1` → `false`**                                                                                                                                                                                                                                                                          |
| ID normalization        | Exact string match on `id`; do not trim (`FlashSaleId` brand is compile-time; runtime value is the stored scalar)                                                                                                                                                                                                                          |
| Nest module             | Extend existing `FlashSaleModule`; register concrete adapter + `useExisting` token alias; export `FLASH_SALE_RESERVATION` alongside `FLASH_SALE_REPOSITORY`                                                                                                                                                                                |
| Controllers / use cases | **None** in `#19`                                                                                                                                                                                                                                                                                                                          |
| Schema / migrations     | **None** in `#19` (CHECK `remaining_stock >= 0` already from `#15` is defense-in-depth)                                                                                                                                                                                                                                                    |
| Verification            | **Unit** = adapter control flow + errors; **integration** = authoritative SQL semantics (incl. success `updated_at === nowUtc`, failure `updated_at` unchanged on stock `= 0`, + `N > S` concurrency via `Promise.all`)                                                                                                                    |
| Typecheck               | Turbo `typecheck` already depends on `^build` (workspace deps must build before typecheck; keep this invariant)                                                                                                                                                                                                                            |

### Port contract

`FlashSaleReservation` is the **domain command port**. `FLASH_SALE_RESERVATION` is its **runtime DI token**. The domain must **not** import Nest decorators on the port or token.

Keep both in one file (`flash-sale.reservation.ts`) unless a later ticket justifies a split:

```ts
import type { FlashSaleId } from '../ids.js';

/** Runtime Nest DI token for FlashSaleReservation. Owned by @flash-sale/domain. */
export const FLASH_SALE_RESERVATION = Symbol('FLASH_SALE_RESERVATION');

export interface FlashSaleReservation {
  tryReserve(flashSaleId: FlashSaleId, nowUtc: Date): Promise<boolean>;
}
```

Behavioral contract:

- `tryReserve` attempts to atomically reserve **one** unit of stock for `flashSaleId` at absolute instant `nowUtc`.
- Returns `true` iff the conditional `UPDATE` affected exactly one row (`affectedRows === 1`).
- Returns `false` when `affectedRows !== 1` (typical miss: missing id, outside window, `remaining_stock === 0`). Callers must **not** treat `false` as a typed business outcome taxonomy in `#19`.
- Does **not** hydrate a `FlashSale`, does **not** call `getStatus`, does **not** insert a `Purchase`.
- Callers pass an already-branded `FlashSaleId`. Runtime blankness is not re-validated by the port; the adapter queries by the underlying string (exact match; no trim).
- **`INVALID_NOW` ownership:** `FlashSaleReservation.tryReserve()` rejects an invalid `Date` with `FlashSaleValidationError(INVALID_NOW)`. The **adapter** performs this input guard before SQL so reservation never issues SQL with an invalid timestamp. Do **not** move this onto `FlashSale` or add a new VO for `#19`.
- **`nowUtc` is used as-is:** only the existing `#14` valid-timestamp check (`Number.isNaN(nowUtc.getTime())`). Do **not** add timezone conversion, locale parsing, or other Date normalization in `#19`. The same caller `Date` is bound for window predicates and `updated_at`.

### SQL contract (adapter)

Authoritative statement (parameterized via Prisma tagged-template `$executeRaw`):

```sql
UPDATE flash_sales
SET
  remaining_stock = remaining_stock - 1,
  updated_at = $nowUtc
WHERE
  id = $flashSaleId
  AND starts_at <= $nowUtc
  AND ends_at > $nowUtc
  AND remaining_stock > 0
```

Then:

```text
affectedRows === 1 → true
affectedRows !== 1 → false
```

Rules:

- Use **`$executeRaw`** (tagged template) — **not** `$executeRawUnsafe`.
- Bind the **same** `nowUtc` `Date` for the window predicates and `updated_at`.
- Do **not** precede the `UPDATE` with a `SELECT` of `remaining_stock` for the success path.
- Do **not** use Prisma Client `updateMany` / `update` for `#19` (locked to raw conditional `UPDATE` for an explicit DB-level contract and explicit `updated_at`).
- Do **not** remap persistence errors into purchase/domain purchase outcomes.

Illustrative adapter shape:

```ts
async tryReserve(flashSaleId: FlashSaleId, nowUtc: Date): Promise<boolean> {
  if (Number.isNaN(nowUtc.getTime())) {
    throw new FlashSaleValidationError('INVALID_NOW', 'FlashSale nowUtc must be a valid Date');
  }

  const affected = await this.prisma.$executeRaw`
    UPDATE flash_sales
    SET
      remaining_stock = remaining_stock - 1,
      updated_at = ${nowUtc}
    WHERE
      id = ${flashSaleId}
      AND starts_at <= ${nowUtc}
      AND ends_at > ${nowUtc}
      AND remaining_stock > 0
  `;

  return affected === 1;
}
```

### Nest wiring

Extend the existing `#17` module — do **not** invent `FlashSaleReservationModule`:

```ts
@Module({
  exports: [FLASH_SALE_REPOSITORY, FLASH_SALE_RESERVATION],
  providers: [
    PrismaFlashSaleRepository,
    PrismaFlashSaleReservation,
    {
      provide: FLASH_SALE_REPOSITORY,
      useExisting: PrismaFlashSaleRepository,
    },
    {
      provide: FLASH_SALE_RESERVATION,
      useExisting: PrismaFlashSaleReservation,
    },
  ],
})
export class FlashSaleModule {}
```

- Prefer `useExisting` so each concrete adapter is a first-class provider and the domain token aliases it.
- `PrismaModule` remains `@Global()`; `FlashSaleModule` does not need to import or re-export Prisma.
- `AppModule` already imports `FlashSaleModule` — no new app import required unless wiring was removed.
- No controllers, resolvers, or application services in `#19`.

### Public API surface (#19 delta)

Export from `packages/domain/src/index.ts` (in addition to existing FlashSale / Purchase exports):

- `FlashSaleReservation` (type)
- `FLASH_SALE_RESERVATION` (runtime DI token — domain-owned Symbol; never redefine in `apps/api`)

Do not export the Prisma reservation adapter or Nest module from `@flash-sale/domain`.

### Testing (#19)

**Verification split:**

- **Unit tests** verify adapter **control flow and error behavior** (boolean mapping from affected-row count; `INVALID_NOW` without SQL).
- **Integration tests** are **authoritative for SQL semantics** (window + stock predicates, decrement, `updated_at === nowUtc`, concurrent no-oversell). Invoking `$executeRaw` in a unit mock is **not** proof of SQL shape.

**API unit (no DB)** — under `apps/api/src/flash-sale/prisma-flash-sale.reservation.spec.ts`, default API Jest suite:

- Mock `PrismaService.$executeRaw` → `1` → `tryReserve` returns `true`
- Mock `$executeRaw` → `0` (stands for `affected !== 1`) → returns `false`
- Invalid `nowUtc` → throws `FlashSaleValidationError` with `code === 'INVALID_NOW'` and **does not** call `$executeRaw`
- Do **not** assert brittle SQL-string equality in unit tests; do **not** require a fake `affected === 2` case

**PostgreSQL integration — sequential** — under `apps/api/test/flash-sale/prisma-flash-sale.reservation.integration.spec.ts`, existing `jest.integration.config.cjs` / `pnpm --filter api test:integration`:

Seed minimal `Product` → `FlashSale` graph (FK `Restrict`), then:

| Case                       | Expected                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Active window, stock `> 0` | `true`; `remaining_stock` decremented by 1; **`updated_at === nowUtc`** (fresh Prisma Client read after `tryReserve`) |
| Stock `=== 1`              | `true`; stock becomes `0`                                                                                             |
| Stock `=== 0`              | `false`; stock remains `0`; **`updated_at` unchanged** (fresh read; seed a distinct initial `updatedAt` ≠ `nowUtc`)   |
| `nowUtc < startsAt`        | `false`                                                                                                               |
| `nowUtc === startsAt`      | `true` (when stock `> 0`)                                                                                             |
| `nowUtc === endsAt`        | `false`                                                                                                               |
| `nowUtc > endsAt`          | `false`                                                                                                               |
| Missing flash-sale id      | `false`                                                                                                               |

`updatedAt` assertions must use a **fresh Prisma Client read after `tryReserve()`**. Do not infer `updatedAt` from the in-memory input or adapter return value — prove the database column was (or was not) written by the raw SQL `SET`. The stock `=== 0` failure case is the representative proof that `SET updated_at` shares the same `WHERE` guard as the stock decrement.

Happy-path must assert both `remainingStock` and `updatedAt`. Invalid `nowUtc` is covered by unit tests; a duplicate integration case is **not** required.

Cleanup in `afterEach` / `finally` consistent with `#17` / `#18` integration style.

**PostgreSQL integration — concurrency** (same file or adjacent describe; still `#19` only):

```text
Initial remaining_stock = S
N concurrent tryReserve(id, nowUtc) with N > S  (e.g. S=10, N=100)
via Promise.all (database-level atomicity — not JS serialization)

Assertions:
- exactly S results are true
- exactly N − S results are false
- final remaining_stock === 0
- remaining_stock never negative (final read + CHECK already present)
```

Do **not** rewrite the concurrency test as sequential awaits or add application-level locking. Do **not** insert purchases, assert `PurchaseConflictError`, or assert `ALREADY_PURCHASED` in `#19`.

### CI (#19)

Reuse the existing `schema-test` job sequence (Postgres 16 + migrate + `test:schema` + `test:integration`). Reservation integration specs ride the existing `test:integration` step — **no new CI job**. Keep lint / typecheck / unit-test / build DB-independent. Preserve Turbo `typecheck` → `^build` so workspace packages are built before dependent typecheck.

### Explicitly out of #19

| Concern                                            | Owner                          |
| -------------------------------------------------- | ------------------------------ |
| Purchase insert / uniqueness / `ALREADY_PURCHASED` | `#20`                          |
| Transactional purchase flow / purchase-level races | `#20`                          |
| Failure-reason taxonomy on `tryReserve`            | Not in `#19` (boolean only)    |
| Write methods on `FlashSaleRepository`             | Not in `#19` (stays read-only) |
| `FlashSale.reserve()` entity mutation              | Not in `#19`                   |
| Controllers / GraphQL resolvers / use cases        | Later / EPIC-03                |
| Redis client                                       | EPIC-04                        |
| Schema / migration changes                         | Not in `#19` (schema done)     |
| Remapping to `PurchaseConflictError`               | Not in `#19`                   |

### Definition of Done (#19)

- Implementation complete for this issue only
- `FlashSaleReservation` + domain-owned `FLASH_SALE_RESERVATION` exported from `@flash-sale/domain`
- `FlashSaleRepository` remains read-only (`findById` only)
- Prisma adapter implements `tryReserve` via one parameterized `$executeRaw` conditional `UPDATE` (window + stock; explicit `updated_at = nowUtc`); returns `affected === 1` (`affected !== 1` → `false`)
- Invalid `nowUtc` → adapter throws `FlashSaleValidationError` (`INVALID_NOW`) without executing SQL (not moved onto `FlashSale`)
- Happy-path integration proves `updatedAt === nowUtc` via fresh Prisma Client read after `tryReserve`
- Representative failure path (stock `= 0`) proves `updatedAt` unchanged via fresh read
- `FlashSaleModule` registers/exports both tokens via `useExisting`
- Unit (control flow/errors) + PostgreSQL sequential + focused concurrent (`N > S` via `Promise.all`) integration tests added and passing under existing `test` / `test:integration`
- ESLint (incl. perfectionist) and typecheck pass; Turbo `^build` dependency preserved for typecheck
- No unrelated changes (no GraphQL; no Redis; no `#20` purchase flow; no schema/migration edits; no purchase uniqueness mapping)
- If commits are authorized, commit messages follow `<type>: <MESSAGE>` (no `Co-authored-by`); author `rex.escario.jr@gmail.com`

### Pre-implementation sequencing (#19)

```text
origin/main (EPIC-01 + #11–#18 merged at 56f5a3e+)
    → sync local checkout
    → finalize this umbrella spec with #19 contract
    → write implementation plan
    → implement #19 on a feature branch
    → unit + sequential + concurrent integration + workspace quality gates
    → commit: <type>: <MESSAGE>
```

**Port amendment (applied by `#20`):** after `#19` merges, `#20` widens `FlashSaleReservation.tryReserve` with an optional trailing `ctx?: PersistenceContext` (omit → root client). Boolean semantics and SQL contract are unchanged. The `#19` snippet above remains the behavioral baseline; see `#20` for the amended signature.

## #20 — Implement transactional purchase flow (detailed contract)

### Issue acceptance criteria

From GitHub [#20](https://github.com/rexescario-dev/flash-sale-system/issues/20), interpreted for this contract:

- Purchase and inventory update commit or rollback together → **one Prisma interactive `$transaction`** shared by `#19` `tryReserve` + `#18` `save` via the same opaque `PersistenceContext`
- Typed outcomes include `SUCCESS`, `ALREADY_PURCHASED`, `SALE_NOT_STARTED`, `SALE_ENDED`, `SOLD_OUT` → domain-owned string-union `PurchaseOutcome` (**five typed business outcomes**) returned by `PurchaseFlow.execute`

### Design interpretation for #20

- Deliver a **domain use-case port** `PurchaseFlow` that composes existing ports — do **not** invent a fat Prisma dual-write adapter that bypasses `#18` / `#19`.
- **`PurchaseOutcome` is domain-owned** (business results, not HTTP/GraphQL transport).
- **Missing flash sale** is exceptional: throw domain `FlashSaleNotFoundError` — **not** a sixth outcome.
- **Status admission:** `#14` `FlashSale.getStatus(nowUtc)` runs **before** opening the transaction and is an **early admission check only**. Do **not** add purchase-gate helpers on `FlashSale`. `ACTIVE` does **not** guarantee stock remains available by the time reservation runs.
- **Authoritative inventory under concurrency:** once inside the transaction, `#19` `tryReserve` is authoritative. `false` → `SOLD_OUT` (including the race where status was `ACTIVE` then another buyer took the last unit).
- **`tryReserve(false)` no-mutation invariant:** returning `false` **performs no inventory mutation**. The transaction callback may therefore `return 'SOLD_OUT'` normally (commit is a no-op). This contrasts with `PurchaseConflictError`, which occurs **after** a successful reserve and **must throw** so Prisma rolls back.
- **`Purchase.create` timing:** occurs **inside** the interactive `$transaction` callback, **after** successful `tryReserve`, immediately before `save`. Creation itself is not a DB operation; placing it in the callback keeps the full purchase mutation path conceptually owned by the unit of work and ensures any future create-time throw aborts the transaction naturally.
- **`ALREADY_PURCHASED`:** map `#18` `PurchaseConflictError` **outside** `$transaction` after Prisma rolls back (conflict must escape the callback — never `return 'ALREADY_PURCHASED'` from inside the callback after a successful reserve).
- **Unexpected errors:** any non-conflict throw from the `$transaction` callback causes Prisma **ROLLBACK** and **propagates** to the caller (not mapped to `PurchaseOutcome`).
- **Transaction context:** optional infrastructure-neutral branded `PersistenceContext` on write ports only (`tryReserve`, `save`). `findById` stays unchanged (pre-txn). Prisma binder lives in `apps/api`.
- **Nest ownership:** extend existing `PurchaseModule` (import `FlashSaleModule`); register `PurchaseFlowService` + `PURCHASE_FLOW` `useExisting` alias.
- **Out of #20:** GraphQL, Redis, controllers/resolvers, N-parallel purchase storm (reservation oversell stays `#19`), schema/migration edits, ALS/UoW magic, returning `Purchase` on success.
- Approach: **domain port + Nest orchestrator + structurally opaque PersistenceContext (runtime-branded for infra) on write ports**.

### Locked decisions (#20)

| Decision                    | Choice                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use-case location           | `@flash-sale/domain` port `PurchaseFlow` + Nest `PurchaseFlowService` in `apps/api/src/purchase/`                                                                                                                                                                                                             |
| DI token                    | `PURCHASE_FLOW` Symbol in `@flash-sale/domain` (same file as the port)                                                                                                                                                                                                                                        |
| Outcome type                | String union `PurchaseOutcome` = five typed **business** outcomes `'ALREADY_PURCHASED' \| 'SALE_ENDED' \| 'SALE_NOT_STARTED' \| 'SOLD_OUT' \| 'SUCCESS'` (ESLint perfectionist A→Z in source)                                                                                                                 |
| `execute` input             | `{ flashSaleId, userId, purchaseId, nowUtc }` — flow owns `Purchase.create({ ..., purchasedAt: nowUtc })`                                                                                                                                                                                                     |
| `Purchase.create` timing    | **Inside** `$transaction` callback, **after** `tryReserve === true`, before `save`                                                                                                                                                                                                                            |
| SUCCESS payload             | Outcome string only — **no** returned `Purchase` entity                                                                                                                                                                                                                                                       |
| Missing sale                | `FlashSaleNotFoundError` (domain); **not** in `PurchaseOutcome`                                                                                                                                                                                                                                               |
| Status gate                 | Pre-txn `findById` → `getStatus(nowUtc)` (**outside** `$transaction`): `UPCOMING→SALE_NOT_STARTED`, `ENDED→SALE_ENDED`, `SOLD_OUT→SOLD_OUT`; only `ACTIVE` enters `$transaction`. Admission only — never authoritative for inventory.                                                                         |
| Authoritative inventory     | In-txn `tryReserve` is authoritative under concurrency                                                                                                                                                                                                                                                        |
| `tryReserve(false)`         | **Guarantees no inventory mutation**; callback may `return 'SOLD_OUT'` normally                                                                                                                                                                                                                               |
| In-txn reserve miss         | `tryReserve === false` → return `'SOLD_OUT'`                                                                                                                                                                                                                                                                  |
| Conflict → outcome          | Let `PurchaseConflictError` escape `$transaction` → Prisma **ROLLBACK** → outer catch maps to `'ALREADY_PURCHASED'`                                                                                                                                                                                           |
| Unexpected error            | Escape `$transaction` → Prisma **ROLLBACK** → **propagate** (not a `PurchaseOutcome`)                                                                                                                                                                                                                         |
| Persistence context         | Structurally opaque domain `PersistenceContext` (runtime-branded for infra validation); `createPrismaPersistenceContext(tx)` binds `$transaction`’s `tx`; `resolvePrismaClient` never falls back to root when `ctx` is provided; optional `ctx?` on `tryReserve` / `save` only                                |
| Ctx client binding          | When `ctx` is provided, the adapter **MUST** use the transaction-bound client for **all** persistence ops in that method call; **MUST NOT** fall back to root `PrismaService` for any op in that call                                                                                                         |
| `findById` + ctx            | **No** — pre-transaction lookup stays outside the unit of work                                                                                                                                                                                                                                                |
| Fat dual-write adapter      | **Forbidden**                                                                                                                                                                                                                                                                                                 |
| ALS / request-scoped UoW    | **Forbidden** in `#20`                                                                                                                                                                                                                                                                                        |
| Nest module                 | Extend `PurchaseModule`; `imports: [FlashSaleModule]`; export `PURCHASE_FLOW` (+ existing `PURCHASE_REPOSITORY`)                                                                                                                                                                                              |
| Controllers / GraphQL       | **None** in `#20`                                                                                                                                                                                                                                                                                             |
| Schema / migrations         | **None** in `#20`                                                                                                                                                                                                                                                                                             |
| Concurrent N-purchase storm | **Out** — `#19` owns reservation concurrency proof                                                                                                                                                                                                                                                            |
| Verification                | **Unit** = orchestration + outcome mapping + conflict-escapes-callback + `ACTIVE→tryReserve(false)→SOLD_OUT` + reserve-before-save; **integration** = sequential PostgreSQL atomicity (success, conflict restores stock, status gates incl. pre-check `SOLD_OUT`). Concurrent reservation races remain `#19`. |
| Typecheck                   | Turbo `typecheck` already depends on `^build` (preserve)                                                                                                                                                                                                                                                      |
| ID normalization            | Exact stored strings; do not trim                                                                                                                                                                                                                                                                             |
| Invalid `nowUtc`            | Propagate existing `FlashSaleValidationError` (`INVALID_NOW`) from `getStatus` / reservation — **not** a `PurchaseOutcome`                                                                                                                                                                                    |

### PersistenceContext contract

```ts
declare const persistenceContextBrand: unique symbol;

/** Opaque unit-of-work handle. Domain must not inspect contents. */
export interface PersistenceContext {
  readonly [persistenceContextBrand]: true;
}
```

Rules:

- Domain ports accept `ctx?: PersistenceContext` and never import Prisma types.
- `apps/api` creates a branded concrete value wrapping the interactive transaction client.
- Adapter client selection (per method invocation):
  - `ctx === undefined` → use root `PrismaService` for **all** persistence ops in that call.
  - `ctx !== undefined` → use the transaction-bound client represented by `ctx` for **all** persistence ops in that call; **MUST NOT** fall back to root `PrismaService` for any op in that call (including secondary reads/writes inside the same method).
- Narrowing/cast lives **only** in infrastructure (documented binder helpers).
- Do **not** sprinkle `PersistenceContext` onto every repository method — **write composition only** (`tryReserve`, `save`).

**`#19` false-path invariant (reaffirmed for `#20`):** `FlashSaleReservation.tryReserve()` returning `false` performs **no** inventory mutation (conditional `UPDATE` affected zero rows). `#20` relies on this so race-`SOLD_OUT` may return normally from the transaction callback.

Amended write ports:

```ts
export interface FlashSaleReservation {
  tryReserve(flashSaleId: FlashSaleId, nowUtc: Date, ctx?: PersistenceContext): Promise<boolean>;
}

export interface PurchaseRepository {
  findByFlashSaleAndUser(flashSaleId: FlashSaleId, userId: UserId): Promise<null | Purchase>;

  save(purchase: Purchase, ctx?: PersistenceContext): Promise<void>;
}
```

### PurchaseFlow port contract

```ts
export type PurchaseOutcome =
  'ALREADY_PURCHASED' | 'SALE_ENDED' | 'SALE_NOT_STARTED' | 'SOLD_OUT' | 'SUCCESS';

export type PurchaseFlowExecuteInput = {
  flashSaleId: FlashSaleId;
  nowUtc: Date;
  purchaseId: PurchaseId;
  userId: UserId;
};

/** Runtime Nest DI token for PurchaseFlow. Owned by @flash-sale/domain. */
export const PURCHASE_FLOW = Symbol('PURCHASE_FLOW');

export interface PurchaseFlow {
  execute(input: PurchaseFlowExecuteInput): Promise<PurchaseOutcome>;
}
```

```ts
export class FlashSaleNotFoundError extends Error {
  readonly code = 'FLASH_SALE_NOT_FOUND' as const;

  constructor(message = 'Flash sale was not found') {
    super(message);
    this.name = 'FlashSaleNotFoundError';
  }
}
```

### Algorithm (normative)

`getStatus(nowUtc)` is an **early admission check only**. Once inside `$transaction`, `tryReserve` is **authoritative** for inventory availability under concurrency (e.g. `ACTIVE` → another buyer takes the last unit → `tryReserve` false → `SOLD_OUT`).

`Purchase.create` occurs **inside** the interactive transaction callback, **after** successful `tryReserve`, before `save`.

```text
findById(flashSaleId)
        │
        ├── null ──────────────> throw FlashSaleNotFoundError
        │
        ▼
flashSale.getStatus(nowUtc)          // admission only — not a stock lock
        │
        ├── UPCOMING ──────────> SALE_NOT_STARTED
        ├── ENDED ─────────────> SALE_ENDED
        ├── SOLD_OUT ──────────> SOLD_OUT
        │
        ▼
      ACTIVE
        │
        ▼
try {
  return await $transaction(async (tx) => {
    ctx = createPrismaPersistenceContext(tx)
    reserved = tryReserve(flashSaleId, nowUtc, ctx)   // authoritative inventory
    if (!reserved) return SOLD_OUT   // false ⇒ no mutation; normal return OK
    purchase = Purchase.create({ id: purchaseId, flashSaleId, userId, purchasedAt: nowUtc })
    await save(purchase, ctx)   // may throw PurchaseConflictError
    return SUCCESS
  })
} catch (error) {
  if (error instanceof PurchaseConflictError) return ALREADY_PURCHASED
  throw error   // unexpected → already rolled back by Prisma; propagate
}
```

**Hard invariants:**

1. No business outcome that must undo a prior transactional mutation may be returned normally from the `$transaction` callback.
2. `tryReserve(false)` performs no inventory mutation (safe normal return → `SOLD_OUT`).
3. When `ctx` is provided, adapters must not mix transaction-bound and root clients within that method call.
4. Unexpected errors propagate after rollback.

| Path                | Callback behavior             | DB effect                                       |
| ------------------- | ----------------------------- | ----------------------------------------------- |
| `SUCCESS`           | `return` normally             | COMMIT reserve + purchase                       |
| race `SOLD_OUT`     | `return` normally             | COMMIT no-op (`tryReserve` false = no mutation) |
| `ALREADY_PURCHASED` | throw `PurchaseConflictError` | ROLLBACK (undo reserve) → map outside           |
| unexpected error    | throw                         | ROLLBACK → **propagate**                        |

### Nest wiring

```ts
@Module({
  exports: [PURCHASE_FLOW, PURCHASE_REPOSITORY],
  imports: [FlashSaleModule],
  providers: [
    PrismaPurchaseRepository,
    PurchaseFlowService,
    {
      provide: PURCHASE_REPOSITORY,
      useExisting: PrismaPurchaseRepository,
    },
    {
      provide: PURCHASE_FLOW,
      useExisting: PurchaseFlowService,
    },
  ],
})
export class PurchaseModule {}
```

- `PurchaseFlowService` injects `FLASH_SALE_REPOSITORY`, `FLASH_SALE_RESERVATION`, `PURCHASE_REPOSITORY`, and `PrismaService` (txn owner — **not** part of the domain port).
- Prefer `useExisting` token aliases (same convention as `#17`–`#19`).
- `PrismaModule` remains `@Global()`; no GraphQL controllers in `#20`.
- Adapter unit tests for `#18`/`#19` must keep working when `ctx` is omitted (root client path).

### Public API surface (#20 delta)

Export from `packages/domain/src/index.ts` (in addition to existing exports):

- `PersistenceContext` (type)
- `FlashSaleNotFoundError`
- `PurchaseOutcome` (type)
- `PurchaseFlowExecuteInput` (type)
- `PurchaseFlow` (type)
- `PURCHASE_FLOW` (runtime DI token)

Do not export `PurchaseFlowService`, Prisma binder helpers, or Nest modules from `@flash-sale/domain`.

### Testing (#20)

**Verification split:**

- **Unit tests** verify orchestration control flow and outcome mapping (mocked ports + mocked `$transaction`).
- **Integration tests** are authoritative for **atomicity** (conflict rolls back stock; success persists both; status gates against real rows).

**API unit** — `apps/api/src/purchase/purchase-flow.service.spec.ts`:

| Case                                            | Expected                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| Missing sale (`findById` → `null`)              | throws `FlashSaleNotFoundError`                     |
| `getStatus` → `UPCOMING`                        | `SALE_NOT_STARTED` (no txn)                         |
| `getStatus` → `ENDED`                           | `SALE_ENDED` (no txn)                               |
| `getStatus` → `SOLD_OUT`                        | `SOLD_OUT` (no txn)                                 |
| ACTIVE + reserve true + save ok                 | `SUCCESS`                                           |
| ACTIVE + reserve false                          | `SOLD_OUT`                                          |
| ACTIVE + reserve true + `PurchaseConflictError` | `$transaction` rejects; result `ALREADY_PURCHASED`  |
| Unexpected error from txn                       | propagates                                          |
| Invalid `nowUtc` via `getStatus`                | `FlashSaleValidationError` `INVALID_NOW` propagates |

Prove conflict path: mock `$transaction` such that a thrown `PurchaseConflictError` from the callback causes promise rejection (escape), and the service maps to `ALREADY_PURCHASED`. Unit proves **escape + mapping only**; PostgreSQL integration proves **rollback**. Also assert the **same** `PersistenceContext` is passed to `tryReserve` and `save`.

**PostgreSQL integration — sequential** — `apps/api/test/purchase/purchase-flow.integration.spec.ts` via existing `test:integration`:

| Case                                                  | Expected                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Active sale, unique user                              | `SUCCESS`; purchase row exists; `remaining_stock` decremented by 1                                  |
| Duplicate `(flashSaleId, userId)` after prior success | `ALREADY_PURCHASED`; **no new purchase row**; **`remaining_stock` unchanged** (rollback of reserve) |
| `nowUtc` before `startsAt`                            | `SALE_NOT_STARTED`; no purchase row; no stock mutation                                              |
| `nowUtc` at/after `endsAt`                            | `SALE_ENDED`; no purchase row; no stock mutation                                                    |
| Stock already `0` / exhausted before `execute`        | `SOLD_OUT` (pre-check); no purchase row; no stock mutation — **not** an in-txn race proof           |
| Unknown `flashSaleId`                                 | throws `FlashSaleNotFoundError`                                                                     |

Highest-value atomicity proof: seed `remainingStock = 1` and an **existing** purchase for the user **outside** `PurchaseFlow` → `execute` → expect `ALREADY_PURCHASED` and `remaining_stock === 1` (reserve + conflict rolled back together). Do **not** create that fixture via a prior successful `execute` then manually re-increment stock.

**Conflict coverage split:** Unit proves `PurchaseConflictError` escapes the `$transaction` callback and maps to `ALREADY_PURCHASED`. PostgreSQL integration is the authoritative rollback proof.

**SOLD_OUT ownership:** `#20` unit covers `ACTIVE → tryReserve(false) → SOLD_OUT`. `#20` integration covers **pre-check** exhaustion (one case). `#19` owns concurrent reservation oversell. Do **not** add production sync hooks solely to manufacture an in-txn race in `#20` integration.

Do **not** require an N-parallel purchase-flow storm in `#20`. Seed/cleanup style must match `#18` / `#19` integration helpers (Product → FlashSale FK graph).

### CI (#20)

Reuse existing `schema-test` job sequence (Postgres 16 + migrate + `test:schema` + `test:integration`). Purchase-flow integration rides `test:integration` — **no new CI job**. Keep lint / typecheck / unit-test / build DB-independent. Preserve Turbo `typecheck` → `^build`.

### Explicitly out of #20

| Concern                                        | Owner                                               |
| ---------------------------------------------- | --------------------------------------------------- |
| GraphQL purchase mutation / resolvers          | EPIC-03                                             |
| Redis client / cache                           | EPIC-04                                             |
| N-parallel purchase-flow oversell storm        | Not in `#20` (`#19` covers reservation concurrency) |
| Returning `Purchase` on `SUCCESS`              | Not in `#20`                                        |
| `NOT_FOUND` as `PurchaseOutcome`               | Not in `#20`                                        |
| Purchase-gate helpers on `FlashSale`           | Not in `#20`                                        |
| ALS / implicit transaction propagation         | Not in `#20`                                        |
| Fat Prisma adapter bypassing `#18`/`#19` ports | Not in `#20`                                        |
| Schema / migration changes                     | Not in `#20`                                        |
| Controllers                                    | Later / EPIC-03                                     |

### Definition of Done (#20)

- Implementation complete for this issue only
- `PurchaseFlow` + `PURCHASE_FLOW` + `PurchaseOutcome` + `PersistenceContext` + `FlashSaleNotFoundError` exported from `@flash-sale/domain`
- Write ports accept optional `PersistenceContext`; omit → root client; provided `ctx` never falls back to root within that method call; `#19` boolean/SQL semantics unchanged (`false` = no mutation)
- `PurchaseFlowService` implements the normative algorithm (`Purchase.create` inside txn after successful reserve); Nest wiring extends `PurchaseModule` and exports `PURCHASE_FLOW`
- `PurchaseConflictError` escaping `$transaction` maps to `ALREADY_PURCHASED` with inventory restored (integration-proven); unexpected errors propagate after rollback
- Unit + PostgreSQL sequential integration tests added and passing under existing `test` / `test:integration` (unit: `ACTIVE→tryReserve(false)`; integration: pre-check `SOLD_OUT`; no fake in-txn race claim)
- ESLint (incl. perfectionist) and typecheck pass; Turbo `^build` dependency preserved for typecheck
- No unrelated changes (no GraphQL; no Redis; no schema/migration edits; no concurrent purchase storm; no purchase-gate helpers on `FlashSale`)
- If commits are authorized, commit messages follow `<type>: <MESSAGE>` (no `Co-authored-by`); author `rex.escario.jr@gmail.com`

### Pre-implementation sequencing (#20)

```text
origin/main (EPIC-01 + #11–#19 merged at 3f474c4+)
    → sync local checkout
    → finalize this umbrella spec with #20 contract
    → write implementation plan
    → implement #20 on a feature branch
    → unit + sequential integration + workspace quality gates
    → commit: <type>: <MESSAGE>
```

## Epic success criteria (from #82)

- Sale status rules are enforced in the domain
- `UNIQUE(flash_sale_id, user_id)` is enforced by the database on **Purchase**
- Inventory reservation is atomic and transactional
- No overselling under concurrent load in integration tests

Child acceptance criteria remain on the linked issues; this spec does not duplicate them beyond the #11–#20 contracts above. `#19` proves reservation-primitive concurrency; `#20` proves purchase+inventory transactional composition, typed `PurchaseOutcome` mapping (incl. `ALREADY_PURCHASED`), and sequential status-gate / atomicity coverage. In-txn `ACTIVE → tryReserve(false) → SOLD_OUT` is unit-owned in `#20`; concurrent reservation races remain `#19`.
