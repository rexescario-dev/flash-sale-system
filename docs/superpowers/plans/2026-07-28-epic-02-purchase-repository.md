# EPIC-02 #18 — Purchase Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#18](https://github.com/rexescario-dev/flash-sale-system/issues/18) by adding a domain-owned `PurchaseRepository` port + `PURCHASE_REPOSITORY` DI token, `PurchaseConflictError`, `Purchase.reconstitute`, and a Prisma `save` / `findByFlashSaleAndUser` adapter with mapper — proven by unit tests (order-independent composite `P2002` mapping + non-composite rethrow) and PostgreSQL integration (save, lookup, composite conflict).

**Acceptance criteria (from issue, interpreted):**

- Purchase create/lookup is implemented → `save(purchase)` + `findByFlashSaleAndUser(flashSaleId, userId)`.
- Unique constraint violations map to domain/application results → composite `P2002` → `PurchaseConflictError`; `ALREADY_PURCHASED` remains `#20`.

**Architecture:** Thin domain port + conflict error in `packages/domain`; Prisma mapper + adapter + Nest feature slice in `apps/api/src/purchase/`. Adapter flow: `save` → `create` (map composite uniqueness only); lookup → `findUnique(flashSaleId_userId)` → `null` or `PurchaseMapper.toDomain` → `Purchase.reconstitute`. Dedicated `PurchaseModule` (not folded into `FlashSaleModule`).

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL 16, Jest + ts-jest, `@flash-sale/domain`, pnpm + Turborepo.

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md) (`#18 — Implement purchase repository`)

**Authority:** The approved umbrella `#18` contract is authoritative. This plan operationalizes it and must **not** alter its contract. Do not invent requirements.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`. Author email must be `rex.escario.jr@gmail.com`.

**ESLint:** perfectionist sort — object keys: `id` first where present, then A→Z. Run ESLint after writing and accept repository ordering if it rewrites keys/members/exports.

**Out of scope:** `findById` on the purchase port; `ALREADY_PURCHASED`; GraphQL; Redis; transactions / `#19`–`#20`; schema/migration **edits**; FlashSale/Product domain or repository changes.

Applying existing migrations via `prisma:migrate:deploy` against a test DB is allowed and required for integration/CI; that is **not** a schema edit.

---

## File map

| Path                                                                     | Responsibility                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `packages/domain/src/purchase/purchase-conflict.error.ts`                | **Create:** `PurchaseConflictError`                                            |
| `packages/domain/src/purchase/purchase.repository.ts`                    | **Create:** `PurchaseRepository` + `PURCHASE_REPOSITORY`                       |
| `packages/domain/src/purchase/purchase.ts`                               | **Modify:** add `PurchaseReconstituteProps` + `reconstitute` (+ shared assert) |
| `packages/domain/src/purchase/purchase.spec.ts`                          | **Modify:** `reconstitute` unit coverage                                       |
| `packages/domain/src/index.ts`                                           | **Modify:** export port, token, conflict error, reconstitute props             |
| `apps/api/src/purchase/purchase.mapper.ts`                               | **Create:** `toDomain` / `toPersistence`                                       |
| `apps/api/src/purchase/purchase.mapper.spec.ts`                          | **Create:** mapper unit tests                                                  |
| `apps/api/src/purchase/prisma-purchase.repository.ts`                    | **Create:** Prisma adapter + order-independent `P2002` targeting               |
| `apps/api/src/purchase/prisma-purchase.repository.spec.ts`               | **Create:** adapter unit tests (incl. three `P2002` cases)                     |
| `apps/api/src/purchase/purchase.module.ts`                               | **Create:** Nest providers + `useExisting` token alias                         |
| `apps/api/src/app.module.ts`                                             | **Modify:** import `PurchaseModule`                                            |
| `apps/api/jest.integration.config.cjs`                                   | **Modify:** include `test/purchase/**`                                         |
| `apps/api/test/purchase/prisma-purchase.repository.integration.spec.ts`  | **Create:** PostgreSQL save / lookup / conflict                                |
| `docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md` | Carry forward if still uncommitted local `#18` contract work                   |
| `docs/superpowers/plans/2026-07-28-epic-02-purchase-repository.md`       | This plan (carry forward if uncommitted)                                       |

**Untouched:** `apps/api/prisma/**`, GraphQL modules, Redis, FlashSale feature slice (except shared AppModule import list), `#20` outcomes.

**CI:** No new job — existing `schema-test` already runs `test:integration` after `#17`. Extending `testMatch` is enough.

---

## Task 0: Inspect working tree, verify `#17` baseline, create branch

**Files:** none (git only)

**Invariant:** Never silently discard, stash, reset, or overwrite the intended `#18` spec/plan.

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

1. **Intended `#18` docs** — umbrella `#18` contract and/or this plan under `docs/superpowers/`
2. **Unrelated uncommitted changes** — anything else

Rules:

- If **unrelated** uncommitted changes exist → **stop** and ask the operator to resolve them. Do **not** stash, reset, discard, or overwrite automatically.
- If only intended `#18` docs are dirty → **preserve** them onto the feature branch (see Step 3).

- [ ] **Step 2: Verify `#17` baseline on `origin/main`**

```bash
git log -1 --oneline origin/main
git show origin/main:packages/domain/src/flash-sale/flash-sale.repository.ts | head -20
rg -n "FlashSaleRepository|FLASH_SALE_REPOSITORY" <(git show origin/main:packages/domain/src/index.ts)
git cat-file -e origin/main:apps/api/src/flash-sale/prisma-flash-sale.repository.ts && echo "adapter_present"
```

Expected:

- `origin/main` at/after `432c142` (PR #104 / `#17` merged)
- `FlashSaleRepository` + `FLASH_SALE_REPOSITORY` exported from domain
- Prisma flash-sale adapter present on main

- [ ] **Step 3: Create feature branch (docs-safe procedure)**

Do **not** blindly `git switch main` when intended `#18` docs are dirty.

```text
1. Inspect status (Step 1).
2. Confirm HEAD contains origin/main
   (merge-base --is-ancestor origin/main HEAD → exit 0).
3. If only intended #18 docs are dirty:
   - create the feature branch from current HEAD:
       git switch -c feat/epic-02-purchase-repository
   - carry the dirty docs as-is (do not discard).
4. If unrelated changes exist:
   - STOP.
5. If current HEAD does NOT contain origin/main:
   - update main first deliberately (ff-only), then recreate/carry docs:
       # only when working tree is clean OR docs are safely preserved
       git switch main
       git pull --ff-only origin main
       git switch -c feat/epic-02-purchase-repository
   - if docs were only on a dirty prior branch tip, cherry-pick/copy them
     onto the new branch — never `git checkout --` / stash-drop them away.
```

Preferred happy path when already on `main` (or a tip that contains `origin/main`) with **only** intended `#18` docs dirty:

```bash
git switch -c feat/epic-02-purchase-repository
```

- [ ] **Step 4: Optional commit checkpoint (docs only — only if authorized)**

```bash
git add docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md \
        docs/superpowers/plans/2026-07-28-epic-02-purchase-repository.md
git commit -m "$(cat <<'EOF'
docs: add EPIC-02 #18 purchase repository contract and plan

EOF
)"
```

---

## Task 1: Domain conflict error + port + DI token + public exports

**Files:**

- Create: `packages/domain/src/purchase/purchase-conflict.error.ts`
- Create: `packages/domain/src/purchase/purchase.repository.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Add `PurchaseConflictError`**

Implement `PurchaseConflictError` using the **same custom-error inheritance/pattern** already established by domain validation errors (`FlashSaleValidationError` / `PurchaseValidationError`): `extends Error`, set `this.name`, expose a stable `readonly code`, **no** alternate prototype hacks unless those existing errors already use them (they do not — do not invent `Object.setPrototypeOf` for this ticket).

Create `packages/domain/src/purchase/purchase-conflict.error.ts`:

```ts
export class PurchaseConflictError extends Error {
  readonly code = 'PURCHASE_CONFLICT' as const;

  constructor(message = 'Purchase conflicts with an existing purchase') {
    super(message);
    this.name = 'PurchaseConflictError';
  }
}
```

Do **not** introduce a second custom-error style. Keep `code = 'PURCHASE_CONFLICT'` (not `ALREADY_PURCHASED`).

- [ ] **Step 2: Add port + token**

Create `packages/domain/src/purchase/purchase.repository.ts`:

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

- [ ] **Step 3: Export from package index**

Modify `packages/domain/src/index.ts` — add exports (run ESLint; accept perfectionist A→Z / existing style). Required surface:

```ts
export { PurchaseConflictError } from './purchase/purchase-conflict.error.js';
export { PURCHASE_REPOSITORY } from './purchase/purchase.repository.js';
export type { PurchaseRepository } from './purchase/purchase.repository.js';
```

Also export `PurchaseReconstituteProps` in Task 2 when the type exists. Do **not** redefine tokens in `apps/api`.

- [ ] **Step 4: Typecheck domain**

```bash
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain lint
```

Expected: PASS.

- [ ] **Step 5: Optional commit (only if authorized)**

```bash
git add packages/domain/src/purchase/purchase-conflict.error.ts \
        packages/domain/src/purchase/purchase.repository.ts \
        packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add PurchaseRepository port and PurchaseConflictError

EOF
)"
```

---

## Task 2: `Purchase.reconstitute` + domain unit tests (TDD)

**Files:**

- Modify: `packages/domain/src/purchase/purchase.ts`
- Modify: `packages/domain/src/purchase/purchase.spec.ts`
- Modify: `packages/domain/src/index.ts` (export `PurchaseReconstituteProps`)

- [ ] **Step 1: Write failing `reconstitute` tests**

Append to `packages/domain/src/purchase/purchase.spec.ts` (reuse existing helpers / fixtures):

```ts
describe('Purchase.reconstitute', () => {
  it('reconstitutes a purchase and preserves ids exactly', () => {
    const paddedId = asPurchaseId('  purchase-1  ');
    const paddedFlashSaleId = asFlashSaleId('  sale-1  ');
    const paddedUserId = asUserId('  user-1  ');
    const purchase = Purchase.reconstitute({
      flashSaleId: paddedFlashSaleId,
      id: paddedId,
      userId: paddedUserId,
      purchasedAt,
    });

    expect(purchase.getId()).toBe('  purchase-1  ');
    expect(purchase.getFlashSaleId()).toBe('  sale-1  ');
    expect(purchase.getUserId()).toBe('  user-1  ');
    expect(purchase.getPurchasedAt().getTime()).toBe(purchasedAt.getTime());
  });

  it('isolates purchasedAt from getter mutation', () => {
    const purchase = Purchase.reconstitute({ flashSaleId, id, userId, purchasedAt });
    const originalTimestamp = purchasedAt.getTime();

    purchase.getPurchasedAt().setTime(0);

    expect(purchase.getPurchasedAt().getTime()).toBe(originalTimestamp);
  });

  it('isolates purchasedAt from input mutation after reconstitute', () => {
    const input = new Date('2026-07-27T00:00:00.000Z');
    const originalTimestamp = input.getTime();
    const purchase = Purchase.reconstitute({
      flashSaleId,
      id,
      userId,
      purchasedAt: input,
    });

    input.setTime(0);

    expect(purchase.getPurchasedAt().getTime()).toBe(originalTimestamp);
  });

  it('rejects empty id', () => {
    expectValidationError(
      () => Purchase.reconstitute({ flashSaleId, id: asPurchaseId(''), userId, purchasedAt }),
      'EMPTY_ID',
    );
  });

  it('rejects invalid purchasedAt', () => {
    expectValidationError(
      () =>
        Purchase.reconstitute({
          flashSaleId,
          id,
          userId,
          purchasedAt: new Date('not-a-date'),
        }),
      'INVALID_PURCHASED_AT',
    );
  });
});
```

Cover at least one empty-id failure and `INVALID_PURCHASED_AT`. Additional empty/whitespace codes for `flashSaleId` / `userId` may mirror `create` coverage; assert `code` only (never exact message strings).

- [ ] **Step 2: Run domain tests — expect FAIL**

```bash
pnpm --filter @flash-sale/domain test -- purchase.spec.ts
```

Expected: FAIL (`Purchase.reconstitute` missing).

- [ ] **Step 3: Implement `reconstitute`**

Modify `packages/domain/src/purchase/purchase.ts`:

1. Export `PurchaseReconstituteProps` with the same fields as `PurchaseCreateProps` (may alias: `export type PurchaseReconstituteProps = PurchaseCreateProps`).
2. Extract private `assertValid(props)` used by both `create` and `reconstitute` (same invariants as today’s `create`).
3. Add:

```ts
static reconstitute(props: PurchaseReconstituteProps): Purchase {
  Purchase.assertValid(props);
  return new Purchase(
    props.id,
    props.flashSaleId,
    new Date(props.purchasedAt.getTime()),
    props.userId,
  );
}
```

4. Refactor `create` to call `assertValid` then construct (preserve existing behavior: IDs stored unchanged; defensive `purchasedAt` copy).

Do **not** trim IDs for storage. Do **not** add uniqueness helpers.

- [ ] **Step 4: Export type + run tests — expect PASS**

Export from `packages/domain/src/index.ts`:

```ts
export type { PurchaseReconstituteProps } from './purchase/purchase.js';
```

(Merge with existing `PurchaseCreateProps` export line if perfectionist prefers a single type export block.)

```bash
pnpm --filter @flash-sale/domain test -- purchase.spec.ts
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain lint
```

Expected: PASS.

- [ ] **Step 5: Optional commit (only if authorized)**

```bash
git add packages/domain/src/purchase/purchase.ts \
        packages/domain/src/purchase/purchase.spec.ts \
        packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add Purchase.reconstitute for persistence hydration

EOF
)"
```

---

## Task 3: Purchase mapper — failing unit tests, then implementation

**Files:**

- Create: `apps/api/src/purchase/purchase.mapper.spec.ts`
- Create: `apps/api/src/purchase/purchase.mapper.ts`

- [ ] **Step 1: Write failing mapper unit tests**

Create `apps/api/src/purchase/purchase.mapper.spec.ts`:

```ts
import type { Purchase as PrismaPurchase } from '@prisma/client';

import {
  Purchase,
  PurchaseValidationError,
  type FlashSaleId,
  type PurchaseId,
  type UserId,
} from '@flash-sale/domain';

import { PurchaseMapper } from './purchase.mapper';

function buildRow(overrides: Partial<PrismaPurchase> = {}): PrismaPurchase {
  const now = new Date('2026-07-28T12:00:00.000Z');
  return {
    id: 'purchase-1',
    createdAt: now,
    flashSaleId: 'sale-1',
    purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    updatedAt: now,
    userId: 'user-1',
    ...overrides,
  };
}

describe('PurchaseMapper', () => {
  it('maps a valid Prisma row to Purchase via reconstitute', () => {
    const row = buildRow({
      id: '  purchase-padded  ',
      flashSaleId: '  sale-padded  ',
      userId: '  user-padded  ',
    });
    const purchase = PurchaseMapper.toDomain(row);

    expect(purchase.getId()).toBe('  purchase-padded  ');
    expect(purchase.getFlashSaleId()).toBe('  sale-padded  ');
    expect(purchase.getUserId()).toBe('  user-padded  ');
    expect(purchase.getPurchasedAt().toISOString()).toBe('2026-07-28T11:00:00.000Z');
  });

  it('maps a domain Purchase to Prisma create data', () => {
    const purchase = Purchase.create({
      id: 'purchase-1' as PurchaseId,
      flashSaleId: 'sale-1' as FlashSaleId,
      userId: 'user-1' as UserId,
      purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    });

    expect(PurchaseMapper.toPersistence(purchase)).toEqual({
      id: 'purchase-1',
      flashSaleId: 'sale-1',
      purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
      userId: 'user-1',
    });
  });

  it('propagates PurchaseValidationError for invalid persisted state', () => {
    const row = buildRow({ id: '   ' });

    try {
      PurchaseMapper.toDomain(row);
      fail('Expected PurchaseValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseValidationError);
      expect((error as PurchaseValidationError).code).toBe('EMPTY_ID');
    }
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter api test -- purchase.mapper.spec.ts
```

Expected: FAIL (mapper module missing). Prefer `pnpm --filter @flash-sale/domain build` first if the API resolves the built package; Turbo `test` already depends on `^build`.

- [ ] **Step 3: Implement mapper**

Create `apps/api/src/purchase/purchase.mapper.ts`:

```ts
import type { Purchase as PrismaPurchase } from '@prisma/client';

import { Purchase, type FlashSaleId, type PurchaseId, type UserId } from '@flash-sale/domain';

export class PurchaseMapper {
  static toDomain(row: PrismaPurchase): Purchase {
    return Purchase.reconstitute({
      id: row.id as PurchaseId,
      flashSaleId: row.flashSaleId as FlashSaleId,
      purchasedAt: row.purchasedAt,
      userId: row.userId as UserId,
    });
  }

  static toPersistence(purchase: Purchase): {
    id: string;
    flashSaleId: string;
    purchasedAt: Date;
    userId: string;
  } {
    return {
      id: purchase.getId(),
      flashSaleId: purchase.getFlashSaleId(),
      purchasedAt: purchase.getPurchasedAt(),
      userId: purchase.getUserId(),
    };
  }
}
```

Rules:

- No Nest decorators.
- No trim/normalization.
- Discard audit timestamps implicitly (never pass `createdAt` / `updatedAt` into domain).
- Do **not** catch `PurchaseValidationError`.
- **`Purchase.getPurchasedAt()` is expected to return a defensive copy; `toPersistence()` must not expose mutable domain state.** Rely on that getter contract (`purchasedAt: purchase.getPurchasedAt()` is sufficient). Do not add redundant `new Date(...)` copying unless a regression proves the getter stopped returning a copy.

- [ ] **Step 4: Run mapper tests — expect PASS**

```bash
pnpm --filter api test -- src/purchase/purchase.mapper.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Optional commit (only if authorized)**

```bash
git add apps/api/src/purchase/purchase.mapper.ts \
        apps/api/src/purchase/purchase.mapper.spec.ts
git commit -m "$(cat <<'EOF'
feat: map Prisma Purchase rows to domain via reconstitute

EOF
)"
```

---

## Task 4: Prisma adapter — failing unit tests (incl. order-independent P2002), then implementation

**Files:**

- Create: `apps/api/src/purchase/prisma-purchase.repository.spec.ts`
- Create: `apps/api/src/purchase/prisma-purchase.repository.ts`

- [ ] **Step 1: Write failing adapter unit tests**

Create `apps/api/src/purchase/prisma-purchase.repository.spec.ts`:

```ts
import {
  Purchase,
  PurchaseConflictError,
  type FlashSaleId,
  type PurchaseId,
  type UserId,
} from '@flash-sale/domain';
import { Prisma } from '@prisma/client';
import type { Purchase as PrismaPurchase } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';

import { PrismaPurchaseRepository } from './prisma-purchase.repository';

function buildRow(overrides: Partial<PrismaPurchase> = {}): PrismaPurchase {
  const now = new Date('2026-07-28T12:00:00.000Z');
  return {
    id: 'purchase-1',
    createdAt: now,
    flashSaleId: 'sale-1',
    purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    updatedAt: now,
    userId: 'user-1',
    ...overrides,
  };
}

function p2002(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    clientVersion: 'test',
    code: 'P2002',
    meta: { target },
  });
}

describe('PrismaPurchaseRepository', () => {
  const flashSaleId = 'sale-1' as FlashSaleId;
  const userId = 'user-1' as UserId;

  function buildPurchase(overrides: { id?: string } = {}): Purchase {
    return Purchase.create({
      id: (overrides.id ?? 'purchase-1') as PurchaseId,
      flashSaleId,
      userId,
      purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    });
  }

  it('returns null when findUnique returns null', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = { purchase: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.findByFlashSaleAndUser(flashSaleId, userId)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({
      where: { flashSaleId_userId: { flashSaleId, userId } },
    });
  });

  it('returns a Purchase when a row exists', async () => {
    const findUnique = jest.fn().mockResolvedValue(buildRow());
    const prisma = { purchase: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    const purchase = await repo.findByFlashSaleAndUser(flashSaleId, userId);

    expect(purchase).not.toBeNull();
    expect(purchase!.getId()).toBe('purchase-1');
    expect(purchase!.getFlashSaleId()).toBe('sale-1');
    expect(purchase!.getUserId()).toBe('user-1');
  });

  it('saves a purchase via prisma create', async () => {
    const create = jest.fn().mockResolvedValue(buildRow());
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledWith({
      data: {
        id: 'purchase-1',
        flashSaleId: 'sale-1',
        purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
        userId: 'user-1',
      },
    });
  });

  it('maps P2002 composite target to PurchaseConflictError (canonical order)', async () => {
    const create = jest.fn().mockRejectedValue(p2002(['flashSaleId', 'userId']));
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).rejects.toMatchObject({
      code: 'PURCHASE_CONFLICT',
      name: 'PurchaseConflictError',
    });
  });

  it('maps P2002 composite target to PurchaseConflictError regardless of field order', async () => {
    const create = jest.fn().mockRejectedValue(p2002(['userId', 'flashSaleId']));
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).rejects.toMatchObject({
      code: 'PURCHASE_CONFLICT',
      name: 'PurchaseConflictError',
    });
  });

  it('rethrows P2002 when target is only id', async () => {
    const error = p2002(['id']);
    const create = jest.fn().mockRejectedValue(error);
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).rejects.toBe(error);
  });

  it('rethrows P2002 when target is unknown/other', async () => {
    const error = p2002(['something_else']);
    const create = jest.fn().mockRejectedValue(error);
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).rejects.toBe(error);
  });

  it('propagates PurchaseValidationError when mapped state is invalid', async () => {
    const findUnique = jest.fn().mockResolvedValue(buildRow({ id: '   ' }));
    const prisma = { purchase: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.findByFlashSaleAndUser(flashSaleId, userId)).rejects.toMatchObject({
      code: 'EMPTY_ID',
    });
  });
});
```

**Required P2002 contract (unit):**

| Case                  | Target                      | Expected                                      |
| --------------------- | --------------------------- | --------------------------------------------- |
| Composite (canonical) | `['flashSaleId', 'userId']` | `PurchaseConflictError` / `PURCHASE_CONFLICT` |
| Composite (reversed)  | `['userId', 'flashSaleId']` | `PurchaseConflictError` / `PURCHASE_CONFLICT` |
| PK                    | `['id']`                    | original Prisma error rethrown                |
| Unknown               | e.g. `['something_else']`   | original Prisma error rethrown                |

Match **exact set equality, order-independent**, on Prisma **field** names `{flashSaleId, userId}` only.

**Not required for `#18`:** SQL-column-name targets (`flash_sale_id` / `user_id`). Do **not** add a required unit test for them. If a real PostgreSQL integration failure later shows Prisma emitting SQL columns in `meta.target` for this project, expand the helper then — do not pre-emptively widen the contract.

**One `save` call per assertion** (no double-invoke).

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter api test -- prisma-purchase.repository.spec.ts
```

Expected: FAIL (adapter module missing).

- [ ] **Step 3: Implement adapter + order-independent target helper**

Create `apps/api/src/purchase/prisma-purchase.repository.ts`:

```ts
import {
  PurchaseConflictError,
  type FlashSaleId,
  type Purchase,
  type PurchaseRepository,
  type UserId,
} from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { PurchaseMapper } from './purchase.mapper';

function isCompositePurchaseUniqueTarget(target: unknown): boolean {
  if (!Array.isArray(target)) {
    return false;
  }

  const names = target.filter((value): value is string => typeof value === 'string');
  if (names.length !== target.length) {
    return false;
  }

  const set = new Set(names);
  // Exact set equality, order-independent — Prisma field names only.
  return set.size === 2 && set.has('flashSaleId') && set.has('userId');
}

@Injectable()
export class PrismaPurchaseRepository implements PurchaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByFlashSaleAndUser(flashSaleId: FlashSaleId, userId: UserId): Promise<Purchase | null> {
    const row = await this.prisma.purchase.findUnique({
      where: { flashSaleId_userId: { flashSaleId, userId } },
    });

    if (row === null) {
      return null;
    }

    return PurchaseMapper.toDomain(row);
  }

  async save(purchase: Purchase): Promise<void> {
    try {
      await this.prisma.purchase.create({
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

Rules:

- **Exact set equality, order-independent**, on Prisma field names `{flashSaleId, userId}` only.
- Remap **only** that composite target → `PurchaseConflictError`.
- Do **not** treat SQL column names (`flash_sale_id` / `user_id`) as a required `#18` contract. Keep the helper narrow; widen only if real runtime evidence requires it.
- Do **not** catch mapper/`PurchaseValidationError`.
- No `include` of `flashSale`.
- No `findById`, update, or upsert.

- [ ] **Step 4: Run adapter + mapper unit tests — expect PASS**

```bash
pnpm --filter api test -- src/purchase
```

Expected: PASS (required `P2002` cases — both composite orders + `['id']` + unknown — plus lookup/save/corrupt).

- [ ] **Step 5: Optional commit (only if authorized)**

```bash
git add apps/api/src/purchase/prisma-purchase.repository.ts \
        apps/api/src/purchase/prisma-purchase.repository.spec.ts
git commit -m "$(cat <<'EOF'
feat: add Prisma PurchaseRepository with composite conflict mapping

EOF
)"
```

---

## Task 5: Nest `PurchaseModule` + `AppModule` wiring

**Files:**

- Create: `apps/api/src/purchase/purchase.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create minimal PurchaseModule**

Create `apps/api/src/purchase/purchase.module.ts`:

```ts
import { PURCHASE_REPOSITORY } from '@flash-sale/domain';
import { Module } from '@nestjs/common';

import { PrismaPurchaseRepository } from './prisma-purchase.repository';

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

Rules:

- Import `PURCHASE_REPOSITORY` from `@flash-sale/domain` — **never** redefine the Symbol in `apps/api`.
- Do **not** import/re-export `PrismaModule` (`PrismaModule` is already `@Global()`).
- No controllers, resolvers, or use cases.

- [ ] **Step 2: Register in AppModule**

Modify `apps/api/src/app.module.ts`:

```ts
import { PurchaseModule } from './purchase/purchase.module';
```

Add `PurchaseModule` to the `@Module({ imports: [...] })` list alongside `FlashSaleModule` / `PrismaModule` / `HealthModule`. Run ESLint for import/member order.

- [ ] **Step 3: Typecheck + lint API**

```bash
pnpm --filter api typecheck
pnpm --filter api lint
```

Expected: PASS. If typecheck fails on missing built domain dist, run `pnpm --filter @flash-sale/domain build` (Turbo root `typecheck` uses `^build`).

- [ ] **Step 4: Optional commit (only if authorized)**

```bash
git add apps/api/src/purchase/purchase.module.ts \
        apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat: wire PurchaseModule with domain repository token

EOF
)"
```

---

## Task 6: PostgreSQL integration + extend Jest integration config

**Files:**

- Modify: `apps/api/jest.integration.config.cjs`
- Create: `apps/api/test/purchase/prisma-purchase.repository.integration.spec.ts`

- [ ] **Step 1: Extend integration testMatch**

Modify `apps/api/jest.integration.config.cjs` `testMatch` to include purchase specs:

```js
testMatch: [
  '<rootDir>/test/flash-sale/**/*.spec.ts',
  '<rootDir>/test/purchase/**/*.spec.ts',
],
```

Do **not** invent a second Jest config or CI job.

- [ ] **Step 2: Write integration tests**

Create `apps/api/test/purchase/prisma-purchase.repository.integration.spec.ts`:

```ts
import {
  Purchase,
  PurchaseConflictError,
  type FlashSaleId,
  type PurchaseId,
  type UserId,
} from '@flash-sale/domain';
import { randomUUID } from 'node:crypto';

import { PrismaPurchaseRepository } from '../../src/purchase/prisma-purchase.repository';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('PrismaPurchaseRepository integration (#18)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaPurchaseRepository(prisma);

  beforeAll(async () => {
    // PrismaService skips eager connect when NODE_ENV=test; connect explicitly for integration.
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedFlashSale(suffix: string): Promise<{
    flashSaleId: string;
    productId: string;
  }> {
    const productId = `product-purchase-repo-${suffix}`;
    const flashSaleId = `sale-purchase-repo-${suffix}`;
    const now = new Date('2026-07-28T12:00:00.000Z');

    await prisma.product.create({
      data: {
        id: productId,
        name: 'Purchase Repo Integration Product',
        updatedAt: now,
      },
    });

    await prisma.flashSale.create({
      data: {
        id: flashSaleId,
        productId,
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 5,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        totalStock: 5,
        updatedAt: now,
      },
    });

    return { flashSaleId, productId };
  }

  it('saves and loads a Purchase by flashSaleId + userId', async () => {
    const suffix = randomUUID();
    const { flashSaleId, productId } = await seedFlashSale(suffix);
    const purchaseId = `purchase-repo-${suffix}`;
    const userId = `user-repo-${suffix}`;
    const purchasedAt = new Date('2026-07-28T11:30:00.000Z');

    try {
      const purchase = Purchase.create({
        id: purchaseId as PurchaseId,
        flashSaleId: flashSaleId as FlashSaleId,
        userId: userId as UserId,
        purchasedAt,
      });

      await repo.save(purchase);

      const loaded = await repo.findByFlashSaleAndUser(
        flashSaleId as FlashSaleId,
        userId as UserId,
      );

      expect(loaded).not.toBeNull();
      expect(loaded!.getId()).toBe(purchaseId);
      expect(loaded!.getFlashSaleId()).toBe(flashSaleId);
      expect(loaded!.getUserId()).toBe(userId);
      expect(loaded!.getPurchasedAt().toISOString()).toBe(purchasedAt.toISOString());
    } finally {
      await prisma.purchase.deleteMany({ where: { flashSaleId } });
      await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
  });

  it('returns null for a missing flashSaleId + userId pair', async () => {
    const missingSale = `sale-missing-${randomUUID()}` as FlashSaleId;
    const missingUser = `user-missing-${randomUUID()}` as UserId;

    await expect(repo.findByFlashSaleAndUser(missingSale, missingUser)).resolves.toBeNull();
  });

  it('maps duplicate (flashSaleId, userId) save to PurchaseConflictError', async () => {
    const suffix = randomUUID();
    const { flashSaleId, productId } = await seedFlashSale(suffix);
    const userId = `user-dup-${suffix}`;
    const purchasedAt = new Date('2026-07-28T11:30:00.000Z');

    try {
      await repo.save(
        Purchase.create({
          id: `purchase-dup-a-${suffix}` as PurchaseId,
          flashSaleId: flashSaleId as FlashSaleId,
          userId: userId as UserId,
          purchasedAt,
        }),
      );

      await expect(
        repo.save(
          Purchase.create({
            id: `purchase-dup-b-${suffix}` as PurchaseId,
            flashSaleId: flashSaleId as FlashSaleId,
            userId: userId as UserId,
            purchasedAt,
          }),
        ),
      ).rejects.toMatchObject({
        code: 'PURCHASE_CONFLICT',
        name: 'PurchaseConflictError',
      });
    } finally {
      await prisma.purchase.deleteMany({ where: { flashSaleId } });
      await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
  });
});
```

Do **not** assert `ALREADY_PURCHASED`. Nest DI TestingModule is optional/YAGNI (mirror `#17`: exercise adapter via `new PrismaPurchaseRepository(prisma)`).

- [ ] **Step 3: Ensure DB migrated, run integration**

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:integration
```

Expected: PASS (existing `#17` flash-sale tests + new `#18` purchase tests).

- [ ] **Step 4: Optional commit (only if authorized)**

```bash
git add apps/api/jest.integration.config.cjs \
        apps/api/test/purchase/prisma-purchase.repository.integration.spec.ts
git commit -m "$(cat <<'EOF'
test: add Purchase repository PostgreSQL integration coverage

EOF
)"
```

---

## Task 7: Workspace quality gates + Definition of Done check

**Files:** none (verification only)

- [ ] **Step 1: Run quality gates**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter api test -- src/purchase
pnpm --filter api test:integration
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all PASS. `pnpm typecheck` must honor Turbo `^build` (domain builds before api typecheck).

- [ ] **Step 2: Out-of-scope greps**

```bash
rg -n "ALREADY_PURCHASED|findById" apps/api/src/purchase packages/domain/src/purchase || true
rg -n "ioredis|redis" apps/api/src/purchase || true
rg -n "PurchaseConflictError|PURCHASE_REPOSITORY|Purchase\\.reconstitute" packages/domain/src apps/api/src/purchase
```

Expected:

- No `ALREADY_PURCHASED` in purchase repo work
- No `findById` on purchase port/adapter
- No Redis client in purchase slice
- Conflict error / token / `reconstitute` present

- [ ] **Step 3: DoD checklist**

- [ ] `PurchaseRepository` + `PURCHASE_REPOSITORY` exported from `@flash-sale/domain`
- [ ] `PurchaseConflictError` with `code: 'PURCHASE_CONFLICT'`; composite-only mapping via **order-independent exact set** `{flashSaleId, userId}`; unit covers both field orders + `['id']` + unknown rethrow
- [ ] `Purchase.reconstitute` + mapper `toDomain` / `toPersistence`
- [ ] `PurchaseModule` `useExisting` + `AppModule` import
- [ ] Integration: save+lookup, miss→null, duplicate pair→`PurchaseConflictError`
- [ ] `jest.integration.config.cjs` includes `test/purchase/**`
- [ ] No schema/migration edits; no GraphQL; no Redis; no `ALREADY_PURCHASED`; no `findById`
- [ ] Lint / typecheck / unit / integration pass

- [ ] **Step 4: Optional final docs commit (only if authorized and docs still dirty)**

```bash
git add docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md \
        docs/superpowers/plans/2026-07-28-epic-02-purchase-repository.md
git commit -m "$(cat <<'EOF'
docs: finalize EPIC-02 #18 purchase repository contract and plan

EOF
)"
```

---

## Spec coverage self-check

| Spec requirement                                                 | Task(s)       |
| ---------------------------------------------------------------- | ------------- |
| Port `save` + `findByFlashSaleAndUser` + branded IDs             | 1, 4          |
| `PURCHASE_REPOSITORY` domain token                               | 1, 5          |
| `PurchaseConflictError` / `PURCHASE_CONFLICT`                    | 1, 4, 6       |
| Order-independent composite `P2002` set (`flashSaleId`/`userId`) | 4             |
| Unit: both composite orders / `['id']` / unknown rethrow         | 4             |
| `Purchase.reconstitute` (hydration for `#18`)                    | 2, 3          |
| Mapper `toDomain` / `toPersistence`; no trim                     | 3             |
| Dedicated `apps/api/src/purchase/` + `PurchaseModule`            | 3–5           |
| Integration save / miss / conflict                               | 6             |
| Extend existing `test:integration` (no new CI job)               | 6             |
| Turbo `^build` typecheck preserved                               | 7             |
| Out: `findById`, `ALREADY_PURCHASED`, GraphQL, Redis             | 7 greps / DoD |

**Type consistency:** `PURCHASE_CONFLICT`, `PurchaseConflictError`, `PURCHASE_REPOSITORY`, `findByFlashSaleAndUser`, `flashSaleId_userId`, `Purchase.reconstitute`, `PurchaseReconstituteProps`.
