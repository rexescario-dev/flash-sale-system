# #78 — Add database health check (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-08-01
**Issue:** [#78](https://github.com/rexescario-dev/flash-sale-system/issues/78) — Add database health check
**Epic:** [#89](https://github.com/rexescario-dev/flash-sale-system/issues/89) (EPIC-09 — Observability & Operational Readiness)
**Sibling issues:** [#77](https://github.com/rexescario-dev/flash-sale-system/issues/77) (health endpoint + registry — shipped), [#79](https://github.com/rexescario-dev/flash-sale-system/issues/79) (Redis health), [#75](https://github.com/rexescario-dev/flash-sale-system/issues/75)–[#76](https://github.com/rexescario-dev/flash-sale-system/issues/76)/[#80](https://github.com/rexescario-dev/flash-sale-system/issues/80) (logging/metrics — separate track)
**Depends on:** [#77](https://github.com/rexescario-dev/flash-sale-system/issues/77) (`HEALTH_CHECKS` registry seam), [#5](https://github.com/rexescario-dev/flash-sale-system/issues/5) (PostgreSQL / Prisma)
**Repository:** `rexescario-dev/flash-sale-system`
**Base design:** [`2026-08-01-issue-77-health-check-endpoint-design.md`](./2026-08-01-issue-77-health-check-endpoint-design.md)

## Goal

Register a PostgreSQL connectivity probe as the first real readiness check on the #77 registry seam, so `GET /health/ready` reports `checks.database` as `up` / `down` without changing liveness, routes, or the controller.

## Acceptance criteria

GitHub AC: **Health includes PostgreSQL connectivity.**

Satisfied when:

1. A `DatabaseHealthCheck` implements the existing `HealthCheck` port with `name: "database"`.
2. It is registered via Nest DI `HEALTH_CHECKS` provider registration from `HealthModule` (`useExisting: DatabaseHealthCheck`).
3. On successful probe, readiness includes `"database": "up"` and can still return top-level `"status": "ok"` (HTTP 200) when every registered check is `up`.
4. On probe failure (reject/throw), `HealthService` aggregation records `"database": "down"` and readiness returns top-level `"status": "error"` (HTTP 503) — using the existing #77 normalization path.
5. `GET /health` liveness contract is unchanged (`{ "status": "ok" }`, HTTP 200).
6. No controller/route edits; no Terminus; no Redis probe (#79); no structured logging/metrics (#75/#76/#80).

## Approach

**`DatabaseHealthCheck` class in `health/`, registered from `HealthModule` (Approach 1):**

| Unit                                  | Role                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `DatabaseHealthCheck`                 | Injectable `HealthCheck`; probes PostgreSQL via `PrismaService`                                 |
| `HealthModule`                        | Registers the class and binds it into `HEALTH_CHECKS` via Nest `useExisting`                    |
| `PrismaService`                       | Existing global client — `HealthModule` must not declare or instantiate another Prisma provider |
| `HealthService` / controller / routes | Unchanged from #77                                                                              |

**Rejected alternatives:**

| Alternative                        | Why rejected                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Register from `PrismaModule`       | Persistence would own health tokens/contracts; scatters checks across modules as #79+ land |
| Anonymous `useFactory` provider    | Weaker unit-test seam; inconsistent with a future `RedisHealthCheck` class                 |
| `@nestjs/terminus`                 | Explicitly out of scope; #77 rejected Terminus for this track                              |
| Change `GET /health` or controller | Violates #77 freeze; #78 is additive registration only                                     |

## Locked decisions

| Area             | Decision                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership        | Health feature owns registration and probe policy                                                                                                                                        |
| Location         | `apps/api/src/health/database.health-check.ts`                                                                                                                                           |
| Port contract    | Implements existing `#77` port (`HealthCheck` / `HealthCheckResult` in `health-check.port.ts`); success returns `Promise<HealthCheckResult>` with `{ status: 'up' }`                     |
| Registration     | `HealthModule` providers: `DatabaseHealthCheck` + `{ provide: HEALTH_CHECKS, useExisting: DatabaseHealthCheck }` (Nest DI; no Angular-style `multi: true`)                               |
| Prisma wiring    | `HealthModule` relies on the existing global `PrismaService` exported by `PrismaModule`; it must not declare or instantiate another Prisma provider                                      |
| Check name       | `"database"` (matches #77 illustrative readiness shape)                                                                                                                                  |
| Probe            | Trivial read-only `await this.prisma.$queryRaw\`SELECT 1\`` — verifies Prisma can obtain a connection and execute SQL; **not** schema or application-data validation                     |
| Success result   | `{ status: 'up' }` (`HealthCheckResult`)                                                                                                                                                 |
| Failure handling | `DatabaseHealthCheck` MUST NOT catch, wrap, log, or normalize probe failures. Any thrown/rejected error is consumed by `HealthService`, which performs readiness normalization to `down` |
| Execution        | Participates in the existing concurrent readiness execution from #77; no sequencing or ordering guarantees are added                                                                     |
| Vocabulary       | Probe status `up` / `down` only; top-level readiness still `ok` / `error`                                                                                                                |
| HTTP surface     | No changes to `GET /health` or `GET /health/ready` mapping                                                                                                                               |
| Out of slice     | Redis (#79); Terminus; logging/correlation/metrics (#75/#76/#80); EPIC-07 stress docs/results; `#134` CSS AC                                                                             |

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

`DatabaseHealthCheck.check()` returns `{ status: 'up' }` on success. Failure is expressed by throw/reject only — never by returning `{ status: 'down' }` from the check itself.

## HTTP contract (unchanged surface; additive `checks`)

| Route               | Role      | After #78 (DB up)                                          | After #78 (DB down)                                             |
| ------------------- | --------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| `GET /health`       | Liveness  | `200` `{ "status": "ok" }`                                 | same (no probes)                                                |
| `GET /health/ready` | Readiness | `200` `{ "status": "ok", "checks": { "database": "up" } }` | `503` `{ "status": "error", "checks": { "database": "down" } }` |

Illustrative success body:

```json
{
  "status": "ok",
  "checks": {
    "database": "up"
  }
}
```

## Components

Stay under `apps/api/src/health/`.

| Unit                             | Responsibility                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DatabaseHealthCheck`            | Implements `HealthCheck`; `readonly name = 'database'`; `check()` runs `$queryRaw\`SELECT 1\``and returns`{ status: 'up' }` on success; MUST NOT catch/wrap/log/normalize failures |
| `HealthModule`                   | Add `DatabaseHealthCheck` provider and `HEALTH_CHECKS` `useExisting` binding; leave controller/service providers as in #77; do not provide `PrismaService`                         |
| `PrismaModule` / `PrismaService` | Unchanged; remain the sole Prisma provider                                                                                                                                         |

### Dependency direction

```
HealthModule
  → DatabaseHealthCheck
      → PrismaService (global from PrismaModule)
          → SELECT 1
```

Not:

```
PrismaModule → HEALTH_CHECKS / health contracts
```

### Readiness data flow (after registration)

1. Request hits `GET /health/ready` (unchanged controller).
2. `HealthService.getReadiness()` loads registered checks (now includes `DatabaseHealthCheck`).
3. Checks run concurrently per #77; `DatabaseHealthCheck` adds no sequencing/ordering guarantees.
4. Throw/reject normalization from #77 still applies exclusively in `HealthService`.
5. Body includes `checks.database`; HTTP 200 or 503 from existing controller mapping.

## Testing

| Layer                      | Cases                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DatabaseHealthCheck` unit | `name === "database"`; `$queryRaw` resolves → `{ status: 'up' }`; `$queryRaw` rejects → promise rejects / throws (no local `down` mapping)                     |
| `HealthService`            | Existing #77 coverage already converts thrown/rejected checks to `down` — no requirement to re-prove aggregation unless a tiny regression assert is convenient |
| Nest wiring test           | Optional; registration is framework wiring, not business logic                                                                                                 |
| Out of scope               | Integration/DB live probe tests; Redis; Terminus; changing consumer defaults away from `/health` liveness; inventing k6/stress results                         |

## Documentation

No operational doc rewrite required. Optional thin note next to existing `/health/ready` mention that readiness may include a `database` check after this issue — only if a discoverability gap remains. Do not change CI / `wait-on` / Playwright defaults away from `/health`.

## Freeze / non-goals

- No changes to `GET /health` response shape or consumers.
- No controller/route edits.
- No Redis health check (#79).
- No Terminus / new health framework dependencies.
- No structured logging, correlation IDs, or metrics (#75 / #76 / #80).
- No EPIC-07 stress harness, results, or bottleneck contract changes.
- No `#134` CSS acceptance criteria work.
- No second `PrismaService` instance registered from `HealthModule`.

## Follow-on

| Issue         | Role after #78                                                                                                                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #79           | Introduce Redis probe **and** finalize Nest-native multi-check aggregation (registry service, factory assembling an array, dynamic module registration, or another Nest-idiomatic approach). Do **not** add a `useFactory` array solely to mimic Angular `multi` binding before that design. |
| #75–#76 / #80 | Separate logging / correlation / metrics track                                                                                                                                                                                                                                               |

For #78, `HEALTH_CHECKS` resolves to a single `HealthCheck`; `HealthService` already normalizes a single instance to an array. Multi-check aggregation will be finalized when additional checks (for example Redis in #79) are introduced.

## Definition of Done

- Implementation complete for #78 only (database probe + registry registration).
- `DatabaseHealthCheck` unit tests added and passing.
- ESLint and typecheck pass where applicable.
- No unrelated changes.
- Commit message follows `<type>: <MESSAGE>` (when committing is requested).
  )
