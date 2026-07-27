# EPIC-02 #16 — Unique Purchase Constraint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#16](https://github.com/rexescario-dev/flash-sale-system/issues/16) by enforcing one purchase per user per flash sale at PostgreSQL via Prisma `@@unique([flashSaleId, userId])`, removing the redundant non-unique `@@index([flashSaleId])`, shipping exactly one append-only migration after `#15`, and proving the invariant with catalog + behavioral (`P2002` + composite cross-pair) tests — with no repositories, GraphQL, Redis client, domain uniqueness helpers, or `ALREADY_PURCHASED` mapping.

**Acceptance criteria (from issue, interpreted):**

- `UNIQUE(flash_sale_id, user_id)` exists in the database as a database-enforced unique constraint/invariant (catalog metadata; do not assume constraint vs unique-index object type).
- Duplicate inserts for the same `(flash_sale_id, user_id)` pair fail at the DB layer (Prisma `P2002`).
- Behavioral coverage also confirms the constraint is **composite**: different users may purchase the same flash sale, while the same user cannot purchase the same flash sale twice.

**Architecture:** Prisma-first change in `apps/api/prisma/schema.prisma`. Generate exactly one new migration directory using the same `#15` path (`prisma migrate dev --create-only`). **Required SQL review gate** before apply — expected migration scope only:

```text
- Drop the existing non-unique flash_sale_id index on purchases.
- Add the composite unique constraint/invariant on ordered (flash_sale_id, user_id).
- No unrelated table, column, foreign key, CHECK, or index changes
  (including: no standalone user_id index created by #16).
```

`migrate dev --create-only` may inspect/synchronize the **disposable local development** database per Prisma’s normal behavior — that is acceptable only against local/dev DB, never as CI/production proof. **`prisma migrate deploy`** is the deployment-path validation (cover both: clean DB → `#15` then `#16`; DB already at `#15` → `#16` only).

Extend `test/schema` coverage: catalog asserts the uniqueness invariant by ordered columns + uniqueness metadata on `public.purchases` (not generated names; not assuming constraint vs unique-index object type). Behavioral asserts repeated exact pair → Prisma `P2002`, and composite cross-pair success. Persistence semantics remain unchanged from `#15`.

**Tech Stack:** Prisma 6, PostgreSQL 16 (Compose), NestJS `apps/api`, Jest + ts-jest (`test:schema` / CI `schema-test`), pnpm + Turborepo.

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md) (`#16 — Add unique purchase constraint`)

**Authority:** The approved umbrella `#16` contract is authoritative. This plan operationalizes it and must **not** alter its contract. Do not invent requirements.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Critical migration workflow (do not skip):**

```text
Update schema.prisma (@@unique; remove @@index([flashSaleId]))
    → prisma migrate dev --create-only --name <descriptive_name>
      (same generation path as #15; may touch disposable local DB only)
    → REQUIRED: review migration.sql (stop if unexpected DDL)
    → prisma migrate deploy  ← CI/production proof
       A) clean DB: applies #15 then #16
       B) DB already at #15: applies #16 only
    → run catalog + behavioral schema tests
```

Never rewrite the `#15` migration. Never treat apply-during-`migrate dev` as the production proof.

**ESLint:** perfectionist sort — object keys: `id` first where present, then A→Z.

---

## File map

| Path                                                                             | Responsibility                                                                     |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma`                                                  | `Purchase`: add `@@unique([flashSaleId, userId])`; remove `@@index([flashSaleId])` |
| `apps/api/prisma/migrations/<prisma-generated-timestamp>_<name>/migration.sql`   | Append-only DDL: drop non-unique index + add uniqueness (Prisma-generated name)    |
| `apps/api/prisma/migrations/20260727005938_init_flash_sale_schema/migration.sql` | **Immutable** — do not edit                                                        |
| `apps/api/test/schema/flash-sale-schema.spec.ts`                                 | Extend: catalog uniqueness + index absence; behavioral `P2002` + cross-pair        |
| `apps/api/jest.schema.config.cjs`                                                | Untouched (already covers `test/schema/**`)                                        |
| `apps/api/package.json`                                                          | Untouched (`test:schema`, `prisma:migrate:deploy` already exist)                   |
| `.github/workflows/ci.yml`                                                       | Untouched (reuse `schema-test` job)                                                |
| `packages/domain/**`                                                             | **Untouched**                                                                      |
| `apps/api/src/**`                                                                | Untouched (no repos/mappers/Nest modules)                                          |
| `docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md`         | Carry forward if still uncommitted local work; do not invent new docs              |
| `docs/superpowers/plans/2026-07-27-epic-02-unique-purchase-constraint.md`        | This plan (carry forward if uncommitted)                                           |

No GraphQL, Redis client, seed APIs, domain edits, or `ALREADY_PURCHASED` mapping.

---

## Task 0: Inspect working tree, verify baseline, create branch

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

1. **Intended `#16` docs** — e.g. umbrella spec `#16` contract and/or this plan under `docs/superpowers/`
2. **Unrelated uncommitted changes** — anything else

Rules:

- If **unrelated** uncommitted changes exist → **stop** and ask the operator to resolve them. Do **not** stash, reset, discard, or overwrite automatically.
- If only intended `#16` docs are dirty → **preserve** them (they should ride along onto the feature branch).
- Do **not** make `git switch main` mandatory. Switching to `main` is unnecessary when the current checkout is already based on the expected `#15` baseline (`origin/main` at/after `8e64323`) and can risk mixing unrelated local work.

- [ ] **Step 2: Verify `#15` baseline is available (without mandatory branch switch)**

From the current safe checkout (or after an operator-approved switch), confirm:

```bash
test -f apps/api/prisma/schema.prisma
test -d apps/api/prisma/migrations/20260727005938_init_flash_sale_schema
rg -n "@@index\(\[flashSaleId\]\)|@@unique|model Purchase" apps/api/prisma/schema.prisma
rg -n "purchases_flash_sale_id_idx" apps/api/prisma/migrations/20260727005938_init_flash_sale_schema/migration.sql
git log -1 --oneline origin/main
```

Expected:

- `origin/main` at/after `8e64323` (#15 merged)
- Tracked `schema.prisma` on the baseline has `Purchase` with `@@index([flashSaleId])` and **no** `@@unique`
- `#15` migration contains `CREATE INDEX "purchases_flash_sale_id_idx"`

If the working tree already has local `#16` schema edits, that is fine only after Task 0 completes and you are on the feature branch — do not confuse uncommitted implementation with the baseline check (prefer verifying baseline via `git show origin/main:apps/api/prisma/schema.prisma` when the working tree is dirty with docs only).

```bash
git show origin/main:apps/api/prisma/schema.prisma | rg -n "@@index\(\[flashSaleId\]\)|@@unique|model Purchase"
```

- [ ] **Step 3: Create feature branch from `origin/main` while carrying intended docs**

Only when Step 1 is safe:

```bash
# Preferred: create branch from origin/main; uncommitted intended docs stay in the working tree.
git switch -c feat/epic-02-unique-purchase-constraint origin/main
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Expected:

- On `feat/epic-02-unique-purchase-constraint` with `HEAD == origin/main` (commit)
- Intended `#16` docs still present as uncommitted (or already staged) files
- No unrelated dirty files

If the branch already exists → **stop and inspect** — do not use `git checkout -B`.

If current `HEAD` is already exactly `origin/main` and you are not on a named feature branch yet, `git switch -c feat/epic-02-unique-purchase-constraint` (without resetting) is also fine.

**Do not** run `git switch main` / `git pull` as a required step when it is unnecessary or unsafe.

- [ ] **Step 4: Confirm API quality + schema-test baseline on #15 schema**

Ensure Postgres is reachable (Compose or CI-equivalent), then:

```bash
cd /home/rex/Project/test/app
export DATABASE_URL="${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale}"
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:schema
```

Expected: PASS against `#15`-only schema (no uniqueness yet).

---

## Task 1: Write failing catalog tests for uniqueness + index replacement

**Files:**

- Modify: `apps/api/test/schema/flash-sale-schema.spec.ts`

- [ ] **Step 1: Add a helper + catalog tests for ordered unique columns and non-unique index absence**

Append (or insert before the final `});` of the describe) the following. Prefer keeping `#15` tests intact except where noted in Step 2.

Add imports if needed:

```ts
import { PrismaClient } from '@prisma/client';
```

(`PrismaClient` is already imported at the top of this file — do not duplicate.)

Add helper + tests inside the existing `describe('flash sale PostgreSQL schema (#15)', ...)` block **or** nest a new `describe('purchase uniqueness (#16)', () => { ... })` in the same file. Prefer a nested describe titled `purchase uniqueness (#16)` so ownership is obvious.

```ts
type PurchaseIndexRow = {
  columns: string[];
  index_name: string;
  is_unique: boolean;
};

async function listPurchaseIndexesByOrderedColumns(
  client: PrismaClient,
): Promise<PurchaseIndexRow[]> {
  // Intentional scope: public.purchases only (exclude other schemas/tables).
  // Unique constraints in PostgreSQL are backed by unique indexes; assert the
  // uniqueness invariant via pg_index metadata (ordered columns + indisunique),
  // not by constraint/index name and not by assuming constraint vs index type.
  const rows = await client.$queryRaw<
    { columns: string[]; index_name: string; is_unique: boolean }[]
  >`
    SELECT
      i.relname AS index_name,
      ix.indisunique AS is_unique,
      array_agg(a.attname ORDER BY ord.ordinality) AS columns
    FROM pg_class t
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS ord(attnum, ordinality)
      ON TRUE
    JOIN pg_attribute a
      ON a.attrelid = t.oid
     AND a.attnum = ord.attnum
    WHERE ns.nspname = 'public'
      AND t.relname = 'purchases'
      AND t.relkind = 'r'
      AND a.attnum > 0
    GROUP BY i.relname, ix.indisunique
    ORDER BY i.relname
  `;

  return rows;
}

describe('purchase uniqueness (#16)', () => {
  it('has a database-enforced unique invariant on ordered (flash_sale_id, user_id)', async () => {
    const indexes = await listPurchaseIndexesByOrderedColumns(prisma);

    expect(
      indexes.some(
        (idx) =>
          idx.is_unique &&
          idx.columns.length === 2 &&
          idx.columns[0] === 'flash_sale_id' &&
          idx.columns[1] === 'user_id',
      ),
    ).toBe(true);
  });

  it('removes the non-unique standalone (flash_sale_id) index', async () => {
    const indexes = await listPurchaseIndexesByOrderedColumns(prisma);

    expect(
      indexes.some(
        (idx) => !idx.is_unique && idx.columns.length === 1 && idx.columns[0] === 'flash_sale_id',
      ),
    ).toBe(false);
  });
});
```

**Do not** add a runtime catalog test asserting “no standalone `(user_id)` index exists.” That absolute property is broader than `#16`. Instead, Task 4’s SQL review gate must confirm `#16` does not create a standalone `(user_id)` index. Leave the existing `#15` `user_id` absence check in the FK-index test as historical `#15` coverage (do not expand its meaning into a new `#16` acceptance test).

- [ ] **Step 2: Tighten the existing #15 FK-index assertion so it stays valid after #16**

In the existing `defines Restrict foreign keys and FK indexes` test, keep the `flash_sale_id` presence check. Update the comment so maintainers do not “fix” it back to requiring a standalone index:

```ts
// The composite unique index from #16 covers flash_sale_id as its leftmost
// prefix, so this assertion verifies sale-scoped index coverage rather than
// requiring a standalone flash_sale_id index.
expect(
  indexes.some((idx) => idx.tablename === 'purchases' && idx.indexdef.includes('flash_sale_id')),
).toBe(true);
```

Do **not** require the old index name `purchases_flash_sale_id_idx` to remain.

- [ ] **Step 3: Run catalog uniqueness tests and confirm they fail on #15 schema**

```bash
cd /home/rex/Project/test/app
export DATABASE_URL="${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale}"
pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:schema
```

Expected: FAIL — uniqueness on `(flash_sale_id, user_id)` absent; and/or non-unique `(flash_sale_id)` index still present.

- [ ] **Step 4: Optional checkpoint commit (only if authorized)**

```bash
git add apps/api/test/schema/flash-sale-schema.spec.ts
git commit -m "$(cat <<'EOF'
test: add failing purchase uniqueness catalog assertions

EOF
)"
```

---

## Task 2: Write failing behavioral tests (P2002 + composite cross-pair)

**Files:**

- Modify: `apps/api/test/schema/flash-sale-schema.spec.ts`

- [ ] **Step 1: Add behavioral tests inside `describe('purchase uniqueness (#16)', ...)`**

Prove both:

1. Repeated **exact** pair `(flashSaleId = X, userId = Y)` → first succeeds, second fails with Prisma `P2002`.
2. The constraint is **composite**: different users may purchase the same flash sale, while the same user cannot purchase the same flash sale twice. Include both cross-pair successes:
   - `(X, Z)` succeeds (different user, same sale)
   - `(W, Y)` succeeds (same user, different sale)

Use `PrismaClient` directly. `#15` schema tests are catalog-only (no row inserts / isolation pattern). For `#16` behavioral inserts, use **per-run unique IDs** (`crypto.randomUUID()` suffixes) so a crashed prior run cannot collide, and always clean up in `finally` (reverse FK order). Suite already runs `--runInBand`.

```ts
it('rejects a duplicate (flashSaleId, userId) pair with Prisma P2002', async () => {
  const suffix = crypto.randomUUID();
  const productId = `product-unique-${suffix}`;
  const flashSaleId = `sale-unique-${suffix}`;
  const purchaseId1 = `purchase-1-${suffix}`;
  const purchaseId2 = `purchase-2-${suffix}`;
  const userId = `user-y-${suffix}`;
  const now = new Date('2026-07-27T12:00:00.000Z');

  await prisma.product.create({
    data: {
      id: productId,
      name: 'Unique Constraint Product',
      updatedAt: now,
    },
  });

  await prisma.flashSale.create({
    data: {
      endsAt: new Date('2026-07-27T14:00:00.000Z'),
      id: flashSaleId,
      productId,
      remainingStock: 10,
      startsAt: new Date('2026-07-27T10:00:00.000Z'),
      totalStock: 10,
      updatedAt: now,
    },
  });

  await prisma.purchase.create({
    data: {
      flashSaleId,
      id: purchaseId1,
      purchasedAt: now,
      updatedAt: now,
      userId,
    },
  });

  try {
    await expect(
      prisma.purchase.create({
        data: {
          flashSaleId,
          id: purchaseId2,
          purchasedAt: now,
          updatedAt: now,
          userId,
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });
  } finally {
    await prisma.purchase.deleteMany({
      where: { id: { in: [purchaseId1, purchaseId2] } },
    });
    await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
});

it('allows different users on the same sale and the same user on a different sale', async () => {
  const suffix = crypto.randomUUID();
  const productId = `product-unique-${suffix}`;
  const flashSaleX = `sale-unique-x-${suffix}`;
  const flashSaleW = `sale-unique-w-${suffix}`;
  const purchaseXy = `purchase-xy-${suffix}`;
  const purchaseXz = `purchase-xz-${suffix}`;
  const purchaseWy = `purchase-wy-${suffix}`;
  const userY = `user-y-${suffix}`;
  const userZ = `user-z-${suffix}`;
  const now = new Date('2026-07-27T12:00:00.000Z');

  await prisma.product.create({
    data: {
      id: productId,
      name: 'Composite Unique Product',
      updatedAt: now,
    },
  });

  await prisma.flashSale.createMany({
    data: [
      {
        endsAt: new Date('2026-07-27T14:00:00.000Z'),
        id: flashSaleX,
        productId,
        remainingStock: 10,
        startsAt: new Date('2026-07-27T10:00:00.000Z'),
        totalStock: 10,
        updatedAt: now,
      },
      {
        endsAt: new Date('2026-07-27T15:00:00.000Z'),
        id: flashSaleW,
        productId,
        remainingStock: 5,
        startsAt: new Date('2026-07-27T11:00:00.000Z'),
        totalStock: 5,
        updatedAt: now,
      },
    ],
  });

  try {
    await expect(
      prisma.purchase.create({
        data: {
          flashSaleId: flashSaleX,
          id: purchaseXy,
          purchasedAt: now,
          updatedAt: now,
          userId: userY,
        },
      }),
    ).resolves.toBeTruthy();

    // Different user, same flash sale — must succeed (not UNIQUE(flash_sale_id)).
    await expect(
      prisma.purchase.create({
        data: {
          flashSaleId: flashSaleX,
          id: purchaseXz,
          purchasedAt: now,
          updatedAt: now,
          userId: userZ,
        },
      }),
    ).resolves.toBeTruthy();

    // Same user, different flash sale — must succeed (not UNIQUE(user_id)).
    await expect(
      prisma.purchase.create({
        data: {
          flashSaleId: flashSaleW,
          id: purchaseWy,
          purchasedAt: now,
          updatedAt: now,
          userId: userY,
        },
      }),
    ).resolves.toBeTruthy();
  } finally {
    await prisma.purchase.deleteMany({
      where: { id: { in: [purchaseXy, purchaseXz, purchaseWy] } },
    });
    await prisma.flashSale.deleteMany({
      where: { id: { in: [flashSaleX, flashSaleW] } },
    });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
});
```

Notes:

- Object keys follow ESLint perfectionist (`id` first where present, then A→Z). Adjust locally if the linter requires a different key order for Prisma `data` objects — prefer satisfying ESLint over the illustrative order above.
- Assert `code: 'P2002'` only — do not assert `ALREADY_PURCHASED` or repository/application error types.
- `updatedAt` is set explicitly because Prisma requires it on create when there is no DB default for `@updatedAt` beyond client middleware (match whatever `#15` / Prisma client behavior requires; if create works without `updatedAt`, omit it consistently).
- Node’s global `crypto.randomUUID()` is available on the CI Node version; no new dependency.

- [ ] **Step 2: Run behavioral tests and confirm failure mode on #15 schema**

```bash
pnpm --filter api test:schema
```

Expected: FAIL —

- Duplicate insert **succeeds** (no uniqueness yet), so `rejects.toMatchObject({ code: 'P2002' })` fails, **and/or**
- Catalog uniqueness assertions from Task 1 still fail

Cross-pair successes may already pass on `#15` (no uniqueness). That is OK — the duplicate `P2002` case is the failing behavioral proof until the migration lands.

- [ ] **Step 3: Optional checkpoint commit (only if authorized)**

```bash
git add apps/api/test/schema/flash-sale-schema.spec.ts
git commit -m "$(cat <<'EOF'
test: add failing purchase uniqueness behavioral assertions

EOF
)"
```

---

## Task 3: Update `schema.prisma` (unique replaces non-unique index)

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Change only the `Purchase` model index/unique declarations**

Replace the `Purchase` model with the approved `#16` end state (Product / FlashSale unchanged):

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

Confirm there is **no** `@@index([flashSaleId])` on `Purchase`.

- [ ] **Step 2: Validate schema + generate client**

```bash
cd /home/rex/Project/test/app
export DATABASE_URL="${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale}"
pnpm --filter api exec prisma validate
pnpm --filter api prisma:generate
rg -n "@@unique|@@index" apps/api/prisma/schema.prisma
```

Expected:

- validate OK; client generates
- `Purchase` shows `@@unique([flashSaleId, userId])`
- `FlashSale` still has `@@index([productId])`
- **No** `@@index([flashSaleId])` anywhere

- [ ] **Step 3: Optional checkpoint commit (only if authorized)**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat: add Purchase composite unique constraint in Prisma schema

EOF
)"
```

---

## Task 4: Generate one append-only migration + REQUIRED SQL review gate

**Files:**

- Create: `apps/api/prisma/migrations/<prisma-generated-timestamp>_<name>/migration.sql`
- Do **not** modify: `apps/api/prisma/migrations/20260727005938_init_flash_sale_schema/**`

- [ ] **Step 1: Create migration SQL using the same `#15` generation path**

Use the established `#15` command shape (`prisma migrate dev --create-only`). Notes:

- `--create-only` generates the migration directory/SQL; Prisma may still inspect / drift-check / interact with the **disposable local development** database. That is acceptable **only** against local/dev DB.
- Do **not** treat any apply performed during `migrate dev` as CI/production proof. The next steps’ `migrate deploy` runs are the deployment-path validation.

```bash
cd /home/rex/Project/test/app
export DATABASE_URL="${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale}"
pnpm --filter api exec prisma migrate dev --create-only --name purchase_flash_sale_user_unique
```

Expected: exactly **one** new directory under `apps/api/prisma/migrations/` besides `20260727005938_init_flash_sale_schema` and `migration_lock.toml`.

```bash
ls apps/api/prisma/migrations
```

- [ ] **Step 2: REQUIRED SQL review gate — stop on unexpected DDL**

**Expected migration scope:**

```text
- Drop the existing non-unique flash_sale_id index on purchases.
- Add the composite unique constraint/invariant on ordered (flash_sale_id, user_id).
- No unrelated table, column, foreign key, CHECK, or index changes
  (including: no standalone user_id index created by #16).
```

Open the new `migration.sql` and verify it matches **only** that scope:

1. Drops the non-unique index `purchases_flash_sale_id_idx` (or equivalent drop of the non-unique `(flash_sale_id)` index from `#15`).
2. Adds a database-enforced uniqueness invariant on ordered columns `(flash_sale_id, user_id)` — typically `CREATE UNIQUE INDEX "purchases_flash_sale_id_user_id_key" ON "purchases"("flash_sale_id", "user_id");` and/or an equivalent unique constraint. Either PostgreSQL representation is acceptable; column order must be `flash_sale_id` then `user_id`.
3. **No** unrelated `CREATE TABLE` / `ALTER TABLE` column changes / FK changes / CHECK changes / other indexes — including **no** `CREATE INDEX` / unique on `(user_id)` alone.

Illustrative acceptable shape (names may vary slightly; **column order must not**):

```sql
-- DropIndex
DROP INDEX "purchases_flash_sale_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "purchases_flash_sale_id_user_id_key" ON "purchases"("flash_sale_id", "user_id");
```

**Stop conditions (do not apply / do not continue):**

- `#15` migration file was modified
- Column order is `(user_id, flash_sale_id)`
- Non-unique `(flash_sale_id)` index is **not** dropped
- A standalone `(user_id)` index is created
- Unrelated tables/columns/FKs/CHECKs appear
- More than one new migration directory was created

If Prisma output is wrong: delete the bad migration directory, fix `schema.prisma`, regenerate — never hand-edit `#15`.

- [ ] **Step 3: Validate deploy path A — clean database applies `#15` then `#16`**

Reset/recreate a disposable local database (Compose volume reset or equivalent), then:

```bash
pnpm --filter api prisma:migrate:deploy
pnpm --filter api prisma:generate
pnpm --filter api exec prisma migrate status
```

Expected: both migrations applied in order (`#15` then `#16`); status shows all applied.

- [ ] **Step 4: Validate deploy path B — database already at `#15` applies `#16` only**

On a disposable DB that has **only** `#15` applied (restore from a `#15`-only state, or temporarily remove the `#16` migration directory from a copy DB’s history — prefer: apply `#15` on a fresh DB, stop before `#16` is present in the migrations folder is wrong; better approach):

Practical local procedure:

1. Fresh disposable DB.
2. Temporarily move the new `#16` migration directory out of `prisma/migrations/`.
3. `pnpm --filter api prisma:migrate:deploy` → only `#15` applied.
4. Move the `#16` migration directory back.
5. `pnpm --filter api prisma:migrate:deploy` → applies **only** `#16`.

```bash
pnpm --filter api exec prisma migrate status
```

Expected after step 5: both applied; the second deploy applied exactly one pending migration (`#16`).

CI’s `schema-test` job (fresh Postgres + full `migrate deploy`) covers path A. Path B is a **required local verification** for append-only correctness after `#15` already shipped.

- [ ] **Step 5: Optional checkpoint commit (only if authorized)**

```bash
git add apps/api/prisma/migrations
git commit -m "$(cat <<'EOF'
feat: migrate Purchase unique (flash_sale_id, user_id) constraint

EOF
)"
```

---

## Task 5: Make schema tests pass + quality gates

**Files:**

- Possibly tweak: `apps/api/test/schema/flash-sale-schema.spec.ts` (only if ESLint key order / Prisma create shape needs fixes)

- [ ] **Step 1: Run schema tests**

```bash
cd /home/rex/Project/test/app
export DATABASE_URL="${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale}"
pnpm --filter api test:schema
```

Expected: PASS —

- Catalog: database-enforced unique invariant on ordered `(flash_sale_id, user_id)` present
- Catalog: non-unique standalone `(flash_sale_id)` absent
- Behavioral: exact pair `(X,Y)` then duplicate `(X,Y)` → `P2002`
- Behavioral: composite — `(X,Z)` and `(W,Y)` succeed
- Existing `#15` catalog tests still pass

- [ ] **Step 2: Run workspace quality gates for api**

```bash
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter @flash-sale/domain test
```

Expected: PASS. Domain package unchanged (tests still pass as baseline).

- [ ] **Step 3: Confirm out-of-scope surfaces untouched**

```bash
git diff --stat origin/main
rg -n "ALREADY_PURCHASED|assertUniquePurchase|@@index\(\[userId\]\)" apps/api packages/domain || true
rg -n "model Purchase|@@unique|@@index" apps/api/prisma/schema.prisma
git diff origin/main -- apps/api/prisma/migrations/20260727005938_init_flash_sale_schema
```

Expected:

- Diff limited to Prisma schema/migration + schema tests (+ carried docs if present)
- `Purchase` has `@@unique([flashSaleId, userId])` only (no `@@index([flashSaleId])`)
- `#15` migration directory unchanged vs `origin/main` (empty diff)

- [ ] **Step 4: Optional final checkpoint commit (only if authorized)**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/test/schema/flash-sale-schema.spec.ts
# include docs only if they are part of this ticket's delivery and user asked to commit
git commit -m "$(cat <<'EOF'
feat: enforce unique purchase per flash sale and user

EOF
)"
```

---

## Task 6: Definition of Done checklist

- [ ] `schema.prisma` has `@@unique([flashSaleId, userId])` and no `@@index([flashSaleId])` on `Purchase`
- [ ] Exactly one new append-only migration after `#15`; SQL reviewed and accepted (drop non-unique `(flash_sale_id)` index + uniqueness on `(flash_sale_id, user_id)` only; no standalone `(user_id)` index in `#16` SQL)
- [ ] `#15` migration immutable
- [ ] Deploy path A verified (clean DB → `#15` then `#16`) and path B verified (existing `#15` → `#16` only)
- [ ] Catalog tests prove a database-enforced unique invariant on ordered `(flash_sale_id, user_id)` and absence of standalone non-unique `(flash_sale_id)` index
- [ ] Behavioral: repeated exact pair → Prisma `P2002`; composite proven (different user same sale succeeds; same user different sale succeeds)
- [ ] No `ALREADY_PURCHASED` mapping; no repos/mappers; no GraphQL; no Redis; no domain package changes; persistence semantics unchanged from `#15`
- [ ] Existing CI `schema-test` job path remains valid (`migrate deploy` + `test:schema`) — no new job required
- [ ] `pnpm --filter api lint|typecheck|test|test:schema` pass
- [ ] Commits (if any were authorized) use `<type>: <MESSAGE>` with **no** `Co-authored-by`

---

## Spec coverage (self-review)

| Spec requirement                                       | Plan task                                              |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `@@unique([flashSaleId, userId])`                      | Task 3                                                 |
| Remove `@@index([flashSaleId])`                        | Task 3 + Task 4 SQL review                             |
| One append-only migration; `#15` immutable             | Task 4                                                 |
| Required SQL review gate / expected migration scope    | Task 4 Step 2                                          |
| No standalone `(user_id)` index introduced by `#16`    | Task 4 Step 2 (SQL review; not a runtime catalog test) |
| Catalog by ordered columns + uniqueness metadata       | Task 1                                                 |
| Catalog scoped to `public.purchases`                   | Task 1 helper                                          |
| No generated-name primary identification               | Task 1 helper                                          |
| Behavioral `P2002` on repeated exact pair              | Task 2                                                 |
| Composite cross-pair proof                             | Task 2                                                 |
| Clean DB + existing-`#15` deploy validation            | Task 4 Steps 3–4                                       |
| Reuse `schema-test` CI                                 | File map + Task 6                                      |
| Persistence semantics unchanged from `#15`             | Task 3 (schema-only index change)                      |
| Out-of-scope (repos/GraphQL/Redis/`ALREADY_PURCHASED`) | Goal + File map + Task 6                               |

**Placeholder scan:** none intentionally left.

**Type consistency:** Prisma model field names `flashSaleId` / `userId`; SQL columns `flash_sale_id` / `user_id`; error code `P2002`.
