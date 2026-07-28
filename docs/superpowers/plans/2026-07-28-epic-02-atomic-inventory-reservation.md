# EPIC-02 #19 — Atomic Inventory Reservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#19](https://github.com/rexescario-dev/flash-sale-system/issues/19) by adding a domain-owned `FlashSaleReservation` port + `FLASH_SALE_RESERVATION` DI token and a Prisma `$executeRaw` conditional `UPDATE` adapter that atomically decrements stock when the sale is in its active window and `remaining_stock > 0` — proven by unit tests, a sequential PostgreSQL behavioral matrix, and a focused `N > S` concurrent integration test.

**Acceptance criteria (from issue, interpreted):**

- Inventory decrement is atomic with `remaining_stock > 0` and active time window → one conditional SQL `UPDATE` with half-open `[starts_at, ends_at)` vs caller `nowUtc`.
- No read-modify-write race pattern → no `SELECT`→mutate→`save`; success is solely `affectedRows === 1`.

**Architecture:** Dedicated command port in `@flash-sale/domain` (`FlashSaleReservation`); `FlashSaleRepository` stays read-only. Adapter `PrismaFlashSaleReservation` in `apps/api/src/flash-sale/` runs one parameterized `$executeRaw` `UPDATE` (explicit `updated_at = nowUtc`). Nest wiring extends existing `FlashSaleModule` with a second `useExisting` token alias. `#20` owns purchase insert / `ALREADY_PURCHASED` / full purchase txn.

**Tech Stack:** NestJS 11, Prisma 6 (`$executeRaw`), PostgreSQL 16, Jest + ts-jest, `@flash-sale/domain`, pnpm + Turborepo.

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md) (`#19 — Implement atomic inventory reservation`)

**Authority:** The approved umbrella `#19` contract is authoritative. This plan operationalizes it and must **not** alter its contract. Do not invent requirements.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`. Author email must be `rex.escario.jr@gmail.com`.

**ESLint:** perfectionist sort — object keys: `id` first where present, then A→Z. Run ESLint after writing and accept repository ordering if it rewrites keys/members/exports. Nest `@Module` arrays: follow existing static-modules-before-`forRoot` / A→Z conventions already on `main`.

**Out of scope:** Purchase insert; uniqueness → `ALREADY_PURCHASED`; full purchase transaction; GraphQL; Redis; schema/migration **edits**; write methods on `FlashSaleRepository`; `FlashSale.reserve()` entity mutation; failure-reason taxonomy on `tryReserve`; timezone conversion / Date normalization beyond `INVALID_NOW`.

Applying existing migrations via `prisma:migrate:deploy` against a test DB is allowed and required for integration/CI; that is **not** a schema edit.

**Verification split (locked):**

- **Unit tests** verify adapter **control flow and error behavior** (`affected === 1` → `true`; `affected !== 1` → `false`; invalid `nowUtc` → `INVALID_NOW` and **no** `$executeRaw` call).
- **Integration tests** are **authoritative for SQL semantics** (window predicates, stock decrement, `updated_at === nowUtc`, concurrent no-oversell). Do **not** treat “`$executeRaw` was invoked” as proof of SQL shape.

**`INVALID_NOW` boundary (locked):**

> `FlashSaleReservation.tryReserve()` rejects an invalid `Date` argument with `FlashSaleValidationError(INVALID_NOW)`. The adapter performs this input guard before invoking SQL because the reservation operation must never issue SQL with an invalid timestamp.

Do **not** move this validation into `FlashSale` or introduce a new value object for `#19`. Reuse the existing `#14` code/`FlashSaleValidationError` type only.

**Success contract:** `affectedRows === 1` → `true`; **`affectedRows !== 1` → `false`** (not merely “0 rows”).

---

## File map

| Path                                                                         | Responsibility                                                    |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/domain/src/flash-sale/flash-sale.reservation.ts`                   | **Create:** `FlashSaleReservation` + `FLASH_SALE_RESERVATION`     |
| `packages/domain/src/index.ts`                                               | **Modify:** export port + token                                   |
| `apps/api/src/flash-sale/prisma-flash-sale.reservation.ts`                   | **Create:** `$executeRaw` conditional `UPDATE` adapter            |
| `apps/api/src/flash-sale/prisma-flash-sale.reservation.spec.ts`              | **Create:** adapter unit tests (`true` / `false` / `INVALID_NOW`) |
| `apps/api/src/flash-sale/flash-sale.module.ts`                               | **Modify:** register + export `FLASH_SALE_RESERVATION`            |
| `apps/api/test/flash-sale/prisma-flash-sale.reservation.integration.spec.ts` | **Create:** sequential matrix + concurrent `N > S` proof          |
| `docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md`     | Carry forward if still uncommitted local `#19` contract work      |
| `docs/superpowers/plans/2026-07-28-epic-02-atomic-inventory-reservation.md`  | This plan (carry forward if uncommitted)                          |

**Untouched:** `apps/api/prisma/**`, `FlashSaleRepository` / read adapter / mapper (except shared module wiring), `Purchase*` slice, GraphQL, Redis, `#20` outcomes.

**CI:** No new job — existing `schema-test` already runs `test:integration`. `jest.integration.config.cjs` already matches `test/flash-sale/**/*.spec.ts` — **no config change**.

---

## Task 0: Inspect working tree, verify `#18` baseline, create branch

**Files:** none (git only)

**Invariant:** Never silently discard, stash, reset, or overwrite the intended `#19` spec/plan. **Never switch branches or rebase with dirty intended docs unless their content is explicitly preserved.**

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

1. **Intended `#19` docs** — umbrella `#19` contract and/or this plan under `docs/superpowers/`
2. **Unrelated uncommitted changes** — anything else

Rules:

- If **unrelated** uncommitted changes exist → **stop** and ask the operator to resolve them. Do **not** stash, reset, discard, or overwrite automatically.
- If only intended `#19` docs are dirty → **preserve** them (do not discard). Preferred path: create the feature branch from current HEAD and carry the dirty docs as-is.
- If HEAD is behind `origin/main` **and** intended docs are dirty → preserve docs first (branch from HEAD, copy/commit docs, or otherwise keep content), then integrate `origin/main` later. Do **not** follow a rigid switch/pull recipe that risks losing docs.

- [ ] **Step 2: Verify `#18` baseline on `origin/main`**

```bash
git log -1 --oneline origin/main
# Optional: if a known #18 merge SHA is available (e.g. from gh pr view 105),
# confirm it is an ancestor — do not treat an abbreviated SHA alone as sufficient.
# git merge-base --is-ancestor <full-or-known-#18-merge-sha> origin/main; echo "has_#18_merge_exit=$?"
git show origin/main:packages/domain/src/purchase/purchase.repository.ts | head -20
git show origin/main:packages/domain/src/purchase/purchase-conflict.error.ts
rg -n "PurchaseRepository|PurchaseConflictError|PURCHASE_REPOSITORY" <(git show origin/main:packages/domain/src/index.ts)
git cat-file -e origin/main:apps/api/src/purchase/prisma-purchase.repository.ts && echo "purchase_adapter_present"
git cat-file -e origin/main:apps/api/src/flash-sale/flash-sale.module.ts && echo "flash_sale_module_present"
```

Expected:

- Verify `origin/main` contains the **merged `#18` baseline**. Use a known merge commit SHA if available (historically PR #105), then **always** verify the expected port, conflict error, adapter, and `FlashSaleModule` artifacts. **Artifact checks are the real acceptance signal**; a SHA ancestor check alone is not sufficient (abbreviated SHAs can be ambiguous).
- `PurchaseRepository` + `PurchaseConflictError` + `PURCHASE_REPOSITORY` on main
- `FlashSaleModule` present (to extend)

- [ ] **Step 3: Create feature branch (docs-safe)**

```bash
git switch -c feat/epic-02-atomic-inventory-reservation
```

If intended `#19` docs are already dirty on the current tip, create the branch from that tip so they ride along. If you must move onto a newer `main`, preserve docs explicitly before any switch/rebase/pull that would drop them.

- [ ] **Step 4: Confirm branch tip**

```bash
git status -sb
git rev-parse --abbrev-ref HEAD
```

Expected: on `feat/epic-02-atomic-inventory-reservation`; intended `#19` docs still present if they were dirty.

- [ ] **Step 5: Commit (optional — only if user authorized)**

```bash
# Docs-only commit only when explicitly asked; otherwise skip.
git add docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md \
        docs/superpowers/plans/2026-07-28-epic-02-atomic-inventory-reservation.md
git commit -m "$(cat <<'EOF'
docs: add EPIC-02 #19 atomic inventory reservation contract and plan

EOF
)"
```

---

## Task 1: Domain port + public exports

**Files:**

- Create: `packages/domain/src/flash-sale/flash-sale.reservation.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Add `FlashSaleReservation` + `FLASH_SALE_RESERVATION`**

Create `packages/domain/src/flash-sale/flash-sale.reservation.ts`:

```ts
import type { FlashSaleId } from '../ids.js';

/** Runtime Nest DI token for FlashSaleReservation. Owned by @flash-sale/domain. */
export const FLASH_SALE_RESERVATION = Symbol('FLASH_SALE_RESERVATION');

export interface FlashSaleReservation {
  tryReserve(flashSaleId: FlashSaleId, nowUtc: Date): Promise<boolean>;
}
```

Preserve established `.js` ESM import style (relative imports ending in `.js`).

- [ ] **Step 2: Export from `packages/domain/src/index.ts`**

Modify the existing file — do **not** reconstruct from scratch. Add exports (ESLint may reorder the whole file; accept perfectionist order):

```ts
export { FLASH_SALE_RESERVATION } from './flash-sale/flash-sale.reservation.js';
export type { FlashSaleReservation } from './flash-sale/flash-sale.reservation.js';
```

Keep existing `FLASH_SALE_REPOSITORY` / `FlashSaleRepository` exports unchanged in meaning.

- [ ] **Step 3: Typecheck domain package**

```bash
pnpm --filter @flash-sale/domain build
pnpm --filter @flash-sale/domain typecheck
```

Expected: PASS (no runtime tests required for a port-only file).

- [ ] **Step 4: Commit (optional — only if user authorized)**

```bash
git add packages/domain/src/flash-sale/flash-sale.reservation.ts packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add FlashSaleReservation domain port

EOF
)"
```

---

## Task 2: Adapter unit tests + `PrismaFlashSaleReservation`

**Files:**

- Create: `apps/api/src/flash-sale/prisma-flash-sale.reservation.spec.ts`
- Create: `apps/api/src/flash-sale/prisma-flash-sale.reservation.ts`

Follow TDD: write failing unit tests first, then implement.

- [ ] **Step 1: Write failing adapter unit tests**

Create `apps/api/src/flash-sale/prisma-flash-sale.reservation.spec.ts`:

```ts
import { FlashSaleValidationError, type FlashSaleId } from '@flash-sale/domain';

import type { PrismaService } from '../prisma/prisma.service';

import { PrismaFlashSaleReservation } from './prisma-flash-sale.reservation';

describe('PrismaFlashSaleReservation', () => {
  const saleId = 'sale-1' as FlashSaleId;
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');

  it('returns true when $executeRaw affects exactly one row', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const prisma = { $executeRaw: executeRaw } as unknown as PrismaService;
    const reservation = new PrismaFlashSaleReservation(prisma);

    await expect(reservation.tryReserve(saleId, nowUtc)).resolves.toBe(true);
    expect(executeRaw).toHaveBeenCalled();
  });

  it('returns false when $executeRaw affects a non-one row count', async () => {
    const executeRaw = jest.fn().mockResolvedValue(0);
    const prisma = { $executeRaw: executeRaw } as unknown as PrismaService;
    const reservation = new PrismaFlashSaleReservation(prisma);

    await expect(reservation.tryReserve(saleId, nowUtc)).resolves.toBe(false);
    expect(executeRaw).toHaveBeenCalled();
  });

  it('throws INVALID_NOW and does not call $executeRaw for invalid nowUtc', async () => {
    const executeRaw = jest.fn();
    const prisma = { $executeRaw: executeRaw } as unknown as PrismaService;
    const reservation = new PrismaFlashSaleReservation(prisma);

    await expect(reservation.tryReserve(saleId, new Date('invalid'))).rejects.toMatchObject({
      code: 'INVALID_NOW',
      name: 'FlashSaleValidationError',
    });
    expect(executeRaw).not.toHaveBeenCalled();
    await expect(reservation.tryReserve(saleId, new Date('invalid'))).rejects.toBeInstanceOf(
      FlashSaleValidationError,
    );
  });
});
```

Notes:

- Assert `code` / `instanceof` — do **not** assert exact message strings.
- **Unit scope = control flow + errors only.** Assert that `$executeRaw` was or was not invoked; do **not** assert SQL text/shape here. Integration tests are authoritative for SQL semantics (predicates, decrement, `updated_at`).
- Do **not** add a fake `affected === 2` case — a single-row conditional `UPDATE` realistically returns `0` or `1`; the contract remains `affected === 1` vs `affected !== 1`.
- Invalid `nowUtc` uses `new Date('invalid')` → `Number.isNaN(getTime()) === true`. The adapter owns this guard so SQL is never issued with an invalid timestamp; do **not** move validation onto `FlashSale`.
- `FlashSaleId` is a branded domain type whose runtime value is still the Prisma/Postgres scalar string — pass it through unchanged (no trim).

- [ ] **Step 2: Run unit tests — expect FAIL (missing module)**

```bash
pnpm --filter api test -- prisma-flash-sale.reservation.spec.ts
```

Expected: FAIL — cannot resolve `./prisma-flash-sale.reservation` (or similar).

- [ ] **Step 3: Implement `PrismaFlashSaleReservation`**

Create `apps/api/src/flash-sale/prisma-flash-sale.reservation.ts`:

```ts
import {
  FlashSaleValidationError,
  type FlashSaleId,
  type FlashSaleReservation,
} from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaFlashSaleReservation implements FlashSaleReservation {
  constructor(private readonly prisma: PrismaService) {}

  async tryReserve(flashSaleId: FlashSaleId, nowUtc: Date): Promise<boolean> {
    // Port contract: reject invalid Date with FlashSaleValidationError(INVALID_NOW)
    // before SQL — reservation must never issue SQL with an invalid timestamp.
    if (Number.isNaN(nowUtc.getTime())) {
      throw new FlashSaleValidationError('INVALID_NOW', 'FlashSale nowUtc must be a valid Date');
    }

    // Same bound nowUtc for window predicates and updated_at.
    // No timezone conversion / Date normalization beyond INVALID_NOW.
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
}
```

Hard rules:

- Use **`$executeRaw`** tagged template — **not** `$executeRawUnsafe`.
- Do **not** use Prisma Client `update` / `updateMany` for this path.
- Do **not** `SELECT` stock before updating on the success path.
- Do **not** trim `flashSaleId` (branded `FlashSaleId` runtime value is the stored string).
- Do **not** convert timezones or rebuild `Date` values (no `toISOString` round-trip that invents a new instant; bind the caller `Date` directly).
- Return `true` only when `affected === 1`; any other count (`affected !== 1`) → `false`.

- [ ] **Step 4: Run unit tests — expect PASS**

```bash
pnpm --filter api test -- prisma-flash-sale.reservation.spec.ts
pnpm --filter api exec eslint src/flash-sale/prisma-flash-sale.reservation.ts src/flash-sale/prisma-flash-sale.reservation.spec.ts
```

Expected: PASS; ESLint clean (accept perfectionist reorder if it rewrites imports/keys).

- [ ] **Step 5: Commit (optional — only if user authorized)**

```bash
git add apps/api/src/flash-sale/prisma-flash-sale.reservation.ts \
        apps/api/src/flash-sale/prisma-flash-sale.reservation.spec.ts
git commit -m "$(cat <<'EOF'
feat: add Prisma FlashSaleReservation with conditional UPDATE

EOF
)"
```

---

## Task 3: Extend `FlashSaleModule`

**Files:**

- Modify: `apps/api/src/flash-sale/flash-sale.module.ts`

- [ ] **Step 1: Register reservation adapter + token alias**

Replace the module contents with (perfectionist may reorder `exports` / `providers` — accept repo order):

```ts
import { FLASH_SALE_REPOSITORY, FLASH_SALE_RESERVATION } from '@flash-sale/domain';
import { Module } from '@nestjs/common';

import { PrismaFlashSaleRepository } from './prisma-flash-sale.repository';
import { PrismaFlashSaleReservation } from './prisma-flash-sale.reservation';

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

- Do **not** create `FlashSaleReservationModule`.
- Do **not** change `AppModule` unless `FlashSaleModule` was removed (it should already be imported after `#17`).
- `PrismaModule` is `@Global()` — do not import/re-export Prisma here.

- [ ] **Step 2: Lint + typecheck api (with workspace build)**

```bash
pnpm --filter @flash-sale/domain build
pnpm --filter api exec eslint src/flash-sale/flash-sale.module.ts
pnpm --filter api typecheck
```

Expected: PASS. Turbo `typecheck` must continue to depend on `^build` (do not remove that invariant from turbo.json).

- [ ] **Step 3: Commit (optional — only if user authorized)**

```bash
git add apps/api/src/flash-sale/flash-sale.module.ts
git commit -m "$(cat <<'EOF'
feat: wire FlashSaleReservation into FlashSaleModule

EOF
)"
```

---

## Task 4: PostgreSQL sequential integration matrix

**Files:**

- Create: `apps/api/test/flash-sale/prisma-flash-sale.reservation.integration.spec.ts`

Requires `DATABASE_URL` and migrated schema (same as `#17`/`#18` integration).

- [ ] **Step 1: Write sequential behavioral integration tests**

Create `apps/api/test/flash-sale/prisma-flash-sale.reservation.integration.spec.ts` with shared setup mirroring `#17` integration style (`PrismaService` + explicit `$connect` in `beforeAll`):

```ts
import type { FlashSaleId } from '@flash-sale/domain';

import { randomUUID } from 'node:crypto';

import { PrismaFlashSaleReservation } from '../../src/flash-sale/prisma-flash-sale.reservation';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('PrismaFlashSaleReservation integration (#19)', () => {
  const prisma = new PrismaService();
  const reservation = new PrismaFlashSaleReservation(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedSale(overrides: {
    endsAt: Date;
    remainingStock: number;
    startsAt: Date;
    totalStock?: number;
    updatedAt?: Date;
  }): Promise<{ flashSaleId: string; productId: string }> {
    const suffix = randomUUID();
    const productId = `product-reserve-${suffix}`;
    const flashSaleId = `sale-reserve-${suffix}`;
    const now = overrides.updatedAt ?? new Date('2026-07-28T12:00:00.000Z');
    const totalStock = overrides.totalStock ?? Math.max(overrides.remainingStock, 1);

    await prisma.product.create({
      data: {
        id: productId,
        name: 'Reservation Integration Product',
        updatedAt: now,
      },
    });

    await prisma.flashSale.create({
      data: {
        id: flashSaleId,
        productId,
        endsAt: overrides.endsAt,
        remainingStock: overrides.remainingStock,
        startsAt: overrides.startsAt,
        totalStock,
        updatedAt: now,
      },
    });

    return { flashSaleId, productId };
  }

  async function cleanup(ids: { flashSaleId: string; productId: string }): Promise<void> {
    await prisma.flashSale.deleteMany({ where: { id: ids.flashSaleId } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
  }

  async function remainingStock(flashSaleId: string): Promise<number> {
    const row = await prisma.flashSale.findUniqueOrThrow({ where: { id: flashSaleId } });
    return row.remainingStock;
  }

  it('decrements stock and sets updated_at to nowUtc when active and remaining_stock > 0', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    const ids = await seedSale({ endsAt, remainingStock: 4, startsAt, totalStock: 9 });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        true,
      );

      // Fresh Prisma Client read after tryReserve — proves the DB column was written by raw SQL.
      // Do not infer updatedAt from the in-memory input or adapter return value.
      const row = await prisma.flashSale.findUniqueOrThrow({ where: { id: ids.flashSaleId } });
      expect(row.remainingStock).toBe(3);
      expect(row.updatedAt).toEqual(nowUtc);
    } finally {
      await cleanup(ids);
    }
  });

  it('reserves the last unit (stock 1 → 0)', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    const ids = await seedSale({ endsAt, remainingStock: 1, startsAt, totalStock: 1 });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        true,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(0);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false when stock is already 0 and leaves updated_at unchanged', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const initialUpdatedAt = new Date('2026-07-28T11:00:00.000Z');
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    const ids = await seedSale({
      endsAt,
      remainingStock: 0,
      startsAt,
      totalStock: 5,
      updatedAt: initialUpdatedAt,
    });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        false,
      );

      // Fresh read after failed tryReserve — SET updated_at must share the same WHERE guard.
      const row = await prisma.flashSale.findUniqueOrThrow({ where: { id: ids.flashSaleId } });
      expect(row.remainingStock).toBe(0);
      expect(row.updatedAt).toEqual(initialUpdatedAt);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false before starts_at', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date('2026-07-28T09:59:59.999Z');
    const ids = await seedSale({ endsAt, remainingStock: 5, startsAt });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        false,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(5);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns true at starts_at when stock > 0', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date(startsAt.getTime());
    const ids = await seedSale({ endsAt, remainingStock: 2, startsAt });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        true,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(1);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false at ends_at', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date(endsAt.getTime());
    const ids = await seedSale({ endsAt, remainingStock: 5, startsAt });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        false,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(5);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false after ends_at', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date('2026-07-28T14:00:00.001Z');
    const ids = await seedSale({ endsAt, remainingStock: 5, startsAt });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        false,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(5);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false for a missing flash sale id', async () => {
    const missingId = `sale-missing-${randomUUID()}` as FlashSaleId;
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    await expect(reservation.tryReserve(missingId, nowUtc)).resolves.toBe(false);
  });
});
```

Do **not** insert `Purchase` rows or assert `PurchaseConflictError` / `ALREADY_PURCHASED`.

**Sequential matrix (authoritative SQL semantics):**

| Scenario              | Expected             | Stock / audit                                           |
| --------------------- | -------------------- | ------------------------------------------------------- |
| Active, stock `> 0`   | `true`               | decremented; **`updatedAt === nowUtc`** (fresh read)    |
| Active, stock `= 1`   | `true`               | `1 → 0`                                                 |
| Active, stock `= 0`   | `false`              | stock unchanged; **`updatedAt` unchanged** (fresh read) |
| `nowUtc < startsAt`   | `false`              | unchanged                                               |
| `nowUtc === startsAt` | `true` (stock `> 0`) | decremented                                             |
| `nowUtc === endsAt`   | `false`              | unchanged                                               |
| `nowUtc > endsAt`     | `false`              | unchanged                                               |
| Missing sale          | `false`              | N/A                                                     |

`updatedAt` assertions must use a **fresh Prisma Client read after `tryReserve()`**. Do not infer `updatedAt` from the in-memory input or adapter return value — the point is to prove the database column was (or was not) written by the raw SQL `SET`.

Invalid `nowUtc` → `INVALID_NOW` is covered by **unit** tests (no SQL). Do **not** require a duplicate integration case unless explicitly added later.

- [ ] **Step 2: Ensure DB is migrated, then run integration**

```bash
# DATABASE_URL must point at a Postgres 16 instance (local Compose or CI service).
pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:integration -- prisma-flash-sale.reservation.integration.spec.ts
```

Expected: all sequential cases PASS.

- [ ] **Step 3: Commit (optional — only if user authorized)**

```bash
git add apps/api/test/flash-sale/prisma-flash-sale.reservation.integration.spec.ts
git commit -m "$(cat <<'EOF'
test: add FlashSaleReservation sequential PostgreSQL coverage

EOF
)"
```

---

## Task 5: Concurrent `N > S` integration proof

**Files:**

- Modify: `apps/api/test/flash-sale/prisma-flash-sale.reservation.integration.spec.ts`

- [ ] **Step 1: Add concurrency describe/it to the same integration file**

Append inside the existing `describe('PrismaFlashSaleReservation integration (#19)', ...)` (reuse `seedSale` / `cleanup` / `remainingStock` helpers):

```ts
it('does not oversell under concurrent tryReserve (N > S)', async () => {
  const startsAt = new Date('2026-07-28T10:00:00.000Z');
  const endsAt = new Date('2026-07-28T14:00:00.000Z');
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const stock = 10;
  const callers = 100;
  const ids = await seedSale({
    endsAt,
    remainingStock: stock,
    startsAt,
    totalStock: stock,
  });

  try {
    // Shares one PrismaFlashSaleReservation instance, but each $executeRaw is a separate
    // Prisma/PostgreSQL operation. The property under test is database-level atomicity of
    // the conditional UPDATE — not JavaScript-level serialization. Do not "optimize" this
    // into sequential awaits or add application-level locking.
    const results = await Promise.all(
      Array.from({ length: callers }, () =>
        reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc),
      ),
    );

    const successes = results.filter((value) => value === true).length;
    const failures = results.filter((value) => value === false).length;

    expect(successes).toBe(stock);
    expect(failures).toBe(callers - stock);
    expect(await remainingStock(ids.flashSaleId)).toBe(0);
  } finally {
    await cleanup(ids);
  }
});
```

Hard rules:

- `callers > stock` (contention + exhaustion).
- Exactly `stock` `true`s; exactly `callers - stock` `false`s; final `remaining_stock === 0`.
- Keep **concurrent** `Promise.all` — do not rewrite as a sequential loop.
- No purchase inserts.

- [ ] **Step 2: Re-run integration suite for this file**

```bash
pnpm --filter api test:integration -- prisma-flash-sale.reservation.integration.spec.ts
```

Expected: sequential + concurrency cases PASS.

- [ ] **Step 3: Commit (optional — only if user authorized)**

```bash
git add apps/api/test/flash-sale/prisma-flash-sale.reservation.integration.spec.ts
git commit -m "$(cat <<'EOF'
test: prove FlashSaleReservation cannot oversell concurrently

EOF
)"
```

---

## Task 6: Workspace quality gates + Definition of Done

**Files:** none (verification only)

- [ ] **Step 1: Unit tests (DB-independent)**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter api test -- prisma-flash-sale.reservation.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Integration (Postgres)**

```bash
pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:integration -- prisma-flash-sale.reservation.integration.spec.ts
```

Expected: PASS (sequential + concurrent).

- [ ] **Step 3: Lint + typecheck with Turbo `^build` invariant**

```bash
pnpm --filter api exec eslint src/flash-sale packages/domain/src/flash-sale/flash-sale.reservation.ts
# Prefer workspace gate used by CI:
pnpm lint
pnpm typecheck
```

If `pnpm typecheck` is Turbo-backed, confirm `turbo.json` still has `typecheck` depending on `^build` (do not remove).

Expected: PASS.

- [ ] **Step 4: Definition of Done checklist**

- [ ] `FlashSaleReservation` + `FLASH_SALE_RESERVATION` exported from `@flash-sale/domain`
- [ ] `FlashSaleRepository` still read-only (`findById` only — no write methods added)
- [ ] Adapter uses one `$executeRaw` conditional `UPDATE` (window + stock + explicit `updated_at = nowUtc`); returns `affected === 1` (else `false` when `affected !== 1`)
- [ ] Invalid `nowUtc` → adapter throws `FlashSaleValidationError` (`INVALID_NOW`) without SQL; no timezone conversion; validation not moved onto `FlashSale`
- [ ] Happy-path integration asserts `updatedAt === nowUtc` via **fresh Prisma Client read** after `tryReserve` (proves raw-SQL audit bump; not Prisma Client `@updatedAt`)
- [ ] Representative failure path (stock `= 0`) asserts `updatedAt` **unchanged** via fresh read (proves `SET updated_at` shares the same `WHERE` guard)
- [ ] `FlashSaleModule` registers/exports both tokens via `useExisting`
- [ ] Unit (control flow/errors) + sequential PG matrix + `N > S` concurrent `Promise.all` integration passing
- [ ] ESLint (perfectionist) + typecheck pass; Turbo `^build` preserved
- [ ] No GraphQL / Redis / `#20` purchase flow / schema edits / `ALREADY_PURCHASED`
- [ ] Commits (if any) follow `<type>: <MESSAGE>` with no `Co-authored-by`; author `rex.escario.jr@gmail.com`

- [ ] **Step 5: Final commit of remaining work (optional — only if user authorized)**

```bash
git status --short
# stage only #19 implementation + intended docs
git commit -m "$(cat <<'EOF'
feat: EPIC-02 #19 atomic inventory reservation

EOF
)"
```

---

## Spec coverage self-check

| Spec requirement                                      | Task(s)                                        |
| ----------------------------------------------------- | ---------------------------------------------- |
| Domain `FlashSaleReservation` + DI token              | 1                                              |
| `FlashSaleRepository` remains read-only               | 1–3 (no writes added)                          |
| `$executeRaw` conditional `UPDATE`                    | 2                                              |
| Same `nowUtc` for window + `updated_at`               | 2, 4 (success `updatedAt` + failure unchanged) |
| `INVALID_NOW` before SQL (adapter guard); no TZ norm  | 2                                              |
| Boolean success: `affected === 1` / else `false`      | 2, 4, 5                                        |
| Unit = control flow; integration = SQL semantics      | 2, 4, 5                                        |
| Extend `FlashSaleModule`                              | 3                                              |
| Sequential matrix (stock/window/missing/`updated_at`) | 4                                              |
| Concurrent `N > S` via `Promise.all` (DB atomicity)   | 5                                              |
| Out: `#20` / GraphQL / Redis / schema edits           | all                                            |
| Turbo `^build` typecheck                              | 3, 6                                           |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-28-epic-02-atomic-inventory-reservation.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
