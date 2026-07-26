# EPIC-02 #11 — FlashSale Domain Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver GitHub [#11](https://github.com/rexescario-dev/flash-sale-system/issues/11) by adding `@flash-sale/domain` with a pure `FlashSale` entity, validation errors, branded IDs, and Jest unit tests — zero Nest/Prisma/Redis dependencies.

**Architecture:** New workspace package `packages/domain` holds rich domain classes. `FlashSale` uses private state, `create` / `reconstitute` factories, and typed `FlashSaleValidationError` codes. `apps/api` receives an intentional workspace dependency on `@flash-sale/domain` to establish the package graph (no Nest module imports or use cases in #11). Prisma, repos, status rules, and GraphQL stay out of scope.

**Tech Stack:** TypeScript (NodeNext ESM), pnpm workspaces, Turborepo, Jest + ts-jest (versions from `apps/api`), `@flash-sale/typescript-config`.

**Spec:** [docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md](../specs/2026-07-26-epic-02-domain-persistence-design.md)

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only** — workers must not execute them unless explicitly authorized.

---

## File map

| Path                                                  | Responsibility                                   |
| ----------------------------------------------------- | ------------------------------------------------ |
| `packages/domain/package.json`                        | `@flash-sale/domain` package metadata & scripts  |
| `packages/domain/tsconfig.json`                       | Extends shared base; emit `dist/`; exclude specs |
| `packages/domain/jest.config.cjs`                     | Jest + ts-jest for `*.spec.ts` (if needed)       |
| `packages/domain/src/ids.ts`                          | `FlashSaleId` / `ProductId` brand types only     |
| `packages/domain/src/flash-sale/flash-sale.errors.ts` | `FlashSaleValidationError` + codes               |
| `packages/domain/src/flash-sale/flash-sale.ts`        | `FlashSale` entity                               |
| `packages/domain/src/flash-sale/flash-sale.spec.ts`   | Unit tests (local cast helpers only)             |
| `packages/domain/src/index.ts`                        | Public exports                                   |
| `apps/api/package.json`                               | Intentional `workspace:*` dependency on domain   |

---

## Task 0: Sync to `origin/main` and ensure final spec is present

**Files:** none (git only)

- [ ] **Step 1: Fetch and create feature branch from main**

```bash
cd /home/rex/Project/test/app
git fetch origin
git checkout -B feat/epic-02-flash-sale-domain origin/main
```

Expected: branch `feat/epic-02-flash-sale-domain` at latest `origin/main`.

- [ ] **Step 2: Ensure the approved EPIC-02 design spec is on the branch**

If the spec is missing:

1. Check whether the known docs branch exists locally: `docs/epic-02-domain-persistence-design`
2. If it exists, merge it: `git merge --no-ff docs/epic-02-domain-persistence-design`
3. Otherwise, **stop and report that the approved design spec is unavailable** — do **not** invent, reconstruct, or rewrite the spec from memory

```bash
SPEC=docs/superpowers/specs/2026-07-26-epic-02-domain-persistence-design.md
if test -f "$SPEC"; then
  echo "spec present"
elif git show-ref --verify --quiet refs/heads/docs/epic-02-domain-persistence-design; then
  git merge --no-ff docs/epic-02-domain-persistence-design
else
  echo "FATAL: approved EPIC-02 design spec unavailable; stop" >&2
  exit 1
fi
```

Before coding, confirm the on-disk spec includes the review fixes (defensive `Date`s, no VOs in #11, ID non-normalization, Purchase uniqueness wording, invalid `Date` → `INVALID_SALE_WINDOW`). Note: uncommitted review fixes on the working tree must be carried onto the feature branch before implementation; do not invent missing content.

- [ ] **Step 3: Confirm clean EPIC-01 baseline**

```bash
git status -sb
git log --oneline -5
test -f apps/api/package.json && test -f packages/types/package.json && echo OK
```

Expected: clean working tree (aside from intentional docs sync); `OK` printed.

---

## Task 1: Scaffold `@flash-sale/domain` package

**Files:**

- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/jest.config.cjs`
- Create: `packages/domain/src/index.ts`

- [ ] **Step 1: Read current repo versions/conventions**

```bash
node -e "const a=require('./apps/api/package.json'); const t=require('./packages/types/package.json'); console.log({jest:a.devDependencies.jest, tsJest:a.devDependencies['ts-jest'], typesLint:t.scripts.lint, typesTest:t.scripts.test})"
```

Expected: print the installed ranges (currently `jest` `^30.0.3`, `ts-jest` `^29.4.0` in `apps/api`). Use those exact version strings from the repo, not hard-coded guesses.

- [ ] **Step 2: Create `packages/domain/package.json`**

Mirror `@flash-sale/types` scripts for `build` / `typecheck` / `lint`. For `lint`, copy the **actual** `@flash-sale/types` lint script (today that is a Turbo-satisfying no-op — do not invent a divergent domain-only fake). For `test`, use real Jest (unlike types, which has no tests).

```json
{
  "name": "@flash-sale/domain",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "node -e \"process.exit(0)\"",
    "test": "NODE_OPTIONS=--experimental-vm-modules jest"
  },
  "devDependencies": {
    "@flash-sale/typescript-config": "workspace:*",
    "@types/jest": "^30.0.0",
    "jest": "^30.0.3",
    "ts-jest": "^29.4.0",
    "typescript": "^5.8.3"
  }
}
```

Replace `jest` / `ts-jest` / `@types/jest` version strings with whatever Step 1 printed from `apps/api` if they differ.

- [ ] **Step 3: Create `packages/domain/tsconfig.json`**

```json
{
  "extends": "@flash-sale/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "noEmit": false,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["jest"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `packages/domain/jest.config.cjs`**

Align with `apps/api` Jest + ESM needs for this package:

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          types: ['jest'],
        },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
```

- [ ] **Step 5: Create placeholder `packages/domain/src/index.ts`**

```ts
export {};
```

- [ ] **Step 6: Install workspace links**

```bash
pnpm install
```

Expected: lockfile updates; `packages/domain` linked; no install errors.

- [ ] **Step 7: Smoke typecheck/build**

```bash
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain build
```

Expected: both succeed (empty package).

- [ ] **Step 8 (optional commit — skip unless authorized)**

```bash
git add packages/domain/package.json packages/domain/tsconfig.json packages/domain/jest.config.cjs packages/domain/src/index.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: scaffold @flash-sale/domain package

EOF
)"
```

---

## Task 2: Add branded IDs and validation errors

**Files:**

- Create: `packages/domain/src/ids.ts`
- Create: `packages/domain/src/flash-sale/flash-sale.errors.ts`
- Modify: `packages/domain/src/index.ts`

No public `toFlashSaleId` / `toProductId` helpers. Brands are compile-time only; tests use local casts.

- [ ] **Step 1: Write `packages/domain/src/ids.ts`**

```ts
export type FlashSaleId = string & { readonly __brand: 'FlashSaleId' };
export type ProductId = string & { readonly __brand: 'ProductId' };
```

- [ ] **Step 2: Write `packages/domain/src/flash-sale/flash-sale.errors.ts`**

```ts
export type FlashSaleValidationErrorCode =
  | 'EMPTY_ID'
  | 'EMPTY_PRODUCT_ID'
  | 'INVALID_SALE_WINDOW'
  | 'INVALID_TOTAL_STOCK'
  | 'INVALID_REMAINING_STOCK'
  | 'REMAINING_STOCK_EXCEEDS_TOTAL';

export class FlashSaleValidationError extends Error {
  readonly code: FlashSaleValidationErrorCode;

  constructor(code: FlashSaleValidationErrorCode, message: string) {
    super(message);
    this.name = 'FlashSaleValidationError';
    this.code = code;
  }
}
```

- [ ] **Step 3: Update `packages/domain/src/index.ts`**

```ts
export type { FlashSaleId, ProductId } from './ids.js';
export type { FlashSaleValidationErrorCode } from './flash-sale/flash-sale.errors.js';
export { FlashSaleValidationError } from './flash-sale/flash-sale.errors.js';
```

- [ ] **Step 4: Build**

```bash
pnpm --filter @flash-sale/domain build
```

Expected: PASS; `dist/ids.js` and `dist/flash-sale/flash-sale.errors.js` emitted.

- [ ] **Step 5 (optional commit — skip unless authorized)**

```bash
git add packages/domain/src/ids.ts packages/domain/src/flash-sale/flash-sale.errors.ts packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: add domain ids and FlashSaleValidationError

EOF
)"
```

---

## Task 3: Write failing FlashSale tests (TDD red phase)

**Files:**

- Create: `packages/domain/src/flash-sale/flash-sale.spec.ts`

- [ ] **Step 1: Write the full spec file**

```ts
import { FlashSale } from './flash-sale.js';
import {
  FlashSaleValidationError,
  type FlashSaleValidationErrorCode,
} from './flash-sale.errors.js';
import type { FlashSaleId, ProductId } from '../ids.js';

const asFlashSaleId = (value: string): FlashSaleId => value as FlashSaleId;
const asProductId = (value: string): ProductId => value as ProductId;

const id = asFlashSaleId('sale-1');
const productId = asProductId('product-1');
const startsAt = new Date('2026-07-26T10:00:00.000Z');
const endsAt = new Date('2026-07-26T12:00:00.000Z');

function expectValidationError(action: () => unknown, code: FlashSaleValidationErrorCode): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(FlashSaleValidationError);
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected FlashSaleValidationError with code ${code}`);
}

describe('FlashSale.create', () => {
  it('creates a fully stocked sale', () => {
    const sale = FlashSale.create({
      id,
      productId,
      startsAt,
      endsAt,
      totalStock: 100,
    });

    expect(sale.getId()).toBe(id);
    expect(sale.getProductId()).toBe(productId);
    expect(sale.getStartsAt().getTime()).toBe(startsAt.getTime());
    expect(sale.getEndsAt().getTime()).toBe(endsAt.getTime());
    expect(sale.getTotalStock()).toBe(100);
    expect(sale.getRemainingStock()).toBe(100);
    expect(sale.getRemainingStock()).toBe(sale.getTotalStock());
  });

  it('preserves id whitespace without trimming valid ids', () => {
    const padded = asFlashSaleId('  sale-123  ');
    const sale = FlashSale.create({
      id: padded,
      productId,
      startsAt,
      endsAt,
      totalStock: 10,
    });

    expect(sale.getId()).toBe(padded);
  });

  it('returns defensive Date copies from getters', () => {
    const sale = FlashSale.create({
      id,
      productId,
      startsAt,
      endsAt,
      totalStock: 10,
    });

    const returnedStartsAt = sale.getStartsAt();
    returnedStartsAt.setTime(0);

    expect(sale.getStartsAt().getTime()).toBe(startsAt.getTime());
    expect(sale.getStartsAt().getTime()).not.toBe(0);
  });

  it('rejects empty id', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id: asFlashSaleId(''),
          productId,
          startsAt,
          endsAt,
          totalStock: 10,
        }),
      'EMPTY_ID',
    );
  });

  it('rejects whitespace-only id', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id: asFlashSaleId('   '),
          productId,
          startsAt,
          endsAt,
          totalStock: 10,
        }),
      'EMPTY_ID',
    );
  });

  it('rejects empty productId', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId: asProductId(''),
          startsAt,
          endsAt,
          totalStock: 10,
        }),
      'EMPTY_PRODUCT_ID',
    );
  });

  it('rejects whitespace-only productId', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId: asProductId('   '),
          startsAt,
          endsAt,
          totalStock: 10,
        }),
      'EMPTY_PRODUCT_ID',
    );
  });

  it('rejects startsAt equal to endsAt', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId,
          startsAt,
          endsAt: startsAt,
          totalStock: 10,
        }),
      'INVALID_SALE_WINDOW',
    );
  });

  it('rejects startsAt after endsAt', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId,
          startsAt: endsAt,
          endsAt: startsAt,
          totalStock: 10,
        }),
      'INVALID_SALE_WINDOW',
    );
  });

  it('rejects invalid Date instances as INVALID_SALE_WINDOW', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId,
          startsAt: new Date('invalid'),
          endsAt,
          totalStock: 10,
        }),
      'INVALID_SALE_WINDOW',
    );
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid totalStock: %p',
    (totalStock) => {
      expectValidationError(
        () =>
          FlashSale.create({
            id,
            productId,
            startsAt,
            endsAt,
            totalStock,
          }),
        'INVALID_TOTAL_STOCK',
      );
    },
  );
});

describe('FlashSale.reconstitute', () => {
  it('restores partial stock', () => {
    const sale = FlashSale.reconstitute({
      id,
      productId,
      startsAt,
      endsAt,
      totalStock: 100,
      remainingStock: 37,
    });

    expect(sale.getTotalStock()).toBe(100);
    expect(sale.getRemainingStock()).toBe(37);
  });

  it('rejects empty id', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id: asFlashSaleId(''),
          productId,
          startsAt,
          endsAt,
          totalStock: 10,
          remainingStock: 10,
        }),
      'EMPTY_ID',
    );
  });

  it('rejects invalid sale window', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id,
          productId,
          startsAt: endsAt,
          endsAt: startsAt,
          totalStock: 10,
          remainingStock: 10,
        }),
      'INVALID_SALE_WINDOW',
    );
  });

  it('rejects invalid totalStock', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id,
          productId,
          startsAt,
          endsAt,
          totalStock: 0,
          remainingStock: 0,
        }),
      'INVALID_TOTAL_STOCK',
    );
  });

  it('rejects negative remainingStock', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id,
          productId,
          startsAt,
          endsAt,
          totalStock: 100,
          remainingStock: -1,
        }),
      'INVALID_REMAINING_STOCK',
    );
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-integer remainingStock: %p',
    (remainingStock) => {
      expectValidationError(
        () =>
          FlashSale.reconstitute({
            id,
            productId,
            startsAt,
            endsAt,
            totalStock: 100,
            remainingStock,
          }),
        'INVALID_REMAINING_STOCK',
      );
    },
  );

  it('rejects remainingStock greater than totalStock', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id,
          productId,
          startsAt,
          endsAt,
          totalStock: 10,
          remainingStock: 11,
        }),
      'REMAINING_STOCK_EXCEEDS_TOTAL',
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (red)**

```bash
pnpm --filter @flash-sale/domain test
```

Expected: FAIL — missing `./flash-sale.js` (entity not implemented yet).

- [ ] **Step 3 (optional commit — skip unless authorized)**

```bash
git add packages/domain/src/flash-sale/flash-sale.spec.ts
git commit -m "$(cat <<'EOF'
test: add FlashSale create and reconstitute coverage

EOF
)"
```

---

## Task 4: Implement `FlashSale` (TDD green phase)

**Files:**

- Create: `packages/domain/src/flash-sale/flash-sale.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Implement `packages/domain/src/flash-sale/flash-sale.ts`**

```ts
import type { FlashSaleId, ProductId } from '../ids.js';
import { FlashSaleValidationError } from './flash-sale.errors.js';

export type FlashSaleCreateProps = {
  id: FlashSaleId;
  productId: ProductId;
  startsAt: Date;
  endsAt: Date;
  totalStock: number;
};

export type FlashSaleReconstituteProps = FlashSaleCreateProps & {
  remainingStock: number;
};

export class FlashSale {
  private constructor(
    private readonly id: FlashSaleId,
    private readonly productId: ProductId,
    private readonly startsAt: Date,
    private readonly endsAt: Date,
    private readonly totalStock: number,
    private readonly remainingStock: number,
  ) {}

  static create(props: FlashSaleCreateProps): FlashSale {
    const remainingStock = props.totalStock;
    FlashSale.assertValid({ ...props, remainingStock });
    return new FlashSale(
      props.id,
      props.productId,
      new Date(props.startsAt.getTime()),
      new Date(props.endsAt.getTime()),
      props.totalStock,
      remainingStock,
    );
  }

  static reconstitute(props: FlashSaleReconstituteProps): FlashSale {
    FlashSale.assertValid(props);
    return new FlashSale(
      props.id,
      props.productId,
      new Date(props.startsAt.getTime()),
      new Date(props.endsAt.getTime()),
      props.totalStock,
      props.remainingStock,
    );
  }

  getId(): FlashSaleId {
    return this.id;
  }

  getProductId(): ProductId {
    return this.productId;
  }

  getStartsAt(): Date {
    return new Date(this.startsAt.getTime());
  }

  getEndsAt(): Date {
    return new Date(this.endsAt.getTime());
  }

  getTotalStock(): number {
    return this.totalStock;
  }

  getRemainingStock(): number {
    return this.remainingStock;
  }

  private static assertValid(props: FlashSaleReconstituteProps): void {
    if (props.id.trim().length === 0) {
      throw new FlashSaleValidationError('EMPTY_ID', 'FlashSale id must be non-empty');
    }

    if (props.productId.trim().length === 0) {
      throw new FlashSaleValidationError(
        'EMPTY_PRODUCT_ID',
        'FlashSale productId must be non-empty',
      );
    }

    if (!(props.startsAt.getTime() < props.endsAt.getTime())) {
      throw new FlashSaleValidationError(
        'INVALID_SALE_WINDOW',
        'FlashSale startsAt must be before endsAt',
      );
    }

    if (!Number.isInteger(props.totalStock) || props.totalStock <= 0) {
      throw new FlashSaleValidationError(
        'INVALID_TOTAL_STOCK',
        'FlashSale totalStock must be a positive integer',
      );
    }

    if (!Number.isInteger(props.remainingStock) || props.remainingStock < 0) {
      throw new FlashSaleValidationError(
        'INVALID_REMAINING_STOCK',
        'FlashSale remainingStock must be a non-negative integer',
      );
    }

    if (props.remainingStock > props.totalStock) {
      throw new FlashSaleValidationError(
        'REMAINING_STOCK_EXCEEDS_TOTAL',
        'FlashSale remainingStock cannot exceed totalStock',
      );
    }
  }
}
```

- [ ] **Step 2: Export entity from `packages/domain/src/index.ts`**

```ts
export type { FlashSaleId, ProductId } from './ids.js';
export type { FlashSaleValidationErrorCode } from './flash-sale/flash-sale.errors.js';
export { FlashSaleValidationError } from './flash-sale/flash-sale.errors.js';
export type { FlashSaleCreateProps, FlashSaleReconstituteProps } from './flash-sale/flash-sale.js';
export { FlashSale } from './flash-sale/flash-sale.js';
```

- [ ] **Step 3: Run package-local tests — expect PASS (green)**

```bash
pnpm --filter @flash-sale/domain test
```

Expected: all tests PASS.

- [ ] **Step 4: Package-local typecheck and build**

```bash
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain build
```

Expected: both PASS. Confirm `dist/` has no `*.spec.js`.

- [ ] **Step 5 (optional commit — skip unless authorized)**

```bash
git add packages/domain/src/flash-sale/flash-sale.ts packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat: implement FlashSale domain entity with invariants

EOF
)"
```

---

## Task 5: Wire intentional `apps/api` → domain dependency (no Nest modules)

**Files:**

- Modify: `apps/api/package.json`

This dependency is **intentional architecture** for #11: it makes the package graph explicit (`apps/api` → `@flash-sale/domain`). It is not required because application code imports domain yet. Do **not** import domain into Nest modules, services, or resolvers in #11.

- [ ] **Step 1: Add workspace dependency**

In `apps/api/package.json` `dependencies`, add:

```json
"@flash-sale/domain": "workspace:*"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

Expected: lockfile updates; api depends on `@flash-sale/domain`.

- [ ] **Step 3: Package-local gates first**

```bash
pnpm --filter @flash-sale/domain test
pnpm --filter @flash-sale/domain typecheck
pnpm --filter @flash-sale/domain build
```

Expected: all green.

- [ ] **Step 4: Full workspace quality gates**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all green. Domain package tests run via turbo `test` (`dependsOn: ["^build"]`).

- [ ] **Step 5: Verify domain has no runtime / infra deps**

```bash
node -e "const p=require('./packages/domain/package.json'); if (p.dependencies && Object.keys(p.dependencies).length) process.exit(1); console.log('no runtime deps')"
rg -n "@nestjs|@prisma|ioredis|redis" packages/domain/src || true
```

Expected: `no runtime deps`; no Nest/Prisma/Redis imports under `packages/domain/src`.

- [ ] **Step 6 (optional commit — skip unless authorized)**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: depend on @flash-sale/domain from api

EOF
)"
```

---

## Task 6: Issue DoD checklist

- [ ] **Step 1: Confirm #11 acceptance criteria / design interpretation**

The issue's "entity/value objects" wording is satisfied by the `FlashSale` entity; separate `SaleWindow`/`Stock` value objects are intentionally deferred per the approved design.

- [x] FlashSale entity exists in domain layer (`packages/domain`)
- [x] No separate value objects in #11
- [x] Domain has no NestJS/Prisma/Redis dependencies and no runtime deps
- [x] Tests passing (including defensive Dates, ID preservation, reconstitute shared invariants)
- [x] typecheck/lint/build green where applicable
- [x] No Nest wiring of domain
- [x] No unrelated changes
- [x] If commits are authorized, commit messages follow `<type>: <MESSAGE>`

- [ ] **Step 2: Optional README touch**

Only if needed for discoverability — one short bullet in root `README.md` under packages listing `@flash-sale/domain`. Skip if README already accurate enough; do not expand scope.

---

## Out of scope (do not implement)

- `FlashSale.getStatus` (#14)
- Product / Purchase entities (#12, #13)
- Prisma schema / unique constraint (#15, #16)
- Repositories (#17, #18)
- Atomic reservation / purchase flow (#19, #20)
- GraphQL purchase APIs (EPIC-03)
- Redis client (EPIC-04)
- Public branding constructor helpers (`toFlashSaleId`, etc.)

---

## Spec coverage self-review

| Spec requirement                                     | Task                          |
| ---------------------------------------------------- | ----------------------------- |
| `@flash-sale/domain` package                         | Task 1                        |
| Branded ID types (no public cast helpers)            | Task 2                        |
| `FlashSaleValidationError` codes                     | Task 2                        |
| `create` / `reconstitute` + invariants               | Tasks 3–4                     |
| Defensive Date ingest + getters                      | Task 4                        |
| Invalid Date → `INVALID_SALE_WINDOW`                 | Tasks 3–4                     |
| ID validate-but-do-not-trim                          | Task 3                        |
| Jest unit tests incl. full-stock assert              | Task 3                        |
| Intentional `apps/api` workspace dep, no Nest wiring | Task 5                        |
| Zero runtime/infra deps                              | Task 5 Step 5                 |
| Sync from `origin/main` + final reviewed spec        | Task 0                        |
| No automatic commits                                 | Header + optional checkpoints |

```

```
