# Issue #129 — Purchase Cache Invalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After `purchaseItem` settles, keep TanStack Query caches for catalog (`flashSales`), sale detail (`flashSale`), `myPurchase`, and `myPurchases` consistent — client-only; no Redis/API changes.

**Architecture:** Extend the existing `usePurchaseItem` `onSettled` invalidation set. Keep `onSettled` (not SUCCESS-only) to match today’s flashSale/myPurchase behavior including request errors. Clarify in docs that Redis `myPurchases` caching is **not** #129.

**Tech Stack:** React, TanStack Query v5, Vitest, MSW (existing FlashSalePage tests)

**Do not invent commits** beyond the logical groups requested at finish time.

---

## Design summary (approved)

| Concern      | Decision                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------- |
| Scope        | Client TanStack Query only                                                                  |
| Trigger      | `onSettled` (success **and** error), same as today                                          |
| Keys         | `flashSale(id)`, `myPurchase(id,userId)`, **+** `flashSales()`, **+** `myPurchases(userId)` |
| Redis        | Unchanged; `myPurchases` stays Postgres-uncached                                            |
| Out of scope | #130 Playwright, #128 primitives, server Redis/API                                          |

**Query key factories:** Reuse the existing exported helpers (`flashSaleQueryKey`, `flashSalesQueryKey`, `myPurchaseQueryKey`, `myPurchasesQueryKey`). Import them; do **not** introduce duplicate key helpers.

**Invalidation style:** Preserve the existing `onSettled` callback and add the two additional invalidations without changing mutation semantics. Ordering is **not** significant.

---

### Task 1: Failing test for extended invalidation

**Files:**

- Prefer extend: if `apps/web/src/hooks/usePurchaseItem.test.tsx` (or similar hook coverage) already exists, extend it instead of creating a parallel test file
- Else create: `apps/web/src/hooks/usePurchaseItem.test.tsx`
- Modify (later): `apps/web/src/hooks/usePurchaseItem.ts`

**Planning note:** Before creating `usePurchaseItem.test.tsx`, check whether a hook test already exists. If one does, extend it; keeping tests colocated with existing coverage is preferable.

- [x] **Step 1: Write the failing hook test(s)**

Assert that after settlement (success **and** error), `invalidateQueries` is called with each of:

- `flashSaleQueryKey(flashSaleId)`
- `myPurchaseQueryKey(flashSaleId, userId)`
- `flashSalesQueryKey()`
- `myPurchasesQueryKey(userId)`

Use `expect.arrayContaining([...])` on the collected `queryKey`s. **Do not** assert `toHaveLength(4)` or any exact total call count — that couples the test to implementation. Optional: if preventing duplicates matters, count occurrences of each expected key instead of asserting total calls.

Sketch (adapt to existing file patterns / ESLint import order):

```tsx
const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
expect(keys).toEqual(
  expect.arrayContaining([
    flashSaleQueryKey('sale-123'),
    myPurchaseQueryKey('sale-123', 'user-456'),
    flashSalesQueryKey(),
    myPurchasesQueryKey('user-456'),
  ]),
);
// do NOT: expect(keys).toHaveLength(4);
```

Cover both success settlement and mutation error settlement.

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/hooks/usePurchaseItem.test.tsx`

Expected: FAIL because `flashSales` / `myPurchases` keys are not yet invalidated (missing from `arrayContaining`), not because of setup/import errors.

- [x] **Step 3: Commit when requested at finish**

---

### Task 2: Extend `usePurchaseItem` invalidation

**Files:**

- Modify: `apps/web/src/hooks/usePurchaseItem.ts`

- [x] **Step 1: Implement the behavioral change**

Extend the existing `onSettled` invalidation logic by adding:

- `flashSalesQueryKey()`
- `myPurchasesQueryKey(userId)`

Preserve the existing invalidation of:

- `flashSaleQueryKey(flashSaleId)`
- `myPurchaseQueryKey(flashSaleId, userId)`

Reuse the existing exported query key factories; do not introduce duplicate key helpers. Preserve the existing `onSettled` callback and add the two additional invalidations without changing mutation semantics (do not move this logic to `onSuccess`). Ordering is not significant — do not rewrite the whole hook unless required.

- [x] **Step 2: Run hook tests + full web suite**

Run:

```bash
pnpm --filter web test -- src/hooks/usePurchaseItem.test.tsx
pnpm --filter web test
```

Expected: all pass.

**Watch:** Existing `FlashSalePage` tests should continue passing without modification unless they intentionally assert the number of invalidations. Prefer leaving those page tests unchanged.

- [x] **Step 3: Commit when requested at finish**

---

### Task 3: Docs clarification (Redis ≠ #129)

**Files:**

- Modify: `docs/redis-caching-strategy.md` (primary)
- Optionally touch only the misleading #125 forward-looking sentences that claim #129 owns Redis history cache — rewrite those lines so they do not assign Redis work to #129.

- [x] **Step 1: Update the section describing `myPurchases` caching** in `docs/redis-caching-strategy.md`

Replace the note that deferred Redis history caching / invalidation to #129 with wording equivalent to:

```markdown
**`myPurchases` (#125):** served directly from Postgres (uncached).

**#129 scope note:** Issue #129 improves **client-side** TanStack Query invalidation after `purchaseItem` (catalog `flashSales`, sale `flashSale`, `myPurchase`, and `myPurchases` history). It does **not** add Redis caching or server-side invalidation for `myPurchases`. Some older planning documents referenced Redis history caching under #129. Those references are superseded; #129 is limited to client-side TanStack Query invalidation. Introduce any server Redis history cache in a **separate** issue if needed.
```

- [x] **Step 2: Fix outdated #125 design forward-refs**

In `docs/superpowers/specs/2026-07-30-issue-125-my-purchases-history-query-design.md`:

- Change the Cache row / “Future extension (#129)” wording so #129 is described as **client TanStack Query invalidation**, not Redis history cache.
- Keep “Redis untouched in #125” historically accurate; only stop saying #129 owns Redis history.

Example replacement for the Future extension blurb:

```markdown
**Later work:** #129 invalidates the client `myPurchases` TanStack Query key after purchase settlement. Server-side Redis caching for history (if ever desired) is a separate issue — not #129.
```

- [x] **Step 3: Do not rewrite every historical “#129 Redis” out-of-scope line in #122–#127 plans** — those are historical scope fences. The redis strategy + #125 forward-ref are enough clarification.

- [x] **Step 4: Commit when requested at finish**

---

## Spec coverage checklist

| Requirement                              | Task                     |
| ---------------------------------------- | ------------------------ |
| Invalidate `flashSales` after buy        | 1–2                      |
| Invalidate `myPurchases` after buy       | 1–2                      |
| Keep `flashSale` + matching `myPurchase` | 2 (preserve)             |
| Docs: Redis history ≠ #129               | 3                        |
| No Redis/API changes                     | all (explicit non-goals) |
| No #130 / #128                           | all                      |

---

## Execution

Implemented via subagent-driven-development on `feat/129-purchase-cache-invalidation`. Commits and PR at finish per user request.
