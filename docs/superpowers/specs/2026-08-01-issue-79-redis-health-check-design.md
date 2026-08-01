# #79 — Add Redis health check (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-08-01
**Issue:** [#79](https://github.com/rexescario-dev/flash-sale-system/issues/79) — Add Redis health check
**Epic:** [#89](https://github.com/rexescario-dev/flash-sale-system/issues/89) (EPIC-09 — Observability & Operational Readiness)
**Sibling issues:** [#77](https://github.com/rexescario-dev/flash-sale-system/issues/77) (health endpoint + registry — shipped), [#78](https://github.com/rexescario-dev/flash-sale-system/issues/78) (database health — shipped), [#75](https://github.com/rexescario-dev/flash-sale-system/issues/75)–[#76](https://github.com/rexescario-dev/flash-sale-system/issues/76)/[#80](https://github.com/rexescario-dev/flash-sale-system/issues/80) (logging/metrics — separate track)
**Depends on:** [#77](https://github.com/rexescario-dev/flash-sale-system/issues/77) (`HEALTH_CHECKS` registry seam), [#78](https://github.com/rexescario-dev/flash-sale-system/issues/78) (`DatabaseHealthCheck` + single-check wiring), [#27](https://github.com/rexescario-dev/flash-sale-system/issues/27) (Redis)
**Repository:** `rexescario-dev/flash-sale-system`
**Base designs:** [`2026-08-01-issue-77-health-check-endpoint-design.md`](./2026-08-01-issue-77-health-check-endpoint-design.md), [`2026-08-01-issue-78-database-health-check-design.md`](./2026-08-01-issue-78-database-health-check-design.md)

## Goal

Register a Redis connectivity probe on the #77 readiness registry and finalize Nest-native multi-check aggregation, so `GET /health/ready` reports `checks.redis` as `up` / `down` alongside `checks.database`, without changing liveness, routes, controller, or `HealthService` aggregation logic.

## Acceptance criteria

GitHub AC: **Health includes Redis connectivity without failing purchases incorrectly.**

Satisfied when:

1. `RedisClientPort` exposes `ping(): Promise<void>` as a dedicated connectivity primitive; the ioredis adapter implements it via Redis `PING`.
2. A `RedisHealthCheck` implements the existing `HealthCheck` port with `name: "redis"`.
3. It is registered from `HealthModule` together with `DatabaseHealthCheck` via an explicit Nest `useFactory` that returns `[db, redis]` for `HEALTH_CHECKS`.
4. On successful probe, readiness includes `"redis": "up"` and returns top-level `"status": "ok"` (HTTP 200) when every registered check reports `up`.
5. On probe failure (reject/throw), `HealthService` aggregation records `"redis": "down"` and readiness returns top-level `"status": "error"` (HTTP 503) — using the existing #77 normalization path (hard readiness: database **or** Redis down fails readiness).
6. Purchase/cache fail-open runtime behavior is unchanged; readiness is an operational signal only, not a behavioral switch.
7. `GET /health` liveness contract is unchanged (`{ "status": "ok" }`, HTTP 200).
8. No controller/route edits; no `HealthService` logic changes; no Terminus; no structured logging/metrics (#75/#76/#80).

## Approach

**`RedisHealthCheck` + port `ping` + explicit `HEALTH_CHECKS` `useFactory` array (Approach 1):**

| Unit                                  | Role                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `RedisClientPort.ping()`              | Connectivity capability on the existing Redis port                                   |
| `IoredisRedisClientAdapter`           | Implements `PING`; propagates client errors                                          |
| `RedisHealthCheck`                    | Injectable `HealthCheck`; probes Redis via `REDIS_CLIENT`                            |
| `HealthModule`                        | Registers both check classes; binds `HEALTH_CHECKS` via `useFactory` → `[db, redis]` |
| `HealthService` / controller / routes | Unchanged from #77/#78                                                               |

**Rejected alternatives:**

| Alternative                                                            | Why rejected                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Registry service collecting checks                                     | Extra lifecycle/API for a fixed small set of infrastructure probes                            |
| Soft Redis (report `down` but keep top-level `ok`)                     | Breaks “ready = safe for production traffic”; special-cases aggregation                       |
| Register from `RedisModule`                                            | Redis would own health tokens/contracts; scatters checks across modules                       |
| Anonymous factory-only probe (no class)                                | Weaker unit-test seam; inconsistent with `DatabaseHealthCheck`                                |
| Reuse `get` of a sentinel key                                          | Fake business op; misleading failures unrelated to connectivity                               |
| Angular-style `multi: true` / `useFactory` array solely to mimic multi | Nest `Provider` has no `multi: true`; #79 designs explicit aggregation, not Angular emulation |
| `@nestjs/terminus`                                                     | Explicitly out of scope; #77 rejected Terminus for this track                                 |
| Change `GET /health`, controller, or `HealthService`                   | Violates #77/#78 freeze; #79 is additive probe + registration wiring                          |

## Locked decisions

| Area                | Decision                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership           | Health feature owns registration and probe policy                                                                                                                                                                                                                                                                   |
| Location            | `apps/api/src/health/redis.health-check.ts`; port/adapter changes under `apps/api/src/redis/`                                                                                                                                                                                                                       |
| Port contract       | Implements existing `#77` port (`HealthCheck` / `HealthCheckResult`); success returns `{ status: 'up' }` — same shape as `DatabaseHealthCheck`                                                                                                                                                                      |
| Redis connectivity  | `RedisClientPort` gains `ping(): Promise<void>`; adapter implements via ioredis `PING`                                                                                                                                                                                                                              |
| Registration        | Nest-native multi-check aggregation: replace the #78 `HEALTH_CHECKS` provider binding (previously `useExisting`) with an explicit `useFactory` that returns both registered check instances (`{ provide: HEALTH_CHECKS, useFactory: (db, redis) => [db, redis], inject: [DatabaseHealthCheck, RedisHealthCheck] }`) |
| Redis wiring        | `HealthModule` relies on the existing global `REDIS_CLIENT` from `RedisModule`; it must not declare or instantiate another Redis provider                                                                                                                                                                           |
| Check name          | `"redis"` (matches #77 illustrative readiness shape)                                                                                                                                                                                                                                                                |
| Probe               | `await this.redis.ping()` — verifies the client can round-trip Redis; it does not validate cache correctness or stored data                                                                                                                                                                                         |
| Success result      | `{ status: 'up' }` (`HealthCheckResult`); name stays on the class (`readonly name = 'redis'`)                                                                                                                                                                                                                       |
| Failure handling    | `RedisHealthCheck` MUST NOT catch, wrap, log, or normalize probe failures. Any thrown/rejected error is consumed by `HealthService`, which performs readiness normalization to `down`                                                                                                                               |
| Adapter errors      | Propagate any Redis client error directly; do not translate connectivity failures into health results                                                                                                                                                                                                               |
| Readiness semantics | `GET /health/ready` reports whether the instance is ready to receive production traffic. If any required infrastructure dependency (currently Prisma or Redis) is unavailable, the endpoint returns `"error"` with HTTP 503                                                                                         |
| Aggregation         | Unchanged: readiness is `ok` iff every registered check reports `up`                                                                                                                                                                                                                                                |
| Execution           | Participates in existing concurrent readiness execution from #77; no sequencing or ordering guarantees are added. #79 does not introduce probe timeouts, retries, or circuit-breaking; probe duration remains governed by the underlying dependency client                                                          |
| Vocabulary          | Probe status `up` / `down` only; top-level readiness still `ok` / `error`                                                                                                                                                                                                                                           |
| HTTP surface        | No changes to `GET /health` or `GET /health/ready` mapping                                                                                                                                                                                                                                                          |
| Runtime             | Purchase/cache fail-open paths remain as already designed; readiness is not a behavioral switch                                                                                                                                                                                                                     |
| Out of slice        | Terminus; registry service; logging/correlation/metrics (#75/#76/#80); EPIC-07 stress docs/results; `#134` CSS AC                                                                                                                                                                                                   |

## Nest-native multi-check aggregation

Nest has no Angular-style `multi: true` on `Provider`. #78 bound `HEALTH_CHECKS` with `useExisting: DatabaseHealthCheck`. #79 replaces that provider binding (not the check classes) with an **explicit** factory that assembles the fixed check set:

```ts
providers: [
  DatabaseHealthCheck,
  RedisHealthCheck,
  HealthService,
  {
    provide: HEALTH_CHECKS,
    useFactory: (db: DatabaseHealthCheck, redis: RedisHealthCheck) => [db, redis],
    inject: [DatabaseHealthCheck, RedisHealthCheck],
  },
],
```

No implementation changes are required because `HealthService` already supports both `HealthCheck` and `HealthCheck[]`.

Future infrastructure checks (e.g. broker, object storage) extend the factory `inject` list and returned array without changing aggregation logic. Ordering of the returned array is not part of the health contract. A registry abstraction is deferred until there is a demonstrated need beyond a small explicit set.

## Existing `#77` port (do not redefine)

```ts
// apps/api/src/health/health-check.port.ts
export interface HealthCheckResult {
  status: string;
}

export interface HealthCheck {
  check(): Promise<HealthCheckResult>;
  readonly name: string;
}
```

`RedisHealthCheck.check()` returns `{ status: 'up' }` on success. Failure is expressed by throw/reject only — never by returning `{ status: 'down' }` from the check itself.

Although the type remains `string` for compatibility, this design uses only the `up` vocabulary for successful probe results. `down` is produced solely by `HealthService`.

## Redis port extension

```ts
// apps/api/src/redis/redis-client.port.ts (additive)
export type RedisClientPort = {
  // existing methods...
  ping(): Promise<void>;
};
```

Adapter: await ioredis `ping()` (or equivalent); resolve on success; propagate client errors without mapping them to health vocabulary.

## HTTP contract (unchanged surface; additive `checks`)

| Route               | Role      | After #79 (both up)                                                       | After #79 (any dependency down)                                                      |
| ------------------- | --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /health`       | Liveness  | `200` `{ "status": "ok" }`                                                | same (no probes)                                                                     |
| `GET /health/ready` | Readiness | `200` `{ "status": "ok", "checks": { "database": "up", "redis": "up" } }` | `503` `{ "status": "error", "checks": { … } }` with the failing check(s) as `"down"` |

Illustrative bodies:

```json
{
  "status": "ok",
  "checks": {
    "database": "up",
    "redis": "up"
  }
}
```

```json
{
  "status": "error",
  "checks": {
    "database": "up",
    "redis": "down"
  }
}
```

Object key order in `checks` is not part of the contract.

## Components

| Unit                                  | Responsibility                                                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RedisClientPort`                     | Add `ping(): Promise<void>` — connectivity only; no key/business semantics                                                                                                                                        |
| `IoredisRedisClientAdapter`           | Implement `ping()` via Redis `PING`; propagate any Redis client error directly; do not translate connectivity failures into health results                                                                        |
| `RedisHealthCheck`                    | Implements `HealthCheck`; `readonly name = 'redis'`; inject `REDIS_CLIENT`; await `this.redis.ping()` and return the same success shape used by `DatabaseHealthCheck`; MUST NOT catch/wrap/log/normalize failures |
| `HealthModule`                        | Providers: `DatabaseHealthCheck`, `RedisHealthCheck`, `HEALTH_CHECKS` `useFactory` registration returning `[db, redis]`, existing `HealthService` / controller wiring; do not provide `REDIS_CLIENT`              |
| `RedisModule` / `REDIS_CLIENT`        | Unchanged ownership; remain the sole Redis client provider (`@Global()`)                                                                                                                                          |
| `HealthService` / controller / routes | Unchanged                                                                                                                                                                                                         |

### Dependency direction

```
HealthModule
  → DatabaseHealthCheck → PrismaService (global)
  → RedisHealthCheck    → REDIS_CLIENT / RedisClientPort (global)

DatabaseHealthCheck ─┐
                     ├── HEALTH_CHECKS (useFactory → [db, redis])
RedisHealthCheck  ───┘
                       ↓
                 HealthService (unchanged) → aggregates concurrently
```

Not:

```
RedisModule → HEALTH_CHECKS / health contracts
```

### Readiness data flow

1. Request hits `GET /health/ready` (unchanged controller).
2. Concurrent execution of all `HEALTH_CHECKS` → probe success or thrown/rejected error → HealthService normalizes failures to `"down"` → aggregate `"ok"`/`"error"` → HTTP `200`/`503`.
3. Body includes `checks.database` and `checks.redis`.

**Invariant: Health checks never normalize failures; `HealthService` is the sole normalization point.**

## Testing

| Layer                   | Cases                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapter `ping`          | Resolves when ioredis `ping` resolves; Redis client failures propagate unchanged (no health mapping in adapter)                                                                                                                                                                                                           |
| `RedisHealthCheck` unit | `name === "redis"`; `ping` resolves → `{ status: 'up' }` and `ping()` called exactly once; `ping` rejects → promise rejects / throws (no local `down` mapping)                                                                                                                                                            |
| `HealthService`         | Since #79 does not modify `HealthService` behavior, only the registration wiring and the addition of a new check, existing aggregation and failure-normalization tests remain the behavioral proof. New tests should focus on the new adapter and check. Optional tiny regression with two fakes is fine but not required |
| Port/type               | Existing Redis adapter/port tests updated so every `RedisClientPort` implementation provides `ping`                                                                                                                                                                                                                       |
| Out of scope            | Live Redis integration probe tests; Terminus; changing consumer defaults away from `/health` liveness; inventing k6/stress results; #75 logging; `#134` CSS AC                                                                                                                                                            |

## Documentation

No operational doc rewrite required. Optional thin note next to existing `/health/ready` mention that readiness may include `database` and `redis` checks — only if existing documentation no longer reflects the readiness response. Do not change CI / `wait-on` / Playwright defaults away from `/health`.

## Freeze / non-goals

**In scope for #79 only:**

- `RedisClientPort.ping()` + adapter `PING`
- `RedisHealthCheck` and `HEALTH_CHECKS` `useFactory` registration
- Unit/adapter tests for the above

**Frozen / out of slice:**

- No changes to `GET /health` response shape or consumers.
- No controller/route edits.
- No `HealthService` aggregation or normalization changes.
- No Terminus / new health framework dependencies.
- No registry service / Angular-style `multi: true` as the primary design.
- No structured logging, correlation IDs, or metrics (#75 / #76 / #80).
- No EPIC-07 stress harness, results, or bottleneck contract changes.
- No `#134` CSS acceptance criteria work.
- No second Redis client instance / re-providing `REDIS_CLIENT` from `HealthModule`.
- No purchase/cache fail-open behavior changes.
- No probe timeouts, retries, or circuit-breaking; probe duration remains governed by the underlying dependency client.

## Follow-on

| Issue              | Role after #79                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| #75–#76 / #80      | Separate logging / correlation / metrics track                                                                              |
| Later infra checks | Extend `HEALTH_CHECKS` factory `inject` list + returned array; keep `HealthService` unchanged until a registry is justified |

## Definition of Done

- Implementation complete for #79 only (Redis probe + Nest-native multi-check registration).
- Relevant adapter/check tests added or updated, with no reduction in existing health coverage; existing tests continue to pass.
- ESLint and typecheck pass where applicable.
- No unrelated changes.
- Commit message follows `<type>: <MESSAGE>` (when committing is requested).
