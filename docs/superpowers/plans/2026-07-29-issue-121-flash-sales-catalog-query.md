# Issue #121 — Flash Sales Catalog Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [#121](https://github.com/rexescario-dev/flash-sale-system/issues/121) — GraphQL `Product` type, nested `product` on shared `FlashSale`, and unfiltered `flashSales` catalog query — without AuthN, pagination, or purchase/Redis contract changes.

**Architecture:** Domain keeps `FlashSale.productId` (no `Product` field on the domain entity). Port adds catalog / with-product read methods returning composed `{ flashSale, product }` pairs. API GraphQL read model nests `product`. Catalog uses one repository query that loads the Product relationship. **`findAllForCatalog()` must issue exactly one Prisma `findMany` with `include: { product: true }`; no subsequent product queries are permitted.** `flashSale(id)` keeps Redis ownership; snapshot gains denormalized product read-model fields for cache hits.

**Tech Stack:** NestJS code-first GraphQL, Prisma, `@flash-sale/domain`, existing Redis `FlashSaleQueryCache`, Jest unit + integration tests.

**Spec:** [docs/superpowers/specs/2026-07-29-issue-121-flash-sales-catalog-query-design.md](../specs/2026-07-29-issue-121-flash-sales-catalog-query-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Baseline:** `main` at/after `4f5865c` (plus any docs commits for this ticket).

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Out of scope:** Pagination/filtering/client sort; admin/product writes; AuthN; Redis list cache; purchase-side invalidation (#129); UI (#122+); Product DataLoader; changing reservation/purchase correctness.

**Hard invariants (locked):**

1. Do **not** add `Product` onto the `FlashSale` domain entity.
2. `FlashSaleWithProduct` is a **read-composition transport type** at the port boundary only — never part of the `FlashSale` entity.
3. Catalog path must **not** call per-row product lookups (no per-row `findUnique` / `findById` for products). `findAllForCatalog()` issues **exactly one** Prisma `findMany({ include: { product: true }, orderBy: { startsAt: 'asc' } })` with no follow-up product queries.
4. Catalog order is `startsAt ASC` only. Equal `startsAt` values have **unspecified** relative order — tests must not assume a secondary tie-break.
5. Description mapping contract:

   ```text
   Prisma         Domain          GraphQL
   --------       --------        --------
   "foo"     →    "foo"      →    "foo"
   null      →    undefined  →    null
   ```

   No empty-string normalization at the GraphQL boundary.

6. Redis snapshot on cache hit may serve **stale** product metadata; do **not** refresh product independently on hit.
7. Snapshot must include `product.id`, `product.name`, `product.description` (`string | null`).
8. Existing `flashSale(id)` errors (`NOT_FOUND`, `BAD_USER_INPUT`) and purchase/reservation paths stay intact; `findById` remains available for those callers (`purchase.resolver.ts`, `purchase-flow.service.ts`, etc.).
9. Do not fold into EPIC-01 or #118.

**Known `findById` call sites (must remain on `findById` unless noted):**

| Caller                                              | Method after #121                                   |
| --------------------------------------------------- | --------------------------------------------------- |
| `apps/api/src/purchase/purchase.resolver.ts`        | `findById` (unchanged)                              |
| `apps/api/src/purchase/purchase-flow.service.ts`    | `findById` (unchanged)                              |
| `apps/api/src/flash-sale/flash-sale-query.cache.ts` | Switch miss path to `findByIdWithProduct` only      |
| Tests / repo specs                                  | Update only where they exercise cache / new methods |

---

## File map

| Path                                                           | Responsibility                                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/domain/src/flash-sale/flash-sale.repository.ts`      | Port: `findById`, add `findByIdWithProduct`, `findAllForCatalog`; export `FlashSaleWithProduct` |
| `packages/domain/src/index.ts`                                 | Re-export new types                                                                             |
| `apps/api/src/flash-sale/product.mapper.ts`                    | Prisma Product row → domain `Product` (null → undefined)                                        |
| `apps/api/src/flash-sale/product.mapper.spec.ts`               | Mapper unit: `"foo"` → `"foo"`; `null` → `undefined`                                            |
| `apps/api/src/flash-sale/prisma-flash-sale.repository.ts`      | Adapter: include-product queries                                                                |
| `apps/api/src/flash-sale/prisma-flash-sale.repository.spec.ts` | Adapter unit: catalog uses `findMany`+include; no per-row lookups                               |
| `apps/api/src/flash-sale/graphql/product.object-type.ts`       | GraphQL `Product`                                                                               |
| `apps/api/src/flash-sale/graphql/flash-sale.object-type.ts`    | Add `product` field                                                                             |
| `apps/api/src/flash-sale/flash-sale-query.cache.ts`            | Snapshot + `product`; miss via `findByIdWithProduct`                                            |
| `apps/api/src/flash-sale/flash-sale.resolver.ts`               | `flashSale`, `flashSales`; map preloaded products                                               |
| `apps/api/src/flash-sale/*.spec.ts` + integration specs        | Unit + GraphQL + repo coverage                                                                  |
| `apps/api/test/factories/product.factory.ts`                   | Optional `description` for nullability seeds                                                    |

---

## Task flow

```text
Task 1  →  Domain port + composition type
Task 2  →  Prisma adapter + Product mapping + repository tests
Task 3  →  GraphQL Product + nested FlashSale field
Task 4  →  Redis snapshot + cache tests (+ findById call-site check)
Task 5  →  Resolver queries + resolver delegation tests
Task 6  →  GraphQL integration contract + behavior tests
Task 7  →  Full verification
```

---

### Task 1: Domain port — `FlashSaleWithProduct` + catalog methods

**Files:**

- Modify: `packages/domain/src/flash-sale/flash-sale.repository.ts`
- Modify: `packages/domain/src/index.ts`
- Do **not** modify: `packages/domain/src/flash-sale/flash-sale.ts`

**Acceptance:**

- Port exposes catalog / with-product composition without changing the `FlashSale` entity.
- `FlashSaleWithProduct` remains a port-boundary transport type only.
- Before adding methods: confirm there is **no** existing separate query/read-repository abstraction; if none, extending `FlashSaleRepository` is correct (avoid architectural churn).

- [ ] **Step 1: Extend the repository port**

Replace `packages/domain/src/flash-sale/flash-sale.repository.ts` with:

```ts
import type { FlashSaleId } from '../ids.js';
import type { Product } from '../product/product.js';
import type { FlashSale } from './flash-sale.js';

/** Runtime Nest DI token for FlashSaleRepository. Owned by @flash-sale/domain. */
export const FLASH_SALE_REPOSITORY = Symbol('FLASH_SALE_REPOSITORY');

/**
 * Read-composition transport at the port boundary only.
 * Must not be added to or become part of the FlashSale domain entity.
 * Domain FlashSale keeps productId as the relationship.
 */
export type FlashSaleWithProduct = {
  flashSale: FlashSale;
  product: Product;
};

export interface FlashSaleRepository {
  findById(id: FlashSaleId): Promise<FlashSale | null>;
  findByIdWithProduct(id: FlashSaleId): Promise<FlashSaleWithProduct | null>;
  /** Unfiltered catalog; adapter orders by startsAt ascending. */
  findAllForCatalog(): Promise<FlashSaleWithProduct[]>;
}
```

- [ ] **Step 2: Re-export from package index**

In `packages/domain/src/index.ts`, add:

```ts
export type { FlashSaleWithProduct } from './flash-sale/flash-sale.repository.js';
```

- [ ] **Step 3: Build domain package**

Run: `pnpm --filter @flash-sale/domain build`

Expected: success.

- [ ] **Step 4: Optional commit**

```bash
git add packages/domain/src/flash-sale/flash-sale.repository.ts packages/domain/src/index.ts
git commit -m "feat(domain): add flash-sale catalog and with-product port methods"
```

---

### Task 2: Prisma adapter + Product mapper

**Files:**

- Create: `apps/api/src/flash-sale/product.mapper.ts`
- Create (if missing tests need a home): extend `apps/api/src/flash-sale/prisma-flash-sale.repository.spec.ts`
- Modify: `apps/api/src/flash-sale/prisma-flash-sale.repository.ts`
- Modify: `apps/api/test/flash-sale/prisma-flash-sale.repository.integration.spec.ts`
- Modify (optional): `apps/api/test/factories/product.factory.ts`

**Hard mapping rule:** Prisma `null` → domain `undefined` → GraphQL `null` (GraphQL mapping lands in Task 5).

- [ ] **Step 1: Add Product mapper**

Follow **existing** Prisma import style from `flash-sale.mapper.ts` / nearby adapters (do not invent a custom client path). Typical:

```ts
import type { Product as PrismaProduct } from '@prisma/client';

import { Product, type ProductId } from '@flash-sale/domain';

export class ProductMapper {
  static toDomain(row: PrismaProduct): Product {
    return Product.create({
      id: row.id as ProductId,
      name: row.name,
      ...(row.description != null ? { description: row.description } : {}),
    });
  }
}
```

Do **not** map `null` description to `''`. Omitting `description` yields domain `undefined` via `Product.create`.

- [ ] **Step 1b: ProductMapper unit test (mapping contract)**

Add a focused unit test (e.g. `apps/api/src/flash-sale/product.mapper.spec.ts`):

```ts
it('maps Prisma description "foo" → domain "foo"', () => {
  const product = ProductMapper.toDomain({
    id: 'p1',
    name: 'N',
    description: 'foo',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as PrismaProduct);
  expect(product.getDescription()).toBe('foo');
});

it('maps Prisma description null → domain undefined', () => {
  const product = ProductMapper.toDomain({
    id: 'p1',
    name: 'N',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as PrismaProduct);
  expect(product.getDescription()).toBeUndefined();
});
```

(Use whatever Prisma row shape / cast the mapper’s parameter type requires.)

- [ ] **Step 2: Implement adapter methods**

Update `apps/api/src/flash-sale/prisma-flash-sale.repository.ts`:

```ts
import {
  type FlashSale,
  type FlashSaleId,
  type FlashSaleRepository,
  type FlashSaleWithProduct,
} from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { FlashSaleMapper } from './flash-sale.mapper';
import { ProductMapper } from './product.mapper';

@Injectable()
export class PrismaFlashSaleRepository implements FlashSaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: FlashSaleId): Promise<FlashSale | null> {
    const row = await this.prisma.flashSale.findUnique({
      where: { id },
    });

    if (row === null) {
      return null;
    }

    return FlashSaleMapper.toDomain(row);
  }

  async findByIdWithProduct(id: FlashSaleId): Promise<FlashSaleWithProduct | null> {
    const row = await this.prisma.flashSale.findUnique({
      where: { id },
      include: { product: true },
    });

    if (row === null) {
      return null;
    }

    return {
      flashSale: FlashSaleMapper.toDomain(row),
      product: ProductMapper.toDomain(row.product),
    };
  }

  async findAllForCatalog(): Promise<FlashSaleWithProduct[]> {
    const rows = await this.prisma.flashSale.findMany({
      include: { product: true },
      orderBy: { startsAt: 'asc' },
    });

    return rows.map((row) => ({
      flashSale: FlashSaleMapper.toDomain(row),
      product: ProductMapper.toDomain(row.product),
    }));
  }
}
```

- [ ] **Step 3: Adapter unit test — catalog uses joined findMany (no per-row lookup)**

In `apps/api/src/flash-sale/prisma-flash-sale.repository.spec.ts`, add a test that mocks `prisma.flashSale`:

```ts
it('findAllForCatalog uses findMany with include product and does not call findUnique', async () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const findUnique = jest.fn();
  const prisma = {
    flashSale: { findMany, findUnique },
  } as unknown as PrismaService;
  const repo = new PrismaFlashSaleRepository(prisma);

  await expect(repo.findAllForCatalog()).resolves.toEqual([]);

  expect(findMany).toHaveBeenCalledWith({
    include: { product: true },
    orderBy: { startsAt: 'asc' },
  });
  expect(findUnique).not.toHaveBeenCalled();
});
```

This is the **no-per-row-lookup verification** at the adapter boundary: exactly one `findMany` with `include: { product: true }`, and `findUnique` must not be called.

- [ ] **Step 4: Extend product factory for nullable description seeds**

```ts
export type CreateProductInput = {
  id: string;
  description?: string | null;
  name?: string;
};

export async function createProduct(
  prisma: PrismaClient,
  input: CreateProductInput,
): Promise<{ id: string }> {
  return prisma.product.create({
    data: {
      id: input.id,
      name: input.name ?? `Product ${input.id}`,
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    select: { id: true },
  });
}
```

- [ ] **Step 5: Repo integration tests — with-product + ordering (no fake empty-catalog)**

Append to `apps/api/test/flash-sale/prisma-flash-sale.repository.integration.spec.ts`.

**Do not** add a “empty catalog” test that filters a random UUID from a shared global catalog — that does not prove `findAllForCatalog() === []`. Empty catalog is covered in Task 6 GraphQL integration (suite runs `--runInBand` and can clear tables).

```ts
it('findByIdWithProduct returns sale + product; null description → domain undefined', async () => {
  const suffix = randomUUID();
  const productId = `product-repo-wp-${suffix}`;
  const flashSaleId = `sale-repo-wp-${suffix}`;
  const now = new Date('2026-07-28T12:00:00.000Z');
  const startsAt = new Date('2026-07-28T10:00:00.000Z');
  const endsAt = new Date('2026-07-28T14:00:00.000Z');

  try {
    await prisma.product.create({
      data: {
        id: productId,
        name: 'With Product',
        description: null,
        updatedAt: now,
      },
    });
    await prisma.flashSale.create({
      data: {
        id: flashSaleId,
        productId,
        endsAt,
        remainingStock: 2,
        startsAt,
        totalStock: 2,
        updatedAt: now,
      },
    });

    const loaded = await repo.findByIdWithProduct(flashSaleId as FlashSaleId);
    expect(loaded).not.toBeNull();
    expect(loaded!.flashSale.getId()).toBe(flashSaleId);
    expect(loaded!.product.getId()).toBe(productId);
    expect(loaded!.product.getName()).toBe('With Product');
    expect(loaded!.product.getDescription()).toBeUndefined();
  } finally {
    await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
});

it('findAllForCatalog orders by startsAt ASC and includes products', async () => {
  const suffix = randomUUID();
  const earlyId = `sale-repo-cat-early-${suffix}`;
  const lateId = `sale-repo-cat-late-${suffix}`;
  const productEarly = `product-repo-cat-early-${suffix}`;
  const productLate = `product-repo-cat-late-${suffix}`;
  const now = new Date('2026-07-28T12:00:00.000Z');

  try {
    await prisma.product.create({
      data: { id: productLate, name: 'Late', updatedAt: now },
    });
    await prisma.product.create({
      data: { id: productEarly, name: 'Early', updatedAt: now },
    });
    await prisma.flashSale.create({
      data: {
        id: lateId,
        productId: productLate,
        endsAt: new Date('2026-07-28T18:00:00.000Z'),
        remainingStock: 1,
        startsAt: new Date('2026-07-28T14:00:00.000Z'),
        totalStock: 1,
        updatedAt: now,
      },
    });
    await prisma.flashSale.create({
      data: {
        id: earlyId,
        productId: productEarly,
        endsAt: new Date('2026-07-28T12:00:00.000Z'),
        remainingStock: 1,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        totalStock: 1,
        updatedAt: now,
      },
    });

    const catalog = await repo.findAllForCatalog();
    const ours = catalog.filter((row) => [earlyId, lateId].includes(row.flashSale.getId()));
    // Distinct startsAt values — do not assert order for equal timestamps (unspecified).
    expect(ours.map((row) => row.flashSale.getId())).toEqual([earlyId, lateId]);
    expect(ours[0]!.product.getName()).toBe('Early');
    expect(ours[1]!.product.getName()).toBe('Late');
  } finally {
    await prisma.flashSale.deleteMany({ where: { id: { in: [earlyId, lateId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [productEarly, productLate] } } });
  }
});
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter api test -- product.mapper.spec.ts prisma-flash-sale.repository.spec.ts
pnpm --filter api test:integration -- prisma-flash-sale.repository.integration.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Optional commit**

```bash
git add apps/api/src/flash-sale/product.mapper.ts \
  apps/api/src/flash-sale/product.mapper.spec.ts \
  apps/api/src/flash-sale/prisma-flash-sale.repository.ts \
  apps/api/src/flash-sale/prisma-flash-sale.repository.spec.ts \
  apps/api/test/flash-sale/prisma-flash-sale.repository.integration.spec.ts \
  apps/api/test/factories/product.factory.ts
git commit -m "feat(api): load flash sales with products for catalog reads"
```

---

### Task 3: GraphQL `Product` + nested field on `FlashSale`

**Files:**

- Create: `apps/api/src/flash-sale/graphql/product.object-type.ts`
- Modify: `apps/api/src/flash-sale/graphql/flash-sale.object-type.ts`

- [ ] **Step 1: Add Product object type**

```ts
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Product')
export class ProductObjectType {
  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;
}
```

- [ ] **Step 2: Nest product on FlashSale object type**

Follow **existing file member order / ESLint sort rules** in `flash-sale.object-type.ts` (do not invent a new ordering convention). Add:

```ts
@Field(() => ProductObjectType)
product!: ProductObjectType;
```

Expected GraphQL:

```graphql
type Product {
  id: ID!
  name: String!
  description: String
}

type FlashSale {
  id: ID!
  product: Product!
  # …existing fields
}
```

- [ ] **Step 3: Optional commit**

```bash
git add apps/api/src/flash-sale/graphql/product.object-type.ts \
  apps/api/src/flash-sale/graphql/flash-sale.object-type.ts
git commit -m "feat(api): add GraphQL Product and nest on FlashSale"
```

---

### Task 4: Extend `FlashSaleQueryCache` snapshot with product

**Files:**

- Modify: `apps/api/src/flash-sale/flash-sale-query.cache.ts`
- Modify: `apps/api/src/flash-sale/flash-sale-query.cache.spec.ts`

**Acceptance:**

- Cache miss → `findByIdWithProduct` → snapshot with product → SET.
- Cache hit with valid `product` → return snapshot; **no** repository call.
- Legacy snapshot missing `product` → treat as miss → rewrite.
- `rg "findById" apps/api/src` confirms purchase/reservation still use `findById`.

- [ ] **Step 0: Call-site verification (semantic)**

Inspect all **`FlashSaleRepository.findById`** call sites and confirm only `FlashSaleQueryCache` changes to `findByIdWithProduct`; purchase/reservation callers remain unchanged.

A search such as `rg "findById" apps/api/src` may help locate candidates, but review must be semantic: distinguish `FlashSaleRepository.findById` from unrelated `findById` methods on other types. Do not treat raw grep hits as the acceptance check.

- [ ] **Step 1: Update snapshot type and builders**

```ts
export type FlashSaleCacheProductSnapshot = {
  description: string | null;
  id: string;
  name: string;
};

export type FlashSaleCacheSnapshot = {
  endsAt: string;
  id: string;
  product: FlashSaleCacheProductSnapshot;
  remainingStock: number;
  startsAt: string;
  status: 'ACTIVE' | 'ENDED' | 'SOLD_OUT' | 'UPCOMING';
  totalStock: number;
};

function toProductSnapshot(product: Product): FlashSaleCacheProductSnapshot {
  return {
    description: product.getDescription() ?? null,
    id: product.getId(),
    name: product.getName(),
  };
}

function toSnapshot(flashSale: FlashSale, product: Product, nowUtc: Date): FlashSaleCacheSnapshot {
  return {
    endsAt: flashSale.getEndsAt().toISOString(),
    id: flashSale.getId(),
    product: toProductSnapshot(product),
    remainingStock: flashSale.getRemainingStock(),
    startsAt: flashSale.getStartsAt().toISOString(),
    status: toFlashSaleStatusGql(flashSale.getStatus(nowUtc)),
    totalStock: flashSale.getTotalStock(),
  };
}
```

Miss path:

```ts
const loaded = await this.flashSales.findByIdWithProduct(id);
if (loaded === null) {
  return null;
}
const snapshot = toSnapshot(loaded.flashSale, loaded.product, this.clock.nowUtc());
```

Hit path: after `JSON.parse`, if `product` is missing / malformed, fall through to miss path (do **not** fetch product alone).

- [ ] **Step 2: Update unit tests**

- Mock `findByIdWithProduct` returning `{ flashSale, product }` from `Product.create({ id: 'product-1' as ProductId, name: 'Widget' })`.
- `expectedSnapshot` includes `product: { id: 'product-1', name: 'Widget', description: null }`.
- Hit: snapshot includes product; `findByIdWithProduct` **not** called (stale product accepted).
- Miss: `findByIdWithProduct` called; bare `findById` **not** called.
- Legacy payload without `product` → `findByIdWithProduct` called and snapshot rewritten.

- [ ] **Step 3: Run unit tests**

Run: `pnpm --filter api test -- flash-sale-query.cache.spec.ts`

Expected: PASS.

- [ ] **Step 4: Optional commit**

```bash
git add apps/api/src/flash-sale/flash-sale-query.cache.ts \
  apps/api/src/flash-sale/flash-sale-query.cache.spec.ts
git commit -m "feat(api): include product read-model in flash-sale cache snapshot"
```

---

### Task 5: Resolver queries + resolver delegation tests

**Files:**

- Modify: `apps/api/src/flash-sale/flash-sale.resolver.ts`
- Modify: `apps/api/src/flash-sale/flash-sale.resolver.spec.ts`
- Modify: `apps/api/src/flash-sale/flash-sale.module.ts` (only if DI wiring needs it)

**Testing framing:**

- Resolver tests = **delegation**: catalog uses only `findAllForCatalog` and maps preloaded products.
- Real no-per-row-lookup verification already lives in Task 2 adapter unit test — do not call that “N+1” at the resolver layer.

**Mapping helpers** (plain objects — not Nest decorator class coupling):

```ts
type ProductGql = {
  description: string | null;
  id: string;
  name: string;
};

function toProductGqlFromDomain(product: Product): ProductGql {
  return {
    description: product.getDescription() ?? null,
    id: product.getId(),
    name: product.getName(),
  };
}

function toProductGqlFromSnapshot(product: FlashSaleCacheProductSnapshot): ProductGql {
  return {
    description: product.description,
    id: product.id,
    name: product.name,
  };
}
```

- [ ] **Step 1: Rewrite resolver**

```ts
@Resolver(() => FlashSaleObjectType)
export class FlashSaleResolver {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FLASH_SALE_REPOSITORY)
    private readonly flashSales: FlashSaleRepository,
    private readonly flashSaleQueryCache: FlashSaleQueryCache,
  ) {}

  @Query(() => FlashSaleObjectType, { name: 'flashSale' })
  async flashSale(@Args('id', { type: () => ID }) id: string): Promise<FlashSaleObjectType> {
    const flashSaleId = requireId(id);
    const snapshot = await this.flashSaleQueryCache.getById(flashSaleId);
    if (snapshot === null) {
      throw new FlashSaleNotFoundError();
    }

    return {
      endsAt: new Date(snapshot.endsAt),
      id: snapshot.id,
      product: toProductGqlFromSnapshot(snapshot.product),
      remainingStock: snapshot.remainingStock,
      startsAt: new Date(snapshot.startsAt),
      status: snapshot.status as FlashSaleStatusGql,
      totalStock: snapshot.totalStock,
    };
  }

  @Query(() => [FlashSaleObjectType], { name: 'flashSales' })
  async flashSales(): Promise<FlashSaleObjectType[]> {
    const rows = await this.flashSales.findAllForCatalog();
    const nowUtc = this.clock.nowUtc();
    return rows.map(({ flashSale, product }) => ({
      endsAt: flashSale.getEndsAt(),
      id: flashSale.getId(),
      product: toProductGqlFromDomain(product),
      remainingStock: flashSale.getRemainingStock(),
      startsAt: flashSale.getStartsAt(),
      status: toFlashSaleStatusGql(flashSale.getStatus(nowUtc)),
      totalStock: flashSale.getTotalStock(),
    }));
  }
}
```

Wire `CLOCK` / repository into the module if not already injectable in this resolver (mirror other modules).

- [ ] **Step 2: Update resolver unit tests**

1. Snapshot fixtures include `product`.
2. `flashSale` maps nested product.
3. Delegation:

```ts
it('flashSales uses only findAllForCatalog and maps preloaded products', async () => {
  const findAllForCatalog = jest.fn().mockResolvedValue([
    {
      flashSale: FlashSale.reconstitute({
        id: 'sale-early' as FlashSaleId,
        productId: 'p1' as ProductId,
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 1,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        totalStock: 1,
      }),
      product: Product.create({ id: 'p1' as ProductId, name: 'A' }),
    },
    {
      flashSale: FlashSale.reconstitute({
        id: 'sale-late' as FlashSaleId,
        productId: 'p2' as ProductId,
        endsAt: new Date('2026-07-28T18:00:00.000Z'),
        remainingStock: 1,
        startsAt: new Date('2026-07-28T14:00:00.000Z'),
        totalStock: 1,
      }),
      product: Product.create({
        id: 'p2' as ProductId,
        name: 'B',
        description: 'Desc',
      }),
    },
  ]);
  const findById = jest.fn();
  const findByIdWithProduct = jest.fn();
  const resolver = new FlashSaleResolver(
    { nowUtc: () => new Date('2026-07-28T12:00:00.000Z') },
    { findAllForCatalog, findById, findByIdWithProduct } as unknown as FlashSaleRepository,
    { getById: jest.fn() } as unknown as FlashSaleQueryCache,
  );

  const result = await resolver.flashSales();

  expect(findAllForCatalog).toHaveBeenCalledTimes(1);
  expect(findById).not.toHaveBeenCalled();
  expect(findByIdWithProduct).not.toHaveBeenCalled();
  expect(result[0]!.product).toEqual({
    description: null,
    id: 'p1',
    name: 'A',
  });
  expect(result[1]!.product.description).toBe('Desc');
});

it('flashSales returns empty array when catalog is empty', async () => {
  const resolver = new FlashSaleResolver(
    { nowUtc: () => new Date('2026-07-28T12:00:00.000Z') },
    {
      findAllForCatalog: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      findByIdWithProduct: jest.fn(),
    } as unknown as FlashSaleRepository,
    { getById: jest.fn() } as unknown as FlashSaleQueryCache,
  );
  await expect(resolver.flashSales()).resolves.toEqual([]);
});
```

- [ ] **Step 3: Run resolver unit tests**

Run: `pnpm --filter api test -- flash-sale.resolver.spec.ts`

Expected: PASS.

- [ ] **Step 4: Optional commit**

```bash
git add apps/api/src/flash-sale/flash-sale.resolver.ts \
  apps/api/src/flash-sale/flash-sale.resolver.spec.ts \
  apps/api/src/flash-sale/flash-sale.module.ts
git commit -m "feat(api): add flashSales catalog query and nested product mapping"
```

---

### Task 6: GraphQL integration contract + behavior tests

**Files:**

- Modify: `apps/api/test/graphql/graphql-api.integration.spec.ts`
- Possibly: `apps/api/test/graphql/redis-query-cache.integration.spec.ts`

**Note:** `pnpm --filter api test:integration` already uses `--runInBand`, so exclusive table clears for empty catalog are safe within that suite.

- [ ] **Step 1: Update schema contract from the live schema**

**Before** locking exact `Set` equality, print/inspect the current query field names and `FlashSale` / `Product` fields from introspection (the existing test already uses exact sets — update them to the **post-change complete** sets, not `arrayContaining`, to preserve the suite’s exact-contract style).

Expected after #121 (verify against running schema, then lock):

```ts
expect(new Set(queryNames)).toEqual(new Set(['flashSale', 'flashSales', 'myPurchase']));

expect(typeFields.get('FlashSale')).toEqual(
  new Set(['id', 'product', 'status', 'remainingStock', 'totalStock', 'startsAt', 'endsAt']),
);
expect(typeFields.get('Product')).toEqual(new Set(['id', 'name', 'description']));
expect(typeFields.get('FlashSale')?.has('productId')).toBe(false);
```

Also assert nullable description via introspection of `Product.description` type kind if convenient; behavioral test below is required.

Confirm generated/runtime schema exposes:

```text
Product.description: String
FlashSale.product: Product!
Query.flashSales: [FlashSale!]!
```

- [ ] **Step 2: Extend `seedFlashSale` for description**

Allow `productDescription?: string | null` on the fixture; pass through to `prisma.product.create`.

- [ ] **Step 3: Behavioral cases**

1. **`flashSale` nested product** — `product { id name description }`; null description → GraphQL `null`.
2. **Preserve `NOT_FOUND` / `BAD_USER_INPUT`** for missing / whitespace ids.
3. **Empty catalog (real `[]`)** — exclusive clear, then assert payload.

   This test must **not** run concurrently with another process or test worker using the same database. The api integration script already uses `--runInBand`; still do not share this DB with a parallel local/CI job while this test clears tables.

```ts
it('returns empty flashSales when no sales exist', async () => {
  await prisma.purchase.deleteMany({});
  await prisma.flashSale.deleteMany({});
  await prisma.product.deleteMany({});

  const result = await postGraphql<{ flashSales: unknown[] }>(app, {
    query: `query { flashSales { id } }`,
  });

  expect(result.errors).toBeUndefined();
  expect(result.data?.flashSales).toEqual([]);
});
```

Place this where subsequent tests in the file seed their own rows (or clear+reseed). Do **not** filter a shared catalog by UUID prefix and call that “empty.”

4. **Multi + relationship + order** — seed late `startsAt` first, early second with **distinct** timestamps; among those ids, response order is early then late; each nested product matches. Do **not** assert relative order when two sales share the same `startsAt` (unspecified).
5. **Status with fixed clock window** — seed:

```text
nowUtc   = wall clock at request time ≈ Date.now() is flaky for ACTIVE assertion;
prefer: startsAt = now - 20m, endsAt = now + 20m, remainingStock > 0
```

Because production `CLOCK` is system time (`SystemClock`), use relative windows around `Date.now()` **documented as time-dependent**, OR override `CLOCK` in a dedicated testing module to fixed `2026-07-28T12:00:00.000Z` with `startsAt=10:00Z` / `endsAt=14:00Z` if the file already supports provider overrides. Prefer fixed clock when wiring is cheap; otherwise relative ACTIVE window with a short comment that status derives from `FlashSale.getStatus(now)`.

6. Keep existing SUCCESS test; add `product` selection; still assert no `productId`.

Catalog query:

```graphql
query FlashSalesCatalog {
  flashSales {
    id
    status
    remainingStock
    totalStock
    startsAt
    endsAt
    product {
      id
      name
      description
    }
  }
}
```

- [ ] **Step 4: Redis integration updates**

Update hard-coded snapshot expectations to include `product`. Optional (not mandatory): stale product E2E — seed → first `flashSale` → mutate product in DB → second `flashSale` still returns cached product. Prefer relying on Task 4 unit proof if E2E is costly.

- [ ] **Step 5: Run GraphQL integration**

```bash
pnpm --filter api test:integration -- graphql-api.integration.spec.ts
pnpm --filter api test:integration -- redis-query-cache.integration.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Optional commit**

```bash
git add apps/api/test/graphql/graphql-api.integration.spec.ts \
  apps/api/test/graphql/redis-query-cache.integration.spec.ts
git commit -m "test(api): cover flashSales catalog and nested product GraphQL contracts"
```

---

### Task 7: Full verification

- [ ] **Step 1: Build / lint / unit**

```bash
pnpm --filter @flash-sale/domain build
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test
```

- [ ] **Step 2: Integration**

```bash
pnpm --filter api test:integration
```

- [ ] **Step 3: Spec checklist**

- [ ] `flashSales` query exists; returns `[]` when empty
- [ ] Nested `product` on shared `FlashSale`
- [ ] No admin fields / no GraphQL `productId`
- [ ] Mapping: Prisma null → domain undefined → GraphQL null
- [ ] `flashSale(id)` works + nested product; errors preserved
- [ ] Ordering `startsAt ASC`
- [ ] Adapter catalog uses `findMany`+include (no per-row `findUnique`)
- [ ] Resolver catalog delegates only to `findAllForCatalog`
- [ ] Purchase/reservation still use `findById`
- [ ] Cache hit serves snapshot product without repository call

- [ ] **Step 4: Optional docs commit** (after user approval)

```bash
git add docs/superpowers/specs/2026-07-29-issue-121-flash-sales-catalog-query-design.md \
  docs/superpowers/plans/2026-07-29-issue-121-flash-sales-catalog-query.md
git commit -m "docs: finalize #121 catalog design and implementation plan"
```

---

## Self-review (plan vs spec)

| Spec requirement                                             | Task                                   |
| ------------------------------------------------------------ | -------------------------------------- |
| GraphQL `Product` + nullable description                     | 3, 5, 6                                |
| Nested `product` on shared `FlashSale`                       | 3, 5                                   |
| `flashSales` unfiltered list + real empty `[]`               | 5, 6                                   |
| Order `startsAt ASC`                                         | 2, 6                                   |
| Exactly one `findMany`+include; no follow-up product queries | 2 adapter unit                         |
| No domain `Product` on `FlashSale` entity / transport type   | 1                                      |
| Prisma null → domain undefined → GraphQL null                | 2 mapper unit + integration, 5, 6      |
| Equal `startsAt` order unspecified                           | 2/6 tests use distinct timestamps only |
| Snapshot product fields; stale on hit; legacy miss           | 4                                      |
| Preserve purchase `findById`                                 | 4 Step 0                               |
| No per-row product lookup                                    | 2 adapter unit                         |
| Resolver delegation only                                     | 5                                      |
| Integration matrix                                           | 6                                      |
| Out of scope                                                 | Not in any task                        |

---

## Execution handoff

Plan revised (uncommitted) at `docs/superpowers/plans/2026-07-29-issue-121-flash-sales-catalog-query.md`.

**Two execution options when you approve this revision:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
