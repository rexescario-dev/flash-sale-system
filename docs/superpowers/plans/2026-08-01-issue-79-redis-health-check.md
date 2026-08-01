# #79 Redis Health Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Redis readiness probe and Nest-native multi-check `HEALTH_CHECKS` wiring so `GET /health/ready` reports `checks.redis` alongside `checks.database` without changing liveness, routes, controller, or `HealthService`.

**Architecture:** Extend `RedisClientPort` with `ping(): Promise<void>` (adapter uses Redis `PING`). Injectable `RedisHealthCheck` in `apps/api/src/health/` mirrors `DatabaseHealthCheck` (throw-through failures). `HealthModule` replaces the #78 `HEALTH_CHECKS` `useExisting` binding with `useFactory: (db, redis) => [db, redis]`. Failures bubble; `HealthService` remains the sole normalizer to `down`.

**Tech Stack:** NestJS 11, ioredis, existing Jest unit tests under `apps/api`, Symbol token injection (`HEALTH_CHECKS`, `REDIS_CLIENT`).

**Base:** `main` at `#78` merge tip (`9d07115` / PR `#168` or later).

**Commits:** Commit in logical groups per task using `<type>: <MESSAGE>` **only when the user asks to commit**. Create a PR when implementation and verification are complete and the user requests it.

**Spec:** `docs/superpowers/specs/2026-08-01-issue-79-redis-health-check-design.md`

**Issue AC:**

- [ ] Health includes Redis connectivity without failing purchases incorrectly

**Task order:** Worktree → port/`ping` TDD → `RedisHealthCheck` TDD → `HealthModule` multi-check registration → freeze/DoD verification.

**Worktree:** Prefer isolated worktree via `using-git-worktrees` (e.g. `.worktrees/79-redis-health-check` on `feat/79-redis-health-check`) before editing. If worktree creation is blocked, work on a feature branch in place.

---

## File map

| File                                                                      | Responsibility                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/api/src/redis/redis-client.port.ts`                                 | **Modify** — add `ping(): Promise<void>`                                  |
| `apps/api/src/redis/ioredis-redis-client.adapter.ts`                      | **Modify** — implement `ping()` via ioredis `PING`                        |
| `apps/api/src/redis/ioredis-redis-client.adapter.spec.ts`                 | **Modify** — adapter `ping` success / failure cases                       |
| `apps/api/test/graphql/redis-query-cache.integration.spec.ts`             | **Modify** — add `ping` to full `RedisClientPort` stub (typecheck)        |
| `apps/api/test/graphql/purchase-rate-limit.integration.spec.ts`           | **Modify** — add `ping` to full `RedisClientPort` stub (typecheck)        |
| `apps/api/src/health/redis.health-check.ts`                               | **Create** — `RedisHealthCheck` (`HealthCheck`)                           |
| `apps/api/src/health/redis.health-check.spec.ts`                          | **Create** — unit tests (name / up + once / reject)                       |
| `apps/api/src/health/health.module.ts`                                    | Replace `HEALTH_CHECKS` binding with `useFactory` returning `[db, redis]` |
| `apps/api/src/health/health-check.port.ts`                                | Unchanged — existing `#77` port                                           |
| `apps/api/src/health/health.tokens.ts`                                    | Unchanged — `HEALTH_CHECKS`                                               |
| `apps/api/src/health/health.service.ts`                                   | Unchanged — aggregation / throw → `down`                                  |
| `apps/api/src/health/health.controller.ts`                                | Unchanged — HTTP mapping only                                             |
| `apps/api/src/health/database.health-check.ts`                            | Unchanged — existing DB probe                                             |
| `apps/api/src/redis/redis.module.ts`                                      | Unchanged — sole `REDIS_CLIENT` provider                                  |
| `docs/superpowers/specs/2026-08-01-issue-79-redis-health-check-design.md` | Approved design                                                           |
| `docs/superpowers/plans/2026-08-01-issue-79-redis-health-check.md`        | This plan                                                                 |

**Frozen:** `GET /health` response `{ "status": "ok" }`; controller/routes; `HealthService` aggregation/normalization; CI/`wait-on`/Playwright/`E2E_API_HEALTH_URL` defaults; GraphQL surface; Terminus; logging/metrics (#75/#76/#80); EPIC-07 stress contracts/results; `#134` CSS AC; second `REDIS_CLIENT` in `HealthModule`; purchase/cache fail-open behavior; probe timeouts/retries/circuit-breaking.

---

### Task 1: Create worktree / branch

**Files:** none yet

- [ ] **Step 1: Ensure `main` includes `#78` tip**

```bash
cd /home/rex/Project/test/app
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git log -1 --oneline
```

Expected: `9d07115…` or later tip that includes `#78` / PR `#168`.

- [ ] **Step 2: Create isolated worktree**

```bash
cd /home/rex/Project/test/app
git check-ignore -q .worktrees || echo 'FAIL: .worktrees not ignored'
git worktree add .worktrees/79-redis-health-check -b feat/79-redis-health-check main
cd .worktrees/79-redis-health-check
```

Expected: new worktree on `feat/79-redis-health-check`. If sandbox/permission blocks worktree creation, create the branch in place instead and continue from repo root.

- [ ] **Step 3: Confirm clean baseline**

```bash
git status
test -f apps/api/src/health/database.health-check.ts \
  && test -f apps/api/src/health/health.module.ts \
  && test -f apps/api/src/redis/redis-client.port.ts \
  && test -f apps/api/src/redis/ioredis-redis-client.adapter.ts
pnpm --filter api test -- --testPathPattern='health|ioredis-redis-client'
```

Expected: clean worktree; `#78` health seam + Redis adapter present; existing health + adapter unit tests pass.

- [ ] **Step 4: Commit** — none (branch/worktree creation only).

---

### Task 2: Redis port `ping` + adapter TDD

**Files:**

- Modify: `apps/api/src/redis/redis-client.port.ts`
- Modify: `apps/api/src/redis/ioredis-redis-client.adapter.ts`
- Modify: `apps/api/src/redis/ioredis-redis-client.adapter.spec.ts`
- Modify: `apps/api/test/graphql/redis-query-cache.integration.spec.ts`
- Modify: `apps/api/test/graphql/purchase-rate-limit.integration.spec.ts`

`ping(): Promise<void>` is connectivity only. Adapter implements Redis `PING`, propagates client errors, and does **not** map them to health vocabulary. No timeouts/retries/circuit-breaking beyond the existing client options.

- [ ] **Step 1: Write the failing adapter `ping` tests**

Append to `apps/api/src/redis/ioredis-redis-client.adapter.spec.ts` (inside the existing `describe`):

```typescript
it('ping resolves when the Redis client ping resolves', async () => {
  const client = {
    connect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  MockRedis.mockImplementation(() => client as never);

  const adapter = createAdapter();
  await adapter.onModuleInit();

  await expect(adapter.ping()).resolves.toBeUndefined();
  expect(client.ping).toHaveBeenCalledTimes(1);
});

it('ping rejects when the Redis client ping rejects', async () => {
  const client = {
    connect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    ping: jest.fn().mockRejectedValue(new Error('redis unreachable')),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  MockRedis.mockImplementation(() => client as never);

  const adapter = createAdapter();
  await adapter.onModuleInit();

  await expect(adapter.ping()).rejects.toThrow('redis unreachable');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter api test -- --testPathPattern=ioredis-redis-client.adapter.spec
```

Expected: FAIL because `ping()` is not yet implemented (missing interface/member or runtime method).

- [ ] **Step 3: Extend the port and implement adapter `ping`**

Update `apps/api/src/redis/redis-client.port.ts` — add `ping(): Promise<void>`. Preserve the existing member ordering or adjust only if required by ESLint/project conventions:

```typescript
export type RedisClientPort = {
  delete(key: string): Promise<void>;
  get(key: string): Promise<null | string>;
  /**
   * Atomically INCR key; if the result is 1, set EXPIRE ttlSeconds in the same Lua script.
   * Must never leave a key without TTL after the first successful increment.
   */
  incrWithExpiryOnFirst(key: string, ttlSeconds: number): Promise<number>;
  ping(): Promise<void>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};
```

Add to `apps/api/src/redis/ioredis-redis-client.adapter.ts` — place `ping` to preserve existing class member ordering, or adjust only if ESLint requires:

```typescript
  async ping(): Promise<void> {
    await this.client.ping();
  }
```

Notes:

- Do **not** catch/wrap/log inside `ping`.
- Do **not** translate failures into `{ status: 'down' }` or other health vocabulary.
- The adapter intentionally discards the returned value (e.g. ioredis `'PONG'`); only successful resolution matters. The port returns `Promise<void>`.

- [ ] **Step 4: Update full `RedisClientPort` object stubs for typecheck**

In both integration stubs, add `ping` that throws like the other ops (preserve existing stub member style / lint order):

`apps/api/test/graphql/redis-query-cache.integration.spec.ts`:

```typescript
const failingRedisClient: RedisClientPort = {
  async delete() {
    throw new Error('redis down');
  },
  async get() {
    throw new Error('redis down');
  },
  async incrWithExpiryOnFirst() {
    throw new Error('redis down');
  },
  async ping() {
    throw new Error('redis down');
  },
  async set() {
    throw new Error('redis down');
  },
};
```

`apps/api/test/graphql/purchase-rate-limit.integration.spec.ts` — same `ping` addition on `failingRedisClient`.

Update only full `RedisClientPort` implementations. Do not churn partial mocks that cast `as unknown as RedisClientPort` unnecessarily; add `ping` there only if TypeScript complains.

- [ ] **Step 5: Run adapter tests to verify they pass**

```bash
pnpm --filter api test -- --testPathPattern=ioredis-redis-client.adapter.spec
```

Expected: PASS (includes the two new `ping` cases).

- [ ] **Step 6: Commit** (only when the user asks)

```bash
git add apps/api/src/redis/redis-client.port.ts \
  apps/api/src/redis/ioredis-redis-client.adapter.ts \
  apps/api/src/redis/ioredis-redis-client.adapter.spec.ts \
  apps/api/test/graphql/redis-query-cache.integration.spec.ts \
  apps/api/test/graphql/purchase-rate-limit.integration.spec.ts
git commit -m "$(cat <<'EOF'
feat: add RedisClientPort ping connectivity primitive

EOF
)"
```

---

### Task 3: `RedisHealthCheck` TDD

**Files:**

- Create: `apps/api/src/health/redis.health-check.spec.ts`
- Create: `apps/api/src/health/redis.health-check.ts`

Implements existing `#77` port (`HealthCheck` / `HealthCheckResult`). Probe is `await this.redis.ping()`. MUST NOT catch/wrap/log/normalize failures. Name stays on the class; success shape matches `DatabaseHealthCheck` (`{ status: 'up' }`).

- [ ] **Step 1: Write the failing unit tests**

Create `apps/api/src/health/redis.health-check.spec.ts`:

```typescript
import type { RedisClientPort } from '../redis/redis-client.port';

import { RedisHealthCheck } from './redis.health-check';

describe('RedisHealthCheck', () => {
  it('exposes registry name redis', () => {
    const redis = { ping: jest.fn() } as unknown as RedisClientPort;
    const check = new RedisHealthCheck(redis);
    expect(check.name).toBe('redis');
  });

  it('returns up when ping resolves and calls ping exactly once', async () => {
    const ping = jest.fn().mockResolvedValue(undefined);
    const redis = { ping } as unknown as RedisClientPort;
    const check = new RedisHealthCheck(redis);

    await expect(check.check()).resolves.toEqual({ status: 'up' });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('rejects when ping rejects (no local down mapping)', async () => {
    const ping = jest.fn().mockRejectedValue(new Error('redis unreachable'));
    const redis = { ping } as unknown as RedisClientPort;
    const check = new RedisHealthCheck(redis);

    await expect(check.check()).rejects.toThrow('redis unreachable');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter api test -- --testPathPattern=redis.health-check.spec
```

Expected: FAIL because `RedisHealthCheck` has not yet been implemented.

- [ ] **Step 3: Implement `RedisHealthCheck`**

Create `apps/api/src/health/redis.health-check.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';

import type { RedisClientPort } from '../redis/redis-client.port';

import { REDIS_CLIENT } from '../redis/redis.tokens';

import type { HealthCheck, HealthCheckResult } from './health-check.port';

@Injectable()
export class RedisHealthCheck implements HealthCheck {
  readonly name = 'redis';

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClientPort,
  ) {}

  async check(): Promise<HealthCheckResult> {
    await this.redis.ping();
    return { status: 'up' };
  }
}
```

Notes:

- Do **not** add `try/catch` that returns `{ status: 'down' }`.
- Do **not** log failures here.
- Constructor injects `REDIS_CLIENT` (global from `RedisModule`); do not construct a Redis client here.
- For unit tests, construct with a fake port directly (`new RedisHealthCheck(redis)`); Nest `@Inject` metadata is irrelevant to direct construction.
- Let ESLint / project conventions be the source of truth for import and member ordering; do not prescribe grouping beyond what lint requires.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter api test -- --testPathPattern=redis.health-check.spec
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit** (only when the user asks)

```bash
git add apps/api/src/health/redis.health-check.ts \
  apps/api/src/health/redis.health-check.spec.ts
git commit -m "$(cat <<'EOF'
feat: add RedisHealthCheck ping probe

EOF
)"
```

---

### Task 4: Multi-check `HEALTH_CHECKS` registration in `HealthModule`

**Files:**

- Modify: `apps/api/src/health/health.module.ts`

Replace the #78 `HEALTH_CHECKS` provider binding only (previously `useExisting: DatabaseHealthCheck`) with an explicit Nest `useFactory` that returns both registered check instances. Do **not** edit `health.controller.ts`, `health.service.ts`, routes, or `RedisModule`. Do **not** re-provide `REDIS_CLIENT` or `PrismaService` here. Do **not** add Angular-style `multi: true`.

- [ ] **Step 1: Wire providers**

In `apps/api/src/health/health.module.ts`, register `DatabaseHealthCheck`, `RedisHealthCheck`, and `HealthService`, then replace the `HEALTH_CHECKS` binding with the `useFactory` provider. Preserve existing module style unless lint or formatting requires changes. Required binding shape:

```typescript
{
  provide: HEALTH_CHECKS,
  useFactory: (db: DatabaseHealthCheck, redis: RedisHealthCheck) => [db, redis],
  inject: [DatabaseHealthCheck, RedisHealthCheck],
}
```

Illustrative full module (provider array order is not part of the health contract):

```typescript
import { Module } from '@nestjs/common';

import { DatabaseHealthCheck } from './database.health-check';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HEALTH_CHECKS } from './health.tokens';
import { RedisHealthCheck } from './redis.health-check';

@Module({
  controllers: [HealthController],
  providers: [
    DatabaseHealthCheck,
    HealthService,
    RedisHealthCheck,
    {
      provide: HEALTH_CHECKS,
      useFactory: (db: DatabaseHealthCheck, redis: RedisHealthCheck) => [db, redis],
      inject: [DatabaseHealthCheck, RedisHealthCheck],
    },
  ],
})
export class HealthModule {}
```

Keep `provide: HEALTH_CHECKS`, the `useFactory` returning `[db, redis]`, and `inject: [DatabaseHealthCheck, RedisHealthCheck]`. Adjust key/member/`providers` order only for lint.

- [ ] **Step 2: Confirm existing health + new unit tests still pass**

```bash
pnpm --filter api test -- --testPathPattern=health
```

Expected: PASS — includes prior `#77`/`#78` service/controller/database tests plus `RedisHealthCheck` tests. No Nest wiring test required. No new `HealthService` tests required (behavior unchanged; existing aggregation/failure-normalization coverage remains the proof).

- [ ] **Step 3: Commit** (only when the user asks)

```bash
git add apps/api/src/health/health.module.ts
git commit -m "$(cat <<'EOF'
feat: register RedisHealthCheck via HEALTH_CHECKS factory

EOF
)"
```

---

### Task 5: Freeze / DoD verification

**Files:** none required for code (verification + optional docs staging)

- [ ] **Step 1: Lint + typecheck API package**

```bash
pnpm --filter api lint
pnpm --filter api typecheck
```

Expected: PASS with no new errors.

- [ ] **Step 2: Re-run health + Redis adapter unit suites**

```bash
pnpm --filter api test -- --testPathPattern='health|ioredis-redis-client'
```

Expected: PASS with no reduction in existing health coverage.

- [ ] **Step 3: Diff freeze checklist**

```bash
git diff main -- apps/api/src/health/health.controller.ts \
  apps/api/src/health/health.service.ts \
  apps/api/src/health/health-check.port.ts \
  apps/api/src/health/health.tokens.ts \
  apps/api/src/health/database.health-check.ts \
  apps/api/src/redis/redis.module.ts \
  apps/api/src/redis/redis.tokens.ts
git diff main -- package.json apps/api/package.json pnpm-lock.yaml
```

Expected: empty diff for controller/service/port/tokens/database check/`RedisModule`/tokens. No `package.json` / lockfile dependency changes (guards against accidental Terminus).

Also confirm Redis-side diffs are limited to the intended files:

```bash
git diff main --name-only -- apps/api/src/redis/
```

Expected Redis paths only among:

- `apps/api/src/redis/redis-client.port.ts`
- `apps/api/src/redis/ioredis-redis-client.adapter.ts`
- `apps/api/src/redis/ioredis-redis-client.adapter.spec.ts`

Intentional diffs overall only under:

- those Redis files
- `apps/api/src/health/redis.health-check.ts`
- `apps/api/src/health/redis.health-check.spec.ts`
- `apps/api/src/health/health.module.ts`
- integration stubs that gained `ping`
- docs/spec/plan if included in the branch

Confirm manually:

- `HealthModule` no longer binds `HEALTH_CHECKS` via `useExisting` and now binds it via the agreed `useFactory`
- No Terminus dependency added
- No `HealthService` aggregation/normalization edits
- No controller/route/`GET /health` changes
- No logging/metrics (#75/#76/#80) changes
- No EPIC-07 stress result invention
- No `#134` CSS AC work
- No second `REDIS_CLIENT` provider from `HealthModule`
- `RedisHealthCheck` does not catch/normalize to `down`
- Purchase/cache fail-open paths untouched
- No probe timeouts/retries/circuit-breaking added

- [ ] **Step 4: Commit docs if they are part of the branch** (only when the user asks)

```bash
git add docs/superpowers/specs/2026-08-01-issue-79-redis-health-check-design.md \
  docs/superpowers/plans/2026-08-01-issue-79-redis-health-check.md
git commit -m "$(cat <<'EOF'
docs: add #79 Redis health check design and plan

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement                                                                 | Task                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------- |
| `RedisClientPort.ping(): Promise<void>` + adapter `PING`                         | Task 2                                    |
| Propagate Redis errors; no health mapping in adapter                             | Task 2                                    |
| Update full port stubs so every implementor has `ping`                           | Task 2                                    |
| `RedisHealthCheck` implements `HealthCheck`, `name: "redis"`                     | Task 3                                    |
| Success `{ status: 'up' }`; `ping()` called exactly once                         | Task 3                                    |
| Failures bubble; no local catch/normalize/log                                    | Task 3                                    |
| Replace #78 `HEALTH_CHECKS` binding with `useFactory` → `[db, redis]` (no multi) | Task 4                                    |
| No second `REDIS_CLIENT` / no `RedisModule` owning health                        | Task 4 + Task 5 freeze                    |
| No controller/route/`GET /health` / `HealthService` changes                      | Task 4 + Task 5 freeze                    |
| Hard readiness: Redis down ⇒ top-level `error` / 503 via existing aggregation    | Inherited `#77`/`#78` — no service change |
| Concurrent aggregation; array order not part of contract                         | Task 4 notes + unchanged `HealthService`  |
| No probe timeouts/retries/circuit-breaking                                       | Task 2 + Task 5 freeze                    |
| Runtime fail-open unchanged                                                      | Task 5 freeze                             |
| Unit tests: adapter ping + RedisHealthCheck name/up/once/reject                  | Tasks 2–3                                 |
| No required new `HealthService` tests                                            | Explicitly omitted                        |
| No Terminus / logging / stress / `#134`                                          | Task 5 freeze                             |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-issue-79-redis-health-check.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
