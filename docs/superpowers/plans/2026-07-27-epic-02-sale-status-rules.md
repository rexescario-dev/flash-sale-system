# EPIC-02 #14 — Sale Status Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#14](https://github.com/rexescario-dev/flash-sale-system/issues/14) by adding derived `FlashSale.getStatus(nowUtc)` status resolution (`UPCOMING` / `ACTIVE` / `SOLD_OUT` / `ENDED`) to `@flash-sale/domain`, with `INVALID_NOW` validation, exported `FlashSaleStatus`, and Jest coverage of the full time × stock matrix — zero Nest/Prisma/Redis; no purchase-gate helpers; no FlashSale ID normalization changes.

**Architecture:** Status is **derived, not persisted**. Add a pure instance method on the existing rich `FlashSale` class that compares absolute instants via `Date#getTime()` (half-open window `[startsAt, endsAt)`), then applies inventory (`remainingStock === 0` → `SOLD_OUT`) only inside the open window. Temporal rules beat inventory (`ENDED` wins after `endsAt`). Extend `FlashSaleValidationErrorCode` with `INVALID_NOW`. Keep `FlashSaleStatus` in `flash-sale.ts` (no status module).

**Tech Stack:** TypeScript (NodeNext ESM), existing `@flash-sale/domain` package, Jest + ts-jest, ESLint perfectionist (ids first, then A→Z).

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md) (`#14 — Implement sale status rules`)

**Authority:** The approved umbrella spec is authoritative. This plan operationalizes it and must **not** alter its contract. Do not invent requirements.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

---

## File map

| Path                                                  | Responsibility                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/domain/src/flash-sale/flash-sale.errors.ts` | Add `INVALID_NOW` to `FlashSaleValidationErrorCode` (perfectionist order) |
| `packages/domain/src/flash-sale/flash-sale.ts`        | Add `FlashSaleStatus` type + `getStatus(nowUtc)`                          |
| `packages/domain/src/flash-sale/flash-sale.spec.ts`   | Add `describe('FlashSale.getStatus')` covering the status matrix          |
| `packages/domain/src/index.ts`                        | Export `FlashSaleStatus`                                                  |
| `packages/domain/src/ids.ts`                          | Untouched                                                                 |
| `packages/domain/src/product/**`                      | Untouched                                                                 |
| `packages/domain/src/purchase/**`                     | Untouched                                                                 |

No new packages, root tooling, Prisma, Nest, GraphQL, Redis, or `flash-sale.status.ts`.

---

## Task 0: Sync baseline and create branch

**Files:** none (git only)

- [ ] **Step 1: Sync `origin/main` and verify #11–#13 domain baseline**

```bash
cd /home/rex/Project/test/app
git fetch origin
git checkout main
git pull --ff-only origin main
git status -sb
test -f packages/domain/src/flash-sale/flash-sale.ts
test -f packages/domain/src/product/product.ts
test -f packages/domain/src/purchase/purchase.ts
rg -n "getStatus|FlashSaleStatus|INVALID_NOW" packages/domain/src/flash-sale || true
rg -n "static create|static reconstitute|getRemainingStock" packages/domain/src/flash-sale/flash-sale.ts
```

Expected:

- Clean working tree on `main` tracking `origin/main` (or only intentional uncommitted `#14` docs already present)
- `FlashSale` / `Product` / `Purchase` entity files present
- `#11` FlashSale API baseline present: `static create`, `static reconstitute`, and `getRemainingStock` all match in `flash-sale.ts` (the `#14` fixtures depend on these)
- No existing `getStatus` / `FlashSaleStatus` / `INVALID_NOW` in flash-sale sources yet
- **Docs handling:** If the finalized `#14` spec/plan is already present in the working tree, preserve it. Do **not** create or modify documentation unless the user explicitly intends the feature branch to carry those docs. Implementation work must not invent doc changes.

- [ ] **Step 2: Create feature branch (do not reset an existing branch)**

```bash
git switch -c feat/epic-02-sale-status-rules origin/main
```

Expected: on branch `feat/epic-02-sale-status-rules` created from `origin/main`.

If the feature branch already exists, **stop and inspect it** rather than resetting it (`git switch -c` / `git checkout -b` should fail instead of silently repointing). Do **not** use `git checkout -B` for this step.

- [ ] **Step 3: Confirm clean domain package quality gate baseline**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter @flash-sale/domain lint
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain build
```

Expected: all pass on the `#11`+`#12`+`#13` baseline before status changes.

---

## Task 1: Write failing `getStatus` tests (TDD)

**Files:**

- Modify: `packages/domain/src/flash-sale/flash-sale.spec.ts`

- [ ] **Step 1: Append a `FlashSale.getStatus` describe block implementing the full matrix**

Reuse existing helpers at the top of the file (`asFlashSaleId`, `asProductId`, `id`, `productId`, `startsAt`, `endsAt`, `expectValidationError`). Do **not** remove or rewrite existing `create` / `reconstitute` suites.

Append (after the existing suites):

```ts
describe('FlashSale.getStatus', () => {
  const beforeStart = new Date('2026-07-26T09:59:59.999Z');
  const atStart = new Date('2026-07-26T10:00:00.000Z');
  const during = new Date('2026-07-26T11:00:00.000Z');
  const atEnd = new Date('2026-07-26T12:00:00.000Z');
  const afterEnd = new Date('2026-07-26T12:00:00.001Z');

  function saleWithStock(remainingStock: number): FlashSale {
    if (remainingStock === 100) {
      return FlashSale.create({
        id,
        productId,
        endsAt,
        startsAt,
        totalStock: 100,
      });
    }

    return FlashSale.reconstitute({
      id,
      productId,
      endsAt,
      remainingStock,
      startsAt,
      totalStock: 100,
    });
  }

  it.each([
    {
      label: 'before start, stock > 0',
      now: beforeStart,
      remainingStock: 100,
      expected: 'UPCOMING',
    },
    {
      label: 'before start, stock === 0',
      now: beforeStart,
      remainingStock: 0,
      expected: 'UPCOMING',
    },
    {
      label: 'at start, stock > 0',
      now: atStart,
      remainingStock: 100,
      expected: 'ACTIVE',
    },
    {
      label: 'at start, stock === 0',
      now: atStart,
      remainingStock: 0,
      expected: 'SOLD_OUT',
    },
    {
      label: 'during window, stock > 0',
      now: during,
      remainingStock: 100,
      expected: 'ACTIVE',
    },
    {
      label: 'during window, stock === 0',
      now: during,
      remainingStock: 0,
      expected: 'SOLD_OUT',
    },
    {
      label: 'at end, stock > 0',
      now: atEnd,
      remainingStock: 100,
      expected: 'ENDED',
    },
    {
      label: 'at end, stock === 0',
      now: atEnd,
      remainingStock: 0,
      expected: 'ENDED',
    },
    {
      label: 'after end, stock > 0',
      now: afterEnd,
      remainingStock: 100,
      expected: 'ENDED',
    },
    {
      label: 'after end, stock === 0',
      now: afterEnd,
      remainingStock: 0,
      expected: 'ENDED',
    },
  ] as const)('$label → $expected', ({ now, remainingStock, expected }) => {
    const sale = saleWithStock(remainingStock);
    expect(sale.getStatus(now)).toBe(expected);
  });

  it('throws INVALID_NOW when Date#getTime() is NaN', () => {
    const sale = saleWithStock(100);
    expectValidationError(() => sale.getStatus(new Date('invalid')), 'INVALID_NOW');
  });

  it('compares absolute instants regardless of timezone offset', () => {
    const sale = saleWithStock(100);

    // 19:00+08:00 == 11:00Z, which is inside [10:00Z, 12:00Z)
    expect(sale.getStatus(new Date('2026-07-26T19:00:00+08:00'))).toBe('ACTIVE');
  });

  it('does not mutate remainingStock when resolving status', () => {
    const sale = saleWithStock(100);
    sale.getStatus(during);
    expect(sale.getRemainingStock()).toBe(100);
    sale.getStatus(afterEnd);
    expect(sale.getRemainingStock()).toBe(100);
  });
});
```

Rules:

- The `it.each` block is the authoritative **10-case time × stock matrix** (before/at/during/at-end/after × stock `> 0` / `=== 0`), covering half-open boundaries and `ENDED` vs `SOLD_OUT` precedence.
- Also include the absolute-instant / timezone-offset case above to lock `Date#getTime()` semantics (no domain timezone conversion).
- Assert status strings and error `code` only — do **not** freeze error message text.
- Zero-stock cases must use `reconstitute` (no stock-mutation API in `#14`).
- Do **not** use a live clock (`Date.now()` / `new Date()` without fixed ISO strings for status cases).
- Do **not** add purchase-gate helper tests.
- The non-mutation case is a **remainingStock regression** for derived/pure status — not a comprehensive purity proof of every field.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm --filter @flash-sale/domain test -- flash-sale.spec.ts
```

Expected: FAIL — `getStatus` is not a function / property does not exist on `FlashSale` (and/or `INVALID_NOW` is not a valid code yet if TypeScript fails first; either failure mode is acceptable before Task 2).

- [ ] **Step 3: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/flash-sale/flash-sale.spec.ts
git commit -m "$(cat <<'EOF'
test: add FlashSale.getStatus matrix coverage

EOF
)"
```

---

## Task 2: Add `INVALID_NOW` error code

**Files:**

- Modify: `packages/domain/src/flash-sale/flash-sale.errors.ts`

- [ ] **Step 1: Extend the union; leave the class unchanged**

Add `'INVALID_NOW'` to `FlashSaleValidationErrorCode`. Keep the union sorted according to the repository’s existing ESLint perfectionist configuration (illustrative current order):

```ts
export type FlashSaleValidationErrorCode =
  | 'EMPTY_ID'
  | 'EMPTY_PRODUCT_ID'
  | 'INVALID_NOW'
  | 'INVALID_REMAINING_STOCK'
  | 'INVALID_SALE_WINDOW'
  | 'INVALID_TOTAL_STOCK'
  | 'REMAINING_STOCK_EXCEEDS_TOTAL';
```

Keep `FlashSaleValidationError` exactly as it is (constructor assigns `code` + `name`). Do **not** add a separate status-error class.

- [ ] **Step 2: Lint/typecheck the errors file path via package scripts**

```bash
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain lint
```

Expected: PASS for typecheck/lint (tests may still fail until `getStatus` exists).

- [ ] **Step 3: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/flash-sale/flash-sale.errors.ts
git commit -m "$(cat <<'EOF'
feat: add INVALID_NOW FlashSale validation code

EOF
)"
```

---

## Task 3: Implement `FlashSaleStatus` + `getStatus`

**Files:**

- Modify: `packages/domain/src/flash-sale/flash-sale.ts`

- [ ] **Step 1: Add the status union near the top-level declarations**

Place this **above** the `FlashSale` class (with the other exported types). Keep the union sorted according to the repository’s existing ESLint perfectionist configuration (illustrative current order):

```ts
export type FlashSaleStatus = 'ACTIVE' | 'ENDED' | 'SOLD_OUT' | 'UPCOMING';
```

Do **not** create `flash-sale.status.ts`.

- [ ] **Step 2: Add `getStatus` as a pure instance method**

Place `getStatus` according to the repository’s existing class-member ordering / lint rules. Do **not** reorder unrelated existing members.

```ts
  getStatus(nowUtc: Date): FlashSaleStatus {
    if (Number.isNaN(nowUtc.getTime())) {
      throw new FlashSaleValidationError(
        'INVALID_NOW',
        'FlashSale nowUtc must be a valid Date',
      );
    }

    if (nowUtc.getTime() < this.startsAt.getTime()) {
      return 'UPCOMING';
    }

    if (nowUtc.getTime() >= this.endsAt.getTime()) {
      return 'ENDED';
    }

    if (this.remainingStock === 0) {
      return 'SOLD_OUT';
    }

    return 'ACTIVE';
  }
```

Rules:

- Use `getTime()` comparisons (not bare `Date` relational operators alone).
- Do **not** revalidate `startsAt` / `endsAt` (already guaranteed by `create` / `reconstitute`).
- Do **not** add `instanceof Date` checks. `INVALID_NOW` covers only invalid `Date` objects where `Date#getTime()` is `NaN`. Non-`Date` runtime values are outside this contract (may throw a native `TypeError`).
- Do **not** mutate any field; do **not** assign/cache `status` on the entity.
- Do **not** change ID normalization / factories / existing getters.
- Do **not** add purchase-gate helpers.

- [ ] **Step 3: Run tests and confirm pass**

```bash
pnpm --filter @flash-sale/domain test -- flash-sale.spec.ts
```

Expected: PASS — 10-case matrix + absolute-instant offset case + `INVALID_NOW` + remainingStock non-mutation regression.

- [ ] **Step 4: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/flash-sale/flash-sale.ts
git commit -m "$(cat <<'EOF'
feat: resolve FlashSale status from window and stock

EOF
)"
```

---

## Task 4: Export `FlashSaleStatus` from the package public API

**Files:**

- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Export the new type with existing FlashSale exports**

Add `FlashSaleStatus` to the FlashSale type export line (accept ESLint perfectionist reorder of the whole file):

```ts
export type {
  FlashSaleCreateProps,
  FlashSaleReconstituteProps,
  FlashSaleStatus,
} from './flash-sale/flash-sale.js';
```

If the current file uses separate `export type` lines, keep the established style and add:

```ts
export type { FlashSaleStatus } from './flash-sale/flash-sale.js';
```

Do **not** remove existing Product / Purchase / ID exports. Do **not** export helpers or aliases.

- [ ] **Step 2: Verify export surface**

```bash
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain build
node --input-type=module -e "import { FlashSale } from './packages/domain/dist/index.js'; const s=FlashSale.create({id:'sale-1',productId:'product-1',startsAt:new Date('2026-07-26T10:00:00.000Z'),endsAt:new Date('2026-07-26T12:00:00.000Z'),totalStock:1}); console.log(s.getStatus(new Date('2026-07-26T11:00:00.000Z')));"
```

Expected:

- `typecheck` verifies the `FlashSaleStatus` public **type** export (types are erased at runtime; the Node smoke test cannot prove the type export)
- `build` PASS
- Node smoke test prints `ACTIVE` — verifies built runtime `FlashSale.getStatus()` behavior via the package entrypoint

Note: branded ids and `FlashSaleStatus` are erased at runtime; the smoke import uses plain strings only to exercise the built JS. Prefer the Jest suite for typed coverage. No dedicated type-only public-API test is required for `#14`.

- [ ] **Step 3: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: export FlashSaleStatus from domain package

EOF
)"
```

---

## Task 5: Package quality gates and scope hygiene

**Files:** none (verification)

- [ ] **Step 1: Run domain package gates**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter @flash-sale/domain lint
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain build
```

Expected: all PASS.

- [ ] **Step 2: Confirm zero runtime dependencies**

```bash
node -e "const p=require('./packages/domain/package.json'); if (Object.keys(p.dependencies ?? {}).length !== 0) throw new Error('Domain package must have zero runtime dependencies'); console.log('dependencies:', p.dependencies ?? {});"
```

Expected: prints `dependencies: {}` (or equivalent empty object) and exits 0.

- [ ] **Step 3: Confirm scope hygiene (paths + newly introduced forbidden symbols)**

```bash
git status -sb
git diff --name-only origin/main...HEAD
git diff origin/main...HEAD -- packages/domain/src
```

If there is no commit yet, use working-tree diffs instead:

```bash
git diff --name-only
git diff -- packages/domain/src
```

Expected touched **implementation** paths only under:

- `packages/domain/src/flash-sale/flash-sale.ts`
- `packages/domain/src/flash-sale/flash-sale.errors.ts`
- `packages/domain/src/flash-sale/flash-sale.spec.ts`
- `packages/domain/src/index.ts`

Docs appear in the diff **only** if the user explicitly intended the branch to carry the finalized `#14` spec/plan. Do not add docs opportunistically.

Must **not** include `product/**`, `purchase/**`, `ids.ts` changes, Prisma, Nest modules, GraphQL, Redis.

Inspect the `packages/domain/src` diff for **newly introduced** forbidden symbols (do not fail solely because of pre-existing trees outside the diff):

- purchase-gate helpers: `isPurchaseOpen`, `assertPurchaseOpen`, `canPurchase`
- status aliases / modules: `NOT_STARTED`, `flash-sale.status`
- uniqueness / purchase outcomes: `ALREADY_PURCHASED`, `assertUniquePurchase`

Expected: none of those appear as additions in the `#14` diff.

Optional purity scan (redundant if gates already enforce domain purity):

```bash
rg -n "from ['\"](@nestjs|@prisma|ioredis|redis)" packages/domain/src || true
```

Expected: no matches.

- [ ] **Step 4: Confirm ID normalization unchanged via entity diff**

```bash
git diff origin/main...HEAD -- packages/domain/src/flash-sale/flash-sale.ts
```

(or `git diff -- packages/domain/src/flash-sale/flash-sale.ts` if uncommitted)

Expected: the `flash-sale.ts` diff only adds `FlashSaleStatus` and `getStatus` (plus any lint-required adjacent formatting). No factory / ID blankness / ID storage policy changes.

- [ ] **Step 5: Single authorized commit for the whole ticket (optional — only if authorized)**

If intermediate commits were skipped, one commit is fine:

```bash
git add \
  packages/domain/src/flash-sale/flash-sale.ts \
  packages/domain/src/flash-sale/flash-sale.errors.ts \
  packages/domain/src/flash-sale/flash-sale.spec.ts \
  packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add FlashSale UTC status resolution

EOF
)"
```

If docs are included in the same authorized commit set, stage them explicitly; do not sneak unrelated files.

---

## Task 6: Final acceptance review

- [ ] **Step 1: Map implementation against `#14` contract**

- [ ] `getStatus(nowUtc: Date): FlashSaleStatus` exists on `FlashSale`
- [ ] Statuses: `UPCOMING` | `ACTIVE` | `SOLD_OUT` | `ENDED` (no aliases)
- [ ] Precedence: invalid → upcoming → ended → sold out → active
- [ ] Half-open window `[startsAt, endsAt)`
- [ ] `ENDED` beats `SOLD_OUT` when `now >= endsAt`
- [ ] Invalid `Date` (`Date#getTime()` is `NaN`, e.g. `new Date('invalid')`) → `FlashSaleValidationError` / `INVALID_NOW`
- [ ] No broader runtime type validation of `nowUtc` (no `instanceof Date`); non-`Date` callers may throw a native `TypeError` under the TypeScript `Date` contract
- [ ] No `instanceof Date` check
- [ ] Pure read — no entity mutation / no persisted status field
- [ ] No purchase-gate helpers
- [ ] No stock mutation APIs
- [ ] No FlashSale ID normalization changes
- [ ] `FlashSaleStatus` exported from `packages/domain/src/index.ts`
- [ ] Tests cover the 10-case time × stock matrix + absolute-instant offset case + `INVALID_NOW` + remainingStock non-mutation regression
- [ ] `@flash-sale/domain` still has zero runtime dependencies
- [ ] No Nest/Prisma/Redis/GraphQL / Product / Purchase changes
- [ ] ESLint perfectionist satisfied (follow repo config; ids-first / member sorting as configured)

- [ ] **Step 2: Re-run final gates once**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter @flash-sale/domain lint
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain build
```

Expected: PASS.

---

## Out of scope (do not implement)

- Purchase-gate helpers / purchasability policy (`#20`)
- Stock mutation / reserve / purchase (`#19`–`#20`)
- Purchase uniqueness / `ALREADY_PURCHASED` (`#16` / `#18` / `#20`)
- FlashSale ID trim / normalization alignment (follow-up debt)
- Persisted `status` column / entity status field
- `instanceof Date` runtime checks on `nowUtc`
- Value objects (`SaleWindow`, `Stock`)
- Free-function status resolver / `flash-sale.status.ts` policy engine
- Prisma schema (`#15`) / repository ports (`#17`) / adapters (`#18`)
- GraphQL (EPIC-03) / Redis (EPIC-04)

---

## Spec coverage self-review

| Spec requirement                                     | Task                     |
| ---------------------------------------------------- | ------------------------ |
| `FlashSale.getStatus(nowUtc)` instance method        | Task 3                   |
| `FlashSaleStatus` union (perfectionist order)        | Tasks 3–4                |
| Temporal-first precedence + half-open window         | Tasks 1, 3               |
| `ENDED` over `SOLD_OUT` after end                    | Tasks 1, 3               |
| `INVALID_NOW` when `Date#getTime()` is `NaN`         | Tasks 1–3                |
| No `instanceof Date` / no broader runtime typing     | Task 3 rules; Task 6     |
| `#11` create/reconstitute/getRemainingStock baseline | Task 0                   |
| Pure read / derived status (no status field)         | Tasks 1, 3               |
| No purchase-gate helpers                             | Tasks 1, 5, Out of scope |
| No ID normalization changes                          | Tasks 0, 3, 5            |
| Export `FlashSaleStatus`                             | Task 4                   |
| 10-case time × stock matrix + boundary precedence    | Task 1                   |
| Absolute-instant / timezone-offset semantics         | Task 1                   |
| Domain purity (no Nest/Prisma/Redis runtime deps)    | Tasks 0, 5–6             |

No placeholders remain in this plan. Types/signatures match the approved `#14` contract (`getStatus(nowUtc: Date): FlashSaleStatus`, `INVALID_NOW`).
