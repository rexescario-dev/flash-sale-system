# EPIC-03 — GraphQL API Implementation Plan (#21–#26)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [EPIC-03 #83](https://github.com/rexescario-dev/flash-sale-system/issues/83) by exposing Nest code-first GraphQL operations `flashSale`, `myPurchase`, and `purchaseItem` over existing EPIC-02 domain ports, with hybrid result/error semantics, caller-supplied `userId`, and GraphQL ↔ PostgreSQL contract tests.

**Architecture:** Thin feature-owned resolvers inject domain tokens (`FLASH_SALE_REPOSITORY`, `PURCHASE_REPOSITORY`, `PURCHASE_FLOW`). Minimal shared GraphQL edge under `apps/api/src/graphql/` (clock, external ID validation, trusted `PurchaseId` generator, error-mapping helper). Error wiring may use a Nest GraphQL exception filter **or** Apollo `formatError` — choose what works on Nest 11 + Apollo; **#26 HTTP GraphQL assertions are the runtime authority**. `#24`/`#25` foundations land early; those tickets complete/harden. `#26` splits real-Postgres persistence vs controlled-error mapping (separate Nest testing modules + `.overrideProvider`).

**Tech Stack:** NestJS 11, `@nestjs/graphql` + Apollo Driver, `@flash-sale/domain`, Prisma 6, PostgreSQL 16, Jest + ts-jest, pnpm + Turborepo.

**Spec:** [docs/superpowers/specs/2026-07-28-epic-03-graphql-api-design.md](../specs/2026-07-28-epic-03-graphql-api-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`. Author email must be `rex.escario.jr@gmail.com`.

**ESLint:** perfectionist sort — object keys: `id` first where present, then A→Z. Nest `@Module` arrays: static modules before `forRoot` / existing A→Z conventions.

**Out of scope:** Product / `productId`; AuthN/AuthZ; idempotency keys; Redis; dataloader framework; browser E2E; concurrent purchase storm (#19/#20); Prisma schema/migration **edits**; changing `PurchaseFlow` semantics; GraphQL-specific port implementations; generic BaseResolver / CQRS layer.

**Hard invariants (locked):**

1. Resolvers → domain ports only; never Prisma; never reimplement `PurchaseFlow`.
2. Caller-supplied `userId: ID!` — **no authentication guarantee**.
3. Missing FlashSale → throw `FlashSaleNotFoundError` → `extensions.code = NOT_FOUND` on all three ops.
4. `myPurchase` is **sale-first** sequential; no purchase → `purchased: false` (not an error).
5. Five `PurchaseOutcome` values live in `PurchaseItemResult`; never in GraphQL `errors`.
6. `purchaseId` non-null **iff** `status = SUCCESS` (null for all other outcomes; not existing purchase / not idempotency key).
7. Empty/whitespace-only **external** GraphQL IDs → `BAD_USER_INPUT`; no silent trim (`" abc "` preserved). Domain IDs today are structural brands (no runtime construction failure); if runtime ID-construction validation is added later, those failures also normalize to `BAD_USER_INPUT`.
8. Unexpected errors → client `INTERNAL_SERVER_ERROR` + safe message; **retain** original for server logs. Unit tests of the mapper alone are insufficient — #26 must prove the GraphQL HTTP path.
9. Public codes exactly: `NOT_FOUND` | `BAD_USER_INPUT` | `INTERNAL_SERVER_ERROR`.
10. `nowUtc` from injectable clock for `flashSale.getStatus` and existing `#20` `PurchaseFlowExecuteInput.nowUtc`.
11. `createPurchaseId()` generates a trusted API-edge UUID; it must **not** route through external input validators (`requireNonEmptyId` / `require*Id`).
12. Mutation signature has **no** `purchaseId` argument — only `flashSaleId` + `userId`.

**Verification split (locked):**

```text
Unit (mocked ports/clock)
  ├── External ID validators / BadUserInput
  ├── Error-mapper helper (pure mapping + scrubbing) — not sole proof of HTTP wiring
  ├── flashSale mapping + injected clock (`nowUtc` called)
  ├── myPurchase sale-first / purchased true|false
  └── purchaseItem: generate PurchaseId → execute; purchaseId iff SUCCESS; no client purchaseId arg

#26 real Postgres persistence (AppModule, real providers)
  ├── Schema contract: public ops + fields (no productId / nowUtc)
  ├── flashSale SUCCESS / NOT_FOUND
  ├── myPurchase true / false / NOT_FOUND
  ├── purchaseItem SUCCESS → row + remainingStock--
  ├── purchaseItem missing sale → NOT_FOUND (via #20 PurchaseFlow)
  ├── BAD_USER_INPUT (empty/whitespace IDs)
  └── Outcomes via real #20 semantics where practical
        (SALE_NOT_STARTED, SALE_ENDED, ALREADY_PURCHASED, SOLD_OUT via existing PurchaseFlow pre-check —
         do not reimplement #20 logic in GraphQL tests)

#26 controlled-error mapping (SEPARATE Nest testing module + .overrideProvider)
  ├── failing port stub → INTERNAL_SERVER_ERROR, no leak
  └── remaining PurchaseOutcome payloads if not covered on real DB path

#19 / #20
  └── concurrency / txn rollback remain owned there
```

---

## File map

| Path                                                                | Responsibility                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/graphql/clock.ts`                                     | **Create:** `CLOCK` token + `Clock` interface + `SystemClock`                                                 |
| `apps/api/src/graphql/graphql-bad-user-input.error.ts`              | **Create:** `GraphqlBadUserInputError`                                                                        |
| `apps/api/src/graphql/id-validation.ts`                             | **Create:** external-input `requireNonEmptyId` + branded `requireId` / `requireFlashSaleId` / `requireUserId` |
| `apps/api/src/graphql/id-validation.spec.ts`                        | **Create:** unit tests for empty/whitespace / preserve spaces                                                 |
| `apps/api/src/graphql/purchase-id.ts`                               | **Create:** trusted `createPurchaseId()` (UUID brand; not via input validators)                               |
| `apps/api/src/graphql/purchase-outcome-message.ts`                  | **Create:** non-empty human messages for each outcome                                                         |
| `apps/api/src/graphql/map-graphql-error.ts`                         | **Create:** pure mapper `mapGraphqlError(exception) → GraphQLError`                                           |
| `apps/api/src/graphql/map-graphql-error.spec.ts`                    | **Create:** unit tests for mapping + scrubbing                                                                |
| `apps/api/src/graphql/graphql-error.wiring.ts`                      | **Create:** Nest filter **or** Apollo `formatError` adapter calling the pure mapper                           |
| `apps/api/src/graphql/graphql-common.module.ts`                     | **Create:** export `CLOCK`; wire chosen error mechanism (not pre-locked to `APP_FILTER`)                      |
| `apps/api/src/flash-sale/graphql/flash-sale-status.mapper.ts`       | **Create:** domain `FlashSaleStatus` → GraphQL enum (no loose casts)                                          |
| `apps/api/src/purchase/graphql/purchase-outcome.mapper.ts`          | **Create:** domain `PurchaseOutcome` → GraphQL enum                                                           |
| `apps/api/src/flash-sale/graphql/flash-sale-status.enum.ts`         | **Create:** GraphQL enum                                                                                      |
| `apps/api/src/flash-sale/graphql/flash-sale.object-type.ts`         | **Create:** `FlashSale` ObjectType                                                                            |
| `apps/api/src/flash-sale/flash-sale.resolver.ts`                    | **Create:** `flashSale` query                                                                                 |
| `apps/api/src/flash-sale/flash-sale.resolver.spec.ts`               | **Create:** unit tests                                                                                        |
| `apps/api/src/flash-sale/flash-sale.module.ts`                      | **Modify:** register resolver; import `GraphqlCommonModule`                                                   |
| `apps/api/src/purchase/graphql/purchase-outcome.enum.ts`            | **Create:** GraphQL `PurchaseOutcome` enum                                                                    |
| `apps/api/src/purchase/graphql/my-purchase-result.object-type.ts`   | **Create:** `MyPurchaseResult`                                                                                |
| `apps/api/src/purchase/graphql/purchase-item-result.object-type.ts` | **Create:** `PurchaseItemResult`                                                                              |
| `apps/api/src/purchase/purchase.resolver.ts`                        | **Create:** `myPurchase` + `purchaseItem`                                                                     |
| `apps/api/src/purchase/purchase.resolver.spec.ts`                   | **Create:** unit tests                                                                                        |
| `apps/api/src/purchase/purchase.module.ts`                          | **Modify:** register resolver; import `GraphqlCommonModule`                                                   |
| `apps/api/src/app.module.ts`                                        | **Modify:** import `GraphqlCommonModule` (if not pulled via features)                                         |
| `apps/api/jest.integration.config.cjs`                              | **Modify:** include `test/graphql/**/*.spec.ts`                                                               |
| `apps/api/test/graphql/graphql-api.integration.spec.ts`             | **Create:** #26 persistence + controlled-error suite                                                          |
| `docs/superpowers/specs/2026-07-28-epic-03-graphql-api-design.md`   | Carry if uncommitted                                                                                          |
| `docs/superpowers/plans/2026-07-28-epic-03-graphql-api.md`          | This plan                                                                                                     |

**Untouched:** `packages/domain/**` (except consuming existing exports), `apps/api/prisma/**` schema/migrations, Redis, concurrency storm tests.

---

## Task 0: Branch + verify `#20` baseline

**Files:** none (git only)

- [ ] **Step 1: Inspect working tree**

```bash
cd /home/rex/Project/test/app
git status --short
git status -sb
git fetch origin
git rev-parse HEAD origin/main
```

Rules:

- Preserve intended EPIC-03 docs if dirty (spec/plan). Do not discard.
- If unrelated dirty changes exist → stop and ask the operator.

**Desired end state of Task 0:**

```text
Feature branch feat/epic-03-graphql-api contains:
  origin/main baseline (#20 at c0055df+)
  + intended EPIC-03 spec/plan (and later code)
  + no unrelated working-tree changes
```

Do **not** branch from an unrelated feature branch merely because docs are dirty there. If EPIC-03 docs exist only as dirty files on the wrong branch: stash/copy them aside, check out `main`, create `feat/epic-03-graphql-api` from `origin/main`, then restore the intended docs onto that branch.

- [ ] **Step 2: Sync `main` and create feature branch**

```bash
git checkout main
git pull origin main
# confirm: git rev-parse HEAD == git rev-parse origin/main
git checkout -b feat/epic-03-graphql-api
# restore intended EPIC-03 docs onto this branch if they were carried separately
```

- [ ] **Step 3: Verify `#20` ports on baseline**

```bash
rg -n "PurchaseFlowExecuteInput|nowUtc|PURCHASE_FLOW|FlashSaleNotFoundError" \
  packages/domain/src/purchase/purchase.flow.ts \
  packages/domain/src/flash-sale/flash-sale-not-found.error.ts \
  apps/api/src/purchase/purchase-flow.service.ts \
  apps/api/src/purchase/purchase.module.ts
```

Expected: `PurchaseFlowExecuteInput` includes `nowUtc`; `PurchaseModule` exports `PURCHASE_FLOW`; `FlashSaleNotFoundError` exists.

- [ ] **Step 4: Commit (optional — only if user authorized)**

```bash
# usually no commit at Task 0
```

---

## Task 1: Shared GraphQL edge foundations (#24/#25 foundations)

**Files:** create shared utilities under `apps/api/src/graphql/` per file map.

**Error-wiring rule (locked for this plan):** Implement a **pure** `mapGraphqlError(exception)` mapper with unit tests. Wire it into Nest GraphQL via **either** a GraphQL exception filter **or** Apollo `formatError` — whichever reliably runs on Nest 11 + Apollo in this repo. Do **not** treat `APP_FILTER` as pre-proven. **#26 HTTP GraphQL assertions are the authority** that the chosen wiring delivers `NOT_FOUND` / `BAD_USER_INPUT` / `INTERNAL_SERVER_ERROR`.

- [ ] **Step 1: Write failing unit tests for ID validation + error mapper**

Create `apps/api/src/graphql/id-validation.spec.ts`:

```ts
import { requireFlashSaleId, requireId, requireUserId } from './id-validation';
import { GraphqlBadUserInputError } from './graphql-bad-user-input.error';

describe('id-validation (external GraphQL input only)', () => {
  it('rejects empty string', () => {
    expect(() => requireFlashSaleId('')).toThrow(GraphqlBadUserInputError);
  });

  it('rejects whitespace-only string', () => {
    expect(() => requireUserId('   ')).toThrow(GraphqlBadUserInputError);
  });

  it('preserves surrounding spaces on non-empty ids', () => {
    expect(requireFlashSaleId(' abc ')).toBe(' abc ');
    expect(requireId(' abc ')).toBe(' abc ');
  });
});
```

Create `apps/api/src/graphql/map-graphql-error.spec.ts`:

```ts
import { FlashSaleNotFoundError } from '@flash-sale/domain';
import { GraphQLError } from 'graphql';

import { GraphqlBadUserInputError } from './graphql-bad-user-input.error';
import { mapGraphqlError } from './map-graphql-error';

describe('mapGraphqlError', () => {
  it('maps FlashSaleNotFoundError to NOT_FOUND', () => {
    const err = mapGraphqlError(new FlashSaleNotFoundError());
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.extensions?.code).toBe('NOT_FOUND');
  });

  it('maps GraphqlBadUserInputError to BAD_USER_INPUT', () => {
    const err = mapGraphqlError(new GraphqlBadUserInputError('bad'));
    expect(err.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('scrubs unexpected errors to INTERNAL_SERVER_ERROR without leaking details', () => {
    const err = mapGraphqlError(new Error('prisma P2002 secret sql'));
    expect(err.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(err.message).toBe('Internal server error');
    expect(err.message).not.toMatch(/prisma|P2002|sql/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter api test -- id-validation.spec.ts map-graphql-error.spec.ts
```

Expected: FAIL (modules missing).

- [ ] **Step 3: Implement shared edge utilities**

`apps/api/src/graphql/graphql-bad-user-input.error.ts`:

```ts
export class GraphqlBadUserInputError extends Error {
  readonly code = 'BAD_USER_INPUT' as const;

  constructor(message = 'Invalid input') {
    super(message);
    this.name = 'GraphqlBadUserInputError';
  }
}
```

`apps/api/src/graphql/id-validation.ts` — **external GraphQL arguments only** (no generated-ID helpers):

```ts
import type { FlashSaleId, UserId } from '@flash-sale/domain';

import { GraphqlBadUserInputError } from './graphql-bad-user-input.error';

function requireNonEmptyId(raw: string, label: string): string {
  if (raw.length === 0 || /^\s*$/.test(raw)) {
    throw new GraphqlBadUserInputError(`${label} must be a non-empty id`);
  }
  return raw;
}

export function requireId(raw: string): FlashSaleId {
  return requireNonEmptyId(raw, 'id') as FlashSaleId;
}

export function requireFlashSaleId(raw: string): FlashSaleId {
  return requireNonEmptyId(raw, 'flashSaleId') as FlashSaleId;
}

export function requireUserId(raw: string): UserId {
  return requireNonEmptyId(raw, 'userId') as UserId;
}
```

Note: Domain IDs are structural brands today — there is no separate runtime “domain ID construction failure” path. If such validation is added later, map those failures to `BAD_USER_INPUT` as well.

`apps/api/src/graphql/clock.ts`:

```ts
import { Injectable } from '@nestjs/common';

export const CLOCK = Symbol('CLOCK');

export interface Clock {
  nowUtc(): Date;
}

@Injectable()
export class SystemClock implements Clock {
  nowUtc(): Date {
    return new Date();
  }
}
```

`apps/api/src/graphql/purchase-id.ts` — **trusted generator; does not use input validators**:

```ts
import { type PurchaseId } from '@flash-sale/domain';
import { randomUUID } from 'node:crypto';

/** API/application-edge PurchaseId generator (not an idempotency key; not external input). */
export function createPurchaseId(): PurchaseId {
  return randomUUID() as PurchaseId;
}
```

`apps/api/src/graphql/purchase-outcome-message.ts`:

```ts
import type { PurchaseOutcome } from '@flash-sale/domain';

const MESSAGES: Record<PurchaseOutcome, string> = {
  ALREADY_PURCHASED: 'User already purchased this flash sale',
  SALE_ENDED: 'Flash sale has ended',
  SALE_NOT_STARTED: 'Flash sale has not started',
  SOLD_OUT: 'Flash sale is sold out',
  SUCCESS: 'Purchase completed',
};

export function messageForPurchaseOutcome(outcome: PurchaseOutcome): string {
  return MESSAGES[outcome];
}
```

`apps/api/src/graphql/map-graphql-error.ts`:

```ts
import { FlashSaleNotFoundError } from '@flash-sale/domain';
import { Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';

import { GraphqlBadUserInputError } from './graphql-bad-user-input.error';

const logger = new Logger('mapGraphqlError');

/** Pure mapping used by whichever Nest/Apollo wiring is chosen. */
export function mapGraphqlError(exception: unknown): GraphQLError {
  if (exception instanceof FlashSaleNotFoundError) {
    return new GraphQLError(exception.message, {
      extensions: { code: 'NOT_FOUND' },
    });
  }

  if (exception instanceof GraphqlBadUserInputError) {
    return new GraphQLError(exception.message, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (exception instanceof GraphQLError) {
    return exception;
  }

  logger.error(
    'Unexpected GraphQL error',
    exception instanceof Error ? exception.stack : String(exception),
  );

  return new GraphQLError('Internal server error', {
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  });
}
```

`apps/api/src/graphql/graphql-error.wiring.ts` — implement **one** of:

**Option A — Nest GraphQL exception filter** (preferred if it works end-to-end):

```ts
import { Catch, type ArgumentsHost } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

import { mapGraphqlError } from './map-graphql-error';

@Catch()
export class GraphqlExceptionFilter implements GqlExceptionFilter {
  catch(exception: unknown, _host: ArgumentsHost): GraphQLError {
    return mapGraphqlError(exception);
  }
}
```

**Option B — Apollo `formatError`** in `GraphQLModule.forRoot` calling `mapGraphqlError`.

Register the chosen option in `GraphqlCommonModule` / `AppModule` **without** claiming `APP_FILTER` is mandatory. If Option A is used via `APP_FILTER`, #26 must still prove HTTP behavior.

`apps/api/src/graphql/graphql-common.module.ts` (example for Option A):

```ts
import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { CLOCK, SystemClock } from './clock';
import { GraphqlExceptionFilter } from './graphql-error.wiring';

@Global()
@Module({
  exports: [CLOCK],
  providers: [
    SystemClock,
    {
      provide: CLOCK,
      useExisting: SystemClock,
    },
    // Only if Option A is chosen and verified later by #26:
    {
      provide: APP_FILTER,
      useClass: GraphqlExceptionFilter,
    },
  ],
})
export class GraphqlCommonModule {}
```

If Option B is chosen instead, omit `APP_FILTER` and wire `formatError` in `app.module.ts` `GraphQLModule.forRoot`.

- [ ] **Step 4: Wire `GraphqlCommonModule` into `AppModule`**

Modify `apps/api/src/app.module.ts` — add `GraphqlCommonModule` to `imports` (alphabetical / existing static-before-forRoot convention). Apply Option B `formatError` here if that path is selected.

- [ ] **Step 5: Run unit tests + typecheck**

```bash
pnpm --filter api test -- id-validation.spec.ts map-graphql-error.spec.ts
pnpm --filter api typecheck
pnpm --filter api lint
```

Expected: PASS (accept perfectionist reorders).

**Note:** Passing unit mapper tests does **not** close #24. Runtime proof is Task 7 (#26).

- [ ] **Step 6: Commit (optional — only if user authorized)**

```bash
git add apps/api/src/graphql apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat: add GraphQL shared edge foundations

EOF
)"
```

---

## Task 2: `#21` — `flashSale` query

**Files:**

- Create: `apps/api/src/flash-sale/graphql/flash-sale-status.enum.ts`
- Create: `apps/api/src/flash-sale/graphql/flash-sale.object-type.ts`
- Create: `apps/api/src/flash-sale/flash-sale.resolver.ts`
- Create: `apps/api/src/flash-sale/flash-sale.resolver.spec.ts`
- Modify: `apps/api/src/flash-sale/flash-sale.module.ts`

- [ ] **Step 1: Write failing resolver unit tests**

```ts
import {
  FLASH_SALE_REPOSITORY,
  FlashSale,
  type FlashSaleId,
  type FlashSaleRepository,
  FlashSaleNotFoundError,
  type ProductId,
} from '@flash-sale/domain';

import { FlashSaleResolver } from './flash-sale.resolver';
import type { Clock } from '../graphql/clock';

describe('FlashSaleResolver', () => {
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const clock: Clock = { nowUtc: () => nowUtc };

  function build(repo: Partial<FlashSaleRepository>) {
    return new FlashSaleResolver(repo as FlashSaleRepository, clock);
  }

  it('maps domain FlashSale using injected clock for status', async () => {
    const nowUtcSpy = jest.fn(() => nowUtc);
    const clockWithSpy: Clock = { nowUtc: nowUtcSpy };
    const flashSale = FlashSale.reconstitute({
      id: 'sale-1' as FlashSaleId,
      productId: 'product-1' as ProductId, // domain fixture only — must never appear in GraphQL output
      endsAt: new Date('2026-07-28T14:00:00.000Z'),
      remainingStock: 3,
      startsAt: new Date('2026-07-28T10:00:00.000Z'),
      totalStock: 5,
    });
    const resolver = new FlashSaleResolver(
      { findById: jest.fn().mockResolvedValue(flashSale) } as FlashSaleRepository,
      clockWithSpy,
    );

    const result = await resolver.flashSale('sale-1');

    expect(nowUtcSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      endsAt: flashSale.getEndsAt(),
      id: 'sale-1',
      remainingStock: 3,
      startsAt: flashSale.getStartsAt(),
      status: 'ACTIVE',
      totalStock: 5,
    });
    expect(result).not.toHaveProperty('productId');
  });

  it('throws FlashSaleNotFoundError when missing', async () => {
    const resolver = build({
      findById: jest.fn().mockResolvedValue(null),
    });
    await expect(resolver.flashSale('missing')).rejects.toBeInstanceOf(FlashSaleNotFoundError);
  });

  it('rejects whitespace-only id before repository', async () => {
    const findById = jest.fn();
    const resolver = build({ findById });
    await expect(resolver.flashSale('   ')).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(findById).not.toHaveBeenCalled();
  });
});
```

Adjust constructor injection to match implementation (`@Inject(FLASH_SALE_REPOSITORY)`, `@Inject(CLOCK)`).

- [ ] **Step 2: Run to verify fail**

```bash
pnpm --filter api test -- flash-sale.resolver.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement GraphQL types + resolver**

`flash-sale-status.enum.ts`:

```ts
import { registerEnumType } from '@nestjs/graphql';

export enum FlashSaleStatusGql {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  SOLD_OUT = 'SOLD_OUT',
  UPCOMING = 'UPCOMING',
}

registerEnumType(FlashSaleStatusGql, { name: 'FlashSaleStatus' });
```

`flash-sale.object-type.ts`:

```ts
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';

import { FlashSaleStatusGql } from './flash-sale-status.enum';

@ObjectType('FlashSale')
export class FlashSaleObjectType {
  @Field(() => GraphQLISODateTime)
  endsAt!: Date;

  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  remainingStock!: number;

  @Field(() => GraphQLISODateTime)
  startsAt!: Date;

  @Field(() => FlashSaleStatusGql)
  status!: FlashSaleStatusGql;

  @Field(() => Int)
  totalStock!: number;
}
```

`flash-sale.resolver.ts`:

```ts
import {
  FLASH_SALE_REPOSITORY,
  type FlashSaleRepository,
  FlashSaleNotFoundError,
} from '@flash-sale/domain';
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { CLOCK, type Clock } from '../graphql/clock';
import { requireId } from '../graphql/id-validation';
import { FlashSaleObjectType } from './graphql/flash-sale.object-type';
import { toFlashSaleStatusGql } from './graphql/flash-sale-status.mapper';

@Resolver()
export class FlashSaleResolver {
  constructor(
    @Inject(FLASH_SALE_REPOSITORY)
    private readonly flashSaleRepository: FlashSaleRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  @Query(() => FlashSaleObjectType, { name: 'flashSale' })
  async flashSale(@Args('id', { type: () => ID }) id: string): Promise<FlashSaleObjectType> {
    const flashSaleId = requireId(id);
    const flashSale = await this.flashSaleRepository.findById(flashSaleId);
    if (flashSale === null) {
      throw new FlashSaleNotFoundError();
    }

    const status = toFlashSaleStatusGql(flashSale.getStatus(this.clock.nowUtc()));

    return {
      endsAt: flashSale.getEndsAt(),
      id: flashSale.getId(),
      remainingStock: flashSale.getRemainingStock(),
      startsAt: flashSale.getStartsAt(),
      status,
      totalStock: flashSale.getTotalStock(),
    };
  }
}
```

`flash-sale-status.mapper.ts`:

```ts
import type { FlashSaleStatus } from '@flash-sale/domain';

import { FlashSaleStatusGql } from './flash-sale-status.enum';

const STATUS_MAP: Record<FlashSaleStatus, FlashSaleStatusGql> = {
  ACTIVE: FlashSaleStatusGql.ACTIVE,
  ENDED: FlashSaleStatusGql.ENDED,
  SOLD_OUT: FlashSaleStatusGql.SOLD_OUT,
  UPCOMING: FlashSaleStatusGql.UPCOMING,
};

export function toFlashSaleStatusGql(status: FlashSaleStatus): FlashSaleStatusGql {
  return STATUS_MAP[status];
}
```

In the resolver, use `toFlashSaleStatusGql(flashSale.getStatus(this.clock.nowUtc()))` — **no** `as FlashSaleStatusGql` cast.

- [ ] **Step 4: Register resolver in `FlashSaleModule`**

```ts
providers: [
  // ...existing
  FlashSaleResolver,
],
```

Import `GraphqlCommonModule` if `CLOCK` is not already global via `AppModule` (global module still requires import once in the app — `AppModule` is enough).

- [ ] **Step 5: Run tests**

```bash
pnpm --filter api test -- flash-sale.resolver.spec.ts
pnpm --filter api typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat: add flashSale GraphQL query

EOF
)"
```

---

## Task 3: `#22` — `myPurchase` query

**Files:**

- Create: `apps/api/src/purchase/graphql/my-purchase-result.object-type.ts`
- Create/Modify: `apps/api/src/purchase/purchase.resolver.ts` (+ spec)
- Modify: `apps/api/src/purchase/purchase.module.ts`

- [ ] **Step 1: Write failing unit tests (sale-first)**

Create / extend `apps/api/src/purchase/purchase.resolver.spec.ts`:

```ts
import {
  FLASH_SALE_REPOSITORY,
  FlashSale,
  type FlashSaleId,
  type FlashSaleRepository,
  FlashSaleNotFoundError,
  type ProductId,
  Purchase,
  type PurchaseFlow,
  type PurchaseId,
  PURCHASE_FLOW,
  PURCHASE_REPOSITORY,
  type PurchaseRepository,
  type UserId,
} from '@flash-sale/domain';

import type { Clock } from '../graphql/clock';
import { PurchaseResolver } from './purchase.resolver';

describe('PurchaseResolver.myPurchase', () => {
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const clock: Clock = { nowUtc: () => nowUtc };

  const sale = FlashSale.reconstitute({
    id: 'sale-1' as FlashSaleId,
    productId: 'product-1' as ProductId,
    endsAt: new Date('2026-07-28T14:00:00.000Z'),
    remainingStock: 3,
    startsAt: new Date('2026-07-28T10:00:00.000Z'),
    totalStock: 5,
  });

  function build(
    flashSales: Partial<FlashSaleRepository>,
    purchases: Partial<PurchaseRepository>,
    flow: Partial<PurchaseFlow> = {},
  ) {
    return new PurchaseResolver(
      flashSales as FlashSaleRepository,
      purchases as PurchaseRepository,
      flow as PurchaseFlow,
      clock,
    );
  }

  it('throws FlashSaleNotFoundError when sale missing (before purchase lookup)', async () => {
    const flashSales = { findById: jest.fn().mockResolvedValue(null) };
    const purchases = { findByFlashSaleAndUser: jest.fn() };
    const resolver = build(flashSales, purchases);

    await expect(resolver.myPurchase('sale-1', 'user-1')).rejects.toBeInstanceOf(
      FlashSaleNotFoundError,
    );
    expect(purchases.findByFlashSaleAndUser).not.toHaveBeenCalled();
  });

  it('returns purchased false when sale exists and no purchase', async () => {
    const resolver = build(
      { findById: jest.fn().mockResolvedValue(sale) },
      { findByFlashSaleAndUser: jest.fn().mockResolvedValue(null) },
    );

    await expect(resolver.myPurchase('sale-1', 'user-1')).resolves.toEqual({
      purchased: false,
      purchaseId: null,
      purchasedAt: null,
    });
  });

  it('returns purchased true with ids when purchase exists', async () => {
    const purchasedAt = new Date('2026-07-28T11:00:00.000Z');
    const purchase = Purchase.create({
      flashSaleId: 'sale-1' as FlashSaleId,
      id: 'purchase-1' as PurchaseId,
      userId: 'user-1' as UserId,
      purchasedAt,
    });
    const resolver = build(
      { findById: jest.fn().mockResolvedValue(sale) },
      { findByFlashSaleAndUser: jest.fn().mockResolvedValue(purchase) },
    );

    await expect(resolver.myPurchase('sale-1', 'user-1')).resolves.toEqual({
      purchased: true,
      purchaseId: 'purchase-1',
      purchasedAt,
    });
  });

  it('rejects whitespace-only userId before ports', async () => {
    const findById = jest.fn();
    const findByFlashSaleAndUser = jest.fn();
    const resolver = build({ findById }, { findByFlashSaleAndUser });

    await expect(resolver.myPurchase('sale-1', '   ')).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(findById).not.toHaveBeenCalled();
    expect(findByFlashSaleAndUser).not.toHaveBeenCalled();
  });
});
```

Constructor parameter order must match the resolver implementation (`flashSaleRepository`, `purchaseRepository`, `purchaseFlow`, `clock`) with `@Inject` tokens.

- [ ] **Step 2: Implement `MyPurchaseResult` + resolver method**

```ts
@ObjectType('MyPurchaseResult')
export class MyPurchaseResultObjectType {
  @Field(() => Boolean)
  purchased!: boolean;

  @Field(() => ID, { nullable: true })
  purchaseId!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  purchasedAt!: Date | null;
}
```

Resolver flow (normative):

```text
requireFlashSaleId + requireUserId
→ flashSaleRepository.findById → null → FlashSaleNotFoundError
→ purchaseRepository.findByFlashSaleAndUser
   → null → { purchased:false, purchaseId:null, purchasedAt:null }
   → purchase → { purchased:true, purchaseId, purchasedAt }
```

Inject `FLASH_SALE_REPOSITORY` and `PURCHASE_REPOSITORY` (both available: `PurchaseModule` imports `FlashSaleModule`).

- [ ] **Step 3: Register `PurchaseResolver` in `PurchaseModule`**

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter api test -- purchase.resolver.spec.ts
pnpm --filter api typecheck
```

- [ ] **Step 5: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat: add myPurchase GraphQL query

EOF
)"
```

---

## Task 4: `#23` — `purchaseItem` mutation

**Files:**

- Create: `apps/api/src/purchase/graphql/purchase-outcome.enum.ts`
- Create: `apps/api/src/purchase/graphql/purchase-item-result.object-type.ts`
- Modify: `apps/api/src/purchase/purchase.resolver.ts` (+ spec)

- [ ] **Step 1: Write failing unit tests**

Extend `purchase.resolver.spec.ts` with a `describe('PurchaseResolver.purchaseItem')` block:

```ts
describe('PurchaseResolver.purchaseItem', () => {
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const clock: Clock = { nowUtc: () => nowUtc };

  function build(flow: Partial<PurchaseFlow>) {
    return new PurchaseResolver(
      { findById: jest.fn() } as unknown as FlashSaleRepository,
      { findByFlashSaleAndUser: jest.fn() } as unknown as PurchaseRepository,
      flow as PurchaseFlow,
      clock,
    );
  }

  it('validates ids before calling PurchaseFlow', async () => {
    const execute = jest.fn();
    const resolver = build({ execute });
    await expect(resolver.purchaseItem('sale-1', '   ')).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes generated purchaseId and clock nowUtc into execute before returning', async () => {
    const execute = jest.fn().mockImplementation(async (input) => {
      expect(input.purchaseId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(input.nowUtc).toBe(nowUtc);
      return 'SUCCESS';
    });
    const resolver = build({ execute });
    const result = await resolver.purchaseItem('sale-1', 'user-1');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].purchaseId).toBe(result.purchaseId);
    expect(result).toEqual({
      message: 'Purchase completed',
      purchaseId: expect.any(String),
      status: 'SUCCESS',
    });
  });

  it('does not accept a client purchaseId argument (TypeScript / resolver arity)', () => {
    expect(PurchaseResolver.prototype.purchaseItem.length).toBe(2);
  });

  it.each([
    ['ALREADY_PURCHASED', 'User already purchased this flash sale'],
    ['SALE_NOT_STARTED', 'Flash sale has not started'],
    ['SALE_ENDED', 'Flash sale has ended'],
    ['SOLD_OUT', 'Flash sale is sold out'],
  ] as const)('maps %s with null purchaseId', async (outcome, message) => {
    const resolver = build({ execute: jest.fn().mockResolvedValue(outcome) });
    await expect(resolver.purchaseItem('sale-1', 'user-1')).resolves.toEqual({
      message,
      purchaseId: null,
      status: outcome,
    });
  });

  it('propagates FlashSaleNotFoundError', async () => {
    const resolver = build({
      execute: jest.fn().mockRejectedValue(new FlashSaleNotFoundError()),
    });
    await expect(resolver.purchaseItem('sale-1', 'user-1')).rejects.toBeInstanceOf(
      FlashSaleNotFoundError,
    );
  });
});
```

- [ ] **Step 2: Implement enum + result type + mutation**

```ts
registerEnumType(PurchaseOutcomeGql, { name: 'PurchaseOutcome' });

@ObjectType('PurchaseItemResult')
export class PurchaseItemResultObjectType {
  @Field(() => String)
  message!: string;

  @Field(() => ID, { nullable: true })
  purchaseId!: string | null;

  @Field(() => PurchaseOutcomeGql)
  status!: PurchaseOutcomeGql;
}
```

Mutation body:

```ts
@Mutation(() => PurchaseItemResultObjectType, { name: 'purchaseItem' })
async purchaseItem(
  @Args('flashSaleId', { type: () => ID }) flashSaleIdRaw: string,
  @Args('userId', { type: () => ID }) userIdRaw: string,
): Promise<PurchaseItemResultObjectType> {
  const flashSaleId = requireFlashSaleId(flashSaleIdRaw);
  const userId = requireUserId(userIdRaw);
  const purchaseId = createPurchaseId();
  const outcome = await this.purchaseFlow.execute({
    flashSaleId,
    nowUtc: this.clock.nowUtc(),
    purchaseId,
    userId,
  });

  return {
    message: messageForPurchaseOutcome(outcome),
    purchaseId: outcome === 'SUCCESS' ? purchaseId : null,
    status: toPurchaseOutcomeGql(outcome),
  };
}
```

Add `purchase-outcome.mapper.ts` mirroring the flash-sale status mapper (domain union → GraphQL enum via `Record` map, no `as` cast).

- [ ] **Step 3: Run tests**

```bash
pnpm --filter api test -- purchase.resolver.spec.ts
pnpm --filter api typecheck
```

- [ ] **Step 4: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat: add purchaseItem GraphQL mutation

EOF
)"
```

---

## Task 5: `#24` — Complete/harden error semantics

**Files:**

- Extend: `map-graphql-error.ts` / `map-graphql-error.spec.ts` / chosen wiring file
- Ensure all three ops throw `FlashSaleNotFoundError` (already required)
- Confirm #26 will own HTTP runtime proof (do not mark #24 done on unit tests alone)

- [ ] **Step 1: Audit mapping table against implementation**

| Input                      | `extensions.code`                      |
| -------------------------- | -------------------------------------- |
| `FlashSaleNotFoundError`   | `NOT_FOUND`                            |
| `GraphqlBadUserInputError` | `BAD_USER_INPUT`                       |
| Unexpected `Error`         | `INTERNAL_SERVER_ERROR` + safe message |
| Existing `GraphQLError`    | preserved (native GraphQL validation)  |

- [ ] **Step 2: Add/adjust unit tests for logging scrubbing contract**

Assert unexpected path on **`mapGraphqlError`**:

- returns safe message
- does **not** include original message in GraphQL payload
- (optional) spy `Logger.error` called with original

- [ ] **Step 3: Run**

```bash
pnpm --filter api test -- map-graphql-error.spec.ts flash-sale.resolver.spec.ts purchase.resolver.spec.ts
```

- [ ] **Step 4: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat: harden GraphQL error mapping

EOF
)"
```

---

## Task 6: `#25` — Complete/harden validation

**Files:**

- Extend `id-validation.spec.ts` for all **external** helpers (`requireId`, `requireFlashSaleId`, `requireUserId`)
- Confirm resolvers never call ports when validation fails
- Confirm `createPurchaseId` is **not** part of this validator surface

- [ ] **Step 1: Expand unit matrix**

```ts
it.each(['', ' ', '\t', '\n', '   '])('rejects %j', (raw) => {
  expect(() => requireUserId(raw)).toThrow(GraphqlBadUserInputError);
});

it('preserves internal and surrounding spaces', () => {
  expect(requireUserId(' a b ')).toBe(' a b ');
});
```

- [ ] **Step 2: Resolver-level "ports not called" assertions** for whitespace on `myPurchase` / `purchaseItem`

- [ ] **Step 3: Run**

```bash
pnpm --filter api test -- id-validation.spec.ts purchase.resolver.spec.ts flash-sale.resolver.spec.ts
```

- [ ] **Step 4: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat: harden GraphQL id validation

EOF
)"
```

---

## Task 7: `#26` — GraphQL ↔ PostgreSQL contract/integration tests

**Files:**

- Modify: `apps/api/jest.integration.config.cjs` — add `'<rootDir>/test/graphql/**/*.spec.ts'` to `testMatch`
- Create: `apps/api/test/graphql/graphql-api.integration.spec.ts`

**Two Nest testing modules (locked):**

```text
Persistence suite
  Test.createTestingModule({ imports: [AppModule] }).compile()
  → real ports → real Prisma → real PostgreSQL

Controlled-error suite
  Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FLASH_SALE_REPOSITORY | PURCHASE_FLOW)
    .useValue(failingStub)
    .compile()
  → do not mutate the production provider graph
  → separate module instance; do not share with persistence suite
```

- [ ] **Step 1: Update Jest integration config**

```js
testMatch: [
  '<rootDir>/test/flash-sale/**/*.spec.ts',
  '<rootDir>/test/purchase/**/*.spec.ts',
  '<rootDir>/test/graphql/**/*.spec.ts',
],
```

- [ ] **Step 2: Scaffold Nest GraphQL HTTP client**

Pattern for **persistence** app:

1. `Test.createTestingModule({ imports: [AppModule] }).compile()`
2. `createNestApplication()` + `app.init()`
3. POST `/graphql` (prefer zero new deps: Node `fetch` against `app.getHttpServer()` via `http`/`undici`, or add `supertest` as api `devDependency` if needed)

**#26 is the runtime authority** for error wiring:

```text
resolver throws FlashSaleNotFoundError
  → HTTP GraphQL response
  → errors[0].extensions.code === 'NOT_FOUND'

port throws Error('secret prisma detail')  [controlled-error module]
  → HTTP GraphQL response
  → extensions.code === 'INTERNAL_SERVER_ERROR'
  → message === 'Internal server error'
  → no prisma/sql/stack leak
```

If the chosen Task 1 wiring fails these HTTP assertions, fix the wiring (switch filter ↔ `formatError` as needed) until they pass.

- [ ] **Step 3: Schema contract assertion (not a separate schema-only suite)**

Execute a representative selection (or minimal introspection) that proves public surface:

```text
Query: flashSale, myPurchase
Mutation: purchaseItem

FlashSale fields: id, status, remainingStock, totalStock, startsAt, endsAt
MyPurchaseResult: purchased, purchaseId, purchasedAt
PurchaseItemResult: status, message, purchaseId
```

Assert absence of accidental fields in successful payloads: **no** `productId`, **no** `nowUtc`.

Also assert GraphQL rejects unknown mutation arg `purchaseId` (or that the schema/operation does not declare it).

- [ ] **Step 4: Real persistence cases**

Seed via Prisma (same suffix/`randomUUID` cleanup pattern as purchase-flow integration). Use wall-clock-relative sale windows with real `SystemClock`.

Minimum list:

1. `flashSale` SUCCESS — status/stock/window fields present
2. `flashSale` missing → `NOT_FOUND`
3. `myPurchase` false / true
4. `myPurchase` missing sale → `NOT_FOUND`
5. `purchaseItem` SUCCESS → GraphQL `SUCCESS` + `purchaseId`; assert purchase row + `remainingStock` decremented
6. `purchaseItem` missing sale → `NOT_FOUND` (via real `#20` `PurchaseFlow` → `FlashSaleNotFoundError` → mapped code)
7. `purchaseItem` whitespace `userId` → `BAD_USER_INPUT`
8. Outcomes via **existing #20 semantics** (do not reimplement purchase logic in GraphQL tests):
   - `SALE_NOT_STARTED` / `SALE_ENDED` fixtures
   - `ALREADY_PURCHASED` (pre-seed purchase outside flow)
   - `SOLD_OUT` only through a fixture that causes real `PurchaseFlow` to return `SOLD_OUT` via its normal pre-check path

- [ ] **Step 5: Controlled-error mapping case (separate module)**

```ts
const moduleRef = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideProvider(FLASH_SALE_REPOSITORY) // or PURCHASE_FLOW
  .useValue({
    findById: async () => {
      throw new Error('secret prisma detail');
    },
  })
  .compile();
```

Assert scrubbed `INTERNAL_SERVER_ERROR`.

For any `PurchaseOutcome` not covered on the real-DB path, override `PURCHASE_FLOW` in another controlled module and assert GraphQL payloads (`purchaseId` null except `SUCCESS`).

**Five outcomes requirement:** every `PurchaseOutcome` must appear in at least one GraphQL response assertion in this suite (real DB and/or controlled stub).

- [ ] **Step 6: Run integration**

```bash
pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:integration -- graphql-api.integration.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
test: add GraphQL API PostgreSQL contract coverage

EOF
)"
```

---

## Task 8: Quality gates + DoD

- [ ] **Step 1: Run gates**

```bash
pnpm --filter @flash-sale/domain build
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test -- id-validation.spec.ts map-graphql-error.spec.ts flash-sale.resolver.spec.ts purchase.resolver.spec.ts
pnpm --filter api test:integration -- graphql-api.integration.spec.ts
```

- [ ] **Step 2: DoD checklist**

- [ ] Schema ops: `flashSale`, `myPurchase`, `purchaseItem` only (integration schema contract asserts fields; no `productId` / `nowUtc`)
- [ ] GraphQL DTOs (not Prisma models)
- [ ] Hybrid errors; codes `NOT_FOUND` | `BAD_USER_INPUT` | `INTERNAL_SERVER_ERROR` only
- [ ] HTTP GraphQL proves `NOT_FOUND` for all three missing-sale paths + scrubbed `INTERNAL_SERVER_ERROR`
- [ ] Caller-supplied `userId`; no AuthN claims
- [ ] `purchaseId` iff `SUCCESS`; mutation accepts only `flashSaleId` + `userId`
- [ ] `createPurchaseId` does not use external ID validators
- [ ] Resolvers → ports only; `PurchaseFlow` unchanged
- [ ] No Product / idempotency / Redis
- [ ] Unit + #26 persistence + #26 controlled-error (`.overrideProvider`) passing
- [ ] Turbo `^build` preserved
- [ ] Spec status can be marked approved once merged

- [ ] **Step 3: Commit (optional)** — only if leftover docs/code and user asked

---

## Self-review (plan vs spec)

| Spec requirement                                                             | Task             |
| ---------------------------------------------------------------------------- | ---------------- |
| Shared edge foundations early (mapper + validators + clock + PurchaseId gen) | 1                |
| Error wiring verified via HTTP GraphQL (not unit-only)                       | 1 + 7            |
| `flashSale` + injected clock + stock/window; no productId                    | 2                |
| `myPurchase` sale-first                                                      | 3                |
| `purchaseItem` + trusted API-edge `PurchaseId` + `nowUtc`                    | 4                |
| Error mapping complete/harden                                                | 1 + 5            |
| Validation complete/harden (external IDs only)                               | 1 + 6            |
| #26 persistence + controlled error + five outcomes + schema contract         | 7                |
| Three missing-sale `NOT_FOUND` paths                                         | 7                |
| No Product / auth / idempotency / PurchaseFlow change                        | Out + invariants |

No placeholders. Types/names match the approved umbrella spec (`PurchaseOutcome`, `MyPurchaseResult`, `NOT_FOUND`, etc.).

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-07-28-epic-03-graphql-api.md` (uncommitted).

**1. Subagent-Driven (recommended)** — fresh subagent per task + two-stage review  
**2. Inline Execution** — executing-plans in this session with checkpoints

Which approach?
