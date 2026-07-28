# EPIC-02 #20 — Transactional Purchase Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#20](https://github.com/rexescario-dev/flash-sale-system/issues/20) by adding a domain-owned `PurchaseFlow` that composes `#14` `getStatus`, `#17` `FlashSaleRepository`, `#19` `FlashSaleReservation.tryReserve`, and `#18` `PurchaseRepository.save` inside one Prisma `$transaction` via opaque `PersistenceContext`, returning five typed business outcomes — proven by unit tests (incl. `ACTIVE → tryReserve(false) → SOLD_OUT`) and sequential PostgreSQL integration (status gates + atomicity, incl. conflict→stock restore).

**Acceptance criteria (from issue, interpreted):**

- Purchase and inventory update commit or rollback together → shared interactive `$transaction` + same `PersistenceContext` for `tryReserve` + `save`.
- Typed outcomes include `SUCCESS`, `ALREADY_PURCHASED`, `SALE_NOT_STARTED`, `SALE_ENDED`, `SOLD_OUT` → domain string-union `PurchaseOutcome`.

**Architecture:** Domain port `PurchaseFlow` + `PurchaseOutcome` + structurally opaque domain `PersistenceContext` (runtime-branded for infrastructure validation) + `FlashSaleNotFoundError` in `@flash-sale/domain`. Nest `PurchaseFlowService` in `apps/api/src/purchase/` opens `$transaction`, binds ctx, maps `PurchaseConflictError` **outside** the callback to `ALREADY_PURCHASED`. Write ports gain optional `ctx?`; Prisma binder unwraps txn client. `PurchaseModule` imports `FlashSaleModule` and exports `PURCHASE_FLOW`.

**Tech Stack:** NestJS 11, Prisma 6 (interactive `$transaction`), PostgreSQL 16, Jest + ts-jest, `@flash-sale/domain`, pnpm + Turborepo.

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md) (`#20 — Implement transactional purchase flow`)

**Authority:** The approved umbrella `#20` contract is authoritative. This plan operationalizes it and must **not** alter its contract. Do not invent requirements.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`. Author email must be `rex.escario.jr@gmail.com`.

**ESLint:** perfectionist sort — object keys: `id` first where present, then A→Z. Run ESLint after writing and accept repository ordering if it rewrites keys/members/exports. Nest `@Module` arrays: follow existing static-modules-before-`forRoot` / A→Z conventions already on `main`.

**Out of scope:** GraphQL; Redis; controllers/resolvers; N-parallel purchase storm; schema/migration **edits**; ALS/UoW; fat dual-write adapter; returning `Purchase` on success; purchase-gate helpers on `FlashSale`; `NOT_FOUND` as a `PurchaseOutcome`.

Applying existing migrations via `prisma:migrate:deploy` against a test DB is allowed and required for integration/CI; that is **not** a schema edit.

**Hard invariants (locked):**

1. `Purchase.create` runs **inside** `$transaction`, **after** `tryReserve === true`, before `save`.
2. `tryReserve(false)` performs **no** inventory mutation → normal `return 'SOLD_OUT'` is safe.
3. `FlashSaleRepository.findById` / `getStatus` is an **admission-only pre-check executed before `$transaction`** and is **never** treated as authoritative for inventory. Only in-txn `tryReserve` determines whether stock can actually be consumed. Do **not** “optimize” by assuming a transactional read provides concurrency safety.
4. `PurchaseConflictError` must **escape** the txn callback → rollback → outer map to `ALREADY_PURCHASED`.
5. Unexpected errors → rollback + **propagate**.
6. When `ctx` is provided, adapters MUST use the txn-bound client for **all** persistence ops in that call — never fall back to root mid-method (`ctx` omitted → root allowed; `ctx` provided → root must never be touched in that method).
7. `createPrismaPersistenceContext(tx)` binds the interactive `$transaction` callback’s `tx`. The binder does **not** independently prove an arbitrary runtime object is a `TransactionClient`; callers must only create contexts from that `tx`. `resolvePrismaClient` never falls back to root when `ctx` is present.

**Verification split (locked):**

```text
#20 Unit
  ├── missing sale → FlashSaleNotFoundError
  ├── invalid now → FlashSaleValidationError / INVALID_NOW
  ├── UPCOMING → SALE_NOT_STARTED, no transaction
  ├── ENDED → SALE_ENDED, no transaction
  ├── ACTIVE + pre-check SOLD_OUT → SOLD_OUT, no transaction
  ├── ACTIVE + tryReserve(false) → SOLD_OUT, no save
  ├── reserve true → save called; reserve before save
  ├── same PersistenceContext passed to reserve + save
  ├── PurchaseConflictError escapes callback → ALREADY_PURCHASED
  │     (unit proves escape + outer mapping only — not DB rollback)
  └── unexpected error propagates

#20 PostgreSQL sequential integration
  ├── SUCCESS commits reservation + purchase
  ├── duplicate conflict rolls back reservation (authoritative rollback proof)
  ├── SALE_NOT_STARTED / SALE_ENDED no mutation
  ├── pre-existing SOLD_OUT no mutation
  └── missing sale

#19 PostgreSQL concurrency
  └── atomic reservation cannot oversell

#20 + #19 composition
  └── PurchaseFlow delegates authoritative stock race to #19
```

Do **not** claim `#20` integration proves an in-txn race where `getStatus` was `ACTIVE` then `tryReserve` returned `false` under concurrent writers. That path is covered by **unit** (`tryReserve(false)`) + **`#19` concurrency**. Integration `SOLD_OUT` is the **pre-check** path (inventory already exhausted / zero before `execute`).

**Conflict coverage split:** Unit test proves callback-boundary escape and outer mapping to `ALREADY_PURCHASED`. PostgreSQL integration proves the actual rollback of reservation.

---

## File map

| Path                                                                       | Responsibility                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/domain/src/persistence-context.ts`                               | **Create:** structurally opaque `PersistenceContext` + exported runtime brand |
| `packages/domain/src/flash-sale/flash-sale-not-found.error.ts`             | **Create:** `FlashSaleNotFoundError`                                          |
| `packages/domain/src/purchase/purchase.outcome.ts`                         | **Create:** `PurchaseOutcome`                                                 |
| `packages/domain/src/purchase/purchase.flow.ts`                            | **Create:** `PurchaseFlow` + `PurchaseFlowExecuteInput` + `PURCHASE_FLOW`     |
| `packages/domain/src/flash-sale/flash-sale.reservation.ts`                 | **Modify:** optional `ctx?: PersistenceContext` on `tryReserve`               |
| `packages/domain/src/purchase/purchase.repository.ts`                      | **Modify:** optional `ctx?: PersistenceContext` on `save`                     |
| `packages/domain/src/index.ts`                                             | **Modify:** export new symbols/types                                          |
| `apps/api/src/prisma/prisma-persistence-context.ts`                        | **Create:** create/resolve binder (validate brand + txn-only binding)         |
| `apps/api/src/prisma/prisma-persistence-context.spec.ts`                   | **Create:** invalid brand / missing binding / happy unwrap                    |
| `apps/api/src/flash-sale/prisma-flash-sale.reservation.ts`                 | **Modify:** resolve client from `ctx?`                                        |
| `apps/api/src/flash-sale/prisma-flash-sale.reservation.spec.ts`            | **Modify:** keep omit-`ctx` cases; add provided-`ctx` uses txn client         |
| `apps/api/src/purchase/prisma-purchase.repository.ts`                      | **Modify:** resolve client from `ctx?` on `save`                              |
| `apps/api/src/purchase/prisma-purchase.repository.spec.ts`                 | **Modify:** keep omit-`ctx`; add provided-`ctx` uses txn client               |
| `apps/api/src/purchase/purchase-flow.service.ts`                           | **Create:** Nest `PurchaseFlow` implementation                                |
| `apps/api/src/purchase/purchase-flow.service.spec.ts`                      | **Create:** unit coverage for outcomes / errors                               |
| `apps/api/src/purchase/purchase.module.ts`                                 | **Modify:** import `FlashSaleModule`; wire `PURCHASE_FLOW`                    |
| `apps/api/test/purchase/purchase-flow.integration.spec.ts`                 | **Create:** sequential PostgreSQL matrix                                      |
| `docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md`   | Carry forward if still uncommitted local `#20` contract work                  |
| `docs/superpowers/plans/2026-07-28-epic-02-transactional-purchase-flow.md` | This plan (carry forward if uncommitted)                                      |

**Untouched:** `apps/api/prisma/**` schema/migrations, GraphQL, Redis, `#19` concurrent storm tests (leave as-is).

**CI:** No new job — existing `schema-test` already runs `test:integration`. `jest.integration.config.cjs` already matches `test/purchase/**/*.spec.ts` — **no config change**.

---

## Task 0: Inspect working tree, verify `#19` baseline, create branch

**Files:** none (git only)

**Invariant:** Never silently discard, stash, reset, or overwrite the intended `#20` spec/plan. **Never switch branches or rebase with dirty intended docs unless their content is explicitly preserved.**

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

1. **Intended `#20` docs** — umbrella `#20` contract and/or this plan under `docs/superpowers/`
2. **Unrelated uncommitted changes** — anything else

Rules:

- If **unrelated** uncommitted changes exist → **stop** and ask the operator to resolve them. Do **not** stash, reset, discard, or overwrite automatically.
- If only intended `#20` docs are dirty → **preserve** them (do not discard). Preferred path: create the feature branch from current HEAD and carry the dirty docs as-is.
- Feature branch must start from a **known-good `#19`-containing base**. If the current tip does **not** contain the required `#19` artifacts / merge ancestry → **stop** and resolve base alignment with the operator. Do **not** silently rebase/pull over dirty intended docs.
- Prefer verifying `#19` presence (artifacts + optional `git merge-base --is-ancestor <known-#19-commit> HEAD`) over requiring “HEAD is not behind `origin/main`”. Unrelated newer commits on `origin/main` must not by themselves halt work if `#19` is already present.
- Known good baseline example: `3f474c4+` (PR #106) contains `#19`.

- [ ] **Step 2: Verify `#19` baseline on `origin/main`**

```bash
git log -1 --oneline origin/main
git show origin/main:packages/domain/src/flash-sale/flash-sale.reservation.ts
rg -n "FlashSaleReservation|FLASH_SALE_RESERVATION|PrismaFlashSaleReservation" <(git show origin/main:packages/domain/src/index.ts)
git cat-file -e origin/main:apps/api/src/flash-sale/prisma-flash-sale.reservation.ts && echo "reservation_adapter_present"
git cat-file -e origin/main:apps/api/src/purchase/purchase.module.ts && echo "purchase_module_present"
```

Expected:

- `origin/main` at `3f474c4+` (PR #106) or later containing `#19`
- `FlashSaleReservation` + `FLASH_SALE_RESERVATION` + Prisma reservation adapter present
- `PurchaseModule` present (to extend)

- [ ] **Step 3: Create feature branch (docs-safe)**

```bash
git switch -c feat/epic-02-transactional-purchase-flow
```

If intended `#20` docs are already dirty on the current tip, create the branch from that tip so they ride along.

- [ ] **Step 4: Confirm branch tip**

```bash
git status -sb
git rev-parse --abbrev-ref HEAD
```

Expected: on `feat/epic-02-transactional-purchase-flow`; intended `#20` docs still present if they were dirty.

- [ ] **Step 5: Commit (optional — only if user authorized)**

```bash
git add docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md \
        docs/superpowers/plans/2026-07-28-epic-02-transactional-purchase-flow.md
git commit -m "$(cat <<'EOF'
docs: add EPIC-02 #20 transactional purchase flow contract and plan

EOF
)"
```

---

## Task 1: Domain types — PersistenceContext, errors, outcome, PurchaseFlow

**Files:**

- Create: `packages/domain/src/persistence-context.ts`
- Create: `packages/domain/src/flash-sale/flash-sale-not-found.error.ts`
- Create: `packages/domain/src/purchase/purchase.outcome.ts`
- Create: `packages/domain/src/purchase/purchase.flow.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Add structurally opaque `PersistenceContext` (runtime-branded for infra validation)**

Create `packages/domain/src/persistence-context.ts`:

```ts
/**
 * Runtime brand key for PersistenceContext.
 * Exported so infrastructure can construct carriers; domain never inspects payload beyond the brand.
 * This is opaque-by-convention (public brand), not a sealed capability token.
 */
export const PERSISTENCE_CONTEXT_BRAND: unique symbol = Symbol(
  'PersistenceContext',
) as unique symbol;

/** Structurally opaque unit-of-work handle. Domain must not inspect contents. */
export interface PersistenceContext {
  readonly [PERSISTENCE_CONTEXT_BRAND]: true;
}
```

Use a **runtime** `Symbol` (not ambient `declare const`) so `apps/api` can brand concrete carriers. Exporting the brand is intentional for `#20` — do **not** add a domain factory just to hide it.

- [ ] **Step 2: Confirm `#17`/`#14` `findById` null contract before adding not-found error**

```bash
rg -n "findById|FlashSaleNotFoundError" packages/domain apps/api --glob '!**/node_modules/**' --glob '!**/*.md'
sed -n '1,20p' packages/domain/src/flash-sale/flash-sale.repository.ts
```

Expected (locked by `#17`):

```ts
findById(id: FlashSaleId): Promise<FlashSale | null>;
```

`#20` owns translating `null` → `FlashSaleNotFoundError`. Do **not** change the repository port to throw.

- [ ] **Step 3: Add `FlashSaleNotFoundError`**

Create `packages/domain/src/flash-sale/flash-sale-not-found.error.ts`:

```ts
export class FlashSaleNotFoundError extends Error {
  readonly code = 'FLASH_SALE_NOT_FOUND' as const;

  constructor(message = 'Flash sale was not found') {
    super(message);
    this.name = 'FlashSaleNotFoundError';
  }
}
```

- [ ] **Step 4: Add `PurchaseOutcome`**

Create `packages/domain/src/purchase/purchase.outcome.ts`:

```ts
export type PurchaseOutcome =
  'ALREADY_PURCHASED' | 'SALE_ENDED' | 'SALE_NOT_STARTED' | 'SOLD_OUT' | 'SUCCESS';
```

Keep union members A→Z for ESLint perfectionist.

- [ ] **Step 5: Add `PurchaseFlow` port + token**

Create `packages/domain/src/purchase/purchase.flow.ts`:

```ts
import type { FlashSaleId, PurchaseId, UserId } from '../ids.js';
import type { PurchaseOutcome } from './purchase.outcome.js';

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

- [ ] **Step 6: Export from `packages/domain/src/index.ts`**

Modify the existing file — do **not** reconstruct from scratch. Add (ESLint may reorder; accept perfectionist order):

```ts
export { FlashSaleNotFoundError } from './flash-sale/flash-sale-not-found.error.js';
export { PERSISTENCE_CONTEXT_BRAND } from './persistence-context.js';
export type { PersistenceContext } from './persistence-context.js';
export { PURCHASE_FLOW } from './purchase/purchase.flow.js';
export type { PurchaseFlow, PurchaseFlowExecuteInput } from './purchase/purchase.flow.js';
export type { PurchaseOutcome } from './purchase/purchase.outcome.js';
```

- [ ] **Step 7: Build + typecheck domain**

```bash
pnpm --filter @flash-sale/domain build
pnpm --filter @flash-sale/domain typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit (optional — only if user authorized)**

```bash
git add packages/domain/src/persistence-context.ts \
        packages/domain/src/flash-sale/flash-sale-not-found.error.ts \
        packages/domain/src/purchase/purchase.outcome.ts \
        packages/domain/src/purchase/purchase.flow.ts \
        packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add PurchaseFlow domain port and PersistenceContext

EOF
)"
```

---

## Task 2: Widen write ports + Prisma PersistenceContext binder + adapters

**Files:**

- Modify: `packages/domain/src/flash-sale/flash-sale.reservation.ts`
- Modify: `packages/domain/src/purchase/purchase.repository.ts`
- Create: `apps/api/src/prisma/prisma-persistence-context.ts`
- Create: `apps/api/src/prisma/prisma-persistence-context.spec.ts`
- Modify: `apps/api/src/flash-sale/prisma-flash-sale.reservation.ts`
- Modify: `apps/api/src/flash-sale/prisma-flash-sale.reservation.spec.ts`
- Modify: `apps/api/src/purchase/prisma-purchase.repository.ts`
- Modify: `apps/api/src/purchase/prisma-purchase.repository.spec.ts`

- [ ] **Step 1: Search all port implementations / test doubles before amending**

```bash
rg -n "implements FlashSaleReservation|FlashSaleReservation|implements PurchaseRepository|PurchaseRepository" packages apps --glob '!**/node_modules/**' --glob '!**/*.md'
```

Expected production implementations to update for `ctx` honor:

- `PrismaFlashSaleReservation`
- `PrismaPurchaseRepository`

Update **every** production implementation that accepts `ctx` so it uses `resolvePrismaClient` (never ignore `ctx`). For every method that accepts `ctx`:

- `ctx` omitted → root Prisma client is allowed
- `ctx` provided → only the transaction-bound client may be used
- `ctx` provided → root Prisma client must never be touched

Test doubles/mocks in unit tests may omit `ctx` usage when they are not under test. Confirm no second concrete adapter silently ignores the optional argument. (`findByFlashSaleAndUser` stays root-only — it does **not** accept `ctx`.)

- [ ] **Step 2: Amend domain write ports**

Replace `packages/domain/src/flash-sale/flash-sale.reservation.ts` with:

```ts
import type { FlashSaleId } from '../ids.js';
import type { PersistenceContext } from '../persistence-context.js';

/** Runtime Nest DI token for FlashSaleReservation. Owned by @flash-sale/domain. */
export const FLASH_SALE_RESERVATION = Symbol('FLASH_SALE_RESERVATION');

export interface FlashSaleReservation {
  tryReserve(flashSaleId: FlashSaleId, nowUtc: Date, ctx?: PersistenceContext): Promise<boolean>;
}
```

Replace `packages/domain/src/purchase/purchase.repository.ts` with:

```ts
import type { FlashSaleId, UserId } from '../ids.js';
import type { PersistenceContext } from '../persistence-context.js';
import type { Purchase } from './purchase.js';

/** Runtime Nest DI token for PurchaseRepository. Owned by @flash-sale/domain. */
export const PURCHASE_REPOSITORY = Symbol('PURCHASE_REPOSITORY');

export interface PurchaseRepository {
  findByFlashSaleAndUser(flashSaleId: FlashSaleId, userId: UserId): Promise<null | Purchase>;

  save(purchase: Purchase, ctx?: PersistenceContext): Promise<void>;
}
```

- [ ] **Step 3: Add Prisma binder helpers (txn-only binding + brand check)**

Create `apps/api/src/prisma/prisma-persistence-context.ts`:

```ts
import { PERSISTENCE_CONTEXT_BRAND, type PersistenceContext } from '@flash-sale/domain';
import { Prisma, type PrismaClient } from '@prisma/client';

const PRISMA_TX_CLIENT = Symbol('PRISMA_TX_CLIENT');

type PrismaBoundPersistenceContext = PersistenceContext & {
  readonly [PRISMA_TX_CLIENT]: Prisma.TransactionClient;
};

export function createPrismaPersistenceContext(
  client: Prisma.TransactionClient,
): PersistenceContext {
  const ctx: PrismaBoundPersistenceContext = {
    [PERSISTENCE_CONTEXT_BRAND]: true,
    [PRISMA_TX_CLIENT]: client,
  };
  return ctx;
}

/**
 * When ctx is omitted, returns rootPrisma.
 * When ctx is provided, validates the domain brand + Prisma txn binding and returns
 * that TransactionClient. MUST NOT fall back to root when ctx is provided.
 *
 * Callers must only pass `tx` from Prisma `$transaction` into `createPrismaPersistenceContext`.
 * The binder does not independently prove an arbitrary runtime object is a TransactionClient.
 */
export function resolvePrismaClient(rootPrisma: PrismaClient): PrismaClient;
export function resolvePrismaClient(
  rootPrisma: PrismaClient,
  ctx: PersistenceContext,
): Prisma.TransactionClient;
export function resolvePrismaClient(
  rootPrisma: PrismaClient,
  ctx?: PersistenceContext,
): Prisma.TransactionClient | PrismaClient {
  if (ctx === undefined) {
    return rootPrisma;
  }

  if (ctx[PERSISTENCE_CONTEXT_BRAND] !== true) {
    throw new Error('Invalid PersistenceContext: missing domain brand');
  }

  const bound = ctx as PrismaBoundPersistenceContext;
  const client = bound[PRISMA_TX_CLIENT];
  if (client === undefined) {
    throw new Error('Invalid PersistenceContext: missing Prisma transaction client');
  }
  return client;
}
```

- [ ] **Step 4: Unit-test the binder**

Create `apps/api/src/prisma/prisma-persistence-context.spec.ts`:

```ts
import { PERSISTENCE_CONTEXT_BRAND } from '@flash-sale/domain';

import { createPrismaPersistenceContext, resolvePrismaClient } from './prisma-persistence-context';
import type { PrismaService } from './prisma.service';

describe('prisma-persistence-context', () => {
  const root = { tag: 'root' } as unknown as PrismaService;
  const tx = { tag: 'tx' } as never;

  it('returns root when ctx is omitted', () => {
    expect(resolvePrismaClient(root)).toBe(root);
  });

  it('returns the bound TransactionClient when ctx is valid', () => {
    const ctx = createPrismaPersistenceContext(tx);
    expect(resolvePrismaClient(root, ctx)).toBe(tx);
  });

  it('rejects a context missing the domain brand', () => {
    const fake = { [Symbol('other')]: true } as never;
    expect(() => resolvePrismaClient(root, fake)).toThrow(/missing domain brand/);
  });

  it('rejects a branded context missing the Prisma binding', () => {
    const fake = { [PERSISTENCE_CONTEXT_BRAND]: true } as never;
    expect(() => resolvePrismaClient(root, fake)).toThrow(/missing Prisma transaction client/);
  });
});
```

- [ ] **Step 5: Update `PrismaFlashSaleReservation` to honor `ctx`**

Replace `apps/api/src/flash-sale/prisma-flash-sale.reservation.ts` with:

```ts
import {
  type FlashSaleId,
  type FlashSaleReservation,
  FlashSaleValidationError,
  type PersistenceContext,
} from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';

import { resolvePrismaClient } from '../prisma/prisma-persistence-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaFlashSaleReservation implements FlashSaleReservation {
  constructor(private readonly prisma: PrismaService) {}

  async tryReserve(
    flashSaleId: FlashSaleId,
    nowUtc: Date,
    ctx?: PersistenceContext,
  ): Promise<boolean> {
    if (Number.isNaN(nowUtc.getTime())) {
      throw new FlashSaleValidationError('INVALID_NOW', 'FlashSale nowUtc must be a valid Date');
    }

    const db = resolvePrismaClient(this.prisma, ctx);

    const affected = await db.$executeRaw`
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

- [ ] **Step 6: Update reservation unit tests for `ctx`**

Keep existing three tests (omit `ctx`). Append with a static import at top of file:

```ts
import { createPrismaPersistenceContext } from '../prisma/prisma-persistence-context';

it('uses the transaction-bound client when PersistenceContext is provided', async () => {
  const rootExecuteRaw = jest.fn();
  const txExecuteRaw = jest.fn().mockResolvedValue(1);
  const prisma = { $executeRaw: rootExecuteRaw } as unknown as PrismaService;
  const reservation = new PrismaFlashSaleReservation(prisma);
  const ctx = createPrismaPersistenceContext({
    $executeRaw: txExecuteRaw,
  } as never);

  await expect(reservation.tryReserve(saleId, nowUtc, ctx)).resolves.toBe(true);
  expect(txExecuteRaw).toHaveBeenCalled();
  expect(rootExecuteRaw).not.toHaveBeenCalled();
});
```

- [ ] **Step 7: Update `PrismaPurchaseRepository.save` to honor `ctx`**

In `apps/api/src/purchase/prisma-purchase.repository.ts`, add imports and change `save` to:

```ts
import {
  type FlashSaleId,
  type PersistenceContext,
  type Purchase,
  PurchaseConflictError,
  type PurchaseRepository,
  type UserId,
} from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { resolvePrismaClient } from '../prisma/prisma-persistence-context';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseMapper } from './purchase.mapper';

// ... keep isCompositePurchaseUniqueTarget unchanged ...

@Injectable()
export class PrismaPurchaseRepository implements PurchaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByFlashSaleAndUser(flashSaleId: FlashSaleId, userId: UserId): Promise<null | Purchase> {
    const row = await this.prisma.purchase.findUnique({
      where: { flashSaleId_userId: { flashSaleId, userId } },
    });

    if (row === null) {
      return null;
    }

    return PurchaseMapper.toDomain(row);
  }

  async save(purchase: Purchase, ctx?: PersistenceContext): Promise<void> {
    const db = resolvePrismaClient(this.prisma, ctx);

    try {
      await db.purchase.create({
        data: PurchaseMapper.toPersistence(purchase),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        isCompositePurchaseUniqueTarget(error.meta?.target)
      ) {
        throw new PurchaseConflictError();
      }

      throw error;
    }
  }
}
```

`findByFlashSaleAndUser` stays on **root** `this.prisma` (no `ctx` — locked).

- [ ] **Step 8: Update purchase repository unit tests for `ctx`**

Open `apps/api/src/purchase/prisma-purchase.repository.spec.ts`. Keep existing omit-`ctx` coverage. Append:

```ts
import { createPrismaPersistenceContext } from '../prisma/prisma-persistence-context';

it('save uses the transaction-bound client when PersistenceContext is provided', async () => {
  const rootCreate = jest.fn();
  const txCreate = jest.fn().mockResolvedValue({});
  const prisma = {
    purchase: { create: rootCreate, findUnique: jest.fn() },
  } as unknown as PrismaService;
  const repo = new PrismaPurchaseRepository(prisma);
  const ctx = createPrismaPersistenceContext({
    purchase: { create: txCreate },
  } as never);

  await repo.save(
    Purchase.create({
      flashSaleId: 'sale-1' as FlashSaleId,
      id: 'purchase-1' as PurchaseId,
      userId: 'user-1' as UserId,
      purchasedAt: new Date('2026-07-28T12:00:00.000Z'),
    }),
    ctx,
  );

  expect(txCreate).toHaveBeenCalled();
  expect(rootCreate).not.toHaveBeenCalled();
});
```

Add branded ID / `Purchase` imports matching the existing file style.

- [ ] **Step 9: Re-confirm every production adapter honors `ctx`**

```bash
rg -n "resolvePrismaClient|tryReserve\(|async save\(" apps/api/src/flash-sale apps/api/src/purchase apps/api/src/prisma --glob '!**/node_modules/**'
```

Expected: both adapters call `resolvePrismaClient` for their write path; no production write path uses `this.prisma` directly when `ctx` may be provided (except `findByFlashSaleAndUser` / root-only reads).

- [ ] **Step 10: Run adapter + binder unit tests + typecheck**

```bash
pnpm --filter @flash-sale/domain build
pnpm --filter api test -- prisma-persistence-context.spec.ts prisma-flash-sale.reservation.spec.ts prisma-purchase.repository.spec.ts
pnpm --filter api typecheck
```

Expected: PASS.

- [ ] **Step 11: Commit (optional — only if user authorized)**

```bash
git add packages/domain/src/flash-sale/flash-sale.reservation.ts \
        packages/domain/src/purchase/purchase.repository.ts \
        apps/api/src/prisma/prisma-persistence-context.ts \
        apps/api/src/prisma/prisma-persistence-context.spec.ts \
        apps/api/src/flash-sale/prisma-flash-sale.reservation.ts \
        apps/api/src/flash-sale/prisma-flash-sale.reservation.spec.ts \
        apps/api/src/purchase/prisma-purchase.repository.ts \
        apps/api/src/purchase/prisma-purchase.repository.spec.ts
git commit -m "$(cat <<'EOF'
feat: propagate PersistenceContext through reservation and purchase writes

EOF
)"
```

---

## Task 3: `PurchaseFlowService` unit tests + implementation (TDD)

**Files:**

- Create: `apps/api/src/purchase/purchase-flow.service.spec.ts`
- Create: `apps/api/src/purchase/purchase-flow.service.ts`

- [ ] **Step 1: Write failing unit tests**

Create `apps/api/src/purchase/purchase-flow.service.spec.ts`:

```ts
import {
  FlashSale,
  type FlashSaleId,
  FlashSaleNotFoundError,
  FlashSaleValidationError,
  type PurchaseId,
  PurchaseConflictError,
  type UserId,
} from '@flash-sale/domain';

import type { PrismaService } from '../prisma/prisma.service';

import { PurchaseFlowService } from './purchase-flow.service';

describe('PurchaseFlowService', () => {
  const flashSaleId = 'sale-1' as FlashSaleId;
  const userId = 'user-1' as UserId;
  const purchaseId = 'purchase-1' as PurchaseId;
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');

  function activeSale(remainingStock = 5): FlashSale {
    return FlashSale.reconstitute({
      id: flashSaleId,
      productId: 'product-1' as never,
      endsAt: new Date('2026-07-28T14:00:00.000Z'),
      remainingStock,
      startsAt: new Date('2026-07-28T10:00:00.000Z'),
      totalStock: 9,
    });
  }

  function buildService(overrides: {
    findById?: jest.Mock;
    tryReserve?: jest.Mock;
    save?: jest.Mock;
    transaction?: jest.Mock;
  }) {
    const flashSaleRepository = {
      findById: overrides.findById ?? jest.fn().mockResolvedValue(activeSale()),
    };
    const reservation = {
      tryReserve: overrides.tryReserve ?? jest.fn().mockResolvedValue(true),
    };
    const purchaseRepository = {
      findByFlashSaleAndUser: jest.fn(),
      save: overrides.save ?? jest.fn().mockResolvedValue(undefined),
    };
    const defaultTx = { transactionClient: true };
    const transaction =
      overrides.transaction ??
      jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(defaultTx));
    const prisma = { $transaction: transaction } as unknown as PrismaService;

    return {
      flashSaleRepository,
      purchaseRepository,
      reservation,
      service: new PurchaseFlowService(
        flashSaleRepository as never,
        reservation as never,
        purchaseRepository as never,
        prisma,
      ),
      transaction,
    };
  }

  const input = { flashSaleId, nowUtc, purchaseId, userId };

  it('throws FlashSaleNotFoundError when findById returns null', async () => {
    const findById = jest.fn().mockResolvedValue(null);
    const { service, transaction } = buildService({ findById });

    await expect(service.execute(input)).rejects.toBeInstanceOf(FlashSaleNotFoundError);
    expect(findById).toHaveBeenCalledWith(flashSaleId);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns SALE_NOT_STARTED for UPCOMING without opening a transaction', async () => {
    const sale = FlashSale.reconstitute({
      id: flashSaleId,
      productId: 'product-1' as never,
      endsAt: new Date('2026-07-28T14:00:00.000Z'),
      remainingStock: 5,
      startsAt: new Date('2026-07-28T13:00:00.000Z'),
      totalStock: 9,
    });
    const findById = jest.fn().mockResolvedValue(sale);
    const { service, transaction } = buildService({ findById });

    await expect(service.execute(input)).resolves.toBe('SALE_NOT_STARTED');
    expect(findById).toHaveBeenCalledWith(flashSaleId);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns SALE_ENDED for ENDED without opening a transaction', async () => {
    const sale = FlashSale.reconstitute({
      id: flashSaleId,
      productId: 'product-1' as never,
      endsAt: new Date('2026-07-28T11:00:00.000Z'),
      remainingStock: 5,
      startsAt: new Date('2026-07-28T10:00:00.000Z'),
      totalStock: 9,
    });
    const { service, transaction } = buildService({
      findById: jest.fn().mockResolvedValue(sale),
    });

    await expect(service.execute(input)).resolves.toBe('SALE_ENDED');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns SOLD_OUT from getStatus without opening a transaction', async () => {
    const { service, transaction } = buildService({
      findById: jest.fn().mockResolvedValue(activeSale(0)),
    });

    await expect(service.execute(input)).resolves.toBe('SOLD_OUT');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns SUCCESS when reserve and save succeed inside the transaction', async () => {
    const events: string[] = [];
    const tryReserve = jest.fn().mockImplementation(async (_id, passedNow) => {
      events.push('reserve');
      expect(passedNow).toBe(nowUtc);
      return true;
    });
    const save = jest.fn().mockImplementation(async (purchase) => {
      events.push('save');
      expect(purchase.getPurchasedAt().getTime()).toBe(nowUtc.getTime());
    });
    const { service, flashSaleRepository, transaction } = buildService({ save, tryReserve });

    await expect(service.execute(input)).resolves.toBe('SUCCESS');
    expect(flashSaleRepository.findById).toHaveBeenCalledWith(flashSaleId);
    expect(transaction).toHaveBeenCalled();
    expect(events).toEqual(['reserve', 'save']);
  });

  it('passes the same transaction PersistenceContext to reserve and save', async () => {
    let reserveCtx: unknown;
    let saveCtx: unknown;

    const tryReserve = jest.fn().mockImplementation(async (_id, _now, ctx) => {
      reserveCtx = ctx;
      return true;
    });
    const save = jest.fn().mockImplementation(async (_purchase, ctx) => {
      saveCtx = ctx;
    });
    const { service } = buildService({ save, tryReserve });

    await expect(service.execute(input)).resolves.toBe('SUCCESS');
    expect(reserveCtx).toBeDefined();
    expect(saveCtx).toBe(reserveCtx);
  });

  it('returns SOLD_OUT when tryReserve returns false inside the transaction', async () => {
    const save = jest.fn();
    const { service } = buildService({
      save,
      tryReserve: jest.fn().mockResolvedValue(false),
    });

    // tryReserve(false) → no PurchaseRepository.save (Purchase.create only after successful reserve).
    await expect(service.execute(input)).resolves.toBe('SOLD_OUT');
    expect(save).not.toHaveBeenCalled();
  });

  it('maps PurchaseConflictError escaping the transaction callback to ALREADY_PURCHASED', async () => {
    // Unit proves escape + outer mapping only. PostgreSQL integration proves DB rollback.
    let callbackError: unknown;
    const transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      try {
        return await fn({ transactionClient: true });
      } catch (error) {
        callbackError = error;
        throw error;
      }
    });
    const { service } = buildService({
      save: jest.fn().mockRejectedValue(new PurchaseConflictError()),
      transaction,
    });

    await expect(service.execute(input)).resolves.toBe('ALREADY_PURCHASED');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(callbackError).toBeInstanceOf(PurchaseConflictError);
  });

  it('propagates unexpected errors from the transaction', async () => {
    const { service } = buildService({
      save: jest.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(service.execute(input)).rejects.toThrow('db down');
  });

  it('propagates INVALID_NOW from getStatus', async () => {
    const { service, transaction } = buildService();

    await expect(service.execute({ ...input, nowUtc: new Date('invalid') })).rejects.toBeInstanceOf(
      FlashSaleValidationError,
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run unit tests — expect FAIL (service missing)**

```bash
pnpm --filter api test -- purchase-flow.service.spec.ts
```

Expected: FAIL (cannot find module / `PurchaseFlowService` undefined).

- [ ] **Step 3: Implement `PurchaseFlowService`**

Create `apps/api/src/purchase/purchase-flow.service.ts`:

```ts
import {
  FLASH_SALE_REPOSITORY,
  FLASH_SALE_RESERVATION,
  type FlashSaleRepository,
  type FlashSaleReservation,
  FlashSaleNotFoundError,
  PURCHASE_REPOSITORY,
  type PurchaseFlow,
  type PurchaseFlowExecuteInput,
  type PurchaseOutcome,
  type PurchaseRepository,
  Purchase,
  PurchaseConflictError,
} from '@flash-sale/domain';
import { Inject, Injectable } from '@nestjs/common';

import { createPrismaPersistenceContext } from '../prisma/prisma-persistence-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PurchaseFlowService implements PurchaseFlow {
  constructor(
    @Inject(FLASH_SALE_REPOSITORY)
    private readonly flashSaleRepository: FlashSaleRepository,
    @Inject(FLASH_SALE_RESERVATION)
    private readonly reservation: FlashSaleReservation,
    @Inject(PURCHASE_REPOSITORY)
    private readonly purchaseRepository: PurchaseRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: PurchaseFlowExecuteInput): Promise<PurchaseOutcome> {
    const flashSale = await this.flashSaleRepository.findById(input.flashSaleId);
    if (flashSale === null) {
      throw new FlashSaleNotFoundError();
    }

    const status = flashSale.getStatus(input.nowUtc);
    if (status === 'UPCOMING') {
      return 'SALE_NOT_STARTED';
    }
    if (status === 'ENDED') {
      return 'SALE_ENDED';
    }
    if (status === 'SOLD_OUT') {
      return 'SOLD_OUT';
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const ctx = createPrismaPersistenceContext(tx);

        const reserved = await this.reservation.tryReserve(input.flashSaleId, input.nowUtc, ctx);
        if (!reserved) {
          return 'SOLD_OUT';
        }

        const purchase = Purchase.create({
          flashSaleId: input.flashSaleId,
          id: input.purchaseId,
          userId: input.userId,
          purchasedAt: input.nowUtc,
        });

        await this.purchaseRepository.save(purchase, ctx);
        return 'SUCCESS';
      });
    } catch (error) {
      if (error instanceof PurchaseConflictError) {
        return 'ALREADY_PURCHASED';
      }
      throw error;
    }
  }
}
```

Do **not** catch `PurchaseConflictError` inside the `$transaction` callback.

If `instanceof PurchaseConflictError` unexpectedly fails while the error looks correct, check for duplicate `@flash-sale/domain` runtime copies (workspace must resolve a single domain build/class identity). Prefer fixing monorepo resolution rather than duck-typing `code === 'PURCHASE_CONFLICT'` unless proven necessary.

- [ ] **Step 4: Run unit tests — expect PASS**

```bash
pnpm --filter api test -- purchase-flow.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit (optional — only if user authorized)**

```bash
git add apps/api/src/purchase/purchase-flow.service.ts \
        apps/api/src/purchase/purchase-flow.service.spec.ts
git commit -m "$(cat <<'EOF'
feat: implement PurchaseFlowService transactional orchestration

EOF
)"
```

---

## Task 4: Wire `PurchaseModule`

**Files:**

- Modify: `apps/api/src/purchase/purchase.module.ts`

- [ ] **Step 1: Extend `PurchaseModule`**

Replace `apps/api/src/purchase/purchase.module.ts` with:

```ts
import { PURCHASE_FLOW, PURCHASE_REPOSITORY } from '@flash-sale/domain';
import { Module } from '@nestjs/common';

import { FlashSaleModule } from '../flash-sale/flash-sale.module';
import { PurchaseFlowService } from './purchase-flow.service';
import { PrismaPurchaseRepository } from './prisma-purchase.repository';

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

`AppModule` already imports `PurchaseModule` and `FlashSaleModule` — no change required unless a circular-import issue appears (should not: purchase → flash-sale only).

- [ ] **Step 2: Verify provider ownership and token resolution**

Confirm composition by reading the modules (and optionally a tiny Nest testing-module smoke if desired — not required if static review is clear):

```bash
rg -n "FLASH_SALE_REPOSITORY|FLASH_SALE_RESERVATION|exports:|imports:|useExisting|PurchaseFlowService" \
  apps/api/src/flash-sale/flash-sale.module.ts \
  apps/api/src/purchase/purchase.module.ts \
  apps/api/src/purchase/purchase-flow.service.ts
```

Expected:

- `FlashSaleModule` **exports** `FLASH_SALE_REPOSITORY` and `FLASH_SALE_RESERVATION` (via `useExisting` to the Prisma adapters).
- `PurchaseModule` **imports** `FlashSaleModule` and does **not** redeclare `FLASH_SALE_REPOSITORY` / `FLASH_SALE_RESERVATION` / Prisma flash-sale adapters.
- `PurchaseFlowService` constructor injects domain-owned tokens (`@Inject(FLASH_SALE_REPOSITORY)`, `@Inject(FLASH_SALE_RESERVATION)`, `@Inject(PURCHASE_REPOSITORY)`) — **not** concrete `PrismaFlashSaleRepository` / `PrismaFlashSaleReservation` types for DI.
- `PURCHASE_FLOW` uses `useExisting: PurchaseFlowService` so consumers get the same service instance as the concrete provider.

This locks that `PurchaseFlowService` receives the **same exported** flash-sale provider instances from `FlashSaleModule`, not a parallel private registration.

- [ ] **Step 3: Typecheck API**

```bash
pnpm --filter @flash-sale/domain build
pnpm --filter api typecheck
pnpm --filter api lint
```

Expected: PASS (accept ESLint perfectionist reorder if it rewrites the module file).

- [ ] **Step 4: Commit (optional — only if user authorized)**

```bash
git add apps/api/src/purchase/purchase.module.ts
git commit -m "$(cat <<'EOF'
feat: wire PurchaseFlow into PurchaseModule

EOF
)"
```

---

## Task 5: PostgreSQL sequential integration tests

**Files:**

- Create: `apps/api/test/purchase/purchase-flow.integration.spec.ts`

**Prereq:** Postgres reachable at `DATABASE_URL` (Compose default). Deploy migrations if needed:

```bash
pnpm --filter api prisma:migrate:deploy
```

- [ ] **Step 1: Add integration suite**

Create `apps/api/test/purchase/purchase-flow.integration.spec.ts`:

```ts
import {
  type FlashSaleId,
  FlashSaleNotFoundError,
  Purchase,
  type PurchaseId,
  type UserId,
} from '@flash-sale/domain';
import { randomUUID } from 'node:crypto';

import { PrismaFlashSaleRepository } from '../../src/flash-sale/prisma-flash-sale.repository';
import { PrismaFlashSaleReservation } from '../../src/flash-sale/prisma-flash-sale.reservation';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PurchaseFlowService } from '../../src/purchase/purchase-flow.service';
import { PrismaPurchaseRepository } from '../../src/purchase/prisma-purchase.repository';

describe('PurchaseFlowService integration (#20)', () => {
  const prisma = new PrismaService();
  const flashSaleRepository = new PrismaFlashSaleRepository(prisma);
  const reservation = new PrismaFlashSaleReservation(prisma);
  const purchaseRepository = new PrismaPurchaseRepository(prisma);
  const flow = new PurchaseFlowService(
    flashSaleRepository,
    reservation,
    purchaseRepository,
    prisma,
  );

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedSale(options: {
    suffix: string;
    endsAt: Date;
    remainingStock: number;
    startsAt: Date;
    totalStock: number;
  }): Promise<FlashSaleId> {
    const productId = `product-purchase-flow-${options.suffix}`;
    const flashSaleId = `sale-purchase-flow-${options.suffix}`;
    const now = new Date('2026-07-28T12:00:00.000Z');

    await prisma.product.create({
      data: {
        id: productId,
        name: 'Purchase Flow Integration Product',
        updatedAt: now,
      },
    });

    await prisma.flashSale.create({
      data: {
        id: flashSaleId,
        productId,
        endsAt: options.endsAt,
        remainingStock: options.remainingStock,
        startsAt: options.startsAt,
        totalStock: options.totalStock,
        updatedAt: now,
      },
    });

    return flashSaleId as FlashSaleId;
  }

  async function cleanup(suffix: string): Promise<void> {
    const productId = `product-purchase-flow-${suffix}`;
    const flashSaleId = `sale-purchase-flow-${suffix}`;
    await prisma.purchase.deleteMany({ where: { flashSaleId } });
    await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }

  async function remainingStock(flashSaleId: FlashSaleId): Promise<number> {
    const row = await prisma.flashSale.findUniqueOrThrow({ where: { id: flashSaleId } });
    return row.remainingStock;
  }

  async function purchaseCount(flashSaleId: FlashSaleId): Promise<number> {
    return prisma.purchase.count({ where: { flashSaleId } });
  }

  it('commits SUCCESS with decremented stock and a purchase row', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');

    try {
      const flashSaleId = await seedSale({
        suffix,
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 3,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        totalStock: 3,
      });

      const outcome = await flow.execute({
        flashSaleId,
        nowUtc,
        purchaseId: `purchase-${suffix}` as PurchaseId,
        userId: `user-${suffix}` as UserId,
      });

      expect(outcome).toBe('SUCCESS');
      expect(await remainingStock(flashSaleId)).toBe(2);
      expect(await purchaseCount(flashSaleId)).toBe(1);
    } finally {
      await cleanup(suffix);
    }
  });

  it('returns ALREADY_PURCHASED and restores stock after conflict rollback', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    const userId = `user-${suffix}` as UserId;
    const existingPurchaseId = `purchase-existing-${suffix}` as PurchaseId;
    const attemptPurchaseId = `purchase-dup-${suffix}` as PurchaseId;

    try {
      const flashSaleId = await seedSale({
        suffix,
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 1,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        totalStock: 1,
      });

      // Pre-seed an existing purchase (do not use PurchaseFlow for fixture setup).
      await purchaseRepository.save(
        Purchase.create({
          flashSaleId,
          id: existingPurchaseId,
          userId,
          purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
        }),
      );
      expect(await remainingStock(flashSaleId)).toBe(1);
      expect(await purchaseCount(flashSaleId)).toBe(1);

      // ACTIVE + stock available → tryReserve decrements → unique conflict → rollback.
      const outcome = await flow.execute({
        flashSaleId,
        nowUtc,
        purchaseId: attemptPurchaseId,
        userId,
      });

      expect(outcome).toBe('ALREADY_PURCHASED');
      expect(await remainingStock(flashSaleId)).toBe(1);
      expect(await purchaseCount(flashSaleId)).toBe(1);
      expect(await prisma.purchase.findUnique({ where: { id: attemptPurchaseId } })).toBeNull();
      expect(
        await prisma.purchase.findUnique({ where: { id: existingPurchaseId } }),
      ).not.toBeNull();
    } finally {
      await cleanup(suffix);
    }
  });

  it('returns SALE_NOT_STARTED with no mutation', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T09:00:00.000Z');

    try {
      const flashSaleId = await seedSale({
        suffix,
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 2,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        totalStock: 2,
      });

      await expect(
        flow.execute({
          flashSaleId,
          nowUtc,
          purchaseId: `purchase-${suffix}` as PurchaseId,
          userId: `user-${suffix}` as UserId,
        }),
      ).resolves.toBe('SALE_NOT_STARTED');
      expect(await remainingStock(flashSaleId)).toBe(2);
      expect(await purchaseCount(flashSaleId)).toBe(0);
    } finally {
      await cleanup(suffix);
    }
  });

  it('returns SALE_ENDED with no mutation', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T15:00:00.000Z');

    try {
      const flashSaleId = await seedSale({
        suffix,
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 2,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        totalStock: 2,
      });

      await expect(
        flow.execute({
          flashSaleId,
          nowUtc,
          purchaseId: `purchase-${suffix}` as PurchaseId,
          userId: `user-${suffix}` as UserId,
        }),
      ).resolves.toBe('SALE_ENDED');
      expect(await remainingStock(flashSaleId)).toBe(2);
      expect(await purchaseCount(flashSaleId)).toBe(0);
    } finally {
      await cleanup(suffix);
    }
  });

  it('returns SOLD_OUT when inventory is exhausted before the flow begins', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');

    try {
      const flashSaleId = await seedSale({
        suffix,
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 1,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        totalStock: 1,
      });

      // Exhaust inventory before execute — proves pre-check SOLD_OUT (no txn purchase path).
      // In-txn ACTIVE→tryReserve(false) is unit-covered; concurrent reservation races are #19.
      await expect(reservation.tryReserve(flashSaleId, nowUtc)).resolves.toBe(true);
      expect(await remainingStock(flashSaleId)).toBe(0);

      await expect(
        flow.execute({
          flashSaleId,
          nowUtc,
          purchaseId: `purchase-${suffix}` as PurchaseId,
          userId: `user-${suffix}` as UserId,
        }),
      ).resolves.toBe('SOLD_OUT');
      expect(await purchaseCount(flashSaleId)).toBe(0);
      expect(await remainingStock(flashSaleId)).toBe(0);
    } finally {
      await cleanup(suffix);
    }
  });

  it('throws FlashSaleNotFoundError for an unknown flash sale id', async () => {
    await expect(
      flow.execute({
        flashSaleId: `sale-missing-${randomUUID()}` as FlashSaleId,
        nowUtc: new Date('2026-07-28T12:00:00.000Z'),
        purchaseId: `purchase-missing-${randomUUID()}` as PurchaseId,
        userId: `user-missing-${randomUUID()}` as UserId,
      }),
    ).rejects.toBeInstanceOf(FlashSaleNotFoundError);
  });
});
```

**Conflict test invariant:** Pre-seed an existing `(flashSaleId, userId)` purchase **outside** `PurchaseFlow` (via `purchaseRepository.save` / Prisma), with `remainingStock = 1`. Then `execute` → `ACTIVE` → `tryReserve` (stock briefly 0) → unique conflict → txn rollback → stock restored to `1`, only the original purchase row remains. Do **not** manufacture state via `SUCCESS` then manually re-increment stock.

**Conflict coverage split:** Unit proves `PurchaseConflictError` escapes the `$transaction` callback and maps to `ALREADY_PURCHASED`. PostgreSQL integration is the **authoritative rollback** proof.

**SOLD_OUT ownership (locked):** One integration case — inventory exhausted before `execute` (pre-check). Unit covers `ACTIVE → tryReserve(false) → SOLD_OUT` (no save). `#19` owns concurrent reservation oversell. Do **not** add production synchronization hooks solely to manufacture an in-txn race in `#20` integration.

**Cleanup:** Keep `try { ... } finally { await cleanup(suffix); }` with purchase → flashSale → product `deleteMany` order (FK-safe, idempotent via suffix). Optional hardening: wrap cleanup in its own try/catch that logs cleanup failures without masking the original test error — not a blocker if existing suite conventions already use plain `finally`.

- [ ] **Step 2: Run integration tests**

```bash
pnpm --filter api test:integration -- purchase-flow.integration.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit (optional — only if user authorized)**

```bash
git add apps/api/test/purchase/purchase-flow.integration.spec.ts
git commit -m "$(cat <<'EOF'
test: add PurchaseFlow PostgreSQL sequential coverage

EOF
)"
```

---

## Task 6: Workspace quality gates + DoD checklist

- [ ] **Step 1: Run quality gates**

```bash
pnpm --filter @flash-sale/domain build
pnpm --filter @flash-sale/domain typecheck
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test -- purchase-flow.service.spec.ts prisma-persistence-context.spec.ts prisma-flash-sale.reservation.spec.ts prisma-purchase.repository.spec.ts
pnpm --filter api test:integration -- purchase-flow.integration.spec.ts
```

Expected: all PASS. Turbo `typecheck` must continue to depend on `^build` (do not weaken).

Optional full workspace:

```bash
pnpm typecheck
```

- [ ] **Step 2: Definition of Done checklist**

- [ ] `PurchaseFlow` + `PURCHASE_FLOW` + `PurchaseOutcome` + `PersistenceContext` + `FlashSaleNotFoundError` exported from `@flash-sale/domain`
- [ ] Write ports accept optional `PersistenceContext`; omit → root; provided ctx validates brand + txn binding and never falls back mid-method
- [ ] `createPrismaPersistenceContext` binds the `Prisma.TransactionClient` supplied by `$transaction`; `resolvePrismaClient` never falls back to root when `ctx` is provided
- [ ] Every production `FlashSaleReservation` / `PurchaseRepository` write adapter honors `ctx` via `resolvePrismaClient`
- [ ] `tryReserve(false)` still means no mutation; SQL contract unchanged
- [ ] `PurchaseFlowService` normative algorithm (`Purchase.create` inside txn after successful reserve; reserve-before-save)
- [ ] `PurchaseModule` imports `FlashSaleModule` (does not redeclare flash-sale tokens); `PurchaseFlowService` injects domain tokens; exports `PURCHASE_FLOW` via `useExisting`
- [ ] Conflict escapes `$transaction` callback → maps to `ALREADY_PURCHASED`; stock restored (integration)
- [ ] Unexpected errors propagate
- [ ] Unit covers `ACTIVE → tryReserve(false) → SOLD_OUT`, same-ctx to reserve+save, conflict escape/mapping; integration covers pre-check `SOLD_OUT` + authoritative conflict rollback (no fake in-txn race claim)
- [ ] Unit + sequential PG integration passing
- [ ] ESLint + typecheck pass; Turbo `^build` preserved
- [ ] No GraphQL / Redis / schema edits / N-parallel purchase storm / purchase-gate helpers

- [ ] **Step 3: Commit (optional — only if user authorized)**

No extra commit unless docs/code still dirty and user asked.

---

## Self-review (plan vs spec)

| Spec / plan requirement                                  | Task       |
| -------------------------------------------------------- | ---------- |
| Domain `PurchaseFlow` / `PurchaseOutcome` / token        | 1          |
| Confirm `findById` → `null`; `FlashSaleNotFoundError`    | 1          |
| Structurally opaque PersistenceContext + brand check     | 1–2        |
| Optional `ctx` on `tryReserve` / `save` only             | 2          |
| Overloaded resolve; binder binds `$transaction` tx       | 2          |
| Search/verify all port implementations honor `ctx`       | 2          |
| Nest `PurchaseFlowService` algorithm + conflict map      | 3          |
| Same `PersistenceContext` to reserve + save (unit)       | 3          |
| Conflict escapes callback (unit) + PG rollback           | 3, 5       |
| `Purchase.create` inside txn; reserve-before-save        | 3          |
| Extend `PurchaseModule` + `PURCHASE_FLOW` + DI ownership | 4          |
| Unit outcomes + not-found + unexpected + nowUtc          | 3          |
| PG success / conflict restore / status / miss            | 5          |
| Concurrent reservation races                             | `#19` only |
| No N-storm / GraphQL / Redis / schema                    | Out        |

No placeholders. Types/names consistent (`purchasedAt`, not `createdAt`). Commit steps optional only.
