# EPIC-02 #17 — Flash Sale Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#17](https://github.com/rexescario-dev/flash-sale-system/issues/17) by adding a domain-owned `FlashSaleRepository` port + `FLASH_SALE_REPOSITORY` DI token, a Prisma read-only `findById` adapter with mapper/`reconstitute`, and a minimal Nest `FlashSaleModule` — proven by unit tests (including corrupt reconstitution) and a PostgreSQL hit/miss integration round-trip.

**Acceptance criteria (from issue, interpreted):**

- Repository interface lives in the domain/application-facing boundary → `@flash-sale/domain` port + runtime DI token.
- Prisma implementation can load flash sale state → `findById` returns `FlashSale | null`.

**Architecture:** Thin domain port in `packages/domain`; Prisma mapper + adapter + Nest feature slice in `apps/api/src/flash-sale/`. Adapter flow: `findUnique` → `null` or `FlashSaleMapper.toDomain` → `FlashSale.reconstitute`. No writes. Corrupt rows propagate `FlashSaleValidationError` (unit-only; do not weaken CHECKs). Integration proves hit + miss only.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL 16, Jest + ts-jest, `@flash-sale/domain`, pnpm + Turborepo.

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md) (`#17 — Implement flash-sale repository`)

**Authority:** The approved umbrella `#17` contract is authoritative. This plan operationalizes it and must **not** alter its contract. Do not invent requirements.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`. Author email must be `rex.escario.jr@gmail.com`.

**ESLint:** perfectionist sort — object keys: `id` first where present, then A→Z. Run ESLint after writing and accept repository ordering if it rewrites keys/members/exports.

**Out of scope:** writes on the port; `PurchaseRepository`; uniqueness → typed repo error; `ALREADY_PURCHASED`; GraphQL; Redis; schema/migration **edits** (creating or modifying migrations / `schema.prisma`); domain entity behavior changes.

Applying existing migrations via `prisma:migrate:deploy` against a test DB is allowed and required for integration/CI; that is **not** a schema edit.

---

## File map

| Path                                                                        | Responsibility                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/domain/src/flash-sale/flash-sale.repository.ts`                   | **Create:** `FlashSaleRepository` interface + `FLASH_SALE_REPOSITORY` Symbol |
| `packages/domain/src/index.ts`                                              | **Modify:** export port type + token                                         |
| `apps/api/src/flash-sale/flash-sale.mapper.ts`                              | **Create:** Prisma row → `FlashSale.reconstitute`                            |
| `apps/api/src/flash-sale/flash-sale.mapper.spec.ts`                         | **Create:** mapper unit tests (valid + corrupt)                              |
| `apps/api/src/flash-sale/prisma-flash-sale.repository.ts`                   | **Create:** Prisma `findById` adapter                                        |
| `apps/api/src/flash-sale/prisma-flash-sale.repository.spec.ts`              | **Create:** adapter unit tests (hit / miss / corrupt propagation)            |
| `apps/api/src/flash-sale/flash-sale.module.ts`                              | **Create:** Nest providers + `useExisting` token alias                       |
| `apps/api/src/app.module.ts`                                                | **Modify:** import `FlashSaleModule`                                         |
| `apps/api/jest.integration.config.cjs`                                      | **Create:** Jest config for `test/flash-sale/**`                             |
| `apps/api/package.json`                                                     | **Modify:** add `test:integration` script                                    |
| `apps/api/test/flash-sale/prisma-flash-sale.repository.integration.spec.ts` | **Create:** PostgreSQL hit + miss round-trip                                 |
| `.github/workflows/ci.yml`                                                  | **Modify:** `schema-test` job adds `test:integration` step                   |
| `docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md`    | Carry forward if still uncommitted local `#17` contract work                 |
| `docs/superpowers/plans/2026-07-28-epic-02-flash-sale-repository.md`        | This plan (carry forward if uncommitted)                                     |

**Untouched:** `apps/api/prisma/**`, purchase uniqueness mapping, GraphQL modules, Redis, domain entity files (`flash-sale.ts` / errors / product / purchase).

---

## Task 0: Inspect working tree, verify `#16` baseline, create branch

**Files:** none (git only)

- [ ] **Step 1: Inspect working tree and classify local changes**

```bash
cd /home/rex/Project/test/app
git status --short
git status -sb
git branch -vv
git rev-parse HEAD
git fetch origin
git rev-parse origin/main
git merge-base --is-ancestor origin/main HEAD; echo "HEAD_contains_origin_main_exit=$?"
```

Classify uncommitted paths into:

1. **Intended `#17` docs** — umbrella `#17` contract and/or this plan under `docs/superpowers/`
2. **Unrelated uncommitted changes** — anything else

Rules:

- If **unrelated** uncommitted changes exist → **stop** and ask the operator to resolve them. Do **not** stash, reset, discard, or overwrite automatically.
- If only intended `#17` docs are dirty → **preserve** them (they should ride along onto the feature branch).

- [ ] **Step 2: Verify `#16` baseline on `origin/main`**

```bash
git log -1 --oneline origin/main
rg -n "@@unique\(\[flashSaleId, userId\]\)" <(git show origin/main:apps/api/prisma/schema.prisma)
git ls-tree -r --name-only origin/main | rg '20260727025216_purchase_flash_sale_user_unique'
```

Expected:

- `origin/main` at/after `10279ca` (PR #103 / `#16` merged)
- `Purchase` has `@@unique([flashSaleId, userId])`
- Migration `20260727025216_purchase_flash_sale_user_unique` exists

- [ ] **Step 3: Create feature branch from up-to-date main**

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/epic-02-flash-sale-repository
```

If docs-only dirty files block the switch, carry them onto the branch (e.g. create branch from current HEAD after confirming it contains `origin/main`, or `git switch -c` without discarding docs). Do **not** discard the `#17` spec/plan.

- [ ] **Step 4: Optional commit checkpoint (docs only — only if authorized)**

```bash
git add docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md \
        docs/superpowers/plans/2026-07-28-epic-02-flash-sale-repository.md
git commit -m "$(cat <<'EOF'
docs: add EPIC-02 #17 flash-sale repository contract and plan

EOF
)"
```

---

## Task 1: Domain port + DI token + public exports

**Files:**

- Create: `packages/domain/src/flash-sale/flash-sale.repository.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Add the port file**

Create `packages/domain/src/flash-sale/flash-sale.repository.ts`.

Before writing, skim a neighboring domain file (e.g. `flash-sale.ts`) and **preserve the repository’s established `.js` ESM import style** (relative imports ending in `.js`).

```ts
import type { FlashSaleId } from '../ids.js';

import type { FlashSale } from './flash-sale.js';

/** Runtime Nest DI token for FlashSaleRepository. Owned by @flash-sale/domain. */
export const FLASH_SALE_REPOSITORY = Symbol('FLASH_SALE_REPOSITORY');

export interface FlashSaleRepository {
  findById(id: FlashSaleId): Promise<FlashSale | null>;
}
```

Rules:

- **No** Nest/Prisma imports.
- Keep interface + Symbol in this single file (no `.token.ts`).
- Do not add write methods.

- [ ] **Step 2: Export from package barrel**

Modify `packages/domain/src/index.ts` — add exports (then run ESLint; accept perfectionist A→Z / established order):

```ts
export { FLASH_SALE_REPOSITORY } from './flash-sale/flash-sale.repository.js';
export type { FlashSaleRepository } from './flash-sale/flash-sale.repository.js';
```

Keep existing FlashSale / Product / Purchase / ID exports. Do **not** remove any prior exports.

- [ ] **Step 3: Typecheck domain package**

```bash
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain lint
```

Expected: PASS. Confirm `FLASH_SALE_REPOSITORY` is a runtime value export (not `export type` only).

- [ ] **Step 4: Optional commit (only if authorized)**

```bash
git add packages/domain/src/flash-sale/flash-sale.repository.ts packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add FlashSaleRepository port and DI token

EOF
)"
```

---

## Task 2: Mapper — failing unit tests, then implementation

**Files:**

- Create: `apps/api/src/flash-sale/flash-sale.mapper.spec.ts`
- Create: `apps/api/src/flash-sale/flash-sale.mapper.ts`

Unit tests verify **field mapping**, **persistence-only timestamp exclusion** (`createdAt` / `updatedAt` never reach the domain), and **propagation of domain reconstitution errors**. They do not weaken schema CHECKs.

- [ ] **Step 1: Write failing mapper unit tests**

Create `apps/api/src/flash-sale/flash-sale.mapper.spec.ts`:

```ts
import { FlashSaleValidationError } from '@flash-sale/domain';
import type { FlashSale as PrismaFlashSale } from '@prisma/client';

import { FlashSaleMapper } from './flash-sale.mapper';

function buildRow(overrides: Partial<PrismaFlashSale> = {}): PrismaFlashSale {
  const now = new Date('2026-07-28T12:00:00.000Z');
  return {
    createdAt: now,
    endsAt: new Date('2026-07-28T14:00:00.000Z'),
    id: 'sale-1',
    productId: 'product-1',
    remainingStock: 3,
    startsAt: new Date('2026-07-28T10:00:00.000Z'),
    totalStock: 10,
    updatedAt: now,
    ...overrides,
  };
}

describe('FlashSaleMapper', () => {
  it('maps a valid Prisma row to FlashSale via reconstitute', () => {
    const row = buildRow({ id: '  sale-padded  ', productId: '  product-padded  ' });
    const sale = FlashSaleMapper.toDomain(row);

    expect(sale.getId()).toBe('  sale-padded  ');
    expect(sale.getProductId()).toBe('  product-padded  ');
    expect(sale.getEndsAt().toISOString()).toBe('2026-07-28T14:00:00.000Z');
    expect(sale.getRemainingStock()).toBe(3);
    expect(sale.getStartsAt().toISOString()).toBe('2026-07-28T10:00:00.000Z');
    expect(sale.getTotalStock()).toBe(10);
  });

  it('propagates FlashSaleValidationError for invalid persisted state', () => {
    const row = buildRow({ remainingStock: 11, totalStock: 10 });

    try {
      FlashSaleMapper.toDomain(row);
      fail('Expected FlashSaleValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(FlashSaleValidationError);
      expect((error as FlashSaleValidationError).code).toBe('REMAINING_STOCK_EXCEEDS_TOTAL');
    }
  });
});
```

Invoke `toDomain` **once**. Do not combine `toThrow(...)` with a second call just to read `code`.

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```bash
pnpm --filter api test -- flash-sale.mapper.spec.ts
```

Expected: FAIL (cannot find `./flash-sale.mapper` or `FlashSaleMapper`).

- [ ] **Step 3: Implement mapper**

Create `apps/api/src/flash-sale/flash-sale.mapper.ts`:

```ts
import { FlashSale, type FlashSaleId, type ProductId } from '@flash-sale/domain';
import type { FlashSale as PrismaFlashSale } from '@prisma/client';

export class FlashSaleMapper {
  static toDomain(row: PrismaFlashSale): FlashSale {
    return FlashSale.reconstitute({
      id: row.id as FlashSaleId,
      endsAt: row.endsAt,
      productId: row.productId as ProductId,
      remainingStock: row.remainingStock,
      startsAt: row.startsAt,
      totalStock: row.totalStock,
    });
  }
}
```

Rules:

- Discard `createdAt` / `updatedAt` (do not pass them to `reconstitute`).
- Local casts only — no public branding helpers.
- Do **not** catch `FlashSaleValidationError`.
- Do **not** trim IDs.
- No Nest decorators.
- After writing, run ESLint; accept perfectionist key order inside the `reconstitute` object.

- [ ] **Step 4: Run mapper tests — expect PASS**

```bash
pnpm --filter api test -- flash-sale.mapper.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Optional commit (only if authorized)**

```bash
git add apps/api/src/flash-sale/flash-sale.mapper.ts apps/api/src/flash-sale/flash-sale.mapper.spec.ts
git commit -m "$(cat <<'EOF'
feat: map Prisma FlashSale rows to domain via reconstitute

EOF
)"
```

---

## Task 3: Prisma adapter — failing unit tests, then implementation

**Files:**

- Create: `apps/api/src/flash-sale/prisma-flash-sale.repository.spec.ts`
- Create: `apps/api/src/flash-sale/prisma-flash-sale.repository.ts`

- [ ] **Step 1: Write failing adapter unit tests**

Create `apps/api/src/flash-sale/prisma-flash-sale.repository.spec.ts`:

```ts
import { type FlashSaleId } from '@flash-sale/domain';
import type { FlashSale as PrismaFlashSale } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';

import { PrismaFlashSaleRepository } from './prisma-flash-sale.repository';

describe('PrismaFlashSaleRepository', () => {
  const saleId = 'sale-1' as FlashSaleId;

  function buildRow(overrides: Partial<PrismaFlashSale> = {}): PrismaFlashSale {
    const now = new Date('2026-07-28T12:00:00.000Z');
    return {
      createdAt: now,
      endsAt: new Date('2026-07-28T14:00:00.000Z'),
      id: 'sale-1',
      productId: 'product-1',
      remainingStock: 3,
      startsAt: new Date('2026-07-28T10:00:00.000Z'),
      totalStock: 10,
      updatedAt: now,
      ...overrides,
    };
  }

  it('returns null when Prisma findUnique returns null', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = { flashSale: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaFlashSaleRepository(prisma);

    await expect(repo.findById(saleId)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: saleId } });
  });

  it('returns a FlashSale when a row exists', async () => {
    const findUnique = jest.fn().mockResolvedValue(buildRow());
    const prisma = { flashSale: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaFlashSaleRepository(prisma);

    const sale = await repo.findById(saleId);

    expect(sale).not.toBeNull();
    expect(sale!.getId()).toBe('sale-1');
    expect(sale!.getRemainingStock()).toBe(3);
    expect(sale!.getTotalStock()).toBe(10);
  });

  it('propagates FlashSaleValidationError when mapped state is invalid', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue(buildRow({ remainingStock: 11, totalStock: 10 }));
    const prisma = { flashSale: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaFlashSaleRepository(prisma);

    await expect(repo.findById(saleId)).rejects.toMatchObject({
      code: 'REMAINING_STOCK_EXCEEDS_TOTAL',
    });
  });
});
```

Assert once (do **not** call `findById` twice). `toMatchObject` on the rejection is sufficient to confirm the domain error `code`; do not rely on a second adapter invocation.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter api test -- prisma-flash-sale.repository.spec.ts
```

Expected: FAIL (adapter module missing).

- [ ] **Step 3: Implement adapter**

Create `apps/api/src/flash-sale/prisma-flash-sale.repository.ts`:

```ts
import { type FlashSale, type FlashSaleId, type FlashSaleRepository } from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { FlashSaleMapper } from './flash-sale.mapper';

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
}
```

Rules:

- No `include` for `product` / `purchases`.
- Do **not** catch mapper/domain errors.
- No write methods.

- [ ] **Step 4: Run adapter + mapper unit tests — expect PASS**

```bash
pnpm --filter api test -- src/flash-sale
```

Expected: PASS.

- [ ] **Step 5: Optional commit (only if authorized)**

```bash
git add apps/api/src/flash-sale/prisma-flash-sale.repository.ts \
        apps/api/src/flash-sale/prisma-flash-sale.repository.spec.ts
git commit -m "$(cat <<'EOF'
feat: add Prisma FlashSaleRepository findById adapter

EOF
)"
```

---

## Task 4: Nest `FlashSaleModule` + `AppModule` wiring

**Files:**

- Create: `apps/api/src/flash-sale/flash-sale.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create minimal FlashSaleModule**

Create `apps/api/src/flash-sale/flash-sale.module.ts`:

```ts
import { FLASH_SALE_REPOSITORY } from '@flash-sale/domain';
import { Module } from '@nestjs/common';

import { PrismaFlashSaleRepository } from './prisma-flash-sale.repository';

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

Rules:

- Import `FLASH_SALE_REPOSITORY` from `@flash-sale/domain` — **never** redefine the Symbol in `apps/api`.
- Do **not** import/re-export `PrismaModule` (`PrismaModule` is already `@Global()`).
- No controllers, resolvers, or use cases.

- [ ] **Step 2: Register in AppModule**

Modify `apps/api/src/app.module.ts` imports array to include `FlashSaleModule` (keep existing Config/GraphQL/Prisma/Health; run ESLint for import/member order):

```ts
import { FlashSaleModule } from './flash-sale/flash-sale.module';
```

Add `FlashSaleModule` to the `@Module({ imports: [...] })` list alongside `PrismaModule` / `HealthModule`.

- [ ] **Step 3: Typecheck API**

```bash
pnpm --filter api typecheck
pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 4: Optional commit (only if authorized)**

```bash
git add apps/api/src/flash-sale/flash-sale.module.ts apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat: wire FlashSaleModule with domain repository token

EOF
)"
```

---

## Task 5: PostgreSQL integration tests + Jest config/script

**Files:**

- Create: `apps/api/jest.integration.config.cjs`
- Modify: `apps/api/package.json`
- Create: `apps/api/test/flash-sale/prisma-flash-sale.repository.integration.spec.ts`

- [ ] **Step 1: Add Jest integration config**

Create `apps/api/jest.integration.config.cjs` (mirror `jest.schema.config.cjs`, different `testMatch`):

```js
/* global module, process */
process.env.NODE_ENV = 'test';

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/flash-sale/**/*.spec.ts'],
  testTimeout: 30_000,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
};
```

- [ ] **Step 2: Add `test:integration` script**

In `apps/api/package.json` `scripts`, add (same `DATABASE_URL` default pattern as `test:schema`):

```json
"test:integration": "DATABASE_URL=${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale} jest --config jest.integration.config.cjs --runInBand"
```

- [ ] **Step 3: Write integration tests (hit + miss only)**

Create `apps/api/test/flash-sale/prisma-flash-sale.repository.integration.spec.ts`:

```ts
import type { FlashSaleId } from '@flash-sale/domain';
import { randomUUID } from 'node:crypto';

import { PrismaFlashSaleRepository } from '../../src/flash-sale/prisma-flash-sale.repository';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('PrismaFlashSaleRepository integration (#17)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaFlashSaleRepository(prisma);

  beforeAll(async () => {
    // PrismaService skips eager connect when NODE_ENV=test; connect explicitly for integration.
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('loads an existing FlashSale from PostgreSQL', async () => {
    const suffix = randomUUID();
    const productId = `product-repo-${suffix}`;
    const flashSaleId = `sale-repo-${suffix}`;
    const now = new Date('2026-07-28T12:00:00.000Z');
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');

    try {
      await prisma.product.create({
        data: {
          id: productId,
          name: 'Repo Integration Product',
          updatedAt: now,
        },
      });

      await prisma.flashSale.create({
        data: {
          id: flashSaleId,
          endsAt,
          productId,
          remainingStock: 4,
          startsAt,
          totalStock: 9,
          updatedAt: now,
        },
      });

      const sale = await repo.findById(flashSaleId as FlashSaleId);

      expect(sale).not.toBeNull();
      expect(sale!.getId()).toBe(flashSaleId);
      expect(sale!.getProductId()).toBe(productId);
      expect(sale!.getEndsAt().toISOString()).toBe(endsAt.toISOString());
      expect(sale!.getRemainingStock()).toBe(4);
      expect(sale!.getStartsAt().toISOString()).toBe(startsAt.toISOString());
      expect(sale!.getTotalStock()).toBe(9);
    } finally {
      await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
  });

  it('returns null for a missing FlashSale id', async () => {
    const missingId = `sale-missing-${randomUUID()}` as FlashSaleId;
    await expect(repo.findById(missingId)).resolves.toBeNull();
  });
});
```

Rules:

- Do **not** attempt to insert CHECK-invalid rows for corrupt-path coverage (unit tests own that).
- Seed `Product` before `FlashSale` (`onDelete: Restrict` FK).
- Wrap **all writes + assertions** in `try` / `finally` so a failed `flashSale.create` still cleans up the product.
- Construct the adapter with `PrismaService` (extends `PrismaClient`); call `$connect()` explicitly because Nest skips eager connect when `NODE_ENV=test`.
- Use `import { randomUUID } from 'node:crypto'` — do not rely on a global `crypto`.
- **Nest DI is intentionally not integration-tested in #17.** This suite exercises the adapter directly (`new PrismaFlashSaleRepository(prisma)`). Token resolution is covered by the explicit `FlashSaleModule` declaration + typecheck/lint; a Nest TestingModule round-trip would be overkill here.

- [ ] **Step 4: Migrate deploy (if needed) and run integration tests**

`prisma:migrate:deploy` is permitted **only** to apply **existing** migrations to the test database. `#17` must **not** create, modify, rename, or add migrations (and must not edit `schema.prisma`).

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:integration
```

Expected: PASS (requires local Postgres matching Compose/`DATABASE_URL`, same as schema tests).

If Postgres is down → start Compose per project docs, then retry. Do **not** skip this gate.

- [ ] **Step 5: Optional commit (only if authorized)**

```bash
git add apps/api/jest.integration.config.cjs \
        apps/api/package.json \
        apps/api/test/flash-sale/prisma-flash-sale.repository.integration.spec.ts
git commit -m "$(cat <<'EOF'
test: add FlashSale repository PostgreSQL integration coverage

EOF
)"
```

---

## Task 6: Extend CI `schema-test` job

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add integration step after `test:schema`**

In the `schema-test` job `steps`, after:

```yaml
- run: pnpm --filter api test:schema
```

append:

```yaml
- run: pnpm --filter api test:integration
```

Do **not** change the Postgres service block, `DATABASE_URL`, or `quality` job. Unit tests stay in `quality` via `pnpm test`.

Final `schema-test` sequence must be:

1. checkout / pnpm / node setup
2. `pnpm install --frozen-lockfile`
3. `pnpm --filter api prisma:generate`
4. `pnpm --filter api prisma:migrate:deploy`
5. `pnpm --filter api test:schema`
6. `pnpm --filter api test:integration`

- [ ] **Step 2: Optional commit (only if authorized)**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: run flash-sale repository integration tests in schema-test

EOF
)"
```

---

## Task 7: Full quality gates + DoD checklist

**Files:** none (verification only)

- [ ] **Step 1: Run workspace quality gates**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter api test:schema
pnpm --filter api test:integration
pnpm build
```

Expected: all PASS.

- [ ] **Step 2: DoD checklist (from umbrella `#17`)**

- [ ] `FlashSaleRepository` + domain-owned `FLASH_SALE_REPOSITORY` exported from `@flash-sale/domain` (token not redefined in `apps/api`)
- [ ] `findById` hit → `FlashSale`; miss → `null`
- [ ] Mapper → `reconstitute` only; corrupt → `FlashSaleValidationError` propagates (unit)
- [ ] `FlashSaleModule` uses `useExisting`; imported by `AppModule`
- [ ] Unit + integration tests pass; CI `schema-test` runs `test:schema` then `test:integration`
- [ ] No writes / purchase repo / uniqueness mapping / GraphQL / Redis / schema-migration edits
- [ ] ESLint + typecheck pass
- [ ] Commits (if any) are `<type>: <MESSAGE>` with **no** `Co-authored-by`

- [ ] **Step 3: Stop for PR / merge authorization**

Do **not** open a PR or push unless the user asks. When asked, use branch `feat/epic-02-flash-sale-repository`, title referencing `#17`, and ensure CI is green before merge. Do **not** start `#18` until `#17` is on `main`.

---

## Spec coverage self-review

| Spec requirement                                      | Task(s)       |
| ----------------------------------------------------- | ------------- |
| Port in `@flash-sale/domain`                          | Task 1        |
| `FLASH_SALE_REPOSITORY` domain-owned Symbol           | Task 1, 4     |
| `findById` → `FlashSale \| null`                      | Tasks 3, 5    |
| Mapper → `reconstitute`; discard audit timestamps     | Task 2        |
| Corrupt → `FlashSaleValidationError` unchanged        | Tasks 2–3     |
| No catch/remap to null                                | Tasks 2–3     |
| Prisma adapter boring flow                            | Task 3        |
| Minimal Nest module + `useExisting` + AppModule       | Task 4        |
| Unit tests (mock Prisma)                              | Tasks 2–3     |
| Integration hit + miss; corrupt unit-only             | Task 5        |
| Integration tests adapter directly (no Nest DI suite) | Task 5        |
| CI extend `schema-test` with `test:integration`       | Task 6        |
| No writes / purchase / uniqueness / GraphQL / Redis   | All (out)     |
| No schema/migration **edits** (`migrate deploy` OK)   | File map / T5 |

**Placeholder scan:** none intentional.  
**Type consistency:** `FlashSaleRepository.findById(id: FlashSaleId): Promise<FlashSale | null>` used throughout; token name `FLASH_SALE_REPOSITORY` only.
