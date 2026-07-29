# EPIC-06 — Automated Testing Implementation Plan (#41–#52)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [EPIC-06 #86](https://github.com/rexescario-dev/flash-sale-system/issues/86) by auditing existing coverage, adding thin shared fixtures/factories, API GraphQL concurrency proofs (#47/#48), a Prisma-first E2E seeder (#43), and real-stack Playwright smoke/regression (#49–#52) — without rewriting suites that already prove their ACs.

**Architecture:** Additive delta epic. Shared scenario fixtures + Prisma factories under `apps/api/test/`. Concurrency suites hit GraphQL HTTP with outcome classification. E2E seeder stays API-side test infra; top-level `e2e/` Playwright invokes it via CLI/process only. Postgres is SoT; Redis is environmental/non-authoritative.

**Tech Stack:** Jest (+ integration config), NestJS GraphQL, Prisma/Postgres, Redis, Playwright, pnpm workspaces, Docker Compose, GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-07-29-epic-06-automated-testing-design.md](../specs/2026-07-29-epic-06-automated-testing-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`. Author email must be `rex.escario.jr@gmail.com`.

**Hard invariants (locked):**

1. Additive only — verify exact ACs before closing; no rewrite of satisfied suites.
2. No `@flash-sale/testing` package in this epic.
3. Factories are generic; scenario semantics live in fixtures. `SOLD_OUT` = pre-exhausted (`remainingStock = 0`); `ACTIVE_STOCK_1` = one unit left (preferred for sold-out **transition**). Fixture `name` is test-only metadata (not persisted).
4. Concurrency entry: GraphQL HTTP preferred; domain-only insufficient.
5. Outcome buckets: `SUCCESS` | `SOLD_OUT` | `DUPLICATE` | `RATE_LIMITED` | `UNEXPECTED_ERROR`. Map **all** production duplicate representations to `DUPLICATE` (verified in Task 0/2 against purchase-flow mapping).
6. `#48` contention count **`N = 100`**. All 100 requests must be **dispatched before awaiting any response** (no serialization). Exact txn-overlap instrumentation is **not** required; do **not** add production sync hooks.
7. Rate limit must not fake results: set `RATE_LIMIT_PURCHASE_ITEM_MAX` ≥ **200** **before** Nest module init; confirm EPIC-04 `validateEnv` / `ConfigModule` reads it at init; assert `RATE_LIMITED === 0`.
8. Isolation: unique flash-sale ID per concurrency case. Concurrency `userId`s are logical opaque strings only — **no User table/factory**.
9. Playwright never imports `apps/api/test/**`, Prisma, or factories — `globalSetup` is the **canonical** seeder invocation (`pnpm --filter api e2e:seed`). CI must **not** pre-seed before Playwright.
10. **`seedE2E()` always writes repository-root `e2e/seed-state.json`, independent of `process.cwd()`.** Prefer `E2E_SEED_STATE_PATH` override; default resolves via `__dirname` from the seeder module.
11. Seeder is test infrastructure only — no production/public HTTP seed endpoint. E2E-owned reset is by **`flashSaleId` prefix** (`e2e-sale-`), then related products — not by arbitrary `userId` prefix alone.
12. Redis: scoped key delete via **`SCAN`** (never `KEYS`); never inventory oracle; never flush shared Redis.
13. UI is Playwright primary oracle. Smoke asserts real success heading (`Purchase successful` / status). Duplicate regression asserts **duplicate rejection UX**, not any outcome banner.
14. `globalSetup`: (1) wait for API `/health` + web `baseURL`, (2) spawn e2e:seed, (3) return.
15. Full E2E gate: either **required PR check** that blocks merge, **or** protected **post-merge release/deploy gate** — a bare `push` to `main` job alone does **not** count as merge protection.

**Lifecycle (dependency vs execution):**

```text
Postgres + Redis healthy
        ↓
migrate
        ├──────────────→ seedE2E()   (Prisma-first; does NOT need API/web)
        ↓                            (canonical invoke = Playwright globalSetup)
API + web ready
        ↓
Playwright (globalSetup: readiness → seed → tests)
```

**Locked plan values (spec open items):**

| Item                       | Value                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#48` N                    | `100` (all dispatched concurrently; no per-request await until `Promise.all`)                                                                                                                                                                                 |
| Concurrency rate-limit max | `RATE_LIMIT_PURCHASE_ITEM_MAX=200` before `createTestingModule`                                                                                                                                                                                               |
| Jest files                 | `apps/api/test/graphql/purchase-concurrency.integration.spec.ts` (#47+#48)                                                                                                                                                                                    |
| Seed CLI                   | `pnpm --filter api e2e:seed` → `tsx test/e2e/seed/cli.ts` (from `apps/api`)                                                                                                                                                                                   |
| Seed state file            | **Always** repo-root `e2e/seed-state.json` (or `E2E_SEED_STATE_PATH`)                                                                                                                                                                                         |
| Root scripts               | `e2e:smoke`, `e2e`                                                                                                                                                                                                                                            |
| Sold-out E2E               | Seed `ACTIVE_STOCK_1` → purchase once → assert `SOLD_OUT` (+ stock `0` preferred)                                                                                                                                                                             |
| Full E2E CI                | **Option A (default):** full regression required on PR (blocks merge) + smoke required on PR. **Option B (if runtime > ~15m):** smoke required on PR; full on `main` push **and** release/deploy blocked until it passes — document which option in the CI PR |

**Scripts (locked names):**

| Script                       | Owner      | Action                                                                 |
| ---------------------------- | ---------- | ---------------------------------------------------------------------- |
| `pnpm --filter api e2e:seed` | `apps/api` | Reset E2E-owned rows + seed; write **repo-root** `e2e/seed-state.json` |
| `pnpm e2e:smoke`             | root       | Playwright project `smoke` (globalSetup seeds)                         |
| `pnpm e2e`                   | root       | Playwright full (globalSetup seeds)                                    |

**Stacked PR mapping:**

| PR  | Contents                                                     |
| --- | ------------------------------------------------------------ |
| 1   | Spec + this plan (docs)                                      |
| 2   | Task 0 baseline audit + close verified issues                |
| 3   | Tasks 1–2 — #41/#42 fixtures/factories + #47/#48 concurrency |
| 4   | Task 3 — #43 seeder                                          |
| 5   | Tasks 4–6 — #49–#52 Playwright + smoke/regression            |
| 6   | Task 7 — CI wiring                                           |

---

## File map

| Path                                                                    | Responsibility                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `docs/superpowers/specs/2026-07-29-epic-06-automated-testing-design.md` | Spec (approved)                                                               |
| `docs/superpowers/plans/2026-07-29-epic-06-automated-testing.md`        | This plan                                                                     |
| `docs/superpowers/audits/2026-07-29-epic-06-baseline-audit.md`          | Task 0 evidence matrix                                                        |
| `apps/api/test/fixtures/scenarios.ts`                                   | Deterministic scenario presets                                                |
| `apps/api/test/fixtures/ids.ts`                                         | ID/namespace helpers (`e2e-…`, `concurrency-…`)                               |
| `apps/api/test/factories/product.factory.ts`                            | Prisma product create                                                         |
| `apps/api/test/factories/flash-sale.factory.ts`                         | Generic flash-sale create with overrides                                      |
| `apps/api/test/factories/index.ts`                                      | Re-exports                                                                    |
| `apps/api/test/graphql/purchase-outcome-classify.ts`                    | Map GraphQL response → outcome bucket                                         |
| `apps/api/test/graphql/purchase-concurrency.integration.spec.ts`        | #47 + #48                                                                     |
| `apps/api/test/e2e/seed/scenarios.ts`                                   | E2E scenario selection (reuses fixtures)                                      |
| `apps/api/test/e2e/seed/seed.ts`                                        | `seedE2E()` reset + plant + Redis scoped clear                                |
| `apps/api/test/e2e/seed/cli.ts`                                         | CLI entry (`node`/`tsx`)                                                      |
| `apps/api/package.json`                                                 | `e2e:seed` script; `tsx` devDep if needed                                     |
| `e2e/package.json`                                                      | Playwright workspace package                                                  |
| `e2e/playwright.config.ts`                                              | Config, projects `smoke` / `regression`, `baseURL`                            |
| `e2e/global-setup.ts`                                                   | Spawns `pnpm --filter api e2e:seed`                                           |
| `e2e/pages/sale.page.ts`                                                | Thin page object                                                              |
| `e2e/tests/smoke/purchase.smoke.spec.ts`                                | View + buy                                                                    |
| `e2e/tests/regression/duplicate-purchase.spec.ts`                       | Duplicate UX                                                                  |
| `e2e/tests/regression/sold-out.spec.ts`                                 | ACTIVE_STOCK_1 transition                                                     |
| `pnpm-workspace.yaml`                                                   | Add `e2e`                                                                     |
| `package.json`                                                          | Root `e2e` / `e2e:smoke` scripts                                              |
| `.github/workflows/ci.yml`                                              | Smoke + full (Option A) or smoke PR + full post-merge release gate (Option B) |
| `e2e/readiness.ts`                                                      | HTTP wait helpers for API/web before seed                                     |
| `.env.example` / README                                                 | Document E2E commands; Redis `:6380` note if needed                           |
| `.gitignore`                                                            | `e2e/seed-state.json`                                                         |

**Untouched (no rewrite):** existing domain/unit/integration suites except demand-driven factory extraction consumers; EPIC-05 Vitest/MSW tests; production Nest modules (except env/CI).

---

## Task 0: Baseline audit (#44/#45/#46 + evidence layers)

**Purpose:** Fill the verification matrix with concrete AC↔test evidence; close or mark no-impl; identify only true gaps for later tasks.

**Files:**

- Create: `docs/superpowers/audits/2026-07-29-epic-06-baseline-audit.md`
- Read-only: domain/API/web test paths listed in the audit template below

- [ ] **Step 1: Run current quality + integration smoke**

```bash
cd /home/rex/Project/test/app
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
DATABASE_URL=postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale \
REDIS_URL=redis://127.0.0.1:6380 \
  pnpm --filter api test:schema && \
DATABASE_URL=postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale \
REDIS_URL=redis://127.0.0.1:6380 \
  pnpm --filter api test:integration
```

Expected: all pass (use `:6380` when `:6379` is occupied).

- [ ] **Step 2: Write the audit file**

Create `docs/superpowers/audits/2026-07-29-epic-06-baseline-audit.md` with this structure filled from actual file:line evidence:

```markdown
# EPIC-06 Baseline Audit (2026-07-29)

## Rule

Satisfied only when existing tests prove the **exact** AC.

## Matrix

| Issue / area               | AC (short)                      | Evidence (path + test name)                                                                                                                  | Verdict             | Action              |
| -------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------- |
| #44 Domain status rules    | UPCOMING/ACTIVE/SOLD_OUT/ENDED  | `packages/domain/src/flash-sale/flash-sale.spec.ts` → `FlashSale.getStatus` table                                                            | Verified            | Close               |
| #45 App service outcomes   | Purchase outcomes with fakes    | `apps/api/src/purchase/purchase-flow.service.spec.ts` cases for SUCCESS/SOLD_OUT/ALREADY_PURCHASED/…                                         | Verified or Partial | Close or delta list |
| #46 GraphQL purchase paths | success + rejection via GraphQL | `apps/api/test/graphql/graphql-api.integration.spec.ts`                                                                                      | Verified            | Close               |
| Reservation integration    | reserve atomicity               | `apps/api/test/flash-sale/prisma-flash-sale.reservation.integration.spec.ts`                                                                 | Verified            | Reference           |
| Purchase flow integration  | flow outcomes vs Postgres       | `apps/api/test/purchase/purchase-flow.integration.spec.ts`                                                                                   | Verified            | Reference           |
| Redis integration          | cache/rate-limit/fail-open      | `apps/api/test/graphql/redis-query-cache.integration.spec.ts`, `purchase-rate-limit.integration.spec.ts`, `redis-client.integration.spec.ts` | Verified            | Reference           |
| #41/#42                    | fixtures/factories              | —                                                                                                                                            | Gap                 | Implement Task 1    |
| #43                        | E2E seeder                      | —                                                                                                                                            | Gap                 | Implement Task 3    |
| #47/#48                    | concurrency                     | —                                                                                                                                            | Gap                 | Implement Task 2    |
| #49–#52                    | Playwright                      | —                                                                                                                                            | Gap                 | Tasks 4–6           |
```

For **#45**, list every expected outcome (`SUCCESS`, `SOLD_OUT`, `ALREADY_PURCHASED`, `SALE_NOT_STARTED`, `SALE_ENDED`, not-found) and map to a specific `it(...)` — if any is missing, record **Partial** + exact delta (do not invent scope beyond #45 AC).

- [ ] **Step 2b: Verify #48 duplicate production mapping (prerequisite for classifier)**

Read and record in the audit:

1. `PurchaseFlowService` maps `PurchaseConflictError` → `'ALREADY_PURCHASED'` (`purchase-flow.service.ts`).
2. Prisma adapter maps composite unique `P2002` → `PurchaseConflictError` (`prisma-purchase.repository.ts`).
3. GraphQL returns `purchaseItem.status === 'ALREADY_PURCHASED'` (not a GraphQL `errors[]` code) for duplicates.

Therefore the concurrency classifier maps **`ALREADY_PURCHASED` → `DUPLICATE`**. If audit finds any other legitimate duplicate surface, extend the classifier accordingly before locking `#48` `DUPLICATE === N - 1`.

Also confirm `RATE_LIMIT_PURCHASE_ITEM_MAX` is applied via `validateEnv` → `ConfigService` at Nest init (`env.validation.ts` + `PurchaseItemRateLimiter`), so setting `process.env.RATE_LIMIT_PURCHASE_ITEM_MAX='200'` **before** `createTestingModule` affects the suite.

- [ ] **Step 3: Close verified GitHub issues**

For each Verified row under #44/#46 (and #45 if fully mapped):

```bash
gh issue comment <N> --body "$(cat <<'EOF'
Verified on main during EPIC-06 baseline audit.
Evidence: see docs/superpowers/audits/2026-07-29-epic-06-baseline-audit.md
No additional implementation required.
EOF
)"
gh issue close <N> --reason completed
```

Leave gap issues open.

- [ ] **Step 4: Acceptance**

Audit committed in PR2; verified issues closed; no coding of fixtures/concurrency yet unless #45 delta is tiny and listed — then implement delta in a follow-up micro-task under PR2 only if audit says Partial with a concrete missing test.

---

## Task 1: Thin fixtures + factories (#41/#42)

**Files:**

- Create: `apps/api/test/fixtures/ids.ts`
- Create: `apps/api/test/fixtures/scenarios.ts`
- Create: `apps/api/test/factories/product.factory.ts`
- Create: `apps/api/test/factories/flash-sale.factory.ts`
- Create: `apps/api/test/factories/index.ts`
- Create: `apps/api/test/factories/flash-sale.factory.spec.ts` (lightweight unit using Prisma mock **or** skip unit and cover via Task 2 — prefer a tiny pure scenarios unit if no DB)

- [ ] **Step 1: Add ID / scenario fixtures**

`apps/api/test/fixtures/ids.ts`:

```typescript
export const E2E_PREFIX = {
  product: 'e2e-product-',
  sale: 'e2e-sale-',
  user: 'e2e-user-',
} as const;

export const CONCURRENCY_PREFIX = {
  product: 'concurrency-product-',
  sale: 'concurrency-sale-',
  user: 'concurrency-user-',
} as const;

export function e2eProductId(suffix: string): string {
  return `${E2E_PREFIX.product}${suffix}`;
}

export function e2eSaleId(suffix: string): string {
  return `${E2E_PREFIX.sale}${suffix}`;
}

export function e2eUserId(suffix: string): string {
  return `${E2E_PREFIX.user}${suffix}`;
}

export function concurrencySaleId(suffix: string): string {
  return `${CONCURRENCY_PREFIX.sale}${suffix}`;
}

export function concurrencyProductId(suffix: string): string {
  return `${CONCURRENCY_PREFIX.product}${suffix}`;
}

export function concurrencyUserId(suffix: string): string {
  return `${CONCURRENCY_PREFIX.user}${suffix}`;
}
```

`apps/api/test/fixtures/scenarios.ts`:

```typescript
export type FlashSaleScenario = {
  /** Test-only metadata; not persisted to Postgres. */
  name: string;
  endsAt: Date;
  remainingStock: number;
  startsAt: Date;
  totalStock: number;
};

const NOW = new Date('2026-07-29T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

/** Active sale with 10 units — concurrency #47. */
export const ACTIVE_STOCK_10: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() + 24 * HOUR),
  name: 'ACTIVE_STOCK_10',
  remainingStock: 10,
  startsAt: new Date(NOW.getTime() - HOUR),
  totalStock: 10,
};

/** Active sale with 1 unit — Playwright sold-out transition. */
export const ACTIVE_STOCK_1: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() + 24 * HOUR),
  name: 'ACTIVE_STOCK_1',
  remainingStock: 1,
  startsAt: new Date(NOW.getTime() - HOUR),
  totalStock: 1,
};

/** Pre-exhausted sale — do NOT use for transition tests. */
export const SOLD_OUT: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() + 24 * HOUR),
  name: 'SOLD_OUT',
  remainingStock: 0,
  startsAt: new Date(NOW.getTime() - HOUR),
  totalStock: 10,
};

export const UPCOMING: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() + 48 * HOUR),
  name: 'UPCOMING',
  remainingStock: 10,
  startsAt: new Date(NOW.getTime() + HOUR),
  totalStock: 10,
};

export const ENDED: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() - HOUR),
  name: 'ENDED',
  remainingStock: 5,
  startsAt: new Date(NOW.getTime() - 48 * HOUR),
  totalStock: 10,
};
```

- [ ] **Step 2: Add Prisma factories**

`apps/api/test/factories/product.factory.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';

export type CreateProductInput = {
  id: string;
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
    },
    select: { id: true },
  });
}
```

`apps/api/test/factories/flash-sale.factory.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';

import { createProduct } from './product.factory';

export type CreateFlashSaleInput = {
  endsAt: Date;
  id: string;
  productId?: string;
  productName?: string;
  remainingStock: number;
  startsAt: Date;
  totalStock: number;
};

export async function createFlashSale(
  prisma: PrismaClient,
  input: CreateFlashSaleInput,
): Promise<{ id: string; productId: string }> {
  const productId = input.productId ?? `product-for-${input.id}`;
  await createProduct(prisma, { id: productId, name: input.productName });
  await prisma.flashSale.create({
    data: {
      endsAt: input.endsAt,
      id: input.id,
      productId,
      remainingStock: input.remainingStock,
      startsAt: input.startsAt,
      totalStock: input.totalStock,
    },
  });
  return { id: input.id, productId };
}
```

`apps/api/test/factories/index.ts`:

```typescript
export { createFlashSale, type CreateFlashSaleInput } from './flash-sale.factory';
export { createProduct, type CreateProductInput } from './product.factory';
```

- [ ] **Step 3: Acceptance for Task 1**

Factories compile (`pnpm --filter api typecheck`). Scenario constants exported. **Consumers arrive in Tasks 2–3** — DoD of #41/#42 completes when both concurrency + seeder import them.

Optional commit message: `test: add shared API fixtures and Prisma factories`

---

## Task 2: GraphQL concurrency suites (#47/#48)

**Files:**

- Create: `apps/api/test/graphql/purchase-outcome-classify.ts`
- Create: `apps/api/test/graphql/purchase-concurrency.integration.spec.ts`

**Concurrency contract (locked):**

- All `N` HTTP requests are **dispatched before awaiting any response** (`Promise.all` of already-started fetches; do not `await` inside the map).
- The suite must **not** serialize requests.
- Exact transaction-overlap instrumentation is **not** required.
- Do **not** add production-only synchronization hooks for this epic.
- Concurrency `userId` values are logical opaque strings; no User persistence.

- [ ] **Step 1: Outcome classifier (based on Task 0 mapping)**

`apps/api/test/graphql/purchase-outcome-classify.ts`:

```typescript
export type ConcurrencyBucket =
  'SUCCESS' | 'SOLD_OUT' | 'DUPLICATE' | 'RATE_LIMITED' | 'UNEXPECTED_ERROR';

export type GraphqlPurchaseResponse = {
  data?: {
    purchaseItem?: {
      status?: string;
    } | null;
  } | null;
  errors?: Array<{ extensions?: { code?: string }; message?: string }> | null;
};

/**
 * Production mapping (verified in Task 0):
 * - PurchaseConflictError / P2002 unique (flash_sale_id, user_id) → ALREADY_PURCHASED
 * - GraphQL data.purchaseItem.status carries business outcomes
 * - RATE_LIMITED is errors[].extensions.code
 */
export function classifyPurchaseResponse(body: GraphqlPurchaseResponse): ConcurrencyBucket {
  const code = body.errors?.[0]?.extensions?.code;
  if (code === 'RATE_LIMITED') return 'RATE_LIMITED';
  if (body.errors?.length) return 'UNEXPECTED_ERROR';

  const status = body.data?.purchaseItem?.status;
  if (status === 'SUCCESS') return 'SUCCESS';
  if (status === 'SOLD_OUT') return 'SOLD_OUT';
  if (status === 'ALREADY_PURCHASED') return 'DUPLICATE';
  return 'UNEXPECTED_ERROR';
}

export function tally(buckets: ConcurrencyBucket[]): Record<ConcurrencyBucket, number> {
  const init: Record<ConcurrencyBucket, number> = {
    DUPLICATE: 0,
    RATE_LIMITED: 0,
    SOLD_OUT: 0,
    SUCCESS: 0,
    UNEXPECTED_ERROR: 0,
  };
  for (const b of buckets) init[b] += 1;
  return init;
}
```

- [ ] **Step 2: Implement concurrency suite**

Confirm before coding: set `process.env.RATE_LIMIT_PURCHASE_ITEM_MAX = '200'` **before** `Test.createTestingModule`, matching EPIC-04 `validateEnv` read-at-init. Optionally assert `app.get(ConfigService).get('RATE_LIMIT_PURCHASE_ITEM_MAX') >= 100` after init.

`apps/api/test/graphql/purchase-concurrency.integration.spec.ts` (key shape):

```typescript
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.tokens';
import type { RedisClientPort } from '../../src/redis/redis-client.port';
import { flashSaleCacheKey, myPurchaseCacheKey } from '../../src/redis/redis-keys';
import { createFlashSale } from '../factories';
import { ACTIVE_STOCK_10 } from '../fixtures/scenarios';
import { concurrencyProductId, concurrencySaleId, concurrencyUserId } from '../fixtures/ids';
import { classifyPurchaseResponse, tally } from './purchase-outcome-classify';

const PURCHASE_ITEM = `
  mutation PurchaseItem($flashSaleId: String!, $userId: String!) {
    purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
      status
      purchaseId
      message
    }
  }
`;

describe('purchase concurrency (#47/#48)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisClientPort;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_PURCHASE_ITEM_MAX = '200';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    prisma = app.get(PrismaService);
    redis = app.get(REDIS_CLIENT);
    const max = app.get(ConfigService).get('RATE_LIMIT_PURCHASE_ITEM_MAX', { infer: true });
    expect(max).toBeGreaterThanOrEqual(100);
  });

  afterAll(async () => {
    await app.close();
  });

  async function postPurchase(flashSaleId: string, userId: string) {
    const baseUrl = await app.getUrl();
    const res = await fetch(`${baseUrl}/graphql`, {
      body: JSON.stringify({
        query: PURCHASE_ITEM,
        variables: { flashSaleId, userId },
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    return res.json();
  }

  async function clearScopedRedis(flashSaleId: string, userIds: string[]): Promise<void> {
    await redis.delete(flashSaleCacheKey(flashSaleId));
    for (const userId of userIds) {
      await redis.delete(myPurchaseCacheKey(flashSaleId, userId));
    }
    // Rate-limit keys are not cleared: suite uses RATE_LIMIT_PURCHASE_ITEM_MAX=200
    // and asserts RATE_LIMITED === 0. If cleanup is ever required, use only a
    // test-scoped key from a deterministic test IP — never flush Redis.
  }

  async function cleanupSale(saleId: string, productId: string): Promise<void> {
    await prisma.purchase.deleteMany({ where: { flashSaleId: saleId } });
    await prisma.flashSale.deleteMany({ where: { id: saleId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }

  it('#47 stock=10 with 100 distinct users → 10 SUCCESS, 0 remaining', async () => {
    const suffix = randomUUID();
    const saleId = concurrencySaleId(`47-${suffix}`);
    const productId = concurrencyProductId(`47-${suffix}`);
    const userIds = Array.from({ length: 100 }, (_, i) => concurrencyUserId(`47-${suffix}-${i}`));

    try {
      await createFlashSale(prisma, {
        ...ACTIVE_STOCK_10,
        id: saleId,
        productId,
      });
      await clearScopedRedis(saleId, userIds);

      // Dispatch all requests before awaiting any response — do not serialize.
      const bodies = await Promise.all(userIds.map((userId) => postPurchase(saleId, userId)));
      const counts = tally(bodies.map(classifyPurchaseResponse));

      expect(counts.RATE_LIMITED).toBe(0);
      expect(counts.UNEXPECTED_ERROR).toBe(0);
      expect(counts.DUPLICATE).toBe(0);
      expect(counts.SUCCESS).toBe(10);
      expect(counts.SOLD_OUT).toBe(90);

      const sale = await prisma.flashSale.findUniqueOrThrow({ where: { id: saleId } });
      expect(sale.remainingStock).toBe(0);
      const purchases = await prisma.purchase.findMany({ where: { flashSaleId: saleId } });
      expect(purchases).toHaveLength(10);
      expect(new Set(purchases.map((p) => p.userId)).size).toBe(10);
    } finally {
      await cleanupSale(saleId, productId);
    }
  });

  it('#48 N=100 same user → 1 SUCCESS, 99 DUPLICATE, one row', async () => {
    const N = 100;
    const suffix = randomUUID();
    const saleId = concurrencySaleId(`48-${suffix}`);
    const productId = concurrencyProductId(`48-${suffix}`);
    const userId = concurrencyUserId(`48-${suffix}`);

    try {
      await createFlashSale(prisma, {
        ...ACTIVE_STOCK_10,
        id: saleId,
        productId,
        remainingStock: 10,
        totalStock: 10,
      });
      await clearScopedRedis(saleId, [userId]);

      const before = await prisma.flashSale.findUniqueOrThrow({ where: { id: saleId } });
      // All N started concurrently — no per-request await until Promise.all settles.
      const bodies = await Promise.all(
        Array.from({ length: N }, () => postPurchase(saleId, userId)),
      );
      const counts = tally(bodies.map(classifyPurchaseResponse));

      expect(counts.SUCCESS).toBe(1);
      expect(counts.DUPLICATE).toBe(N - 1);
      expect(counts.RATE_LIMITED).toBe(0);
      expect(counts.UNEXPECTED_ERROR).toBe(0);

      const rowCount = await prisma.purchase.count({
        where: { flashSaleId: saleId, userId },
      });
      expect(rowCount).toBe(1);

      const after = await prisma.flashSale.findUniqueOrThrow({ where: { id: saleId } });
      expect(after.remainingStock).toBe(before.remainingStock - 1);
    } finally {
      await cleanupSale(saleId, productId);
    }
  });
});
```

- [ ] **Step 3: Run suite**

```bash
DATABASE_URL=postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale \
REDIS_URL=redis://127.0.0.1:6380 \
  pnpm --filter api test:integration -- purchase-concurrency
```

Expected: both `#47` and `#48` pass; `RATE_LIMITED` never appears.

- [ ] **Step 4: Acceptance**

Both concurrency cases use `createFlashSale` + `ACTIVE_STOCK_10`. Close #47/#48 with evidence when green.

Optional commit: `test: add GraphQL purchase concurrency suites`

---

## Task 3: E2E seeder (#43)

**Files:**

- Create: `apps/api/test/e2e/seed/scenarios.ts`
- Create: `apps/api/test/e2e/seed/seed.ts`
- Create: `apps/api/test/e2e/seed/cli.ts`
- Create: `apps/api/test/e2e/seed/paths.ts` (deterministic repo-root resolver)
- Modify: `apps/api/package.json` (script + `tsx` if needed)
- Gitignore: `e2e/seed-state.json`

**Hard path invariant:** `seedE2E()` always writes **repository-root** `e2e/seed-state.json`, independent of `process.cwd()`.

- [ ] **Step 1: Deterministic state path helper**

`apps/api/test/e2e/seed/paths.ts`:

```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve repo root from this file:
 * apps/api/test/e2e/seed/paths.ts → ../../../../../.. → repo root
 * (Adjust if file moves; prefer E2E_SEED_STATE_PATH in CI.)
 */
export function defaultSeedStatePath(): string {
  if (process.env.E2E_SEED_STATE_PATH) {
    return path.resolve(process.env.E2E_SEED_STATE_PATH);
  }
  // tsx/CJS: prefer __dirname when available
  const here =
    typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
  // apps/api/test/e2e/seed → up 5 → repo root
  const repoRoot = path.resolve(here, '..', '..', '..', '..', '..');
  return path.join(repoRoot, 'e2e', 'seed-state.json');
}
```

Verify the `..` count against the real file location before merge (add a one-line unit/assert in CLI that logs the resolved path on first run).

- [ ] **Step 2: Implement `seedE2E()`**

`apps/api/test/e2e/seed/scenarios.ts`:

```typescript
import { ACTIVE_STOCK_1, ACTIVE_STOCK_10 } from '../../fixtures/scenarios';
import { e2eProductId, e2eSaleId } from '../../fixtures/ids';

export const E2E_SCENARIOS = {
  activeStock1: {
    productId: e2eProductId('active-stock-1'),
    saleId: e2eSaleId('active-stock-1'),
    scenario: ACTIVE_STOCK_1,
  },
  activeStock10: {
    productId: e2eProductId('active-stock-10'),
    saleId: e2eSaleId('active-stock-10'),
    scenario: ACTIVE_STOCK_10,
  },
} as const;
```

`apps/api/test/e2e/seed/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { mkdir, writeFile } from 'node:fs/promises';

import { createFlashSale } from '../../factories';
import { E2E_PREFIX } from '../../fixtures/ids';
import { defaultSeedStatePath } from './paths';
import { E2E_SCENARIOS } from './scenarios';

export type SeedState = {
  sales: {
    activeStock1Id: string;
    activeStock10Id: string;
  };
};

export async function resetE2EOwned(prisma: PrismaClient): Promise<void> {
  // Ownership is E2E-owned sales (and their purchases/products), not userId prefixes.
  await prisma.purchase.deleteMany({
    where: { flashSaleId: { startsWith: E2E_PREFIX.sale } },
  });
  await prisma.flashSale.deleteMany({
    where: { id: { startsWith: E2E_PREFIX.sale } },
  });
  await prisma.product.deleteMany({
    where: { id: { startsWith: E2E_PREFIX.product } },
  });
}

async function scanDelete(redis: Redis, match: string): Promise<void> {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
}

async function clearE2ERedisKeys(redisUrl: string, saleIds: string[]): Promise<void> {
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    for (const saleId of saleIds) {
      await redis.del(`flash-sale:v1:${saleId}`);
      await scanDelete(redis, `my-purchase:v1:${saleId}:*`);
    }
  } finally {
    redis.disconnect();
  }
}

export async function seedE2E(options?: {
  databaseUrl?: string;
  redisUrl?: string;
  statePath?: string;
}): Promise<SeedState> {
  const databaseUrl =
    options?.databaseUrl ??
    process.env.DATABASE_URL ??
    'postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale';
  const redisUrl = options?.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
  const statePath = options?.statePath ?? defaultSeedStatePath();

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await resetE2EOwned(prisma);

    const planted: string[] = [];
    for (const entry of Object.values(E2E_SCENARIOS)) {
      await createFlashSale(prisma, {
        endsAt: entry.scenario.endsAt,
        id: entry.saleId,
        productId: entry.productId,
        remainingStock: entry.scenario.remainingStock,
        startsAt: entry.scenario.startsAt,
        totalStock: entry.scenario.totalStock,
      });
      planted.push(entry.saleId);
    }

    await clearE2ERedisKeys(redisUrl, planted);

    const state: SeedState = {
      sales: {
        activeStock1Id: E2E_SCENARIOS.activeStock1.saleId,
        activeStock10Id: E2E_SCENARIOS.activeStock10.saleId,
      },
    };

    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    return state;
  } finally {
    await prisma.$disconnect();
  }
}
```

Add `import path from 'node:path'` at top of `seed.ts`. Prefer importing `flashSaleCacheKey` from `src/redis/redis-keys` when the CLI TS path allows; keep prefixes in sync if not.

`apps/api/test/e2e/seed/cli.ts`:

```typescript
import { defaultSeedStatePath } from './paths';
import { seedE2E } from './seed';

seedE2E()
  .then((state) => {
    process.stdout.write(
      `E2E seed complete → ${defaultSeedStatePath()}: ${JSON.stringify(state)}\n`,
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
```

- [ ] **Step 3: Wire package script + gitignore**

```json
"e2e:seed": "tsx test/e2e/seed/cli.ts"
```

```gitignore
e2e/seed-state.json
```

- [ ] **Step 4: Prove reset idempotency + path**

```bash
cd /home/rex/Project/test/app   # or apps/api — path must still resolve to repo-root e2e/
DATABASE_URL=... REDIS_URL=... pnpm --filter api e2e:seed
DATABASE_URL=... REDIS_URL=... pnpm --filter api e2e:seed
test -f e2e/seed-state.json && cat e2e/seed-state.json
```

Expected: file exists at **repo-root** `e2e/seed-state.json` even when pnpm runs with `apps/api` as cwd; second run equivalent.

- [ ] **Step 5: Acceptance (partial for #43)**

Seeder uses fixtures/factories; CLI + idempotency proven. **Do not close #43 yet** — Playwright `globalSetup` consumption is proven in Task 4.

Optional commit: `test: add Prisma-first E2E seeder CLI`

---

## Task 4: Playwright package + config (#49) + #43 integration contract

**Files:**

- Modify: `pnpm-workspace.yaml` — add `- 'e2e'`
- Create: `e2e/package.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/readiness.ts`
- Create: `e2e/global-setup.ts`
- Create: `e2e/tsconfig.json`
- Modify: root `package.json` scripts

- [ ] **Step 1: Add workspace package**

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'e2e'
```

`e2e/package.json`:

```json
{
  "name": "@flash-sale/e2e",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "test": "playwright test",
    "test:smoke": "playwright test --project=smoke",
    "test:regression": "playwright test --project=regression"
  },
  "devDependencies": {
    "@playwright/test": "^1.54.1",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Readiness + CLI-only globalSetup (canonical seed path)**

`e2e/readiness.ts`:

```typescript
async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

export async function waitForStack(): Promise<void> {
  const apiHealth = process.env.E2E_API_HEALTH_URL ?? 'http://127.0.0.1:3000/health';
  const webBase = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
  await waitForHttp(apiHealth);
  await waitForHttp(webBase);
}
```

`e2e/global-setup.ts`:

```typescript
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { waitForStack } from './readiness';

export default async function globalSetup(): Promise<void> {
  await waitForStack();

  const repoRoot = path.join(__dirname, '..');
  execFileSync('pnpm', ['--filter', 'api', 'e2e:seed'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      // Force canonical path even if package cwd differs
      E2E_SEED_STATE_PATH: path.join(repoRoot, 'e2e', 'seed-state.json'),
    },
    stdio: 'inherit',
  });
}
```

`e2e/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  globalSetup: './global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: /smoke\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'regression',
      testMatch: /regression\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

Root scripts:

```json
"e2e": "pnpm --filter @flash-sale/e2e test",
"e2e:smoke": "pnpm --filter @flash-sale/e2e test:smoke"
```

- [ ] **Step 3: Install + browser**

```bash
CI=true pnpm install
pnpm --filter @flash-sale/e2e exec playwright install chromium
```

- [ ] **Step 4: Acceptance**

`globalSetup` fails clearly if API/web down; seeds via CLI only; writes `e2e/seed-state.json` at repo root. **Close #43** once CLI + Playwright globalSetup consumption is demonstrated (with a minimal smoke placeholder if needed). Close #49 with config.

Optional commit: `test: scaffold Playwright e2e with readiness + CLI seed`

---

## Task 5: Page objects (#50)

**Files:**

- Create: `e2e/pages/sale.page.ts`

- [ ] **Step 1: Thin page object**

```typescript
import type { Page } from '@playwright/test';

export class SalePage {
  constructor(private readonly page: Page) {}

  async gotoSale(flashSaleId: string): Promise<void> {
    await this.page.goto(`/sales/${flashSaleId}`);
  }

  status() {
    return this.page.getByTestId('sale-status');
  }

  stock() {
    return this.page.getByTestId('sale-stock');
  }

  userIdInput() {
    return this.page.locator('#user-id');
  }

  buyButton() {
    return this.page.getByRole('button', { name: /Buy Now|Buying/ });
  }

  purchaseOutcome() {
    return this.page.getByTestId('purchase-outcome');
  }

  purchaseOutcomeStatus() {
    return this.page.getByTestId('purchase-outcome-status');
  }

  alreadyPurchased() {
    return this.page.getByTestId('already-purchased');
  }

  async enterUserId(userId: string): Promise<void> {
    await this.userIdInput().fill(userId);
  }

  async buy(): Promise<void> {
    await this.buyButton().click();
  }
}
```

No assertions / no Prisma here.

Optional commit: `test: add Playwright sale page object`

---

## Task 6: Smoke + regression specs (#52 / #51)

**Files:**

- Create: `e2e/tests/helpers/seed-state.ts`
- Create: `e2e/tests/smoke/purchase.smoke.spec.ts`
- Create: `e2e/tests/regression/duplicate-purchase.spec.ts`
- Create: `e2e/tests/regression/sold-out.spec.ts`

**UI contracts (from `PurchaseOutcomeBanner` / `PurchasePanel`):**

| Outcome           | `data-testid="purchase-outcome-status"` text |
| ----------------- | -------------------------------------------- |
| SUCCESS           | `Purchase successful`                        |
| ALREADY_PURCHASED | `Already purchased`                          |
| SOLD_OUT          | `Sold out`                                   |

Also: `data-testid="already-purchased"` → `You have already purchased this item.` after successful buy + myPurchase refresh.

- [ ] **Step 1: Seed state loader**

```typescript
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type SeedState = {
  sales: { activeStock1Id: string; activeStock10Id: string };
};

export function loadSeedState(): SeedState {
  const file = path.join(__dirname, '../../seed-state.json'); // e2e/seed-state.json
  return JSON.parse(readFileSync(file, 'utf8')) as SeedState;
}
```

- [ ] **Step 2: Smoke (#52) — required exact success UX**

```typescript
import { expect, test } from '@playwright/test';

import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test.describe('smoke', () => {
  test('views seeded ACTIVE sale and completes a purchase', async ({ page }) => {
    const { sales } = loadSeedState();
    const sale = new SalePage(page);
    await sale.gotoSale(sales.activeStock10Id);

    await expect(sale.status()).toHaveText('ACTIVE');
    await expect(sale.stock()).toContainText('/');

    const userId = `e2e-user-smoke-${Date.now()}`;
    await sale.enterUserId(userId);
    await sale.buy();

    await expect(sale.purchaseOutcomeStatus()).toHaveText('Purchase successful', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('purchase-id')).toBeVisible();
  });
});
```

- [ ] **Step 3: Regression — duplicate (#51) — must prove rejection, not any banner**

```typescript
import { expect, test } from '@playwright/test';

import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test('rejects duplicate purchase for same user', async ({ page }) => {
  const { sales } = loadSeedState();
  const sale = new SalePage(page);
  const userId = `e2e-user-dup-${Date.now()}`;

  await sale.gotoSale(sales.activeStock10Id);
  await sale.enterUserId(userId);
  await sale.buy();
  await expect(sale.purchaseOutcomeStatus()).toHaveText('Purchase successful', {
    timeout: 15_000,
  });

  // Second attempt: assert duplicate-specific UX (not merely "any outcome").
  await sale.buy();
  await expect(
    sale
      .alreadyPurchased()
      .or(sale.purchaseOutcomeStatus().filter({ hasText: 'Already purchased' })),
  ).toBeVisible({ timeout: 15_000 });
});
```

Prefer asserting `already-purchased` **or** outcome status `Already purchased` — never a generic success/outcome visibility check alone.

- [ ] **Step 4: Regression — sold-out via `ACTIVE_STOCK_1`**

```typescript
import { expect, test } from '@playwright/test';

import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test('transitions to sold-out after purchasing last unit', async ({ page }) => {
  const { sales } = loadSeedState();
  const sale = new SalePage(page);
  const userId = `e2e-user-last-${Date.now()}`;

  await sale.gotoSale(sales.activeStock1Id);
  await expect(sale.status()).toHaveText('ACTIVE');
  await sale.enterUserId(userId);
  await sale.buy();
  await expect(sale.purchaseOutcomeStatus()).toHaveText('Purchase successful', {
    timeout: 15_000,
  });

  await sale.gotoSale(sales.activeStock1Id);
  await expect(sale.status()).toHaveText('SOLD_OUT');
  await expect(sale.stock()).toContainText('0');
});
```

Do **not** use the `SOLD_OUT` preset for this transition test.

- [ ] **Step 5: Local run**

```bash
docker compose up -d postgres redis
pnpm --filter api prisma:migrate:deploy
# start API (`pnpm --filter api start` after build) + web (`pnpm --filter web dev` or preview)
# Do NOT manually seed unless debugging — Playwright globalSetup seeds.
pnpm e2e:smoke
pnpm e2e
```

- [ ] **Step 6: Acceptance**

Close #50/#51/#52. Seeder consumed only via Playwright CLI globalSetup in the happy path.

Optional commit: `test: add Playwright smoke and regression suites`

---

## Task 7: CI wiring + docs

**Files:**

- Modify: `.github/workflows/ci.yml` (full self-contained jobs — no undocumented copy/paste stubs)
- Optionally: `.github/workflows/e2e-reusable.yml` if factoring shared steps
- Modify: `README.md`
- Modify: `.gitignore`

**CI protection (pick Option A by default):**

| Option                 | PR                                    | After merge               | Merge/release protection                                                                                 |
| ---------------------- | ------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| **A (default)**        | `e2e-smoke` + `e2e-full` **required** | optional nightly          | Branch protection blocks merge until both green                                                          |
| **B (if full > ~15m)** | `e2e-smoke` required                  | `e2e-full` on `main` push | **Release/deploy** job/environment required to pass `e2e-full` — a bare push job alone is **not** enough |

Document the chosen option in the CI PR body.

- [ ] **Step 1: Implement complete `e2e-smoke` job (no pre-seed)**

Canonical seed ownership is Playwright `globalSetup`. CI must **not** run `e2e:seed` before Playwright.

Shared step sequence (inline fully in each job OR reusable workflow — agent must not leave `# same as smoke` placeholders):

```yaml
e2e-smoke:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: flash_sale
        POSTGRES_PASSWORD: flash_sale_dev
        POSTGRES_DB: flash_sale
      ports: ['5432:5432']
      options: >-
        --health-cmd "pg_isready -U flash_sale -d flash_sale"
        --health-interval 5s
        --health-timeout 5s
        --health-retries 10
    redis:
      image: redis:7-alpine
      ports: ['6379:6379']
      options: >-
        --health-cmd "redis-cli ping"
        --health-interval 5s
        --health-timeout 5s
        --health-retries 10
  env:
    DATABASE_URL: postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale
    REDIS_URL: redis://localhost:6379
    E2E_BASE_URL: http://127.0.0.1:5173
    E2E_API_HEALTH_URL: http://127.0.0.1:3000/health
    E2E_SEED_STATE_PATH: ${{ github.workspace }}/e2e/seed-state.json
    VITE_API_URL: http://127.0.0.1:3000
    PORT: 3000
    RATE_LIMIT_PURCHASE_ITEM_MAX: '200'
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
    - run: pnpm --filter api build
    - run: pnpm --filter web build
    - name: Start API + web preview
      run: |
        pnpm --filter api start &
        pnpm --filter web exec vite preview --host 127.0.0.1 --port 5173 &
        npx --yes wait-on http://127.0.0.1:3000/health http://127.0.0.1:5173
    - run: pnpm --filter @flash-sale/e2e exec playwright install chromium --with-deps
    # globalSetup: readiness (again) → e2e:seed → tests
    - run: pnpm e2e:smoke
```

- [ ] **Step 2: Implement complete `e2e-full` job**

Duplicate the full setup (or call reusable workflow). For Option A, run on `pull_request` (and optionally `push` to main). For Option B, run on `push` to `main` **and** wire a release environment that requires this check.

```yaml
  e2e-full:
    # Option A:
    if: github.event_name == 'pull_request' || (github.event_name == 'push' && github.ref == 'refs/heads/main')
    # Option B alternate: only push to main + required for deploy
    runs-on: ubuntu-latest
    # … identical services/env/steps through wait-on …
    - run: pnpm e2e
```

**Do not** leave the job as a comment stub.

- [ ] **Step 3: README**

```markdown
## E2E

Lifecycle: Postgres/Redis healthy → migrate → start API+web → Playwright globalSetup
(readiness + `pnpm --filter api e2e:seed`) → tests.

Manual seed (debug only): `pnpm --filter api e2e:seed`
(writes repo-root `e2e/seed-state.json`; override with `E2E_SEED_STATE_PATH`).

Commands: `pnpm e2e:smoke` · `pnpm e2e`

If Redis `:6379` is busy: `REDIS_URL=redis://127.0.0.1:6380`.
```

- [ ] **Step 4: Branch / release protection**

In PR description, instruct maintainers:

- Option A: require `e2e-smoke` **and** `e2e-full` on PRs.
- Option B: require `e2e-smoke` on PRs; require `e2e-full` for the deploy/release environment.

- [ ] **Step 5: Acceptance / epic close preparation**

All epic DoD bullets checkable. Update audit matrix. Close remaining children + #86 when merged.

Optional commit: `ci: add Playwright smoke and full E2E jobs`

---

## Spec coverage checklist (self-review)

| Spec requirement                                                      | Task                                      |
| --------------------------------------------------------------------- | ----------------------------------------- |
| Additive baseline audit + verified close                              | Task 0                                    |
| #48 duplicate mapping verified before classifier                      | Task 0 Step 2b + Task 2                   |
| Thin fixtures/factories; both consumers                               | Tasks 1–3                                 |
| Deterministic `e2e/seed-state.json` path                              | Task 3 `paths.ts` + `E2E_SEED_STATE_PATH` |
| No testing package                                                    | File map / locked                         |
| GraphQL concurrency + classification + `#47`/`#48`                    | Task 2                                    |
| Concurrent dispatch (no serialization); no prod sync hooks            | Task 2                                    |
| `N=100`; unique sale IDs; rate-limit raise verified                   | Task 2                                    |
| CLI seeder; SCAN redis; sale-prefix ownership; #43 close after Task 4 | Tasks 3–4                                 |
| globalSetup readiness + canonical seed (no CI pre-seed)               | Tasks 4 + 7                               |
| Top-level `e2e/`; exact smoke/duplicate/sold-out UX                   | Tasks 4–6                                 |
| `ACTIVE_STOCK_1` sold-out transition                                  | Task 6                                    |
| CI Option A/B with real merge/release protection                      | Task 7                                    |
| Redis non-authoritative / no HTTP seed / no AuthN/k6                  | Locked + out of scope                     |

**Placeholder scan:** no `# same as …` stubs; CI jobs must be fully written.

---

## Execution handoff

Plan revised with required pre-execution fixes and saved to `docs/superpowers/plans/2026-07-29-epic-06-automated-testing.md`. **Not committed.**

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute in this session with checkpoints

Which approach?
)
