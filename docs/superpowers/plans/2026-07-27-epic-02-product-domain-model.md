# EPIC-02 #12 — Product Domain Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#12](https://github.com/rexescario-dev/flash-sale-system/issues/12) by adding a pure `Product` entity to `@flash-sale/domain` with `create`-only factory, trim/normalize invariants, typed validation errors, and Jest unit tests — zero Nest/Prisma/Redis; no `FlashSale` edits.

**Architecture:** Rich class in `packages/domain/src/product/` mirroring `#11` `FlashSale` style (private state, factory, getters, `ProductValidationError`). Reuse existing `ProductId` from `ids.ts` and retain its package-level public export. Validate → trim → construct. Optional `description` (`undefined`/omit equivalent). No `reconstitute`, no shared trim helpers, no persistence.

**Tech Stack:** TypeScript (NodeNext ESM), existing `@flash-sale/domain` package, Jest + ts-jest, ESLint perfectionist (ids first, then A→Z).

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md) (`#12 — Product domain model`)

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

---

## File map

| Path                                            | Responsibility                                  |
| ----------------------------------------------- | ----------------------------------------------- |
| `packages/domain/src/ids.ts`                    | Unchanged — existing `ProductId` brand          |
| `packages/domain/src/flash-sale/**`             | Untouched                                       |
| `packages/domain/src/product/product.errors.ts` | `ProductValidationError` + codes                |
| `packages/domain/src/product/product.ts`        | `Product` entity + `ProductCreateProps`         |
| `packages/domain/src/product/product.spec.ts`   | Jest unit tests (local `asProductId` cast only) |
| `packages/domain/src/index.ts`                  | Add Product public exports; retain `ProductId`  |

No new packages, root tooling, Prisma, Nest, GraphQL, or Redis.

---

## Task 0: Sync baseline and branch

**Files:** none (git only)

- [ ] **Step 1: Confirm `origin/main` includes #11 and create feature branch**

```bash
cd /home/rex/Project/test/app
git fetch origin
git checkout main
git pull --ff-only origin main
git log -1 --oneline
test -f packages/domain/src/ids.ts
test -f packages/domain/src/flash-sale/flash-sale.ts
rg -n "export type ProductId" packages/domain/src/ids.ts packages/domain/src/index.ts
git checkout -B feat/epic-02-product-domain origin/main
```

Expected:

- `main` tip includes merged #11 (e.g. PR #98 / `FlashSale` package present)
- `ProductId` defined in `ids.ts` and exported from `index.ts`
- On branch `feat/epic-02-product-domain`

If the approved umbrella-spec `#12` section is only on `docs/epic-02-product-domain-design` (or uncommitted), carry that finalized spec onto the feature branch before coding — do not invent the contract.

- [ ] **Step 2: Confirm clean domain package quality gate baseline**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter @flash-sale/domain lint
pnpm --filter @flash-sale/domain typecheck
```

Expected: all pass on the #11 baseline before Product changes.

---

## Task 1: Failing Product tests (TDD)

**Files:**

- Create: `packages/domain/src/product/product.spec.ts`
- Create (minimal stubs only if required for imports to resolve): prefer writing the full test file first against the intended public surface; TypeScript/Jest will fail until Task 2–3.

- [ ] **Step 1: Create `packages/domain/src/product/product.spec.ts`**

```ts
import type { ProductId } from '../ids.js';

import { ProductValidationError, type ProductValidationErrorCode } from './product.errors.js';
import { Product } from './product.js';

const asProductId = (value: string): ProductId => value as ProductId;

const id = asProductId('product-1');
const name = 'Chicken';

function expectValidationError(action: () => unknown, code: ProductValidationErrorCode): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ProductValidationError);
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected ProductValidationError with code ${code}`);
}

describe('Product.create', () => {
  it('creates a product without description', () => {
    const product = Product.create({ id, name });

    expect(product.getId()).toBe(id);
    expect(product.getName()).toBe(name);
    expect(product.getDescription()).toBeUndefined();
  });

  it('treats description: undefined the same as omitted description', () => {
    const withoutDescription = Product.create({ id, name });
    const withUndefinedDescription = Product.create({
      id,
      description: undefined,
      name,
    });

    expect(withoutDescription.getDescription()).toBeUndefined();
    expect(withUndefinedDescription.getDescription()).toBeUndefined();
    expect(withoutDescription.getId()).toBe(withUndefinedDescription.getId());
    expect(withoutDescription.getName()).toBe(withUndefinedDescription.getName());
  });

  it('stores a trimmed non-blank description', () => {
    const product = Product.create({
      id,
      description: '  Fresh free-range  ',
      name,
    });

    expect(product.getDescription()).toBe('Fresh free-range');
  });

  it('returns trimmed id from padded ProductId input', () => {
    const padded = asProductId('  product-123  ');
    const product = Product.create({ id: padded, name });

    expect(product.getId()).toBe('product-123');
  });

  it('returns trimmed name from padded name input', () => {
    const product = Product.create({ id, name: '  Chicken  ' });

    expect(product.getName()).toBe('Chicken');
  });

  it('rejects empty id', () => {
    expectValidationError(() => Product.create({ id: asProductId(''), name }), 'EMPTY_ID');
  });

  it('rejects whitespace-only id', () => {
    expectValidationError(() => Product.create({ id: asProductId('   '), name }), 'EMPTY_ID');
  });

  it('rejects empty name', () => {
    expectValidationError(() => Product.create({ id, name: '' }), 'EMPTY_NAME');
  });

  it('rejects whitespace-only name', () => {
    expectValidationError(() => Product.create({ id, name: '   ' }), 'EMPTY_NAME');
  });

  it('rejects empty description when provided', () => {
    expectValidationError(() => Product.create({ id, description: '', name }), 'EMPTY_DESCRIPTION');
  });

  it('rejects whitespace-only description when provided', () => {
    expectValidationError(
      () => Product.create({ id, description: '   ', name }),
      'EMPTY_DESCRIPTION',
    );
  });
});
```

Notes:

- Assert on `code` only — never exact message strings.
- Do not import or test `FlashSale`.
- Write object literals / member order in a natural domain order (`id`, `name`, `description` where practical). Run ESLint afterward and accept the repository’s established perfectionist ordering if it rewrites keys/members.
- Public API coverage for barrel exports is verified later by package typecheck + retained `ProductId` export; no dedicated `index.spec.ts` is required for #12.

- [ ] **Step 2: Run tests and confirm they fail (expected RED)**

```bash
pnpm --filter @flash-sale/domain test -- product.spec
```

Expected: FAIL because the Product implementation does not yet exist. This is an expected RED state; the exact failure may be module resolution, type-check, or runtime import failure depending on Jest/ts-jest configuration. Do not overfit the failure shape.

---

## Task 2: `ProductValidationError`

**Files:**

- Create: `packages/domain/src/product/product.errors.ts`

- [ ] **Step 1: Implement errors matching FlashSale style**

```ts
export type ProductValidationErrorCode = 'EMPTY_DESCRIPTION' | 'EMPTY_ID' | 'EMPTY_NAME';

export class ProductValidationError extends Error {
  readonly code: ProductValidationErrorCode;

  constructor(code: ProductValidationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ProductValidationError';
  }
}
```

Union members must be alphabetical (`perfectionist/sort-union-types`).

- [ ] **Step 2: Re-run product tests (still failing on missing `Product`)**

```bash
pnpm --filter @flash-sale/domain test -- product.spec
```

Expected: still FAIL (RED) because `Product` is missing; errors alone are not enough. Exact failure shape may vary.

- [ ] **Step 3: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/product/product.errors.ts packages/domain/src/product/product.spec.ts
git commit -m "$(cat <<'EOF'
test: add Product domain validation specs

EOF
)"
```

---

## Task 3: `Product` entity

**Files:**

- Create: `packages/domain/src/product/product.ts`

- [ ] **Step 1: Implement `Product`**

```ts
import type { ProductId } from '../ids.js';

import { ProductValidationError } from './product.errors.js';

export type ProductCreateProps = {
  id: ProductId;
  name: string;
  description?: string;
};

export class Product {
  private constructor(
    private readonly id: ProductId,
    private readonly name: string,
    private readonly description: string | undefined,
  ) {}

  static create(props: ProductCreateProps): Product {
    const id = props.id.trim();
    if (id.length === 0) {
      throw new ProductValidationError('EMPTY_ID', 'Product id must be non-empty');
    }

    const name = props.name.trim();
    if (name.length === 0) {
      throw new ProductValidationError('EMPTY_NAME', 'Product name must be non-empty');
    }

    let description: string | undefined;
    if (props.description !== undefined) {
      const trimmedDescription = props.description.trim();
      if (trimmedDescription.length === 0) {
        throw new ProductValidationError(
          'EMPTY_DESCRIPTION',
          'Product description must be non-empty when provided',
        );
      }
      description = trimmedDescription;
    }

    return new Product(id as ProductId, name, description);
  }

  getId(): ProductId {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string | undefined {
    return this.description;
  }
}
```

Critical invariants:

- Trim → validate non-blank → then treat trimmed id as `ProductId` (never cast before the check).
- `description === undefined` (omit or explicit) → store `undefined`.
- `description !== undefined` → trim; blank → `EMPTY_DESCRIPTION`.
- No `reconstitute`.
- Do **not** add runtime `typeof` guards or new validation error codes for non-string inputs. Runtime validation assumes the underlying branded value is a string, as guaranteed by the TypeScript API contract; #12 only specifies blank-string validation.
- Prefer semantic field order (`id`, `name`, `description`). After writing, run ESLint and accept the repository’s established perfectionist ordering if it rewrites props, constructor params, or class members.

- [ ] **Step 2: Run product tests — expect PASS**

```bash
pnpm --filter @flash-sale/domain test -- product.spec
```

Expected: all `Product.create` tests PASS.

- [ ] **Step 3: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/product/product.ts
git commit -m "$(cat <<'EOF'
feat: add Product domain entity

EOF
)"
```

---

## Task 4: Public exports

**Files:**

- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Add Product exports incrementally; retain existing #11 exports**

Modify the existing `packages/domain/src/index.ts` — do **not** reconstruct the whole file from scratch. Preserve all existing #11 exports unchanged, including:

```ts
export type { FlashSaleId, ProductId } from './ids.js';
```

Add only these Product exports (minimum public surface):

```ts
export { ProductValidationError } from './product/product.errors.js';
export type { ProductValidationErrorCode } from './product/product.errors.js';
export { Product } from './product/product.js';
export type { ProductCreateProps } from './product/product.js';
```

Do **not** add branding helpers (`toProductId`, etc.).

Run ESLint and accept the repository’s established export ordering. Public API coverage is verified by successful package typecheck and the retained `ProductId` export; no dedicated barrel test is required.

- [ ] **Step 2: Lint + typecheck + full domain tests**

```bash
pnpm --filter @flash-sale/domain lint
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain test
```

Expected: all pass. `FlashSale` tests still green; no FlashSale file diffs.

- [ ] **Step 3: Confirm scope hygiene**

```bash
git status -sb
git diff --name-only
```

Expected touched paths only under:

- `packages/domain/src/product/**`
- `packages/domain/src/index.ts`
- (and docs only if intentionally carrying the finalized #12 spec onto the branch)

Must **not** include `flash-sale/**`, Prisma, Nest modules, GraphQL, Redis.

- [ ] **Step 4: Commit (optional — only if authorized)**

```bash
git add packages/domain/src/index.ts packages/domain/src/product
git commit -m "$(cat <<'EOF'
feat: export Product domain model

EOF
)"
```

Or a single authorized commit for the whole ticket:

```bash
git add packages/domain/src/product packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add Product domain model

EOF
)"
```

---

## Task 5: Definition of Done checklist

- [ ] **Step 1: Verify acceptance criteria**

- [ ] Product includes `id`, `name`, optional `description`
- [ ] No multi-product / catalog over-engineering (no price/SKU/metadata bag)
- [ ] `@flash-sale/domain` still has zero runtime dependencies
- [ ] No Nest/Prisma/Redis/FlashSale changes
- [ ] Tests assert error `code`s; messages not frozen
- [ ] ESLint passes (follow repo perfectionist rules; do not invent extra ordering policy)
- [ ] `ProductId` still exported from package public API
- [ ] No public runtime branding constructor was added — compile-time-only `ProductId` branding is intentional for #12 (known deferred work, not a defect)

- [ ] **Step 2: Final quality gates**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter @flash-sale/domain lint
pnpm --filter @flash-sale/domain typecheck
```

Expected: PASS.

---

## Out of scope (do not implement)

- `Product.reconstitute`
- FlashSale ID trim alignment / #11 Date-input test backfill
- Shared trim helpers
- Prisma schema / repos / Nest modules / GraphQL / Redis
- Purchase model

---

## Spec coverage self-check

| Spec requirement                                       | Task            |
| ------------------------------------------------------ | --------------- |
| Rich `Product` class, private state, getters           | 3               |
| `Product.create` only                                  | 3               |
| Optional description; omit ≡ `undefined`               | 1, 3            |
| Trim id/name/provided description; reject blank        | 1, 3            |
| Trim → validate → cast `ProductId`                     | 3               |
| `ProductValidationError` + stable codes                | 2               |
| Public exports + retain `ProductId`                    | 4               |
| Jest coverage listed in #12 testing section            | 1               |
| No FlashSale / Prisma / Nest / Redis                   | 0, 4            |
| Extensible without metadata bag / catalog abstractions | 3 (fields only) |
