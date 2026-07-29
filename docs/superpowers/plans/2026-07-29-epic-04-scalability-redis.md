# EPIC-04 — Scalability & Redis Implementation Plan (#27–#32)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [EPIC-04 #84](https://github.com/rexescario-dev/flash-sale-system/issues/84) by adding a non-authoritative Redis layer: read-through caches for `flashSale` / `myPurchase`, IP fixed-window rate limiting for `purchaseItem`, fail-open degraded mode, and docs — without changing Postgres inventory/purchase correctness.

**Architecture:** Approach 1 from the spec. `RedisModule` + `RedisClientPort` (ioredis adapter). `FlashSaleQueryCache` / `MyPurchaseQueryCache` are API read concerns used only by their resolvers. `PurchaseFlow` / Prisma adapters stay Redis-free. `purchaseItem` rate-limits by client IP **before** `PURCHASE_FLOW.execute`, then on committed `SUCCESS` the **resolver** invalidates both cache keys (best-effort).

**Tech Stack:** NestJS 11, ioredis, existing Prisma/Postgres, Jest + ts-jest, pnpm + Turborepo, Docker Compose Redis 7, GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-07-29-epic-04-scalability-redis-design.md](../specs/2026-07-29-epic-04-scalability-redis-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`. Author email must be `rex.escario.jr@gmail.com`.

**ESLint:** perfectionist sort — object keys: `id` first where present, then A→Z. Nest `@Module` arrays: static modules before `forRoot` / existing A→Z conventions.

**Out of scope:** Redis stock admission; AuthN/AuthZ; sale listing; global GraphQL throttling; rate limiting by caller-supplied `userId`; sliding windows; metrics counters as acceptance; changing `PurchaseOutcome` semantics; domain Redis imports.

**Hard invariants (locked):**

1. Postgres is sole SoT for stock, reservation, purchase create, uniqueness, txn consistency.
2. `PurchaseFlow` / reservation / Prisma repos have **no** Redis or query-cache dependencies.
3. `flashSale` cache is presentation-only (incl. possibly stale `remainingStock` **and** `status` for up to TTL); never used by purchase path. Cache hits return the snapshot **as-is** — do **not** recalculate `getStatus()` from cached timestamps.
4. `myPurchase`: uncached `FLASH_SALE_REPOSITORY.findById` **before** `MyPurchaseQueryCache`; missing sale → `NOT_FOUND`, never a negative purchase cache hit.
5. Negative `myPurchase` uses explicit envelope `{ found: false }` / `{ found: true, purchase: … }` — not a raw `"null"` string.
6. Invalidation owned by `purchaseItem` resolver **after** `PURCHASE_FLOW.execute` returns committed `SUCCESS`; cache `invalidate*` methods **never throw**; resolver uses `Promise.all` for independent best-effort deletes (only the current `(flashSaleId, userId)` my-purchase key).
7. Rate limit: `purchaseItem` only; **client IP**; **fixed window**; atomic incr with **expiry bound to first increment** (Lua); forbid `GET→INCR→SET` and separate `INCR` then `EXPIRE`.
8. Rate-limit rejection ⇒ no `PURCHASE_FLOW` ⇒ no Prisma txn ⇒ no DB write.
9. Redis failures fail open (startup connection → API still boots; cache → Postgres; rate limit → allow; invalidation → SUCCESS + log).
10. `RATE_LIMITED` is a GraphQL **error** (`extensions.code`), not a `PurchaseOutcome`.
11. Domain package remains Redis-free.
12. Cache keys are built only from **validated** `FlashSaleId` / `UserId` (after `requireFlashSaleId` / `requireUserId` / `requireId`) — never raw GraphQL argument strings.
13. Redis client lifecycle is locked: `lazyConnect: true`, explicit `connect()` in `onModuleInit` (errors caught → `redis_connection_degraded`, do not throw), `quit()` in `onModuleDestroy`. Background reconnect allowed; ops continue fail-open while unavailable.
14. **No** `getNativeClientForTests()` (or other raw-client escape hatches). TTL inspection in integration tests uses a **separate** ioredis connection.

**Chosen Redis rate-limit primitive (locked for implementation):**

Lua script (single EVAL round-trip):

```lua
-- KEYS[1] = rate-limit key
-- ARGV[1] = window TTL seconds (integer)
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return n
```

Port method name: `incrWithExpiryOnFirst(key: string, ttlSeconds: number): Promise<number>`.

**Default env values (locked):**

| Variable                                  | Default          | Notes                                          |
| ----------------------------------------- | ---------------- | ---------------------------------------------- |
| `REDIS_URL`                               | already required | Compose `redis://localhost:6379`               |
| `FLASH_SALE_CACHE_TTL_SECONDS`            | `5`              | short presentation TTL                         |
| `MY_PURCHASE_CACHE_TTL_SECONDS`           | `5`              | positive hit TTL                               |
| `MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS`  | `2`              | shorter negative TTL                           |
| `RATE_LIMIT_PURCHASE_ITEM_MAX`            | `30`             | requests per window                            |
| `RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS` | `60`             | fixed window length                            |
| `TRUSTED_PROXY`                           | `false`          | when `true`, Express trust proxy hop count `1` |

**IP resolution (locked):**

- Default (`TRUSTED_PROXY=false`): use socket remote address only (`req.socket.remoteAddress`). **Do not** read `X-Forwarded-For`.
- When `TRUSTED_PROXY=true`: set Express `trust proxy` to `1` from the **same** validated `AppEnv.TRUSTED_PROXY` (via `ConfigService` after `NestFactory.create`), then use Express `req.ip`.
- Never blindly trust raw `X-Forwarded-For` without `TRUSTED_PROXY=true`.
- Do **not** special-case merge `::ffff:x.x.x.x` with `x.x.x.x` in this epic — rate-limit identity is whatever string `resolveClientIp` returns. Centralize key building in `purchaseItemRateLimitKey(ip)` and unit-test IPv4 + IPv6 (including `:` characters) as distinct key strings.
- Single config source: parse `TRUSTED_PROXY` only in `validateEnv` / `ConfigService` — `main.ts` must not re-parse `process.env.TRUSTED_PROXY` with different rules.

**`RATE_LIMITED` HTTP transport (locked verification):**

EPIC-03 GraphQL errors assert `extensions.code` on HTTP GraphQL responses; Apollo typically returns **HTTP 200** with `errors[]` in the body (existing `#26` tests do not require non-200 for `NOT_FOUND`). For `RATE_LIMITED`, assert:

1. `errors[0].extensions.code === 'RATE_LIMITED'`
2. HTTP status matches the same convention as existing GraphQL error responses in `#26` (expect **200** unless the live suite already differs — verify in Task 0; do not invent a parallel status mapper)

**Fail-open Redis-down testing strategy (locked):**

| Layer             | How                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real Redis        | Task 1 integration: Lua incr + separate Redis connection asserts `TTL > 0`                                                                                    |
| API fail-open     | Tasks 6: `.overrideProvider(REDIS_CLIENT).useValue(failingRedisClient)` — deterministic; **do not** kill Compose Redis mid-suite for GraphQL fail-open proofs |
| Startup fail-open | Task 1 unit/integration: `onModuleInit` connect failure logs `redis_connection_degraded` and does **not** throw                                               |

**Stacked PR mapping:**

| PR  | Contents                                                                                |
| --- | --------------------------------------------------------------------------------------- |
| 1   | Spec + this plan (docs)                                                                 |
| 2   | Tasks 0–1 — baseline + #27 Redis module + CI Redis                                      |
| 3   | Tasks 2–4 — #28/#29 caches + resolver invalidation (+ #31 cache/invalidation fail-open) |
| 4   | Tasks 5–6 — #30 rate limiter + #31 limiter fail-open + integration coverage             |
| 5   | Task 7 — #32 strategy doc                                                               |

---

## File map

| Path                                                                    | Responsibility                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/api/package.json`                                                 | Add runtime dep `ioredis` (+ `@types/ioredis` if needed)                                   |
| `apps/api/src/config/env.validation.ts`                                 | Extend `AppEnv` with cache TTLs, rate-limit, `TRUSTED_PROXY`                               |
| `apps/api/src/config/env.validation.spec.ts`                            | **Create/extend** validation tests                                                         |
| `apps/api/src/redis/redis.tokens.ts`                                    | `REDIS_CLIENT` token                                                                       |
| `apps/api/src/redis/redis-client.port.ts`                               | `RedisClientPort` interface                                                                |
| `apps/api/src/redis/ioredis-redis-client.adapter.ts`                    | ioredis adapter + Lua `incrWithExpiryOnFirst`; startup fail-open                           |
| `apps/api/src/redis/ioredis-redis-client.adapter.spec.ts`               | Unit tests (mocked ioredis; connect failure does not throw)                                |
| `apps/api/src/redis/redis.module.ts`                                    | Nest module; connect/disconnect lifecycle                                                  |
| `apps/api/src/redis/redis-events.ts`                                    | Log event name constants                                                                   |
| `apps/api/src/redis/redis-keys.ts`                                      | Shared key helpers (`flashSaleCacheKey`, `myPurchaseCacheKey`, `purchaseItemRateLimitKey`) |
| `apps/api/src/app.module.ts`                                            | Import `RedisModule`                                                                       |
| `apps/api/src/main.ts`                                                  | `trust proxy` from `ConfigService` / validated env (single source)                         |
| `apps/api/src/flash-sale/flash-sale-query.cache.ts`                     | Read-through + invalidate (never throws)                                                   |
| `apps/api/src/flash-sale/flash-sale-query.cache.spec.ts`                | Unit tests                                                                                 |
| `apps/api/src/flash-sale/flash-sale.resolver.ts`                        | Use query cache                                                                            |
| `apps/api/src/flash-sale/flash-sale.module.ts`                          | Provide/export cache; import Redis                                                         |
| `apps/api/src/purchase/my-purchase-query.cache.ts`                      | Purchase lookup cache + negative envelope                                                  |
| `apps/api/src/purchase/my-purchase-query.cache.spec.ts`                 | Unit tests                                                                                 |
| `apps/api/src/purchase/client-ip.ts`                                    | Resolve client IP from request                                                             |
| `apps/api/src/purchase/client-ip.spec.ts`                               | Unit tests                                                                                 |
| `apps/api/src/purchase/purchase-item.rate-limiter.ts`                   | Fixed-window IP limiter                                                                    |
| `apps/api/src/purchase/purchase-item.rate-limiter.spec.ts`              | Unit tests                                                                                 |
| `apps/api/src/purchase/purchase.resolver.ts`                            | Cache / rate-limit / post-SUCCESS invalidate                                               |
| `apps/api/src/purchase/purchase.resolver.spec.ts`                       | Resolver unit tests (ordering, invalidation, rate-limit gate)                              |
| `apps/api/src/purchase/purchase.module.ts`                              | Wire providers                                                                             |
| `apps/api/src/purchase/purchase-flow.service.ts`                        | **Untouched** (isolation)                                                                  |
| `apps/api/src/graphql/graphql-rate-limited.error.ts`                    | `GraphqlRateLimitedError`                                                                  |
| `apps/api/src/graphql/map-graphql-error.ts`                             | Map to `RATE_LIMITED`                                                                      |
| `apps/api/src/graphql/map-graphql-error.spec.ts`                        | Mapper unit tests                                                                          |
| `apps/api/test/redis/redis-client.integration.spec.ts`                  | Real Redis: TTL via **separate** Redis connection                                          |
| `apps/api/test/graphql/redis-query-cache.integration.spec.ts`           | Cache hit counts / invalidation / fail-open via failing port                               |
| `apps/api/test/graphql/purchase-rate-limit.integration.spec.ts`         | RATE_LIMITED / no PURCHASE_FLOW / fail-open via failing port                               |
| `apps/api/jest.integration.config.cjs`                                  | Include `test/redis/**`                                                                    |
| `.github/workflows/ci.yml`                                              | Redis service on the job that runs `pnpm --filter api test:integration` (`schema-test`)    |
| `.env.example`                                                          | Document new vars; remove “deferred to EPIC-04”                                            |
| `docs/superpowers/specs/2026-07-29-epic-04-scalability-redis-design.md` | Spec                                                                                       |
| `docs/superpowers/plans/2026-07-29-epic-04-scalability-redis.md`        | This plan                                                                                  |
| `docs/redis-caching-strategy.md`                                        | #32 user-facing strategy doc                                                               |

**Untouched:** `packages/domain/**` (no Redis), Playwright, web app (except optional manual smoke).

---

## Task 0: Baseline and contract verification

**Purpose:** Prove EPIC-02/03 wiring before coding so Tasks 1–6 do not discover conflicts mid-flight.

**Files (read-only):**

- `apps/api/src/purchase/purchase.resolver.ts`
- `apps/api/src/flash-sale/flash-sale.resolver.ts`
- `apps/api/src/purchase/purchase-flow.service.ts`
- `apps/api/src/graphql/map-graphql-error.ts`
- `apps/api/src/graphql/graphql-common.module.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/config/env.validation.ts`
- `apps/api/src/main.ts`
- `apps/api/test/graphql/graphql-api.integration.spec.ts`
- `.github/workflows/ci.yml`
- `docker-compose.yml`

- [ ] **Step 1: Confirm GraphQL / purchase contracts**

Record in the PR description (or a short checklist comment in the Task 0 commit if docs-only):

1. Resolver signatures: `flashSale(id)`, `myPurchase(flashSaleId, userId)`, `purchaseItem(flashSaleId, userId)` — no client `purchaseId`.
2. Public error codes today: `NOT_FOUND` | `BAD_USER_INPUT` | `INTERNAL_SERVER_ERROR` (EPIC-04 adds `RATE_LIMITED`).
3. HTTP GraphQL error responses in `#26` use status **200** with `errors[].extensions.code` (verify by reading assertions / one local request).
4. `PurchaseFlowService.execute` opens `prisma.$transaction` and returns outcomes only after the transaction callback completes (committed SUCCESS path) — invalidation may run only after `execute` returns.
5. `CLOCK` is exported from `GraphqlCommonModule` and injected into flash-sale resolver.
6. `FLASH_SALE_REPOSITORY` / `PURCHASE_REPOSITORY` / `PURCHASE_FLOW` tokens + Prisma binders unchanged.
7. `ConfigModule.forRoot({ validate: validateEnv })` is global — `ConfigService<AppEnv, true>` is available after app init.
8. CI: `schema-test` job runs `pnpm --filter api test:integration` (Redis service must be added **here**, not a job that never runs integration tests).
9. Local Compose already has `redis:7-alpine` on `6379`; `REDIS_URL` already required by `validateEnv`.

- [ ] **Step 2: Smoke local Redis**

```bash
cd /home/rex/Project/test/app && docker compose up -d redis && redis-cli -u redis://localhost:6379 ping
```

Expected: `PONG`.

- [ ] **Step 3: Acceptance**

No Task 1–6 assumption conflicts with the checklist above. If any conflict is found, stop and amend this plan before coding.

---

## Task 1: Redis module + port + CI (#27)

**Files:**

- Modify: `apps/api/package.json`
- Create: `apps/api/src/redis/redis.tokens.ts`
- Create: `apps/api/src/redis/redis-client.port.ts`
- Create: `apps/api/src/redis/ioredis-redis-client.adapter.ts`
- Create: `apps/api/src/redis/ioredis-redis-client.adapter.spec.ts`
- Create: `apps/api/src/redis/redis.module.ts`
- Create: `apps/api/src/redis/redis-events.ts`
- Create: `apps/api/src/redis/redis-keys.ts`
- Create: `apps/api/test/redis/redis-client.integration.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/config/env.validation.ts`
- Modify: `apps/api/jest.integration.config.cjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `.env.example`
- Modify: `apps/api/package.json` `test:integration` script to include `REDIS_URL`

- [ ] **Step 1: Add `ioredis` dependency**

```bash
cd /home/rex/Project/test/app && pnpm --filter api add ioredis
```

- [ ] **Step 2: Extend `AppEnv` with EPIC-04 config**

Modify `apps/api/src/config/env.validation.ts` so `AppEnv` includes:

```typescript
export type AppEnv = {
  DATABASE_URL: string;
  FLASH_SALE_CACHE_TTL_SECONDS: number;
  MY_PURCHASE_CACHE_TTL_SECONDS: number;
  MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS: number;
  NODE_ENV?: string;
  PORT: number;
  RATE_LIMIT_PURCHASE_ITEM_MAX: number;
  RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS: number;
  REDIS_URL: string;
  TRUSTED_PROXY: boolean;
};
```

Parse positive integers with test defaults matching the locked table above. `TRUSTED_PROXY` is `true` only when the env string is exactly `'true'` (case-sensitive); otherwise `false`.

- [ ] **Step 3: Port, tokens, events, keys**

Create `apps/api/src/redis/redis-client.port.ts`:

```typescript
export type RedisClientPort = {
  delete(key: string): Promise<void>;
  get(key: string): Promise<null | string>;
  /**
   * Atomically INCR key; if the result is 1, set EXPIRE ttlSeconds in the same Lua script.
   * Must never leave a key without TTL after the first successful increment.
   */
  incrWithExpiryOnFirst(key: string, ttlSeconds: number): Promise<number>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};
```

**Do not** add `ttl()` or `getNativeClientForTests()` to the port.

Create `apps/api/src/redis/redis.tokens.ts`:

```typescript
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
```

Create `apps/api/src/redis/redis-events.ts`:

```typescript
export const REDIS_CACHE_DEGRADED = 'redis_cache_degraded';
export const REDIS_CACHE_INVALIDATION_FAILED = 'redis_cache_invalidation_failed';
export const REDIS_CONNECTION_DEGRADED = 'redis_connection_degraded';
export const REDIS_RATE_LIMIT_DEGRADED = 'redis_rate_limit_degraded';
```

Create `apps/api/src/redis/redis-keys.ts`:

```typescript
export function flashSaleCacheKey(flashSaleId: string): string {
  return `flash-sale:v1:${flashSaleId}`;
}

export function myPurchaseCacheKey(flashSaleId: string, userId: string): string {
  return `my-purchase:v1:${flashSaleId}:${userId}`;
}

export function purchaseItemRateLimitKey(clientIp: string): string {
  return `rate-limit:v1:purchaseItem:ip:${clientIp}`;
}
```

Unit-test key helpers for IPv4 and IPv6 (`2001:db8::1`) producing stable distinct strings (colons allowed).

- [ ] **Step 4: Implement ioredis adapter (lifecycle locked + startup fail-open)**

`apps/api/src/redis/ioredis-redis-client.adapter.ts`:

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { AppEnv } from '../config/env.validation';
import type { RedisClientPort } from './redis-client.port';
import { REDIS_CONNECTION_DEGRADED } from './redis-events';

const INCR_WITH_EXPIRY_ON_FIRST = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return n
`;

@Injectable()
export class IoredisRedisClientAdapter implements RedisClientPort, OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(IoredisRedisClientAdapter.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get('REDIS_URL', { infer: true });
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Allow ioredis background reconnect after a failed/interrupted session
      enableOfflineQueue: false,
    });
    this.client.on('error', (err) => {
      this.logger.warn({
        event: REDIS_CONNECTION_DEGRADED,
        err: err.message,
      });
    });
    try {
      await this.client.connect();
    } catch (err) {
      this.logger.warn({
        event: REDIS_CONNECTION_DEGRADED,
        err: String(err),
      });
      // Do NOT rethrow — API must start; feature ops fail open while Redis is down.
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }

  async get(key: string): Promise<null | string> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incrWithExpiryOnFirst(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.client.eval(INCR_WITH_EXPIRY_ON_FIRST, 1, key, String(ttlSeconds));
    return Number(result);
  }
}
```

**Locked lifecycle (do not reinterpret during implementation):**

- Always `lazyConnect: true`
- Always explicit `await this.client.connect()` inside `try/catch` in `onModuleInit`
- Always `quit()` (with disconnect fallback) in `onModuleDestroy`
- Connection failure → log `redis_connection_degraded` → **resolve successfully** (Nest boot continues)
- Redis may reconnect in the background; while unavailable, `get`/`set`/`delete`/`incrWithExpiryOnFirst` throw and callers fail open
- **Never** separate `INCR` then `EXPIRE` outside Lua
- **Never** add `getNativeClientForTests()`

Unit tests (mocked Redis):

1. Successful `connect()` path
2. `connect()` rejection → `onModuleInit` does not throw; `REDIS_CONNECTION_DEGRADED` logged

- [ ] **Step 5: Wire `RedisModule` and import in `AppModule`**

```typescript
@Global()
@Module({
  exports: [REDIS_CLIENT],
  providers: [
    IoredisRedisClientAdapter,
    { provide: REDIS_CLIENT, useExisting: IoredisRedisClientAdapter },
  ],
})
export class RedisModule {}
```

Import `RedisModule` in `AppModule` (alphabetical with other static imports).

- [ ] **Step 6: Real-Redis integration test — TTL via separate connection**

Create `apps/api/test/redis/redis-client.integration.spec.ts`:

1. Boot Nest testing module with `RedisModule` + `ConfigModule` (or full `AppModule` if simpler).
2. Inject `REDIS_CLIENT`, call `incrWithExpiryOnFirst(key, 60)` once → expect `1`.
3. Open a **second** `new Redis(process.env.REDIS_URL)` in the test file; `await inspector.ttl(key)` → `> 0` and `<= 60`.
4. Call `incrWithExpiryOnFirst` again → expect `2`; TTL still `> 0`.
5. Cleanup: delete key; `inspector.quit()`.

Add `'<rootDir>/test/redis/**/*.spec.ts'` to `jest.integration.config.cjs` `testMatch`.

Update `test:integration` script:

```bash
DATABASE_URL=${DATABASE_URL:-postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale} REDIS_URL=${REDIS_URL:-redis://localhost:6379} jest --config jest.integration.config.cjs --runInBand
```

- [ ] **Step 7: CI Redis on the integration job**

Confirm Task 0: `schema-test` runs `pnpm --filter api test:integration`. Add Redis **to that job**:

```yaml
services:
  postgres: # existing
  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
env:
  DATABASE_URL: postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale
  REDIS_URL: redis://localhost:6379
```

Do **not** add Redis only to `quality` (that job does not run `test:integration`).

- [ ] **Step 8: Update `.env.example`**

Document all new vars; replace “Redis client integration is deferred to EPIC-04” with “Redis client used for query cache + purchaseItem rate limiting (non-authoritative; fail-open if unavailable)”.

- [ ] **Step 9: Verify**

```bash
pnpm --filter api typecheck
pnpm --filter api test
# with Compose Redis up:
pnpm --filter api test:integration
```

Expected: pass.

- [ ] **Step 10: Optional commit**

```bash
git commit -m "feat: add Redis client module and CI Redis service"
```

---

## Task 2: `FlashSaleQueryCache` (#28 + #31 cache fail-open)

**Files:**

- Create: `apps/api/src/flash-sale/flash-sale-query.cache.ts`
- Create: `apps/api/src/flash-sale/flash-sale-query.cache.spec.ts`
- Modify: `apps/api/src/flash-sale/flash-sale.resolver.ts`
- Modify: `apps/api/src/flash-sale/flash-sale.module.ts`

- [ ] **Step 1: Write failing unit tests**

Cover:

1. Miss → loads via `FLASH_SALE_REPOSITORY`, maps snapshot, `set` with TTL
2. Hit → returns parsed snapshot **as-is**; repository **not** called; `getStatus` / clock **not** called on hit
3. Redis `get` throws → log `redis_cache_degraded` (include `reason: 'redis_error'`), load from Postgres, still return
4. Malformed cached JSON → treat as degraded (`reason: 'invalid_payload'`), load from Postgres, overwrite cache best-effort
5. Redis `set` throws after miss → still return Postgres result + degraded log
6. `invalidate(flashSaleId)` calls `delete(flashSaleCacheKey(id))`; delete failure logs `redis_cache_invalidation_failed` and **resolves** (never throws)

**Staleness note (explicit):** cached `status` and `remainingStock` may be stale for up to TTL; presentation only.

Snapshot shape (GraphQL-facing, serializable):

```typescript
export type FlashSaleCacheSnapshot = {
  endsAt: string; // ISO
  id: string;
  remainingStock: number;
  startsAt: string; // ISO
  status: 'ACTIVE' | 'ENDED' | 'SOLD_OUT' | 'UPCOMING';
  totalStock: number;
};
```

Keys via `flashSaleCacheKey` only — arguments are validated `FlashSaleId` values from the resolver.

- [ ] **Step 2: Implement `FlashSaleQueryCache`**

```typescript
async getById(id: FlashSaleId): Promise<FlashSaleCacheSnapshot | null> {
  const key = flashSaleCacheKey(id);
  try {
    const raw = await this.redis.get(key);
    if (raw !== null) {
      try {
        return JSON.parse(raw) as FlashSaleCacheSnapshot;
      } catch (err) {
        this.logger.warn({
          event: REDIS_CACHE_DEGRADED,
          op: 'get',
          key,
          reason: 'invalid_payload',
          err: String(err),
        });
      }
    }
  } catch (err) {
    this.logger.warn({
      event: REDIS_CACHE_DEGRADED,
      op: 'get',
      key,
      reason: 'redis_error',
      err: String(err),
    });
  }

  const entity = await this.flashSales.findById(id);
  if (entity === null) return null;

  const snapshot = toSnapshot(entity, this.clock.nowUtc());
  try {
    await this.redis.set(
      key,
      JSON.stringify(snapshot),
      this.config.get('FLASH_SALE_CACHE_TTL_SECONDS', { infer: true }),
    );
  } catch (err) {
    this.logger.warn({
      event: REDIS_CACHE_DEGRADED,
      op: 'set',
      key,
      reason: 'redis_error',
      err: String(err),
    });
  }
  return snapshot;
}

async invalidate(flashSaleId: FlashSaleId): Promise<void> {
  const key = flashSaleCacheKey(flashSaleId);
  try {
    await this.redis.delete(key);
  } catch (err) {
    this.logger.warn({
      event: REDIS_CACHE_INVALIDATION_FAILED,
      key,
      err: String(err),
    });
  }
}
```

`toSnapshot` computes `status` **once** at population time via `entity.getStatus(nowUtc)` + `toFlashSaleStatusGql`. Hits must not recompute status.

- [ ] **Step 3: Wire resolver to cache**

After `requireId` / `requireFlashSaleId`, pass the **validated** id into `getById`. Map snapshot dates back to `Date` for the GraphQL object type.

**Do not** inject `FlashSaleQueryCache` into `PurchaseFlowService`.

- [ ] **Step 4: Update `FlashSaleModule`**

Provide + **export** `FlashSaleQueryCache` for purchase resolver invalidation. Ensure `CLOCK` remains available.

- [ ] **Step 5: Run unit tests**

```bash
pnpm --filter api test -- flash-sale-query.cache.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Optional commit**

```bash
git commit -m "feat: cache flashSale query reads in Redis"
```

---

## Task 3: `MyPurchaseQueryCache` (#29 + sale-existence invariant)

**Files:**

- Create: `apps/api/src/purchase/my-purchase-query.cache.ts`
- Create: `apps/api/src/purchase/my-purchase-query.cache.spec.ts`
- Modify: `apps/api/src/purchase/purchase.resolver.ts`
- Create: `apps/api/src/purchase/purchase.resolver.spec.ts` (ordering tests)
- Modify: `apps/api/src/purchase/purchase.module.ts`

- [ ] **Step 1: Write failing cache unit tests**

Envelope:

```typescript
export type MyPurchaseCacheEnvelope =
  | { found: false }
  | {
      found: true;
      purchase: { purchaseId: string; purchasedAt: string };
    };
```

Keys via `myPurchaseCacheKey(flashSaleId, userId)` from validated IDs only.

Tests:

1. Miss + Postgres null → return `{ purchased: false, … }`, SET `{ found: false }` with **negative** TTL
2. Miss + Postgres hit → SET `{ found: true, purchase }`, return purchased true
3. Hit negative → repository not called
4. Hit positive → repository not called
5. Redis get failure → degraded + Postgres
6. Malformed JSON → `reason: 'invalid_payload'` → Postgres
7. `invalidate(flashSaleId, userId)` delete failure → log `redis_cache_invalidation_failed`, **never throws**
8. Isolation: `myPurchaseCacheKey(sale, userA) !== myPurchaseCacheKey(sale, userB)`

- [ ] **Step 2: Implement cache service**

`get(flashSaleId, userId)` returns GraphQL-facing my-purchase fields. Cache **only** the purchase lookup — never flash-sale existence. `invalidate` never throws.

- [ ] **Step 3: Update `myPurchase` resolver — hard ordering**

```typescript
async myPurchase(...): Promise<MyPurchaseResultObjectType> {
  const flashSaleId = requireFlashSaleId(flashSaleIdRaw);
  const userId = requireUserId(userIdRaw);

  // HARD INVARIANT: uncached sale existence BEFORE purchase cache
  const flashSale = await this.flashSaleRepository.findById(flashSaleId);
  if (flashSale === null) {
    throw new FlashSaleNotFoundError();
  }

  return this.myPurchaseQueryCache.get(flashSaleId, userId);
}
```

**Forbidden:** consulting `MyPurchaseQueryCache` before sale existence; using `FlashSaleQueryCache` for this existence check; building keys from raw GraphQL strings.

- [ ] **Step 4: Resolver unit tests for ordering (mandatory)**

In `purchase.resolver.spec.ts`:

1. Sale missing → `FLASH_SALE_REPOSITORY.findById` called → `MyPurchaseQueryCache.get` **NOT** called → `FlashSaleNotFoundError`
2. Sale exists → `findById` called → `MyPurchaseQueryCache.get` called with validated ids

- [ ] **Step 5: Run tests**

```bash
pnpm --filter api test -- my-purchase-query.cache.spec.ts purchase.resolver.spec.ts
```

- [ ] **Step 6: Optional commit**

```bash
git commit -m "feat: cache myPurchase lookup with negative sentinel"
```

---

## Task 4: Post-SUCCESS invalidation in `purchaseItem` resolver

**Files:**

- Modify: `apps/api/src/purchase/purchase.resolver.ts`
- Modify: `apps/api/src/purchase/purchase.resolver.spec.ts`
- Create: `apps/api/src/purchase/purchase-flow.isolation.spec.ts`

- [ ] **Step 1: Write failing resolver unit tests**

1. When `purchaseFlow.execute` returns `'SUCCESS'`, resolver awaits:
   ```ts
   Promise.all([
     flashSaleQueryCache.invalidate(flashSaleId),
     myPurchaseQueryCache.invalidate(flashSaleId, userId),
   ]);
   ```
2. Invalidation args: flash-sale id + **only** the purchasing `userId` (assert `invalidate` called with `userA`, never `userB`)
3. Non-SUCCESS outcomes → **no** invalidation calls
4. Both `invalidate` methods are contracted to **never reject**; mutation still returns SUCCESS after Redis errors inside invalidate (drive via mock redis inside real cache services, or stub invalidate to resolve after logging — do **not** invent a “throws internally” path)
5. `PurchaseFlow` mock is the only purchase path

- [ ] **Step 2: Implement resolver orchestration**

```typescript
if (outcome === 'SUCCESS') {
  await Promise.all([
    this.flashSaleQueryCache.invalidate(flashSaleId),
    this.myPurchaseQueryCache.invalidate(flashSaleId, userId),
  ]);
}
```

Both invalidations are independent best-effort operations. Cache services own swallowing Redis errors.

Inject both cache services into `PurchaseResolver`. Export `FlashSaleQueryCache` from `FlashSaleModule`.

- [ ] **Step 3: Architectural isolation assertion**

`purchase-flow.isolation.spec.ts`: `PurchaseFlowService` constructor params remain only repository/reservation/Prisma — no Redis/query-cache tokens.

- [ ] **Step 4: Verify + optional commit**

```bash
pnpm --filter api test
git commit -m "feat: invalidate query caches after successful purchaseItem"
```

---

## Task 5: IP rate limiter + `RATE_LIMITED` (#30 + #31)

**Files:**

- Create: `apps/api/src/purchase/client-ip.ts`
- Create: `apps/api/src/purchase/client-ip.spec.ts`
- Create: `apps/api/src/purchase/purchase-item.rate-limiter.ts`
- Create: `apps/api/src/purchase/purchase-item.rate-limiter.spec.ts`
- Create: `apps/api/src/graphql/graphql-rate-limited.error.ts`
- Modify: `apps/api/src/graphql/map-graphql-error.ts`
- Modify: `apps/api/src/graphql/map-graphql-error.spec.ts`
- Modify: `apps/api/src/purchase/purchase.resolver.ts`
- Modify: `apps/api/src/purchase/purchase.resolver.spec.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Client IP helper tests + implementation**

```typescript
export function resolveClientIp(req: Request, trustedProxy: boolean): string {
  if (trustedProxy) {
    const ip = req.ip;
    if (typeof ip === 'string' && ip.length > 0) return ip;
  }
  const remote = req.socket.remoteAddress;
  if (typeof remote === 'string' && remote.length > 0) return remote;
  return 'unknown';
}
```

Tests:

1. `trustedProxy=false` ignores `X-Forwarded-For`, uses socket address
2. `trustedProxy=true` uses `req.ip`
3. Documented expectation: IPv4-mapped IPv6 strings are **not** normalized in this epic

- [ ] **Step 2: `GraphqlRateLimitedError` + mapper**

Map to `extensions.code = 'RATE_LIMITED'`. Public codes: four.

- [ ] **Step 3: Rate limiter unit tests (TDD)**

`PurchaseItemRateLimiter.consume(ip)`:

1. Under max → `allow` via `incrWithExpiryOnFirst`
2. At max+1 → `limit`
3. Redis throw → `redis_rate_limit_degraded` → `allow`
4. Key via `purchaseItemRateLimitKey(ip)` for IPv4 and IPv6
5. No get/set counting path

- [ ] **Step 4: Implement limiter using `purchaseItemRateLimitKey`**

- [ ] **Step 5: Wire into `purchaseItem` before `PURCHASE_FLOW`**

```typescript
const trustedProxy = this.config.get('TRUSTED_PROXY', { infer: true });
const clientIp = resolveClientIp(ctx.req, trustedProxy);
if ((await this.rateLimiter.consume(clientIp)) === 'limit') {
  throw new GraphqlRateLimitedError();
}
// then createPurchaseId + purchaseFlow.execute + Promise.all invalidate on SUCCESS
```

Resolver unit test: limiter `limit` ⇒ `purchaseFlow.execute` never called.

- [ ] **Step 6: `main.ts` trust proxy from ConfigService (single source)**

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<AppEnv, true>);
  if (config.get('TRUSTED_PROXY', { infer: true })) {
    app.set('trust proxy', 1);
  }
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}
```

Do **not** read `process.env.TRUSTED_PROXY` directly in `main.ts`.

- [ ] **Step 7: Verify + optional commit**

```bash
pnpm --filter api test -- map-graphql-error.spec.ts purchase-item.rate-limiter.spec.ts client-ip.spec.ts purchase.resolver.spec.ts
git commit -m "feat: rate-limit purchaseItem by client IP"
```

---

## Task 6: GraphQL + Redis integration coverage

**Files:**

- Create: `apps/api/test/graphql/redis-query-cache.integration.spec.ts`
- Create: `apps/api/test/graphql/purchase-rate-limit.integration.spec.ts`
- Prefer copy-minimal helpers from `graphql-api.integration.spec.ts`

**Failing Redis client (locked pattern for API fail-open):**

```typescript
const failingRedisClient: RedisClientPort = {
  async get() {
    throw new Error('redis down');
  },
  async set() {
    throw new Error('redis down');
  },
  async delete() {
    throw new Error('redis down');
  },
  async incrWithExpiryOnFirst() {
    throw new Error('redis down');
  },
};
```

Use `.overrideProvider(REDIS_CLIENT).useValue(failingRedisClient)` for fail-open GraphQL tests. Do **not** stop the Compose Redis container mid-suite for those cases.

- [ ] **Step 1: Query-cache integration (real Redis + counting repo)**

1. Warm path: counting `FLASH_SALE_REPOSITORY` wrapper — first `flashSale` → `findById` count `1`; second → count still `1`.
2. Same for `myPurchase` purchase repository count after sale existence (sale find may still run every time — that is correct).
3. Missing sale → `NOT_FOUND`; purchase cache not required.
4. userA vs userB isolation.
5. SUCCESS purchase → only `my-purchase:v1:{sale}:{userA}` deleted (userB key remains if present); `flash-sale:v1:{sale}` deleted; subsequent flashSale increments Postgres count again.
6. Fail-open: override `REDIS_CLIENT` with `failingRedisClient` → `flashSale` / `myPurchase` still succeed from Postgres.

- [ ] **Step 2: Rate-limit integration**

1. Override config so `RATE_LIMIT_PURCHASE_ITEM_MAX=2`, window large enough for the test.
2. Seed sale with `totalStock >= 5` (strictly `>= MAX + 1`) so stock cannot masquerade as rate-limit.
3. Two `purchaseItem` from same IP with **different** `userId`s succeed (or return business outcomes that are not RATE_LIMITED).
4. Third call → `extensions.code === 'RATE_LIMITED'`; HTTP status matches control `NOT_FOUND` GraphQL response status from the same suite.
5. Rejected attempt: dedicated `userId` with **no** purchase row.
6. Fail-open: `failingRedisClient` → `purchaseItem` can still reach SUCCESS (different sale/user).
7. Real Redis Lua TTL remains covered by Task 1 (separate inspector connection).

- [ ] **Step 3: Run full integration**

```bash
docker compose up -d postgres redis
pnpm --filter api test:integration
pnpm --filter api typecheck
pnpm --filter api lint
```

- [ ] **Step 4: Optional commit**

```bash
git commit -m "test: cover Redis query cache and purchaseItem rate limits"
```

---

## Task 7: Document Redis caching strategy (#32)

**Files:**

- Create: `docs/redis-caching-strategy.md`
- Modify: `README.md` — link under Redis / local stack

- [ ] **Step 1: Write strategy doc covering**

1. What Redis owns / does not own
2. Key formats + TTLs + negative caching + status/stock presentation staleness
3. Validated-ID-only cache keys
4. Post-SUCCESS `Promise.all` invalidation + never-fail mutation
5. Fail-open including **startup** (`redis_connection_degraded`)
6. Rate-limit identity (IP now; AuthN later); IPv6 keys; no IPv4-mapped merge
7. `TRUSTED_PROXY` + ConfigService single source
8. Log event names including `redis_connection_degraded`

- [ ] **Step 2: Optional commit**

```bash
git commit -m "docs: document Redis caching and rate-limit strategy"
```

---

## Self-review (plan author)

| Spec / review requirement                                                         | Task      |
| --------------------------------------------------------------------------------- | --------- |
| Task 0 baseline verification                                                      | Task 0    |
| #27 Redis module + locked lifecycle + startup fail-open                           | Task 1    |
| No native-client escape hatch; TTL via separate Redis connection                  | Task 1    |
| Atomic Lua incr+expiry; CI Redis on `schema-test` (runs `test:integration`)       | Task 1    |
| #28 FlashSaleQueryCache; stale status; no recompute on hit; malformed JSON        | Task 2    |
| Validated IDs for cache keys                                                      | Tasks 2–5 |
| #29 + resolver sale-existence ordering unit tests                                 | Task 3    |
| Promise.all invalidation; only current user key; invalidate never throws          | Task 4    |
| #30 IP fixed-window + RATE_LIMITED; ConfigService trust proxy                     | Task 5    |
| Deterministic fail-open via failing `REDIS_CLIENT`; enough stock for RATE_LIMITED | Task 6    |
| #32 docs                                                                          | Task 7    |

**Placeholder scan:** lifecycle, startup fail-open, CI job, fail-open test strategy, and defaults are locked — no worker design choices left for those.

---

## Execution handoff

Plan revised and saved to `docs/superpowers/plans/2026-07-29-epic-04-scalability-redis.md` (uncommitted). Spec also notes startup fail-open + `redis_connection_degraded`.

Two execution options after you approve this revision:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
