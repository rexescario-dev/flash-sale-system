# EPIC-02 #13 — Purchase Domain Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#13](https://github.com/rexescario-dev/flash-sale-system/issues/13) by adding a pure `Purchase` entity to `@flash-sale/domain` with `create`-only factory, non-blank ID checks that preserve supplied identity, valid `purchasedAt` with defensive `Date` copies, typed validation errors, and Jest unit tests — zero Nest/Prisma/Redis; no `FlashSale` / `Product` entity edits.

**Architecture:** Rich class in `packages/domain/src/purchase/` mirroring `#11`/`#12` style (private state, factory, getters, `PurchaseValidationError`). Add compile-time `PurchaseId` and `UserId` brands to `ids.ts`. Validate blankness via `trim()` but **store original IDs unchanged**. Reject invalid `Date` (`NaN` `getTime()`). Document `(flashSaleId, userId)` uniqueness as a domain rule only — no uniqueness helper API. No `reconstitute`, no `productId`/`quantity`, no persistence.

**Tech Stack:** TypeScript (NodeNext ESM), existing `@flash-sale/domain` package, Jest + ts-jest, ESLint perfectionist (ids first, then A→Z).

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md) (`#13 — Purchase domain model`)

**Authority:** The approved umbrella spec is authoritative. This plan operationalizes it and must **not** alter its contract. Do not invent requirements.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

---

## File map

| Path                                              | Responsibility                                        |
| ------------------------------------------------- | ----------------------------------------------------- |
| `packages/domain/src/ids.ts`                      | Add `PurchaseId`, `UserId` (compile-time brands only) |
| `packages/domain/src/flash-sale/**`               | Untouched                                             |
| `packages/domain/src/product/**`                  | Untouched                                             |
| `packages/domain/src/purchase/purchase.errors.ts` | `PurchaseValidationError` + codes                     |
| `packages/domain/src/purchase/purchase.ts`        | `Purchase` entity + `PurchaseCreateProps`             |
| `packages/domain/src/purchase/purchase.spec.ts`   | Jest unit tests (local brand casts only)              |
| `packages/domain/src/index.ts`                    | Add Purchase exports; re-export all four ID brands    |

No new packages, root tooling, Prisma, Nest, GraphQL, or Redis.

---

## Task 0: Sync baseline and create branch

**Files:** none (git only)

- [ ] **Step 1: Sync `origin/main` and verify #11/#12 domain baseline**

```bash
cd /home/rex/Project/test/app
git fetch origin
git checkout main
git pull --ff-only origin main
git status -sb
test -f packages/domain/src/ids.ts
test -f packages/domain/src/flash-sale/flash-sale.ts
test -f packages/domain/src/product/product.ts
rg -n "FlashSaleId|ProductId" packages/domain/src/ids.ts packages/domain/src/index.ts
```

Expected:

- Clean working tree on `main` tracking `origin/main`
- `origin/main` contains the implemented `#11`/`#12` domain package structure and exports (`FlashSale` + `Product` entity files present; `FlashSaleId` and `ProductId` defined/exported)
- Do **not** invent the `#13` contract — if the approved umbrella-spec `#13` section is only uncommitted / on another docs branch, carry that finalized spec onto the feature branch before coding

- [ ] **Step 2: Create feature branch**

```bash
git checkout -B feat/epic-02-purchase-domain origin/main
```

Expected: on branch `feat/epic-02-purchase-domain`.

- [ ] **Step 3: Confirm clean domain package quality gate baseline**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter @flash-sale/domain lint
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain build
```

Expected: all pass on the `#11`+`#12` baseline before Purchase changes.

---

## Task 1: Extend compile-time ID brands

**Files:**

- Modify: `packages/domain/src/ids.ts`

- [ ] **Step 1: Add `PurchaseId` and `UserId`; preserve existing brands exactly**

Extend the existing file — do **not** delete or rewrite `FlashSaleId` / `ProductId`. Add only:

```ts
export type PurchaseId = string & { readonly __brand: 'PurchaseId' };
export type UserId = string & { readonly __brand: 'UserId' };
```

Expected final contents of `packages/domain/src/ids.ts` (order may be rewritten by ESLint perfectionist — accept the repo’s established ordering):

```ts
export type FlashSaleId = string & { readonly __brand: 'FlashSaleId' };
export type ProductId = string & { readonly __brand: 'ProductId' };
export type PurchaseId = string & { readonly __brand: 'PurchaseId' };
export type UserId = string & { readonly __brand: 'UserId' };
```

Rules:

- Compile-time brands only — no runtime helpers / value objects.
- Preserve existing `#11`/`#12` definitions bit-for-bit aside from additive aliases and any ESLint-driven reorder of the whole file’s type aliases.
- Do **not** change `FlashSale` or `Product` entity files.

- [ ] **Step 2: Typecheck still green for existing packages**

```bash
pnpm --filter @flash-sale/domain typecheck
```

Expected: PASS (new types are additive).

- [ ] **Step 3: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/ids.ts
git commit -m "$(cat <<'EOF'
feat: add PurchaseId and UserId domain brands

EOF
)"
```

---

## Task 2: Write Purchase tests (RED)

**Files:**

- Create: `packages/domain/src/purchase/purchase.spec.ts`

- [ ] **Step 1: Create `packages/domain/src/purchase/purchase.spec.ts`**

```ts
import type { FlashSaleId, PurchaseId, UserId } from '../ids.js';

import { PurchaseValidationError, type PurchaseValidationErrorCode } from './purchase.errors.js';
import { Purchase } from './purchase.js';

const asFlashSaleId = (value: string): FlashSaleId => value as FlashSaleId;
const asPurchaseId = (value: string): PurchaseId => value as PurchaseId;
const asUserId = (value: string): UserId => value as UserId;

const id = asPurchaseId('purchase-1');
const flashSaleId = asFlashSaleId('sale-1');
const userId = asUserId('user-1');
const purchasedAt = new Date('2026-07-27T00:00:00.000Z');

function expectValidationError(action: () => unknown, code: PurchaseValidationErrorCode): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(PurchaseValidationError);
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected PurchaseValidationError with code ${code}`);
}

describe('Purchase.create', () => {
  it('creates a purchase and exposes all fields through getters while preserving ids', () => {
    const paddedId = asPurchaseId('  purchase-1  ');
    const paddedFlashSaleId = asFlashSaleId('  sale-1  ');
    const paddedUserId = asUserId('  user-1  ');
    const purchase = Purchase.create({
      id: paddedId,
      flashSaleId: paddedFlashSaleId,
      purchasedAt,
      userId: paddedUserId,
    });

    expect(purchase.getId()).toBe('  purchase-1  ');
    expect(purchase.getFlashSaleId()).toBe('  sale-1  ');
    expect(purchase.getUserId()).toBe('  user-1  ');
    expect(purchase.getPurchasedAt().getTime()).toBe(purchasedAt.getTime());
  });

  it('isolates purchasedAt from getter mutation', () => {
    const purchase = Purchase.create({ id, flashSaleId, purchasedAt, userId });
    const originalTimestamp = purchasedAt.getTime();

    purchase.getPurchasedAt().setTime(0);

    expect(purchase.getPurchasedAt().getTime()).toBe(originalTimestamp);
  });

  it('isolates purchasedAt from input mutation after create', () => {
    const input = new Date('2026-07-27T00:00:00.000Z');
    const originalTimestamp = input.getTime();
    const purchase = Purchase.create({
      id,
      flashSaleId,
      purchasedAt: input,
      userId,
    });

    input.setTime(0);

    expect(purchase.getPurchasedAt().getTime()).toBe(originalTimestamp);
  });

  it('accepts a future purchasedAt when the Date is valid', () => {
    const future = new Date('2099-01-01T00:00:00.000Z');
    const purchase = Purchase.create({
      id,
      flashSaleId,
      purchasedAt: future,
      userId,
    });

    expect(purchase.getPurchasedAt().getTime()).toBe(future.getTime());
  });

  it('rejects empty id', () => {
    expectValidationError(
      () => Purchase.create({ id: asPurchaseId(''), flashSaleId, purchasedAt, userId }),
      'EMPTY_ID',
    );
  });

  it('rejects whitespace-only id', () => {
    expectValidationError(
      () => Purchase.create({ id: asPurchaseId('   '), flashSaleId, purchasedAt, userId }),
      'EMPTY_ID',
    );
  });

  it('rejects empty flashSaleId', () => {
    expectValidationError(
      () => Purchase.create({ id, flashSaleId: asFlashSaleId(''), purchasedAt, userId }),
      'EMPTY_FLASH_SALE_ID',
    );
  });

  it('rejects whitespace-only flashSaleId', () => {
    expectValidationError(
      () => Purchase.create({ id, flashSaleId: asFlashSaleId('   '), purchasedAt, userId }),
      'EMPTY_FLASH_SALE_ID',
    );
  });

  it('rejects empty userId', () => {
    expectValidationError(
      () => Purchase.create({ id, flashSaleId, purchasedAt, userId: asUserId('') }),
      'EMPTY_USER_ID',
    );
  });

  it('rejects whitespace-only userId', () => {
    expectValidationError(
      () => Purchase.create({ id, flashSaleId, purchasedAt, userId: asUserId('   ') }),
      'EMPTY_USER_ID',
    );
  });

  it('rejects invalid purchasedAt', () => {
    expectValidationError(
      () =>
        Purchase.create({
          id,
          flashSaleId,
          purchasedAt: new Date('not-a-date'),
          userId,
        }),
      'INVALID_PURCHASED_AT',
    );
  });
});
```

Notes:

- Assert on `code` only — never exact message strings.
- Do not import or test `FlashSale` / `Product` behavior.
- Do **not** add uniqueness / multi-purchase helper tests — uniqueness is documented domain language only in `#13` (umbrella spec), not an entity API.
- Write object literals in a natural domain order; run ESLint afterward and accept the repository’s established perfectionist ordering if it rewrites keys/members.

- [ ] **Step 2: Run tests and confirm they fail (expected RED)**

```bash
pnpm --filter @flash-sale/domain test -- purchase.spec
```

Expected: FAIL because `purchase.errors.ts` / `purchase.ts` do not yet exist. This is an expected RED state; the exact failure may be module resolution, type-check, or runtime import failure depending on Jest/ts-jest configuration. Do not overfit the failure shape.

---

## Task 3: Implement `PurchaseValidationError`

**Files:**

- Create: `packages/domain/src/purchase/purchase.errors.ts`

- [ ] **Step 1: Implement errors matching FlashSale/Product style**

```ts
export type PurchaseValidationErrorCode =
  'EMPTY_FLASH_SALE_ID' | 'EMPTY_ID' | 'EMPTY_USER_ID' | 'INVALID_PURCHASED_AT';

export class PurchaseValidationError extends Error {
  readonly code: PurchaseValidationErrorCode;

  constructor(code: PurchaseValidationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PurchaseValidationError';
  }
}
```

Union members must satisfy `perfectionist/sort-union-types` (A→Z). Do **not** add `ALREADY_PURCHASED` (owned by `#20`).

No purchase-test rerun is required in this task — the suite still cannot execute meaningfully until `Purchase` exists (Task 4).

- [ ] **Step 2: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/purchase/purchase.errors.ts packages/domain/src/purchase/purchase.spec.ts
git commit -m "$(cat <<'EOF'
test: add Purchase domain validation specs

EOF
)"
```

---

## Task 4: Implement `Purchase` entity (GREEN)

**Files:**

- Create: `packages/domain/src/purchase/purchase.ts`

- [ ] **Step 1: Implement `Purchase`**

```ts
import type { FlashSaleId, PurchaseId, UserId } from '../ids.js';

import { PurchaseValidationError } from './purchase.errors.js';

export type PurchaseCreateProps = {
  id: PurchaseId;
  flashSaleId: FlashSaleId;
  purchasedAt: Date;
  userId: UserId;
};

export class Purchase {
  private constructor(
    private readonly id: PurchaseId,
    private readonly flashSaleId: FlashSaleId,
    private readonly purchasedAt: Date,
    private readonly userId: UserId,
  ) {}

  static create(props: PurchaseCreateProps): Purchase {
    if (props.id.trim().length === 0) {
      throw new PurchaseValidationError('EMPTY_ID', 'Purchase id must be non-empty');
    }

    if (props.flashSaleId.trim().length === 0) {
      throw new PurchaseValidationError(
        'EMPTY_FLASH_SALE_ID',
        'Purchase flashSaleId must be non-empty',
      );
    }

    if (props.userId.trim().length === 0) {
      throw new PurchaseValidationError('EMPTY_USER_ID', 'Purchase userId must be non-empty');
    }

    const timestamp = props.purchasedAt.getTime();
    if (Number.isNaN(timestamp)) {
      throw new PurchaseValidationError(
        'INVALID_PURCHASED_AT',
        'Purchase purchasedAt must be a valid Date',
      );
    }

    return new Purchase(props.id, props.flashSaleId, new Date(timestamp), props.userId);
  }

  getFlashSaleId(): FlashSaleId {
    return this.flashSaleId;
  }

  getId(): PurchaseId {
    return this.id;
  }

  getPurchasedAt(): Date {
    return new Date(this.purchasedAt.getTime());
  }

  getUserId(): UserId {
    return this.userId;
  }
}
```

Critical invariants:

- **Validation trims only for blankness; never assign a trimmed string to entity state.** Store `props.id` / `props.flashSaleId` / `props.userId` unchanged.
- Invalid `Date` (`Number.isNaN(getTime())`) → `INVALID_PURCHASED_AT`.
- Store and return defensive `Date` copies via the validated `timestamp` primitive (`new Date(timestamp)` / `new Date(this.purchasedAt.getTime())`).
- Future timestamps are allowed.
- No `reconstitute`.
- No uniqueness helpers.
- Do **not** add runtime `typeof` / `instanceof Date` guards beyond the `getTime()` validity check above. ID blankness assumes branded values are strings per the TypeScript API contract.
- Prefer semantic field order (`id`, `flashSaleId`, `purchasedAt`, `userId`). After writing, run ESLint and accept the repository’s established perfectionist ordering if it rewrites props, constructor params, or class members.

- [ ] **Step 2: Run purchase tests — expect PASS**

```bash
pnpm --filter @flash-sale/domain test -- purchase.spec
```

Expected: all `Purchase.create` tests PASS.

- [ ] **Step 3: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/purchase/purchase.ts
git commit -m "$(cat <<'EOF'
feat: add Purchase domain entity

EOF
)"
```

---

## Task 5: Update public exports

**Files:**

- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Add Purchase exports; re-export all four ID brands**

Modify the existing `packages/domain/src/index.ts` — do **not** reconstruct the whole file from scratch. Preserve all existing `#11`/`#12` exports unchanged.

Update the IDs export so all four brands are re-exported from `ids.ts` (exact member order may be rewritten by ESLint — accept the repo’s established ordering):

```ts
export type { FlashSaleId, ProductId, PurchaseId, UserId } from './ids.js';
```

Add these Purchase exports (minimum public surface; ordering may be rewritten by ESLint):

```ts
export { PurchaseValidationError } from './purchase/purchase.errors.js';
export type { PurchaseValidationErrorCode } from './purchase/purchase.errors.js';
export { Purchase } from './purchase/purchase.js';
export type { PurchaseCreateProps } from './purchase/purchase.js';
```

Do **not** add branding helpers (`toPurchaseId`, `toUserId`, etc.) or uniqueness helpers.

Public API coverage is verified by package typecheck and the existing package build/export configuration; no dedicated barrel test is required.

- [ ] **Step 2: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: export Purchase domain model

EOF
)"
```

---

## Task 6: Full quality gates and scope hygiene

**Files:** none (verification only)

- [ ] **Step 1: Package quality gates**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter @flash-sale/domain lint
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain build
git diff --check
```

Expected: all PASS; `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Verify zero runtime dependencies**

```bash
node -e "const p=require('./packages/domain/package.json'); if (Object.keys(p.dependencies ?? {}).length !== 0) throw new Error('Domain package must have zero runtime dependencies'); console.log('dependencies:', p.dependencies ?? {});"
```

Expected: prints `dependencies: {}` (or equivalent empty object) and exits 0.

- [ ] **Step 3: Confirm scope hygiene (files + forbidden symbols)**

```bash
git status -sb
git diff --name-only
rg -n "assertUniquePurchase|isSameBuyerSale|ALREADY_PURCHASED" packages/domain/src/purchase packages/domain/src/index.ts || true
```

Expected touched paths only under:

- `packages/domain/src/ids.ts`
- `packages/domain/src/purchase/**`
- `packages/domain/src/index.ts`
- (and docs only if intentionally carrying the finalized `#13` spec/plan onto the branch)

Must **not** include `flash-sale/**` entity changes, `product/**` entity changes, Prisma, Nest modules, GraphQL, Redis.

Expected for the `rg` scan: **no matches** for `assertUniquePurchase`, `isSameBuyerSale`, or `ALREADY_PURCHASED`.

- [ ] **Step 4: Single authorized commit for the whole ticket (optional — only if authorized)**

```bash
git add packages/domain/src/ids.ts packages/domain/src/purchase packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add Purchase domain model

EOF
)"
```

---

## Task 7: Final acceptance review

- [ ] **Step 1: Map implementation against `#13` contract**

- [ ] Purchase includes flash sale identity (`flashSaleId`) and user identity (`userId`)
- [ ] One-purchase-per-user rule is expressed in domain language in the approved umbrella spec (no entity uniqueness API / no code-comment requirement)
- [ ] Fields: `id`, `flashSaleId`, `userId`, `purchasedAt` only (no `productId` / `quantity`)
- [ ] IDs: blankness via `trim()`, stored values unchanged
- [ ] Invalid `purchasedAt` rejected; future dates allowed; defensive `Date` copies
- [ ] `@flash-sale/domain` still has zero runtime dependencies
- [ ] No Nest/Prisma/Redis/FlashSale/Product entity changes
- [ ] Tests assert error `code`s; messages not frozen
- [ ] ESLint passes (follow repo perfectionist rules)
- [ ] `PurchaseId` and `UserId` exported from package public API; all four ID brands re-exported
- [ ] No public runtime branding constructor was added
- [ ] No `assertUniquePurchase` / `isSameBuyerSale` / `ALREADY_PURCHASED` in purchase sources

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

- `Purchase.reconstitute`
- Uniqueness helpers / multi-purchase check APIs
- `ALREADY_PURCHASED` outcome (`#20`)
- DB `UNIQUE(flash_sale_id, user_id)` (`#16`)
- Prisma schema (`#15`) / repository ports (`#17`) / adapters (`#18`)
- Atomic reservation (`#19`) / transactional purchase flow (`#20`)
- Sale status rules (`#14`)
- FlashSale ID trim alignment / Product changes
- Shared trim helpers
- GraphQL (EPIC-03) / Redis (EPIC-04)

---

## Spec coverage self-check

| Spec requirement                                                  | Task    |
| ----------------------------------------------------------------- | ------- |
| Rich `Purchase` class, private state, getters                     | 4       |
| `Purchase.create` only                                            | 4       |
| Fields: `id`, `flashSaleId`, `userId`, `purchasedAt`              | 4       |
| Trim for blankness only; store original IDs                       | 2, 4    |
| Reject invalid `Date`; allow future; defensive copies             | 2, 4    |
| Documented uniqueness rule; no entity uniqueness API              | 2, 6, 7 |
| `PurchaseValidationError` + stable codes (no `ALREADY_PURCHASED`) | 3       |
| `PurchaseId` / `UserId` brands in `ids.ts`                        | 1       |
| Public exports + re-export all four ID brands                     | 5       |
| Jest coverage listed in `#13` testing section                     | 2       |
| Zero runtime dependencies                                         | 6, 7    |
| No FlashSale / Product entity / Prisma / Nest / Redis             | 0, 6, 7 |
