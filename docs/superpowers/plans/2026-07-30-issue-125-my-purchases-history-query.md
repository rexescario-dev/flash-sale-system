# Issue #125 — GraphQL myPurchases History Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [#125](https://github.com/rexescario-dev/flash-sale-system/issues/125) — uncached GraphQL `myPurchases(userId)` returning `[PurchaseHistoryItem!]!` with nested slim `flashSale` + `Product`, newest-first — without AuthN, Redis, or #126 UI.

**Architecture:** CQRS read-model port `PurchaseHistoryQuery` returns `PurchaseHistoryReadModel[]`. Prisma adapter runs **exactly one** `findMany` with `include: { flashSale: { include: { product: true } } }` ordered by `purchasedAt DESC`. Resolver validates `userId` and maps read model → GraphQL. `PurchaseRepository` aggregate API stays unchanged. Redis untouched (#129).

**Tech Stack:** NestJS code-first GraphQL, Prisma, `@flash-sale/domain`, Jest unit + integration + schema tests.

**Spec:** [docs/superpowers/specs/2026-07-30-issue-125-my-purchases-history-query-design.md](../specs/2026-07-30-issue-125-my-purchases-history-query-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Baseline:** `main` at/after `3dd0415` (plus any docs commits for this ticket).

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Out of scope:** AuthN; pagination/client sort; full nested `FlashSale`; Redis / #129; #126 UI; #127 nav; #133/#134; web GraphQL client ops; purchase correctness changes.

**Hard invariants (locked):**

1. Do **not** extend `PurchaseRepository` with history/include methods.
2. `PurchaseHistoryReadModel` is a **read-composition transport** at the port boundary only — not a domain entity, not a GraphQL type.
3. History path issues **exactly one** Prisma `findMany` with the include tree above; no GraphQL field resolvers that hit the DB for `product` / `flashSale`.
4. Ordering is `purchasedAt DESC` only (adapter-owned). Equal timestamps have unspecified relative order — do not assert a secondary tie-break.
5. Empty/whitespace `userId` → `BAD_USER_INPUT` via `requireUserId`; no trim/normalize of the stored lookup string.
6. Valid unknown `userId` → `[]` (never `null` list).
7. No Redis keys, caches, or `purchaseItem` invalidation changes.
8. Schema test `#15` currently forbids a standalone `purchases(user_id)` index — **replace that assertion** when adding `@@index([userId])` so the suite expects the index.

---

## File map

Paths below are **suggested** where the layout is already clear; GraphQL object-type filenames may be new files or colocated following the existing purchase GraphQL layout. Prefer matching nearby modules over inventing a parallel structure.

| Path / area                                                            | Responsibility                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/domain/src/purchase/purchase-history.query.ts` (suggested)   | Port: `PURCHASE_HISTORY_QUERY`, `PurchaseHistoryQuery`, `PurchaseHistoryReadModel` |
| `packages/domain/src/index.ts`                                         | Re-export token + types                                                            |
| `packages/domain/src/purchase/purchase.repository.ts`                  | **Unchanged**                                                                      |
| `apps/api/prisma/schema.prisma`                                        | Add `@@index([userId])` on `Purchase`                                              |
| `apps/api/prisma/migrations/<timestamp>_…`                             | Migration creating the `user_id` index                                             |
| `apps/api/src/purchase/` — history query adapter                       | Prisma adapter implementing `PurchaseHistoryQuery`                                 |
| `apps/api/src/purchase/` — adapter unit spec                           | Adapter unit tests                                                                 |
| `apps/api/src/purchase/graphql/` (or existing purchase GraphQL layout) | GraphQL `FlashSaleRef` + `PurchaseHistoryItem`                                     |
| Existing purchase GraphQL resolver                                     | Add `myPurchases`; inject port; map read model                                     |
| `apps/api/src/purchase/purchase.module.ts`                             | Wire adapter → `PURCHASE_HISTORY_QUERY`                                            |
| Existing purchase resolver unit spec                                   | Resolver unit tests (+ update constructor stubs)                                   |
| `apps/api/test/graphql/graphql-api.integration.spec.ts`                | Schema + behavior integration                                                      |
| `apps/api/test/schema/flash-sale-schema.spec.ts`                       | Expect standalone `user_id` index                                                  |
| `docs/redis-caching-strategy.md`                                       | Note `myPurchases` is uncached (Postgres); #129 later                              |

---

## Task flow

```text
Task 1  →  Domain read-model contracts
Task 2  →  Persistence: migration + Prisma adapter
Task 3  →  GraphQL types, resolver, DI wiring
Task 4  →  Unit tests (resolver + adapter)
Task 5  →  GraphQL integration tests
Task 6  →  Regression + docs
```

---

### Task 1: Domain / read-model contracts

**Files:**

- Create: read-model query port under `packages/domain/src/purchase/` (suggested name `purchase-history.query.ts`)
- Modify: `packages/domain/src/index.ts`
- Do **not** modify: `packages/domain/src/purchase/purchase.repository.ts`, `packages/domain/src/purchase/purchase.ts`

**Acceptance:**

- Port + read model + DI token exported from `@flash-sale/domain`.
- Aggregate `PurchaseRepository` unchanged.

- [ ] **Step 1: Add the query port**

Export from `@flash-sale/domain` (same DI-token comment style as other ports):

```ts
export const PURCHASE_HISTORY_QUERY = Symbol('PURCHASE_HISTORY_QUERY');

export type PurchaseHistoryReadModel = {
  id: PurchaseId;
  purchasedAt: Date;
  flashSaleId: FlashSaleId;
  product: {
    id: ProductId;
    name: string;
    description: string | null;
  };
};

export interface PurchaseHistoryQuery {
  findByUser(userId: UserId): Promise<PurchaseHistoryReadModel[]>;
}
```

`PurchaseHistoryReadModel` is a read-composition transport only — not a domain entity, not a GraphQL type.

- [ ] **Step 2: Re-export from package index**

In `packages/domain/src/index.ts`, export `PURCHASE_HISTORY_QUERY`, `PurchaseHistoryQuery`, and `PurchaseHistoryReadModel` alongside other purchase exports.

- [ ] **Step 3: Build domain package**

Run: `pnpm --filter @flash-sale/domain build`

Expected: success.

- [ ] **Step 4: Optional commit**

```bash
git add packages/domain/src/purchase packages/domain/src/index.ts
git commit -m "feat(domain): add PurchaseHistoryQuery read-model port"
```

---

### Task 2: Persistence — index migration + Prisma adapter

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: Prisma migration for the `user_id` index (name via local workflow)
- Create: Prisma adapter implementing `PurchaseHistoryQuery` under `apps/api/src/purchase/`
- Modify: `apps/api/test/schema/flash-sale-schema.spec.ts` (**replace** the #15 “no standalone `user_id` index” assertion)
- Do **not** modify: the aggregate `PrismaPurchaseRepository` (write / by-sale lookup only)

**Acceptance:**

- `@@index([userId])` applied.
- Adapter satisfies `PurchaseHistoryQuery` using exactly one Prisma `findMany` (+ include + `purchasedAt desc`).
- Schema suite expects the new index.

- [ ] **Step 1: Add Prisma index**

On `Purchase` in `apps/api/prisma/schema.prisma`, keep the existing unique constraint and add:

```prisma
@@index([userId])
```

No other schema changes. No composite `(userId, purchasedAt)` index in #125.

- [ ] **Step 2: Create migration**

Generate a Prisma migration using the repository's existing migration workflow (name suggestion: `purchase_user_id_index`). Expected effect: a non-unique index on `purchases(user_id)`. Apply / generate the Prisma client as required by that workflow.

- [ ] **Step 3: Replace schema test expectation for standalone `user_id` index**

In `apps/api/test/schema/flash-sale-schema.spec.ts`, **replace** the block that asserts there is **no** standalone `purchases(user_id)` index with an assertion that such an index **exists** (owned by #125 for the history lookup). Update the comment so it no longer claims #15 forbids the index.

Example shape:

```ts
// #125: standalone purchases(user_id) index for myPurchases history lookup.
expect(
  indexes.some((idx) => idx.tablename === 'purchases' && /\(\s*user_id\s*\)/.test(idx.indexdef)),
).toBe(true);
```

- [ ] **Step 4: Implement Prisma adapter**

Implement `PurchaseHistoryQuery` with **one** `prisma.purchase.findMany`:

- `where: { userId }`
- `orderBy: { purchasedAt: 'desc' }`
- `include: { flashSale: { include: { product: true } } }`
- map each row → `PurchaseHistoryReadModel`
  - `id` from purchase id
  - `purchasedAt` from purchase
  - `flashSaleId` from related `FlashSale.id`
  - `product` from related product (`description` as Prisma `string | null`, including `null`)

Rules:

- Exactly one Prisma query per `findByUser` call.
- Do **not** route product fields through `Product.create` (domain-write validation/trim).
- Do **not** call `PurchaseRepository` from this adapter.
- Follow existing Nest `@Injectable()` + `PrismaService` patterns in `apps/api/src/purchase/`.

- [ ] **Step 5: Verify schema tests (after migrate applied to test DB)**

Run the API schema test suite via the repo’s usual command (e.g. `pnpm --filter api test:schema`).

Expected: pass (including the new `user_id` index assertion).

- [ ] **Step 6: Optional commit**

```bash
git add apps/api/prisma apps/api/src/purchase apps/api/test/schema/flash-sale-schema.spec.ts
git commit -m "feat(api): add purchase userId index and PurchaseHistoryQuery adapter"
```

---

### Task 3: GraphQL schema, resolver, DI wiring

**Files:**

- Add GraphQL object types for `FlashSaleRef` and `PurchaseHistoryItem` (new files or colocated following the existing purchase GraphQL layout; reuse existing `Product` GraphQL type)
- Modify: the existing GraphQL resolver responsible for purchase queries
- Modify: `apps/api/src/purchase/purchase.module.ts`
- Modify: existing purchase resolver unit spec — **only** update the shared constructor/`build` helper so current `myPurchase` / `purchaseItem` tests still construct the resolver with the new dependency (stub `findByUser`). Full `myPurchases` unit cases land in Task 4.

**Acceptance:**

- Schema types exist; `myPurchases` query wired; Nest provides `PURCHASE_HISTORY_QUERY`.
- Existing resolver unit suites still compile/pass with a history-query stub.

- [ ] **Step 1: Add GraphQL object types**

Expose code-first types matching the spec:

```graphql
type FlashSaleRef {
  id: ID!
}

type PurchaseHistoryItem {
  id: ID!
  purchasedAt: DateTime!
  flashSale: FlashSaleRef!
  product: Product!
}
```

Reuse the existing GraphQL `Product` type (do not invent a history-specific product summary).

- [ ] **Step 2: Wire module DI**

In `PurchaseModule`, register the Prisma history adapter under `PURCHASE_HISTORY_QUERY` (same `provide` / `useExisting` style as `PURCHASE_REPOSITORY`). Resolvers depend only on the port token.

- [ ] **Step 3: Add `myPurchases` on the purchase query resolver**

Extend the existing GraphQL resolver responsible for purchase queries:

1. Inject `PURCHASE_HISTORY_QUERY`.
2. Add `@Query` `myPurchases(userId: ID!): [PurchaseHistoryItem!]!`.
3. Validate with `requireUserId`.
4. Call `findByUser` once.
5. Map each `PurchaseHistoryReadModel` into a `PurchaseHistoryItem`.

Keep existing `myPurchase` / `purchaseItem` behavior unchanged aside from the new constructor dependency.

Rules:

- No GraphQL field resolvers that hit the DB for `product` / `flashSale`.
- Do not touch Redis invalidation in `purchaseItem`.

- [ ] **Step 4: Unblock existing resolver unit tests**

Prefer **extending the existing resolver factory/helper** in the purchase resolver spec so every construction path stubs `PurchaseHistoryQuery.findByUser`. Avoid introducing a separate `buildHistory` helper unless it materially improves readability.

Do **not** add `myPurchases` cases yet (Task 4).

- [ ] **Step 5: Unit smoke**

Run the existing purchase resolver unit suite. Expected: current suites pass.

- [ ] **Step 6: Optional commit**

```bash
git add apps/api/src/purchase
git commit -m "feat(api): expose GraphQL myPurchases history query"
```

---

### Task 4: Unit tests — resolver + adapter

**Files:**

- Create: adapter unit spec next to the history adapter
- Modify: existing purchase resolver unit spec (add `myPurchases` cases using the shared factory)

**Acceptance:**

- Adapter asserts Prisma args + mapping + empty list + null description.
- Resolver asserts validation-before-port, single port call, mapping, empty list.

- [ ] **Step 1: Adapter unit tests**

Cover at least:

1. **Args:** `findMany` called once with `where: { userId }`, `orderBy: { purchasedAt: 'desc' }`, and `include: { flashSale: { include: { product: true } } }`.
2. **Empty:** when Prisma returns `[]`, adapter returns `[]`.
3. **Mapping:** nested `flashSale.product` maps into `PurchaseHistoryReadModel` (`flashSaleId` from related sale id; product fields preserved).
4. **Null description:** Prisma `description: null` → read model `description: null`.

- [ ] **Step 2: Resolver unit tests for `myPurchases`**

Using the **extended existing** resolver factory (not a parallel helper unless necessary), cover:

1. Whitespace-only / empty `userId` → `BAD_USER_INPUT` and history port **not** called (include `it.each` for common whitespace cases).
2. Port called once with the validated `userId`; read model mapped to GraphQL `PurchaseHistoryItem` shape.
3. Port returns `[]` → resolver returns `[]`.

- [ ] **Step 3: Run unit tests**

Run the adapter + purchase resolver unit specs via the repo’s Jest workflow.

Expected: all pass.

- [ ] **Step 4: Optional commit**

```bash
git add apps/api/src/purchase
git commit -m "test(api): cover myPurchases resolver and history adapter"
```

---

### Task 5: GraphQL integration tests

**Files:**

- Modify: `apps/api/test/graphql/graphql-api.integration.spec.ts`

**Acceptance:**

- Introspection includes `Query.myPurchases`, `PurchaseHistoryItem`, `FlashSaleRef`.
- Behavior: empty; one; **multiple purchases across multiple flash sales**; isolation; newest-first regardless of insertion order; nested fields; `BAD_USER_INPUT`.

- [ ] **Step 1: Update schema contract introspection**

In the existing schema contract test, extend the query-name set to include `myPurchases`, and assert type fields for `PurchaseHistoryItem` (`id`, `purchasedAt`, `flashSale`, `product`) and `FlashSaleRef` (`id`). Keep existing `MyPurchaseResult` / `FlashSale` / `Product` assertions unchanged.

- [ ] **Step 2: Add history behavior tests**

Add a focused `it` (or small `describe`) using the file’s seed / cleanup / `postGraphql` helpers. Cover:

1. **Empty:** unknown `userId` → `data.myPurchases === []`, no errors.
2. **One:** create one purchase → returns that item with nested `flashSale.id` + `product { id name description }`.
3. **Multiple purchases across multiple flash sales + ordering:** because `UNIQUE(flashSaleId, userId)`, seed **two different flash sales** for the same user; insert the older `purchasedAt` **before** the newer one (insertion order ≠ purchase time); expect newest-first by `purchasedAt` regardless of insertion order.
4. **Isolation:** user A and user B each have purchases; `myPurchases(userA)` never returns B’s rows.
5. **Validation:** whitespace-only `userId` → `BAD_USER_INPUT`.

Query document (fields as needed):

```graphql
query MyPurchases($userId: ID!) {
  myPurchases(userId: $userId) {
    id
    purchasedAt
    flashSale {
      id
    }
    product {
      id
      name
      description
    }
  }
}
```

Always clean up seeded sales/purchases in `finally` (extend cleanup if a second sale suffix is used).

- [ ] **Step 3: Run GraphQL integration suite**

Requires Postgres (+ Redis if the suite boots the full app). Run `graphql-api.integration` via the repo’s integration test workflow.

Expected: pass, including new history cases and updated introspection.

- [ ] **Step 4: Optional commit**

```bash
git add apps/api/test/graphql/graphql-api.integration.spec.ts
git commit -m "test(api): integrate myPurchases history GraphQL contract"
```

---

### Task 6: Regression & documentation

**Files:**

- Modify (light): `docs/redis-caching-strategy.md` — document that `myPurchases` is **not** Redis-cached in #125
- Optionally touch `README.md` only if it lists GraphQL operations and would otherwise be wrong
- Do **not** modify Redis cache classes / invalidation code

**Acceptance:**

- Existing `myPurchase` / Redis cache integration suites green.
- Docs state history is Postgres-direct until #129.
- Spec success criteria checklist can be marked done in the PR description (do not require editing the design doc unless asked).

- [ ] **Step 1: Document uncached `myPurchases`**

In `docs/redis-caching-strategy.md`, under “What Redis owns / does not own” (or cache keys table), add a short note that `myPurchases` (#125) is served directly from Postgres (uncached), and that history list caching + SUCCESS invalidation is deferred to #129.

Do **not** invent a key prefix or TTL.

- [ ] **Step 2: Run regression suites**

Rebuild domain; run purchase unit specs, schema tests, and integration suites covering `graphql-api.integration` + `redis-query-cache` via the repo’s usual commands.

Expected: all pass. Confirm no new Redis key helpers or invalidation branches landed in the diff.

- [ ] **Step 3: Diff hygiene check**

```bash
git diff --stat
rg -n "myPurchases|PURCHASE_HISTORY|PurchaseHistory" apps/api/src/redis apps/api/src/purchase/my-purchase-query.cache.ts apps/api/src/purchase
```

Expected:

- Redis folder: **no** history cache additions.
- `purchaseItem` SUCCESS invalidation still only covers flash-sale + singular `myPurchase`.
- History query present on resolver + port wiring only.
- `PurchaseRepository` unchanged (no history/include methods; aggregate API intact).

- [ ] **Step 4: Optional commit**

```bash
git add docs/redis-caching-strategy.md
git commit -m "docs: note myPurchases is uncached until #129"
```

---

## Spec coverage checklist

| Spec requirement                                                            | Task         |
| --------------------------------------------------------------------------- | ------------ |
| `PurchaseHistoryQuery` + `PurchaseHistoryReadModel` + token                 | 1            |
| `@@index([userId])`                                                         | 2            |
| Single Prisma `findMany` + include                                          | 2, 4         |
| GraphQL `PurchaseHistoryItem` / `FlashSaleRef` / `myPurchases`              | 3, 5         |
| Resolver mapping; `requireUserId`                                           | 3, 4         |
| Empty / one / multiple across sales; isolation; newest-first; nested fields | 5            |
| Schema introspection                                                        | 5            |
| No Redis / #129 seam                                                        | 6            |
| `PurchaseRepository` unchanged                                              | 1–6 (verify) |
| Schema test assertion **replaced** for `user_id` index                      | 2            |

---

## Self-review notes (plan author)

- Spec remains authoritative for contracts; this plan specifies behavior and checkpoints, not brittle full source dumps for adapter/resolver bodies.
- GraphQL file layout and resolver class organization follow existing purchase GraphQL conventions.
- Adapter empty-list coverage is explicit in Task 4 (not only via resolver).
- Integration “many” case requires **multiple flash sales** because of `UNIQUE(flashSaleId, userId)`.
- Resolver unit helpers: extend the existing factory; avoid a parallel `buildHistory` unless readability clearly wins.
- Schema suite: **replace** (not casually “flip”) the #15 no-`user_id`-index assertion.
