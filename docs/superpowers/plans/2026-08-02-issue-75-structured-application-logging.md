# #75 Structured Application Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce an `AppLogger` contract + dotted `LogEvent` taxonomy, emit GraphQL request lifecycle events via an Apollo plugin, and emit purchase domain/read events from `PurchaseResolver` — without changing health contracts or Redis fail-open logs.

**Architecture:** Global `LoggingModule` provides injectable `AppLogger` (Nest `Logger` backend; API is `info|warn|error|debug(event, fields?)` → `{ event, ...fields }`). `GraphqlLoggingPlugin` (Apollo `requestDidStart`) emits `graphql.request.completed|failed`. `PurchaseResolver` owns `purchase.*` / `purchase.query.completed`. `PurchaseFlowService` stays silent. Expected GraphQL execution errors currently include `RATE_LIMITED`, `BAD_USER_INPUT`, and `NOT_FOUND` and still count as lifecycle `completed`.

**Tech Stack:** NestJS 11, `@nestjs/apollo` / Apollo Server 5 plugins, existing Jest unit tests under `apps/api`, Nest `Logger` (no pino).

**Base:** `main` at `#79` merge tip (`2699a68` / PR `#169` or later).

**Commits:** Commit in logical groups per task using `<type>: <MESSAGE>` **only when the user asks to commit**. Create a PR when implementation and verification are complete and the user requests it.

**Spec:** `docs/superpowers/specs/2026-08-02-issue-75-structured-application-logging-design.md`

**Issue AC:**

- [ ] Structured logs are emitted for key request/purchase paths

**Task order:** Worktree → `AppLogger`/`LogEvent` TDD → Apollo plugin TDD + wire → `PurchaseResolver` domain/read logging TDD → freeze/DoD verification.

**Worktree:** Prefer isolated worktree via `using-git-worktrees` (e.g. `.worktrees/75-structured-logging` on `feat/75-structured-logging`) before editing. If worktree creation is blocked, work on a feature branch in place.

---

## File map

| File                                                                                  | Responsibility                                                          |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/api/src/logging/log-event.ts`                                                   | **Create** — `LogEvent` dotted taxonomy constants                       |
| `apps/api/src/logging/app-logger.ts`                                                  | **Create** — `AppLogger` thin Nest `Logger` wrapper                     |
| `apps/api/src/logging/app-logger.spec.ts`                                             | **Create** — contract unit tests                                        |
| `apps/api/src/logging/logging.module.ts`                                              | **Create** — global module exporting `AppLogger`                        |
| `apps/api/src/graphql/graphql-logging.plugin.ts`                                      | **Create** — Apollo plugin factory for GraphQL request lifecycle events |
| `apps/api/src/graphql/graphql-logging.plugin.spec.ts`                                 | **Create** — completed / failed / expected-error-code tests             |
| `apps/api/src/graphql/graphql-common.module.ts`                                       | Unchanged — GraphQL bootstrap stays in `AppModule`                      |
| `apps/api/src/app.module.ts`                                                          | **Modify** — import `LoggingModule`; register plugin on `GraphQLModule` |
| `apps/api/src/purchase/purchase.resolver.ts`                                          | **Modify** — emit purchase / query structured events                    |
| `apps/api/src/purchase/purchase.resolver.spec.ts`                                     | **Modify** — spy `AppLogger`; assert events + mutual exclusion          |
| `apps/api/src/purchase/purchase-flow.service.ts`                                      | Unchanged — no logging                                                  |
| `apps/api/src/redis/*` / `apps/api/src/health/*`                                      | Unchanged                                                               |
| `docs/superpowers/specs/2026-08-02-issue-75-structured-application-logging-design.md` | Approved design                                                         |
| `docs/superpowers/plans/2026-08-02-issue-75-structured-application-logging.md`        | This plan                                                               |

**Frozen:** `GET /health` / `GET /health/ready` contracts; Redis snake_case fail-open events; pino/winston; `LOG_LEVEL`; correlation IDs (#76); metrics (#80); EPIC-07 k6 results invention; `#134` CSS AC.

**Naming:** Keep project `Graphql*` class prefix (`GraphqlLoggingPlugin`, matching `GraphqlCommonModule` / `GraphqlRateLimitedError`).

---

### Task 1: Create worktree / branch

**Files:** none yet

- [ ] **Step 1: Ensure `main` includes `#79` tip**

```bash
cd /home/rex/Project/test/app
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git log -1 --oneline
git merge-base --is-ancestor 2699a68 HEAD && echo OK
```

Expected: tip is `2699a68…` or later; ancestor check prints `OK`.

- [ ] **Step 2: Create isolated worktree**

```bash
cd /home/rex/Project/test/app
git check-ignore -q .worktrees || echo 'FAIL: .worktrees not ignored'
git worktree add .worktrees/75-structured-logging -b feat/75-structured-logging main
cd .worktrees/75-structured-logging
```

Expected: new worktree on `feat/75-structured-logging`. If sandbox/permission blocks worktree creation, create the branch in place instead and continue from repo root.

- [ ] **Step 3: Confirm clean baseline**

```bash
git status
test -f apps/api/src/purchase/purchase.resolver.ts \
  && test -f apps/api/src/app.module.ts \
  && test -f apps/api/src/graphql/graphql-common.module.ts
pnpm --filter api test -- --testPathPattern='purchase.resolver|map-graphql-error|health'
```

Expected: clean worktree; existing purchase/health/error mapping unit tests pass.

- [ ] **Step 4: Commit** — none (branch/worktree creation only).

---

### Task 2: `LogEvent` + `AppLogger` TDD

**Files:**

- Create: `apps/api/src/logging/log-event.ts`
- Create: `apps/api/src/logging/app-logger.ts`
- Create: `apps/api/src/logging/app-logger.spec.ts`
- Create: `apps/api/src/logging/logging.module.ts`

- [ ] **Step 1: Write the failing `AppLogger` tests**

Create `apps/api/src/logging/app-logger.spec.ts`:

```ts
import { Logger } from '@nestjs/common';

import { AppLogger } from './app-logger';
import { LogEvent } from './log-event';

describe('AppLogger', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let appLogger: AppLogger;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    appLogger = new AppLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('info emits { event, ...fields } without mutating fields', () => {
    const fields = { flashSaleId: 'sale-1', userId: 'user-1' };
    const snapshot = { ...fields };

    appLogger.info(LogEvent.PURCHASE_COMPLETED, fields);

    expect(fields).toEqual(snapshot);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toEqual({
      event: LogEvent.PURCHASE_COMPLETED,
      flashSaleId: 'sale-1',
      userId: 'user-1',
    });
  });

  it('warn / debug emit structured payloads', () => {
    appLogger.warn(LogEvent.PURCHASE_RATE_LIMITED, { userId: 'u1' });
    appLogger.debug(LogEvent.PURCHASE_ATTEMPTED, { userId: 'u1' });

    expect(warnSpy.mock.calls[0][0]).toEqual({
      event: LogEvent.PURCHASE_RATE_LIMITED,
      userId: 'u1',
    });
    expect(debugSpy.mock.calls[0][0]).toEqual({
      event: LogEvent.PURCHASE_ATTEMPTED,
      userId: 'u1',
    });
  });

  it('error merges error: string and never includes stack in payload', () => {
    const err = new Error('boom');
    appLogger.error(LogEvent.PURCHASE_FAILED, { userId: 'u1' }, err);

    const payload = errorSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({
      event: LogEvent.PURCHASE_FAILED,
      userId: 'u1',
      error: 'boom',
    });
    expect(payload).not.toHaveProperty('stack');
    expect(JSON.stringify(payload)).not.toContain(err.stack ?? 'no-stack');
  });

  it('error stringifies non-Error values', () => {
    appLogger.error(LogEvent.GRAPHQL_REQUEST_FAILED, {}, 'nope');
    expect(errorSpy.mock.calls[0][0]).toEqual({
      event: LogEvent.GRAPHQL_REQUEST_FAILED,
      error: 'nope',
    });
  });

  it('info works with omitted fields', () => {
    appLogger.info(LogEvent.GRAPHQL_REQUEST_COMPLETED);
    expect(logSpy.mock.calls[0][0]).toEqual({
      event: LogEvent.GRAPHQL_REQUEST_COMPLETED,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter api test -- --testPathPattern='app-logger.spec'
```

Expected: FAIL (modules / `AppLogger` missing).

- [ ] **Step 3: Implement `LogEvent`, `AppLogger`, `LoggingModule`**

`apps/api/src/logging/log-event.ts`:

```ts
export const LogEvent = {
  GRAPHQL_REQUEST_COMPLETED: 'graphql.request.completed',
  GRAPHQL_REQUEST_FAILED: 'graphql.request.failed',
  PURCHASE_ATTEMPTED: 'purchase.attempted',
  PURCHASE_COMPLETED: 'purchase.completed',
  PURCHASE_DUPLICATE: 'purchase.duplicate',
  PURCHASE_SOLD_OUT: 'purchase.sold_out',
  PURCHASE_SALE_NOT_STARTED: 'purchase.sale_not_started',
  PURCHASE_SALE_ENDED: 'purchase.sale_ended',
  PURCHASE_RATE_LIMITED: 'purchase.rate_limited',
  PURCHASE_FAILED: 'purchase.failed',
  PURCHASE_QUERY_COMPLETED: 'purchase.query.completed',
} as const;

export type LogEventName = (typeof LogEvent)[keyof typeof LogEvent];
```

`apps/api/src/logging/app-logger.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppLogger {
  private readonly logger = new Logger(AppLogger.name);

  info(event: string, fields?: Record<string, unknown>): void {
    this.logger.log(this.payload(event, fields));
  }

  warn(event: string, fields?: Record<string, unknown>): void {
    this.logger.warn(this.payload(event, fields));
  }

  error(event: string, fields?: Record<string, unknown>, err?: unknown): void {
    const base = this.payload(event, fields);
    if (err === undefined) {
      this.logger.error(base);
      return;
    }
    this.logger.error({
      ...base,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  debug(event: string, fields?: Record<string, unknown>): void {
    this.logger.debug(this.payload(event, fields));
  }

  private payload(event: string, fields?: Record<string, unknown>): Record<string, unknown> {
    return fields === undefined ? { event } : { event, ...fields };
  }
}
```

`apps/api/src/logging/logging.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';

import { AppLogger } from './app-logger';

@Global()
@Module({
  exports: [AppLogger],
  providers: [AppLogger],
})
export class LoggingModule {}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter api test -- --testPathPattern='app-logger.spec'
```

Expected: PASS.

- [ ] **Step 5: Commit** — only when the user asks.

Suggested message if asked:

```bash
git add apps/api/src/logging
git commit -m "$(cat <<'EOF'
feat: add AppLogger structured logging contract (#75)

EOF
)"
```

---

### Task 3: `GraphqlLoggingPlugin` TDD + wire into Nest GraphQL

**Files:**

- Create: `apps/api/src/graphql/graphql-logging.plugin.ts`
- Create: `apps/api/src/graphql/graphql-logging.plugin.spec.ts`
- Modify: `apps/api/src/app.module.ts` only (`GraphQLModule.forRootAsync` + injected `AppLogger`). Do **not** modify `graphql-common.module.ts`.

**Lifecycle contract (public):** expected execution errors → `graphql.request.completed`; unexpected execution errors → `graphql.request.failed`.  
**Implementation detail (private to plugin):** which GraphQL `extensions.code` values count as expected currently includes `RATE_LIMITED`, `BAD_USER_INPUT`, `NOT_FOUND` via a module-private allow-list constant — not part of the public logging contract; evolve the list without changing the design.  
**Unexpected → lifecycle `failed`:** any other error, including `INTERNAL_SERVER_ERROR`.

**`operationName`:** Apollo may provide `null` for anonymous operations; fields use `operationName: string | null`.

**Timing:** use `Date.now()` for `durationMs` in #75 (acceptable and consistent with the project). Do not introduce `performance.now()` here; high-resolution timing can wait for a later metrics/#80 standardization if needed.

- [ ] **Step 1: Write the failing plugin tests**

Create `apps/api/src/graphql/graphql-logging.plugin.spec.ts` that drives the Apollo plugin listener API directly (no full Nest app required):

```ts
import type { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';

import { AppLogger } from '../logging/app-logger';
import { LogEvent } from '../logging/log-event';
import { createGraphqlLoggingPlugin } from './graphql-logging.plugin';

type Listener = GraphQLRequestListener<Record<string, unknown>>;

async function startListener(
  plugin: ApolloServerPlugin,
  request: { operationName?: string | null; query?: string },
): Promise<Listener> {
  const result = await plugin.requestDidStart?.({
    request,
    contextValue: {},
  } as never);
  if (!result) {
    throw new Error('expected request listener');
  }
  return result as Listener;
}

describe('createGraphqlLoggingPlugin', () => {
  let appLogger: { info: jest.Mock; error: jest.Mock };
  let plugin: ApolloServerPlugin;

  beforeEach(() => {
    appLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    plugin = createGraphqlLoggingPlugin(appLogger as unknown as AppLogger);
  });

  it('emits graphql.request.completed on successful execution', async () => {
    const listener = await startListener(plugin, {
      operationName: 'PurchaseItem',
      query: 'mutation PurchaseItem { purchaseItem }',
    });

    await listener.didResolveOperation?.({
      operation: { operation: 'mutation' },
      operationName: 'PurchaseItem',
    } as never);

    await listener.willSendResponse?.({} as never);

    expect(appLogger.info).toHaveBeenCalledWith(
      LogEvent.GRAPHQL_REQUEST_COMPLETED,
      expect.objectContaining({
        operationName: 'PurchaseItem',
        operationType: 'mutation',
        durationMs: expect.any(Number),
      }),
    );
    expect(appLogger.error).not.toHaveBeenCalled();
  });

  it('emits completed when only expected GraphQL error codes are present', async () => {
    const listener = await startListener(plugin, {
      operationName: 'PurchaseItem',
      query: 'mutation { purchaseItem }',
    });

    await listener.didResolveOperation?.({
      operation: { operation: 'mutation' },
      operationName: 'PurchaseItem',
    } as never);

    await listener.didEncounterErrors?.({
      errors: [{ message: 'rate limited', extensions: { code: 'RATE_LIMITED' } }],
    } as never);

    await listener.willSendResponse?.({} as never);

    expect(appLogger.info).toHaveBeenCalledWith(
      LogEvent.GRAPHQL_REQUEST_COMPLETED,
      expect.objectContaining({
        operationName: 'PurchaseItem',
        operationType: 'mutation',
        durationMs: expect.any(Number),
      }),
    );
    expect(appLogger.error).not.toHaveBeenCalled();
  });

  it('emits failed with error string and no stack for unexpected errors', async () => {
    const listener = await startListener(plugin, {
      operationName: 'PurchaseItem',
      query: 'mutation { purchaseItem }',
    });

    await listener.didResolveOperation?.({
      operation: { operation: 'mutation' },
      operationName: 'PurchaseItem',
    } as never);

    await listener.didEncounterErrors?.({
      errors: [
        {
          message: 'Internal server error',
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
          stack: 'Error: Internal server error\n    at x',
        },
      ],
    } as never);

    await listener.willSendResponse?.({} as never);

    expect(appLogger.error).toHaveBeenCalledTimes(1);
    expect(appLogger.error).toHaveBeenCalledWith(
      LogEvent.GRAPHQL_REQUEST_FAILED,
      expect.objectContaining({
        operationName: 'PurchaseItem',
        operationType: 'mutation',
        durationMs: expect.any(Number),
      }),
      'Internal server error',
    );
    const fields = appLogger.error.mock.calls[0][1] as Record<string, unknown>;
    expect(fields).not.toHaveProperty('error'); // wrapper owns error serialization via 3rd arg
    expect(fields).not.toHaveProperty('stack');
    expect(JSON.stringify(appLogger.error.mock.calls[0])).not.toContain('at x');
    expect(appLogger.info).not.toHaveBeenCalled();
  });

  it('emits no graphql.request.* when execution never begins (no didResolveOperation)', async () => {
    const listener = await startListener(plugin, {
      operationName: null,
      query: '{',
    });

    // parse/validation failure path: never call didResolveOperation
    await listener.willSendResponse?.({} as never);
    await listener.didEncounterErrors?.({
      errors: [{ message: 'Syntax Error' }],
    } as never);

    expect(appLogger.info).not.toHaveBeenCalled();
    expect(appLogger.error).not.toHaveBeenCalled();
  });
});
```

Adjust listener typing/`as never` casts if Apollo 5 listener signatures differ slightly — keep assertions identical.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter api test -- --testPathPattern='graphql-logging.plugin.spec'
```

Expected: FAIL (plugin missing).

- [ ] **Step 3: Implement plugin**

`apps/api/src/graphql/graphql-logging.plugin.ts`:

```ts
import type {
  ApolloServerPlugin,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import type { GraphQLError } from 'graphql';

import type { AppLogger } from '../logging/app-logger';
import { LogEvent } from '../logging/log-event';

/** Private allow-list (not part of the public logging contract). Extend when new expected app errors appear. */
const EXPECTED_EXECUTION_ERROR_CODES = new Set(['RATE_LIMITED', 'BAD_USER_INPUT', 'NOT_FOUND']);

function errorCode(
  err: GraphQLError | { extensions?: { code?: unknown }; message: string },
): string | undefined {
  const code = err.extensions?.code;
  return typeof code === 'string' ? code : undefined;
}

function isExpectedErrorsOnly(
  errors: readonly { extensions?: { code?: unknown }; message: string }[],
): boolean {
  return (
    errors.length > 0 &&
    errors.every((err) => {
      const code = errorCode(err);
      return code !== undefined && EXPECTED_EXECUTION_ERROR_CODES.has(code);
    })
  );
}

export function createGraphqlLoggingPlugin(appLogger: AppLogger): ApolloServerPlugin {
  return {
    async requestDidStart(): Promise<GraphQLRequestListener<Record<string, unknown>>> {
      const startedAt = Date.now();
      let executionBegan = false;
      let operationName: string | null = null;
      let operationType: string | undefined;
      let encounteredErrors: readonly { extensions?: { code?: unknown }; message: string }[] = [];

      return {
        async didResolveOperation(ctx) {
          executionBegan = true;
          operationName = ctx.operationName ?? null;
          operationType = ctx.operation?.operation;
        },

        async didEncounterErrors(ctx) {
          encounteredErrors = ctx.errors ?? [];
        },

        async willSendResponse() {
          if (!executionBegan) {
            return;
          }

          const durationMs = Date.now() - startedAt;
          const fields = {
            durationMs,
            operationName, // string | null (anonymous ops are null)
            operationType,
          };

          if (encounteredErrors.length === 0 || isExpectedErrorsOnly(encounteredErrors)) {
            appLogger.info(LogEvent.GRAPHQL_REQUEST_COMPLETED, fields);
            return;
          }

          const first = encounteredErrors[0];
          // Pass err as 3rd arg so AppLogger owns `{ error: string }` serialization.
          appLogger.error(
            LogEvent.GRAPHQL_REQUEST_FAILED,
            fields,
            first?.message ?? 'unknown error',
          );
        },
      };
    },
  };
}

/** Optional typed helper if a future task needs request context — unused in #75. */
export type GraphqlLoggingRequestContext = GraphQLRequestContext<Record<string, unknown>>;
```

- [ ] **Step 4: Wire `LoggingModule` + plugin into `AppModule`**

Modify `apps/api/src/app.module.ts`:

```ts
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';

import { validateEnv } from './config/env.validation';
import { FlashSaleModule } from './flash-sale/flash-sale.module';
import { createGraphqlLoggingPlugin } from './graphql/graphql-logging.plugin';
import { GraphqlCommonModule } from './graphql/graphql-common.module';
import { HealthModule } from './health/health.module';
import { AppLogger } from './logging/app-logger';
import { LoggingModule } from './logging/logging.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchaseModule } from './purchase/purchase.module';
import { RedisModule } from './redis/redis.module';

const envFilePath = [
  join(__dirname, '..', '..', '..', '.env'),
  join(process.cwd(), '.env'),
  join(process.cwd(), '..', '..', '.env'),
];

@Module({
  imports: [
    LoggingModule,
    FlashSaleModule,
    GraphqlCommonModule,
    HealthModule,
    PrismaModule,
    PurchaseModule,
    RedisModule,
    ConfigModule.forRoot({
      envFilePath,
      isGlobal: true,
      validate: validateEnv,
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [AppLogger],
      useFactory: (appLogger: AppLogger) => ({
        autoSchemaFile: true,
        driver: ApolloDriver,
        introspection: process.env.NODE_ENV !== 'production',
        playground: process.env.NODE_ENV !== 'production',
        plugins: [createGraphqlLoggingPlugin(appLogger)],
      }),
    }),
  ],
})
export class AppModule {}
```

Notes:

- Keep existing `introspection` / `playground` / `autoSchemaFile` behavior.
- Do **not** change health modules.
- If `forRootAsync` typing complains about `driver` duplication, keep `driver: ApolloDriver` only on `forRootAsync` options (Nest style) and omit from factory return — match whichever compiles cleanly.

- [ ] **Step 5: Run plugin + related tests**

```bash
pnpm --filter api test -- --testPathPattern='graphql-logging.plugin.spec|app-logger.spec'
pnpm --filter api typecheck
```

Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit** — only when the user asks.

Suggested message:

```bash
git add apps/api/src/graphql/graphql-logging.plugin.ts \
  apps/api/src/graphql/graphql-logging.plugin.spec.ts \
  apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat: emit GraphQL request lifecycle structured logs (#75)

EOF
)"
```

---

### Task 4: Purchase resolver domain + read events (TDD)

**Files:**

- Modify: `apps/api/src/purchase/purchase.resolver.ts`
- Modify: `apps/api/src/purchase/purchase.resolver.spec.ts`

**Outcome → LogEvent map**

| Domain / path                         | Event                                 |
| ------------------------------------- | ------------------------------------- |
| before processing (after id validate) | `purchase.attempted`                  |
| `GraphqlRateLimitedError`             | `purchase.rate_limited`               |
| `SUCCESS`                             | `purchase.completed` (+ `purchaseId`) |
| `ALREADY_PURCHASED`                   | `purchase.duplicate`                  |
| `SOLD_OUT`                            | `purchase.sold_out`                   |
| `SALE_NOT_STARTED`                    | `purchase.sale_not_started`           |
| `SALE_ENDED`                          | `purchase.sale_ended`                 |
| unexpected throw                      | `purchase.failed`                     |
| `myPurchase` / `myPurchases` success  | `purchase.query.completed`            |

Do **not** emit `purchase.failed` for `FlashSaleNotFoundError`, `GraphqlBadUserInputError`, or `GraphqlRateLimitedError` (expected GraphQL errors). Re-throw after logging rate_limited / after failed as applicable.

- [ ] **Step 1: Update resolver test factory to inject `AppLogger` spy**

In both `build` helpers inside `purchase.resolver.spec.ts`, append an `AppLogger` mock as the last constructor arg:

```ts
const appLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as AppLogger;

return new PurchaseResolver(
  /* existing deps… */,
  appLogger,
);
```

Expose `appLogger` from the purchaseItem `build` return value for assertions. For query `build`, either return `{ resolver, appLogger }` or keep a module-level spy — prefer returning both to avoid shared mutable state.

Update **all** existing call sites that destructure `build(...)` so tests still compile. Existing behavior assertions must keep passing.

- [ ] **Step 2: Add failing logging assertions**

Add (or extend) tests in `purchase.resolver.spec.ts`:

```ts
import { LogEvent } from '../logging/log-event';

// inside purchaseItem describe, after build returns appLogger:

it('emits purchase.attempted then purchase.completed on SUCCESS', async () => {
  const execute = jest.fn().mockResolvedValue('SUCCESS');
  const { appLogger, resolver } = build({ execute });

  const result = await resolver.purchaseItem('sale-1', 'user-1', mockReq);

  expect(appLogger.info).toHaveBeenCalledWith(
    LogEvent.PURCHASE_ATTEMPTED,
    expect.objectContaining({ flashSaleId: 'sale-1', userId: 'user-1' }),
  );
  expect(appLogger.info).toHaveBeenCalledWith(
    LogEvent.PURCHASE_COMPLETED,
    expect.objectContaining({
      flashSaleId: 'sale-1',
      userId: 'user-1',
      purchaseId: result.purchaseId,
      durationMs: expect.any(Number),
    }),
  );
  expect(appLogger.error).not.toHaveBeenCalledWith(
    LogEvent.PURCHASE_FAILED,
    expect.anything(),
    expect.anything(),
  );
});

it.each([
  ['ALREADY_PURCHASED', LogEvent.PURCHASE_DUPLICATE],
  ['SOLD_OUT', LogEvent.PURCHASE_SOLD_OUT],
  ['SALE_NOT_STARTED', LogEvent.PURCHASE_SALE_NOT_STARTED],
  ['SALE_ENDED', LogEvent.PURCHASE_SALE_ENDED],
] as const)('emits %s outcome event without purchase.failed', async (outcome, event) => {
  const { appLogger, resolver } = build({
    execute: jest.fn().mockResolvedValue(outcome),
  });

  await resolver.purchaseItem('sale-1', 'user-1', mockReq);

  expect(appLogger.info).toHaveBeenCalledWith(
    event,
    expect.objectContaining({
      flashSaleId: 'sale-1',
      userId: 'user-1',
      durationMs: expect.any(Number),
    }),
  );
  expect(appLogger.error).not.toHaveBeenCalled();
});

it('emits purchase.rate_limited and not purchase.failed when rate limited', async () => {
  const execute = jest.fn();
  const consume = jest.fn().mockResolvedValue('limit');
  const { appLogger, resolver } = build({ execute }, {}, { consume });

  await expect(resolver.purchaseItem('sale-1', 'user-1', mockReq)).rejects.toBeInstanceOf(
    GraphqlRateLimitedError,
  );

  expect(appLogger.info).toHaveBeenCalledWith(
    LogEvent.PURCHASE_RATE_LIMITED,
    expect.objectContaining({
      flashSaleId: 'sale-1',
      userId: 'user-1',
      durationMs: expect.any(Number),
    }),
  );
  expect(appLogger.error).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
});

it('emits purchase.failed for unexpected errors and rethrows', async () => {
  const boom = new Error('db down');
  const { appLogger, resolver } = build({
    execute: jest.fn().mockRejectedValue(boom),
  });

  await expect(resolver.purchaseItem('sale-1', 'user-1', mockReq)).rejects.toThrow('db down');

  expect(appLogger.error).toHaveBeenCalledWith(
    LogEvent.PURCHASE_FAILED,
    expect.objectContaining({
      flashSaleId: 'sale-1',
      userId: 'user-1',
      durationMs: expect.any(Number),
    }),
    boom,
  );
  // mutual exclusion: no expected outcome event
  expect(appLogger.info).not.toHaveBeenCalledWith(LogEvent.PURCHASE_COMPLETED, expect.anything());
  expect(appLogger.info).not.toHaveBeenCalledWith(LogEvent.PURCHASE_SOLD_OUT, expect.anything());
});

it('does not emit purchase.failed for FlashSaleNotFoundError', async () => {
  const { appLogger, resolver } = build({
    execute: jest.fn().mockRejectedValue(new FlashSaleNotFoundError()),
  });

  await expect(resolver.purchaseItem('sale-1', 'user-1', mockReq)).rejects.toBeInstanceOf(
    FlashSaleNotFoundError,
  );
  expect(appLogger.error).not.toHaveBeenCalledWith(
    LogEvent.PURCHASE_FAILED,
    expect.anything(),
    expect.anything(),
  );
});
```

For reads:

```ts
it('myPurchases emits purchase.query.completed without operationName', async () => {
  const findByUser = jest.fn().mockResolvedValue([
    {
      flashSaleId: 'sale-1',
      id: 'purchase-1',
      product: { id: 'p1', description: 'd', name: 'n' },
      purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    },
  ]);
  const { appLogger, resolver } = build({}, {}, {}, { findByUser });

  await resolver.myPurchases('user-1');

  expect(appLogger.info).toHaveBeenCalledWith(
    LogEvent.PURCHASE_QUERY_COMPLETED,
    expect.objectContaining({
      userId: 'user-1',
      resultCount: 1,
      durationMs: expect.any(Number),
    }),
  );
  const fields = appLogger.info.mock.calls.find(
    (c) => c[0] === LogEvent.PURCHASE_QUERY_COMPLETED,
  )?.[1] as Record<string, unknown>;
  expect(fields).not.toHaveProperty('operationName');
});

it('myPurchase emits purchase.query.completed with resultCount 0|1', async () => {
  const findById = jest.fn().mockResolvedValue(sale);
  const get = jest.fn().mockResolvedValue({
    purchaseId: null,
    purchased: false,
    purchasedAt: null,
  });
  const { appLogger, resolver } = build({ findById }, { get });

  await resolver.myPurchase('sale-1', 'user-1');

  expect(appLogger.info).toHaveBeenCalledWith(
    LogEvent.PURCHASE_QUERY_COMPLETED,
    expect.objectContaining({
      userId: 'user-1',
      resultCount: 0,
      durationMs: expect.any(Number),
    }),
  );
});
```

- [ ] **Step 3: Run resolver tests to verify new assertions fail**

```bash
pnpm --filter api test -- --testPathPattern='purchase.resolver.spec'
```

Expected: FAIL on missing `AppLogger` constructor arg / missing log calls.

- [ ] **Step 4: Implement resolver logging**

Update `PurchaseResolver` constructor to inject `AppLogger`. Import `LogEvent` and `LogEventName` from `../logging/log-event`. Implement roughly:

```ts
@Mutation(() => PurchaseItemResultObjectType, { name: 'purchaseItem' })
async purchaseItem(...): Promise<PurchaseItemResultObjectType> {
  const flashSaleId = requireFlashSaleId(flashSaleIdRaw);
  const userId = requireUserId(userIdRaw);
  const startedAt = Date.now();

  this.appLogger.info(LogEvent.PURCHASE_ATTEMPTED, { flashSaleId, userId });

  try {
    const trustedProxy = this.config.get('TRUSTED_PROXY', { infer: true });
    const clientIp = resolveClientIp(req, trustedProxy);
    if ((await this.rateLimiter.consume(clientIp)) === 'limit') {
      this.appLogger.info(LogEvent.PURCHASE_RATE_LIMITED, {
        flashSaleId,
        userId,
        durationMs: Date.now() - startedAt,
      });
      throw new GraphqlRateLimitedError();
    }

    const purchaseId = createPurchaseId();
    const outcome = await this.purchaseFlow.execute({
      flashSaleId,
      purchaseId,
      userId,
      nowUtc: this.clock.nowUtc(),
    });

    if (outcome === 'SUCCESS') {
      await Promise.all([
        this.flashSaleQueryCache.invalidate(flashSaleId),
        this.myPurchaseQueryCache.invalidate(flashSaleId, userId),
      ]);
    }

    const durationMs = Date.now() - startedAt;
    this.appLogger.info(outcomeEvent(outcome), {
      flashSaleId,
      userId,
      durationMs,
      ...(outcome === 'SUCCESS' ? { purchaseId } : {}),
    });

    return {
      purchaseId: outcome === 'SUCCESS' ? purchaseId : null,
      message: messageForPurchaseOutcome(outcome),
      status: toPurchaseOutcomeGql(outcome),
    };
  } catch (err) {
    if (
      err instanceof GraphqlRateLimitedError ||
      err instanceof FlashSaleNotFoundError ||
      err instanceof GraphqlBadUserInputError
    ) {
      throw err;
    }
    this.appLogger.error(
      LogEvent.PURCHASE_FAILED,
      {
        flashSaleId,
        userId,
        durationMs: Date.now() - startedAt,
      },
      err,
    );
    throw err;
  }
}
```

Helper (same file or tiny local function):

```ts
function outcomeEvent(outcome: PurchaseOutcome): LogEventName {
  switch (outcome) {
    case 'SUCCESS':
      return LogEvent.PURCHASE_COMPLETED;
    case 'ALREADY_PURCHASED':
      return LogEvent.PURCHASE_DUPLICATE;
    case 'SOLD_OUT':
      return LogEvent.PURCHASE_SOLD_OUT;
    case 'SALE_NOT_STARTED':
      return LogEvent.PURCHASE_SALE_NOT_STARTED;
    case 'SALE_ENDED':
      return LogEvent.PURCHASE_SALE_ENDED;
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}
```

For `myPurchase` / `myPurchases`: wrap success path with `startedAt`, emit `PURCHASE_QUERY_COMPLETED` with `{ userId, durationMs, resultCount }` (`0|1` for myPurchase based on `purchased`, `rows.length` for myPurchases). Do not log on validation throws before work begins. Do not add `operationName`.

Import `GraphqlBadUserInputError` only if used in the catch guard (id validation throws before `try` today — keep that behavior; catch guard is for execute-path expected errors).

- [ ] **Step 5: Run resolver tests**

```bash
pnpm --filter api test -- --testPathPattern='purchase.resolver.spec'
```

Expected: PASS (existing + new logging tests).

- [ ] **Step 6: Commit** — only when the user asks.

Suggested message:

```bash
git add apps/api/src/purchase/purchase.resolver.ts apps/api/src/purchase/purchase.resolver.spec.ts
git commit -m "$(cat <<'EOF'
feat: emit structured purchase path logs (#75)

EOF
)"
```

---

### Task 5: Freeze / DoD verification

**Files:** none expected beyond fixes if verification fails

- [ ] **Step 1: Unit tests for logging + purchase + health freeze**

```bash
pnpm --filter api test -- --testPathPattern='app-logger|graphql-logging.plugin|purchase.resolver|health|ioredis-redis-client|rate-limiter|query.cache'
```

Expected: PASS. Health + Redis fail-open tests unchanged.

- [ ] **Step 2: Lint + typecheck**

```bash
pnpm --filter api lint
pnpm --filter api typecheck
```

Expected: PASS.

- [ ] **Step 3: Confirm frozen surfaces untouched**

```bash
git diff main -- apps/api/src/health apps/api/src/redis/redis-events.ts
rg -n "purchase\\.(completed|failed)|graphql\\.request\\." apps/api/src/purchase/purchase-flow.service.ts && echo 'FAIL: flow should not log' || echo 'flow clean'
rg -n "nestjs-pino|winston|pino" apps/api/package.json && echo 'FAIL: new logger dep' || echo 'no pino/winston'
# AppLogger owns Nest Logger in purchase + graphql (aside from pre-existing mapGraphqlError unstructured log).
rg -n "new Logger|Logger\\(" apps/api/src/purchase apps/api/src/graphql apps/api/src/logging
```

Expected: empty health/redis-events diff (or only incidental whitespace — prefer empty); flow clean; no pino/winston deps. Nest `Logger` construction only in `apps/api/src/logging/app-logger.ts` for new code; pre-existing `map-graphql-error.ts` `Logger` may remain (legacy unstructured path, out of #75 rename scope) — do **not** introduce additional raw `Logger` usage in `purchase/` or new graphql logging files.

- [ ] **Step 4: Manual smoke (optional, if API running)**

Start API, run a `purchaseItem` mutation and a deliberate sold-out / duplicate path; confirm Nest stdout shows objects with `event: 'purchase.*'` and `event: 'graphql.request.completed'`. No `/health` shape change:

```bash
curl -s localhost:3000/health
curl -s localhost:3000/health/ready
```

Expected: existing liveness/readiness JSON contracts.

- [ ] **Step 5: Update GitHub issue checklists when shipping** (after commit/PR, when user asks)

On `#75`: check AC + DoD. On `#89`: check child `#75` when merged. Do **not** check epic success criterion “Structured logging and correlation IDs” until `#76` also ships.

- [ ] **Step 6: Commit** — only when the user asks (docs-only commit if spec/plan were edited on the branch).

---

## Spec coverage checklist

| Spec requirement                                   | Task |
| -------------------------------------------------- | ---- |
| `AppLogger` contract + Nest `Logger` backend       | 2    |
| `LogEvent` dotted taxonomy                         | 2    |
| JSON-serializable fields / no field mutation       | 2    |
| Apollo plugin GraphQL request lifecycle events     | 3    |
| Expected GraphQL execution errors → `completed`    | 3    |
| No lifecycle event if execution never begins       | 3    |
| Plugin uses `error(event, fields, err)` 3rd arg    | 3    |
| Wire plugin in Nest GraphQL bootstrap              | 3    |
| Purchase mutation domain events                    | 4    |
| `purchase.failed` mutual exclusion                 | 4    |
| `purchase.query.completed` without `operationName` | 4    |
| `PurchaseFlowService` silent                       | 4/5  |
| Redis / health unchanged                           | 5    |
| No pino / correlation / metrics                    | 5    |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-02-issue-75-structured-application-logging.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
