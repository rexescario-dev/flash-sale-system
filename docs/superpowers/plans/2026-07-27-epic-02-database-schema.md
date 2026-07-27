# EPIC-02 #15 — Database Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#15](https://github.com/rexescario-dev/flash-sale-system/issues/15) by adding PostgreSQL/Prisma persistence for `Product`, `FlashSale`, and `Purchase` in `apps/api` — domain-aligned columns, snake_case maps, `timestamptz(3)`, app-supplied `String @id`, explicit `onDelete: Restrict`, FK indexes, named FlashSale CHECK constraints via one new edited migration, catalog-level schema tests, and a dedicated CI Postgres job — with no GraphQL, Redis client, repositories, mappers, purchase uniqueness, or domain package changes.

**Architecture:** Prisma-first schema in `apps/api/prisma/schema.prisma`. Generate exactly one new migration directory with Prisma (Prisma-generated timestamped name; must be the only new migration added relative to `origin/main`), then manually add four named CHECK constraints that Prisma cannot express. Verify the committed migration artifact with `prisma migrate deploy` against a clean database (same path CI will use). Schema tests inspect `information_schema` / `pg_catalog` only — no repository round-trips.

**Tech Stack:** Prisma 6, PostgreSQL 16 (Compose), NestJS `apps/api` (PrismaModule already present), Jest + ts-jest, GitHub Actions, pnpm + Turborepo.

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md) (`#15 — Implement database schema`)

**Authority:** The approved umbrella `#15` contract is authoritative. This plan operationalizes it and must **not** alter its contract. Do not invent requirements.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Critical migration workflow (do not skip):**

```text
Write schema.prisma
    → prisma migrate dev --create-only
    → manually add 4 named CHECKs to migration.sql
    → reset to a clean database
    → prisma migrate deploy
    → run schema catalog tests
```

Never rely only on `migrate dev` apply-during-generation as the proof that CI/production will work.

---

## File map

| Path                                                                                           | Responsibility                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma`                                                                | Product / FlashSale / Purchase models + maps + Restrict + indexes + Timestamptz(3)                      |
| `apps/api/prisma/migrations/<prisma-generated-timestamp>_init_flash_sale_schema/migration.sql` | Generated DDL + manually named CHECKs (directory name is Prisma-generated; do not invent the timestamp) |
| `apps/api/test/schema/flash-sale-schema.spec.ts`                                               | Catalog-level schema verification                                                                       |
| `apps/api/jest.schema.config.cjs`                                                              | Jest config for `test/schema/**` (unit Jest stays `src/`-rooted)                                        |
| `apps/api/package.json`                                                                        | Add `prisma:migrate:deploy`, `test:schema`                                                              |
| `.github/workflows/ci.yml`                                                                     | Add dedicated `schema-test` job                                                                         |
| `packages/domain/**`                                                                           | **Untouched**                                                                                           |
| `apps/api/src/**`                                                                              | Untouched (no repos/mappers/Nest modules for #15)                                                       |

No uniqueness constraint, GraphQL resolvers, Redis client, seed data, or domain edits.

---

## Task 0: Sync baseline and create branch

**Files:** none (git only)

- [ ] **Step 1: Inspect working tree before any branch switch**

```bash
cd /home/rex/Project/test/app
git status --short
git status -sb
```

Expected: note any uncommitted files first.

**Working-tree / docs guard (mandatory):**

- If uncommitted changes exist, **stop and inspect**; do **not** stash, reset, discard, or overwrite them automatically.
- If the working tree contains the finalized `#15` spec and/or this plan, **preserve those changes**. Do not lose them when switching branches.
- Prefer creating the feature branch while carrying those docs forward (e.g. create branch from current HEAD / `origin/main` without discarding local doc edits), or explicitly move/cherry-pick the doc files onto the feature branch after inspecting status.

- [ ] **Step 2: Sync `origin/main` and verify #14 baseline (only after Step 1 is safe)**

```bash
cd /home/rex/Project/test/app
git fetch origin
# Only switch to main if Step 1 confirmed it is safe (no unprotected local work to lose).
git switch main
git pull --ff-only origin main
git status -sb
git rev-parse HEAD
test -f apps/api/prisma/schema.prisma
test -f packages/domain/src/flash-sale/flash-sale.ts
rg -n "model Product|model FlashSale|model Purchase" apps/api/prisma/schema.prisma || true
rg -n "getStatus|FlashSaleStatus" packages/domain/src/flash-sale/flash-sale.ts
```

Expected:

- On `main` tracking `origin/main` (at/after `350dedf` with #14 merged)
- `schema.prisma` exists with generator + datasource only (no Product/FlashSale/Purchase models yet)
- Domain `getStatus` / `FlashSaleStatus` present from #14
- **Docs handling:** If the finalized `#15` spec/plan is already in the working tree, preserve it. Do **not** invent extra documentation.

- [ ] **Step 3: Create feature branch (do not reset an existing branch)**

```bash
git switch -c feat/epic-02-database-schema origin/main
```

Expected: on `feat/epic-02-database-schema` from `origin/main`.

If the branch already exists, **stop and inspect** — do not use `git checkout -B`.

- [ ] **Step 4: Confirm API + domain quality baseline**

```bash
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter @flash-sale/domain test
```

Expected: PASS (existing unit tests; schema tests do not exist yet).

---

## Task 1: Write Prisma models in `schema.prisma`

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Replace `schema.prisma` with the approved #15 contract**

Keep the existing generator/datasource; add the three models exactly as specified (no `@default` on ids, no `status`, no `@@unique`):

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

- [ ] **Step 2: Validate schema + generate client**

```bash
cd /home/rex/Project/test/app
export DATABASE_URL="${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale}"
pnpm --filter api exec prisma validate
pnpm --filter api prisma:generate
```

Expected: validate OK; client generates. Confirm no `@@unique` and no `status` field:

```bash
rg -n "@@unique|status" apps/api/prisma/schema.prisma || true
```

Expected: no matches (or only unrelated comments — there should be none).

- [ ] **Step 3: Optional checkpoint commit (only if authorized)**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat: add Product FlashSale Purchase Prisma models

EOF
)"
```

---

## Task 2: Create migration, add named CHECKs, verify with `migrate deploy`

**Files:**

- Create: `apps/api/prisma/migrations/<prisma-generated-timestamp>_init_flash_sale_schema/migration.sql`
- Modify: `apps/api/package.json` (add `prisma:migrate:deploy` if not already present)

- [ ] **Step 1: Ensure Postgres is up**

```bash
cd /home/rex/Project/test/app
docker compose up -d postgres
docker compose ps
```

Expected: `postgres` healthy (or running and accepting connections).

- [ ] **Step 2: Generate migration SQL only (do not treat this apply as final proof)**

Generate exactly one new migration directory with Prisma. The migration directory name must be **Prisma-generated** (do not invent or hand-edit the timestamp prefix) and must be the **only new migration directory added relative to `origin/main`**.

```bash
# All path comparisons run from the repo root to avoid cwd mismatches.
cd /home/rex/Project/test/app
export DATABASE_URL="${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale}"

# Before generating: list migration directories already on origin/main (may be empty).
git ls-tree -d --name-only origin/main -- apps/api/prisma/migrations || true

# Create-only from apps/api via pnpm filter (still keep shell cwd at repo root).
pnpm --filter api exec prisma migrate dev --create-only --name init_flash_sale_schema

# After generating: compare directory basenames relative to origin/main.
# Left side = basenames already on origin/main; right side = local migration dirs.
comm -13 \
  <(git ls-tree -d --name-only origin/main -- apps/api/prisma/migrations \
      | xargs -r -n1 basename | sort -u) \
  <(find apps/api/prisma/migrations -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
```

Expected:

- `comm -13` prints **exactly one** basename: `<prisma-timestamp>_init_flash_sale_schema`
- Directory name timestamp is Prisma-generated (do not invent or rename it)
- That directory is the **only** new migration directory relative to `origin/main`
- It contains `migration.sql` with `CREATE TABLE` for `products`, `flash_sales`, `purchases`, FKs, and indexes
- **Do not stop here** — CHECKs still need to be added, then verify via clean-DB `migrate deploy`

- [ ] **Step 3: Manually add the four named CHECK constraints**

Edit the Prisma-generated `apps/api/prisma/migrations/<prisma-generated-timestamp>_init_flash_sale_schema/migration.sql` (use the actual directory Prisma created).

Preferred: add the constraints inside the `flash_sales` `CREATE TABLE` (or as `ALTER TABLE "flash_sales" ADD CONSTRAINT ...` immediately after that table is created). Exact Prisma-generated SQL varies; the committed file **must** include these four names and expressions:

```sql
CONSTRAINT "flash_sales_total_stock_positive"
  CHECK ("total_stock" > 0),

CONSTRAINT "flash_sales_remaining_stock_non_negative"
  CHECK ("remaining_stock" >= 0),

CONSTRAINT "flash_sales_remaining_stock_lte_total"
  CHECK ("remaining_stock" <= "total_stock"),

CONSTRAINT "flash_sales_starts_before_ends"
  CHECK ("starts_at" < "ends_at")
```

If using `ALTER TABLE` form instead:

```sql
ALTER TABLE "flash_sales"
  ADD CONSTRAINT "flash_sales_total_stock_positive"
  CHECK ("total_stock" > 0);

ALTER TABLE "flash_sales"
  ADD CONSTRAINT "flash_sales_remaining_stock_non_negative"
  CHECK ("remaining_stock" >= 0);

ALTER TABLE "flash_sales"
  ADD CONSTRAINT "flash_sales_remaining_stock_lte_total"
  CHECK ("remaining_stock" <= "total_stock");

ALTER TABLE "flash_sales"
  ADD CONSTRAINT "flash_sales_starts_before_ends"
  CHECK ("starts_at" < "ends_at");
```

**Preservation rule:** never delete/regenerate/squash/replace this migration without reintroducing these named CHECKs.

**Purchase uniqueness (human migration review — not a runtime “absent” test):**

- `#15` `schema.prisma` must not contain `@@unique([flashSaleId, userId])` (purchase uniqueness is owned by `#16`).
- Review the generated `migration.sql` and confirm it does **not** introduce a unique constraint/index on `(flash_sale_id, user_id)`.
- Do **not** rely on a broad `rg UNIQUE` scan as the acceptance gate (false positives are possible); rely on schema review + the `#16` positive uniqueness test later.

- [ ] **Step 4: Add `prisma:migrate:deploy` script**

In `apps/api/package.json` scripts, ensure:

```json
"prisma:migrate:deploy": "prisma migrate deploy",
"prisma:migrate": "prisma migrate dev"
```

Keep existing `prisma:generate` / `prisma:migrate` behavior.

- [ ] **Step 5: Verify the final migration artifact on a clean database**

Reset Postgres volumes so history is empty, then deploy:

```bash
cd /home/rex/Project/test/app
docker compose down -v
docker compose up -d postgres
# wait until healthy
until docker compose exec -T postgres pg_isready -U flash_sale -d flash_sale; do sleep 1; done

export DATABASE_URL="${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale}"
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate:deploy
```

Expected: migrate deploy applies the single new migration successfully with no drift errors.

Spot-check named constraints exist:

```bash
docker compose exec -T postgres psql -U flash_sale -d flash_sale -c \
  "SELECT conname FROM pg_constraint WHERE contype = 'c' AND conrelid = 'flash_sales'::regclass ORDER BY conname;"
```

Expected rows include:

- `flash_sales_total_stock_positive`
- `flash_sales_remaining_stock_non_negative`
- `flash_sales_remaining_stock_lte_total`
- `flash_sales_starts_before_ends`

Also confirm the migration SQL introduces **no** `updated_at` trigger/function (Option B — migration/schema review only; no runtime trigger catalog test required):

```bash
cd /home/rex/Project/test/app
rg -ni "create trigger|create function|create or replace function" \
  apps/api/prisma/migrations/*_init_flash_sale_schema/migration.sql || true
```

Expected:

- **No** `CREATE TRIGGER` / `CREATE FUNCTION` / `CREATE OR REPLACE FUNCTION` for maintaining `updated_at`
- `updated_at` may appear as a normal column in `CREATE TABLE` DDL (NOT NULL / type), which is fine
- Do **not** confuse Prisma Client `@updatedAt` with a PostgreSQL `DEFAULT` that auto-bumps on every update — there is **no** DB-level auto-update mechanism. `@updatedAt` is **Prisma Client behavior only**; raw SQL / `updateMany` paths must set `updated_at` explicitly if audit semantics require it (`#19`–`#20`)

- [ ] **Step 6: Optional checkpoint commit (only if authorized)**

```bash
git add apps/api/prisma/migrations apps/api/package.json
git commit -m "$(cat <<'EOF'
feat: add flash sale schema migration with named checks

EOF
)"
```

---

## Task 3: Schema catalog tests + `test:schema`

**Files:**

- Create: `apps/api/jest.schema.config.cjs`
- Create: `apps/api/test/schema/flash-sale-schema.spec.ts`
- Modify: `apps/api/package.json`

Existing `apps/api/jest.config.cjs` keeps `rootDir: 'src'` for unit tests. Schema tests live under `test/schema/` with a separate config so `pnpm test` stays DB-independent.

- [ ] **Step 1: Add Jest schema config**

Create `apps/api/jest.schema.config.cjs`:

```js
process.env.NODE_ENV = 'test';

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/schema/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 30_000,
};
```

- [ ] **Step 2: Add `test:schema` script**

In `apps/api/package.json` scripts:

```json
"test:schema": "DATABASE_URL=${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale} jest --config jest.schema.config.cjs --runInBand"
```

- [ ] **Step 3: Write catalog schema tests**

Create `apps/api/test/schema/flash-sale-schema.spec.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale';

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

type ColumnRow = {
  column_name: string;
  data_type: string;
  datetime_precision: number | null;
  is_nullable: 'YES' | 'NO';
};

describe('flash sale PostgreSQL schema (#15)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates products, flash_sales, and purchases tables', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('products', 'flash_sales', 'purchases')
      ORDER BY table_name
    `;

    expect(tables.map((row) => row.table_name)).toEqual(['flash_sales', 'products', 'purchases']);
  });

  it('defines id primary keys on all three tables', async () => {
    const keys = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_name IN ('products', 'flash_sales', 'purchases')
      ORDER BY tc.table_name
    `;

    expect(keys).toEqual([
      { table_name: 'flash_sales', column_name: 'id' },
      { table_name: 'products', column_name: 'id' },
      { table_name: 'purchases', column_name: 'id' },
    ]);
  });

  it('stores id columns as text with no database default', async () => {
    const idColumns = await prisma.$queryRaw<
      {
        table_name: string;
        column_name: string;
        data_type: string;
        column_default: string | null;
      }[]
    >`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('products', 'flash_sales', 'purchases')
        AND column_name = 'id'
      ORDER BY table_name
    `;

    expect(idColumns).toEqual([
      {
        table_name: 'flash_sales',
        column_name: 'id',
        data_type: 'text',
        column_default: null,
      },
      {
        table_name: 'products',
        column_name: 'id',
        data_type: 'text',
        column_default: null,
      },
      {
        table_name: 'purchases',
        column_name: 'id',
        data_type: 'text',
        column_default: null,
      },
    ]);
  });

  it('exposes exact snake_case physical column sets (no unexpected columns)', async () => {
    const columns = await prisma.$queryRaw<
      { table_name: string; column_name: string; is_nullable: 'YES' | 'NO' }[]
    >`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('products', 'flash_sales', 'purchases')
      ORDER BY table_name, column_name
    `;

    const byTable = (table: string) =>
      columns
        .filter((row) => row.table_name === table)
        .map((row) => ({ column_name: row.column_name, is_nullable: row.is_nullable }));

    expect(byTable('products')).toEqual([
      { column_name: 'created_at', is_nullable: 'NO' },
      { column_name: 'description', is_nullable: 'YES' },
      { column_name: 'id', is_nullable: 'NO' },
      { column_name: 'name', is_nullable: 'NO' },
      { column_name: 'updated_at', is_nullable: 'NO' },
    ]);

    expect(byTable('flash_sales')).toEqual([
      { column_name: 'created_at', is_nullable: 'NO' },
      { column_name: 'ends_at', is_nullable: 'NO' },
      { column_name: 'id', is_nullable: 'NO' },
      { column_name: 'product_id', is_nullable: 'NO' },
      { column_name: 'remaining_stock', is_nullable: 'NO' },
      { column_name: 'starts_at', is_nullable: 'NO' },
      { column_name: 'total_stock', is_nullable: 'NO' },
      { column_name: 'updated_at', is_nullable: 'NO' },
    ]);

    expect(byTable('purchases')).toEqual([
      { column_name: 'created_at', is_nullable: 'NO' },
      { column_name: 'flash_sale_id', is_nullable: 'NO' },
      { column_name: 'id', is_nullable: 'NO' },
      { column_name: 'purchased_at', is_nullable: 'NO' },
      { column_name: 'updated_at', is_nullable: 'NO' },
      { column_name: 'user_id', is_nullable: 'NO' },
    ]);
  });

  it('stores all timestamps as timestamptz with precision 3', async () => {
    const timestampColumns = await prisma.$queryRaw<ColumnRow[]>`
      SELECT table_name, column_name, data_type, datetime_precision, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('products', 'flash_sales', 'purchases')
        AND column_name IN (
          'created_at', 'updated_at', 'starts_at', 'ends_at', 'purchased_at'
        )
      ORDER BY table_name, column_name
    `;

    expect(timestampColumns.length).toBeGreaterThan(0);
    for (const column of timestampColumns) {
      expect(column.data_type).toBe('timestamp with time zone');
      expect(column.datetime_precision).toBe(3);
    }
  });

  it('defines Restrict foreign keys and FK indexes', async () => {
    const foreignKeys = await prisma.$queryRaw<
      {
        constraint_name: string;
        table_name: string;
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
        delete_rule: string;
      }[]
    >`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
       AND rc.constraint_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('flash_sales', 'purchases')
      ORDER BY tc.table_name, kcu.column_name
    `;

    expect(foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: 'flash_sales',
          column_name: 'product_id',
          foreign_table_name: 'products',
          foreign_column_name: 'id',
          delete_rule: 'RESTRICT',
        }),
        expect.objectContaining({
          table_name: 'purchases',
          column_name: 'flash_sale_id',
          foreign_table_name: 'flash_sales',
          foreign_column_name: 'id',
          delete_rule: 'RESTRICT',
        }),
      ]),
    );

    const indexes = await prisma.$queryRaw<
      { tablename: string; indexname: string; indexdef: string }[]
    >`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('flash_sales', 'purchases')
    `;

    expect(
      indexes.some((idx) => idx.tablename === 'flash_sales' && idx.indexdef.includes('product_id')),
    ).toBe(true);
    expect(
      indexes.some(
        (idx) => idx.tablename === 'purchases' && idx.indexdef.includes('flash_sale_id'),
      ),
    ).toBe(true);

    // #15 contract: no standalone purchases(user_id) index (composite unique is #16).
    expect(
      indexes.some(
        (idx) => idx.tablename === 'purchases' && /\(\s*user_id\s*\)/.test(idx.indexdef),
      ),
    ).toBe(false);
  });

  it('defines the four named FlashSale CHECK constraints', async () => {
    // Umbrella #15 contract asserts CHECK constraints by name (not by pg expression text).
    const checks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'c'
        AND conrelid = 'public.flash_sales'::regclass
      ORDER BY conname
    `;

    const names = checks.map((row) => row.conname);
    expect(names).toEqual(
      expect.arrayContaining([
        'flash_sales_total_stock_positive',
        'flash_sales_remaining_stock_non_negative',
        'flash_sales_remaining_stock_lte_total',
        'flash_sales_starts_before_ends',
      ]),
    );
  });
});
```

Do **not** add a runtime test that uniqueness is absent; `#16` owns the positive uniqueness test. Do **not** insert business rows or call domain mappers. CHECK expression text is **not** required by the umbrella catalog contract (names are authoritative); the migration SQL still must contain the four intended `CHECK (...)` expressions when authored in Task 2.

- [ ] **Step 4: Run schema tests against the deployed DB**

```bash
cd /home/rex/Project/test/app
export DATABASE_URL="${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale}"
pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:schema
```

Expected: PASS.

Also confirm unit tests still ignore schema tests:

```bash
pnpm --filter api test
```

Expected: PASS; does not require Postgres beyond existing Nest unit behavior.

- [ ] **Step 5: Optional checkpoint commit (only if authorized)**

```bash
git add \
  apps/api/jest.schema.config.cjs \
  apps/api/test/schema/flash-sale-schema.spec.ts \
  apps/api/package.json
git commit -m "$(cat <<'EOF'
test: add PostgreSQL schema catalog verification

EOF
)"
```

---

## Task 4: Dedicated CI `schema-test` job

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `schema-test` job alongside existing `quality`**

Keep `quality` DB-independent. Append a job like:

```yaml
schema-test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: flash_sale
        POSTGRES_PASSWORD: flash_sale_dev
        POSTGRES_DB: flash_sale
      ports:
        - 5432:5432
      options: >-
        --health-cmd "pg_isready -U flash_sale -d flash_sale"
        --health-interval 5s
        --health-timeout 5s
        --health-retries 10
  env:
    DATABASE_URL: postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version-file: '.nvmrc'
        cache: 'pnpm'
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter api prisma:generate
    - run: pnpm --filter api prisma:migrate:deploy
    - run: pnpm --filter api test:schema
```

Match existing action versions / pnpm conventions already in the file.

- [ ] **Step 2: Document branch-protection prerequisite (out of code scope)**

In the PR description / handoff notes, record explicitly:

> Dedicated CI job `schema-test` exists in the workflow, but the workflow alone does not make it merge-blocking. Configure GitHub branch protection / rulesets to require `schema-test` for merges to `main`. Branch protection/ruleset configuration itself is **out of scope** for this implementation PR unless explicitly requested.

Do not invent a new markdown doc file solely for this unless the user asks.

- [ ] **Step 3: Optional checkpoint commit (only if authorized)**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: add PostgreSQL schema-test job

EOF
)"
```

---

## Task 5: Diff guardrails and quality gates

**Files:** none (verification)

- [ ] **Step 1: Diff must stay inside #15 persistence surface**

```bash
git diff --name-only origin/main...HEAD
# or, if uncommitted:
git status -sb
git diff --name-only
```

Expected touched implementation paths only under:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/api/test/schema/**`
- `apps/api/jest.schema.config.cjs`
- `apps/api/package.json`
- `.github/workflows/ci.yml`

Docs appear **only** if the user intended the branch to carry the finalized `#15` spec/plan.

Must **not** include:

- `packages/domain/**`
- repository/mapper Nest modules
- GraphQL resolvers
- Redis client
- `@@unique([flashSaleId, userId])` / uniqueness tests

```bash
rg -n "@@unique|ALREADY_PURCHASED|ioredis|redis" apps/api/prisma apps/api/test apps/api/src || true
rg -n "model .*Status|status\s+String" apps/api/prisma/schema.prisma || true
```

Expected: no uniqueness/status/redis creep in #15 paths.

- [ ] **Step 2: Re-run gates**

```bash
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter api test:schema
pnpm --filter api build
```

Expected: PASS (Postgres up for `test:schema`).

- [ ] **Step 3: Single authorized commit for the whole ticket (optional — only if authorized)**

If intermediate commits were skipped, one commit is fine:

```bash
git add \
  apps/api/prisma/schema.prisma \
  apps/api/prisma/migrations \
  apps/api/test/schema \
  apps/api/jest.schema.config.cjs \
  apps/api/package.json \
  .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
feat: add Product FlashSale Purchase database schema

EOF
)"
```

If docs are included in the same authorized commit set, stage them explicitly.

---

## Task 6: Final acceptance review

- [ ] **Step 1: Map implementation against `#15` contract**

- [ ] `Product` / `FlashSale` / `Purchase` tables via Prisma migration
- [ ] Domain-aligned columns only (+ `createdAt` / `updatedAt`)
- [ ] App-supplied `String @id` (no Prisma `@default`)
- [ ] All three `id` columns are PostgreSQL `text`
- [ ] All three `id` columns have no database default (`column_default IS NULL`)
- [ ] Snake_case `@@map` / `@map`
- [ ] All `DateTime` → `@db.Timestamptz(3)`
- [ ] Explicit `onDelete: Restrict` both FKs; catalog `delete_rule = RESTRICT`
- [ ] `@@index([productId])` and `@@index([flashSaleId])` exist
- [ ] No standalone `purchases(user_id)` index
- [ ] Four **named** FlashSale CHECKs present in migration + DB
- [ ] No persisted `status`
- [ ] No `@@unique([flashSaleId, userId])` in schema/migration
- [ ] No runtime “unique constraint absent” test (`#16` owns positive uniqueness)
- [ ] Exactly one new migration directory was added relative to `origin/main`
- [ ] Migration directory name is Prisma-generated (timestamp not hand-invented)
- [ ] The migration applies successfully via `prisma migrate deploy` on a clean DB
- [ ] Migration contains no `updated_at` trigger/function; `@updatedAt` remains Prisma Client behavior only
- [ ] Schema catalog tests cover PK, id text/no-default, exact snake_case column sets + nullability, timestamptz(3), FKs, required indexes, no standalone `user_id` index, named CHECKs
- [ ] Dedicated CI `schema-test` job exists
- [ ] PR handoff explicitly notes that `schema-test` must be configured as a required status check
- [ ] Branch protection/ruleset configuration itself is out of scope unless explicitly requested
- [ ] `pnpm test` remains DB-independent; `test:schema` is separate
- [ ] No domain / GraphQL / Redis / repository / mapper changes
- [ ] ESLint + typecheck pass

- [ ] **Step 2: Final clean-DB smoke once more**

```bash
cd /home/rex/Project/test/app
docker compose down -v
docker compose up -d postgres
until docker compose exec -T postgres pg_isready -U flash_sale -d flash_sale; do sleep 1; done
export DATABASE_URL=postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale
pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:schema
```

Expected: PASS.

---

## Out of scope (do not implement)

- `@@unique([flashSaleId, userId])` / duplicate-purchase tests (`#16`)
- Repository ports (`#17`)
- Prisma adapters / mappers / uniqueness error mapping (`#18`)
- Atomic inventory reservation / raw-SQL `updated_at` maintenance (`#19`)
- Transactional purchase flow / `ALREADY_PURCHASED` (`#20`)
- Persisted `status` column
- Domain entity changes / ID normalization alignment
- GraphQL (EPIC-03) / Redis client (EPIC-04)
- Seed data / admin CRUD
- Standalone `@@index([userId])`
- Runtime “unique constraint absent” schema assertion

---

## Spec coverage self-review

| Spec requirement                                                    | Task                    |
| ------------------------------------------------------------------- | ----------------------- |
| Product / FlashSale / Purchase tables via Prisma migration          | Tasks 1–2               |
| Domain-aligned columns + audit timestamps                           | Task 1                  |
| App-supplied `String @id` (no DB default)                           | Tasks 1, 3, 6           |
| `id` physical type `text` + `column_default` null                   | Tasks 3, 6              |
| Snake_case `@map` / `@@map`                                         | Task 1                  |
| `timestamptz(3)` all DateTime fields                                | Tasks 1, 3              |
| Explicit `onDelete: Restrict` + catalog verify                      | Tasks 1, 3              |
| FK indexes `productId` / `flashSaleId`                              | Tasks 1, 3              |
| No standalone `user_id` index                                       | Tasks 3, 6              |
| Four named FlashSale CHECKs in edited migration                     | Task 2                  |
| Exactly one new migration dir relative to `origin/main`             | Tasks 2, 6              |
| Migration preservation / no blind regenerate                        | Task 2                  |
| Clean-DB `prisma migrate deploy` verification                       | Tasks 2, 6              |
| No `updated_at` DB trigger (Prisma Client `@updatedAt` only)        | Tasks 2, 6              |
| Schema catalog tests (PK, nullability, types, FKs, indexes, CHECKs) | Task 3                  |
| No uniqueness in #15; #16 owns positive unique test                 | Tasks 1–3, Out of scope |
| No persisted status                                                 | Tasks 1, 5              |
| Dedicated CI schema-test job                                        | Task 4                  |
| Branch-protection prerequisite called out; config out of scope      | Task 4                  |
| Clean working-tree / preserve uncommitted #15 docs                  | Task 0                  |
| No repos/mappers/GraphQL/Redis/domain changes                       | Tasks 0, 5–6            |

No placeholders remain. Schema/test/CI artifacts match the approved `#15` contract.
