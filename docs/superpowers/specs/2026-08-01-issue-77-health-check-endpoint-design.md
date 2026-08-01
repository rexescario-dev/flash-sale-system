# #77 — Add health check endpoint (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-08-01
**Issue:** [#77](https://github.com/rexescario-dev/flash-sale-system/issues/77) — Add health check endpoint
**Epic:** [#89](https://github.com/rexescario-dev/flash-sale-system/issues/89) (EPIC-09 — Observability & Operational Readiness)
**Sibling issues:** [#78](https://github.com/rexescario-dev/flash-sale-system/issues/78) (database health), [#79](https://github.com/rexescario-dev/flash-sale-system/issues/79) (Redis health), [#75](https://github.com/rexescario-dev/flash-sale-system/issues/75)–[#76](https://github.com/rexescario-dev/flash-sale-system/issues/76)/[#80](https://github.com/rexescario-dev/flash-sale-system/issues/80) (logging/metrics — separate track)
**Depends on:** [#2](https://github.com/rexescario-dev/flash-sale-system/issues/2) (existing Nest API + `/health` stub on `main`)
**Repository:** `rexescario-dev/flash-sale-system`

## Goal

Evolve the existing REST health surface so the API exposes **liveness** and **readiness** independently of GraphQL, with a small injectable check registry that #78 and #79 can extend without route or controller changes.

## Acceptance criteria

GitHub AC: **Health endpoint reports process liveness/readiness independently of GraphQL.**

Satisfied when:

1. `GET /health` continues to report process liveness with its frozen response shape and HTTP 200 after Nest bootstrap.
2. `GET /health/ready` reports readiness independently of GraphQL, with a stable `{ status, checks }` body.
3. Ready once Nest application bootstrap has completed successfully: with no registered checks, readiness returns HTTP 200 and `{ "status": "ok", "checks": {} }`.
4. A custom injectable check registry exists so later issues can register readiness checks without changing routes or the controller.
5. Health remains REST-only (not a GraphQL field).
6. Existing `/health` consumers (README, Compose verify, CI `wait-on`, Playwright, GraphQL integration tests) require no changes.
7. No database or Redis probe implementations land in this issue.

## Approach

**Custom health module + injectable check registry (Approach 1):**

| Surface                                              | Role after #77                                                |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `GET /health`                                        | Frozen liveness for existing tooling                          |
| `GET /health/ready`                                  | Readiness contract + empty `checks` map until probes register |
| `HealthCheck` port + `HEALTH_CHECKS` injection token | Extension seam for #78 / #79                                  |
| `HealthService`                                      | Aggregation and status mapping                                |
| `HealthController`                                   | HTTP mapping only                                             |

**Rejected alternatives:**

| Alternative                      | Why rejected                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `@nestjs/terminus`               | New dependency; response shape needs adaptation; overkill for two future checks |
| Dual routes without registry     | Pushes extension design into #78; #77 owns the Health-track seam                |
| Collapse #78/#79 into #77        | Violates epic decomposition; larger blast radius                                |
| `/health/live` + `/health` alias | Extra route with no current consumer need                                       |

## Locked decisions

| Area                          | Decision                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approach                      | Custom `HealthModule` + injectable check registry (no Terminus)                                                                                                         |
| Liveness route                | `GET /health` — response shape intentionally frozen for backward compatibility                                                                                          |
| Liveness body                 | `{ "status": "ok" }` only; no `checks`, no dependency probes                                                                                                            |
| Readiness route               | `GET /health/ready`                                                                                                                                                     |
| Readiness lifecycle           | Ready once Nest application bootstrap has completed successfully                                                                                                        |
| Readiness body (#77)          | `{ "status": "ok", "checks": {} }` when no checks are registered                                                                                                        |
| `checks` type                 | Object map check name → status string (`Record<string, string>`)                                                                                                        |
| Top-level status vocabulary   | `#77` defines `ok` and `error` only; no `degraded` or other values                                                                                                      |
| Check status success sentinel | Aggregation treats `status === "up"` as success; any other string is failure                                                                                            |
| Check status vocabulary       | #77 reserves the probe status vocabulary by normalizing thrown/rejected checks to `{ status: "down" }`; #78/#79 use the same vocabulary (`up` / `down`) for real probes |
| Aggregation                   | Readiness is `ok` iff every registered check reports `up`; empty registry is healthy                                                                                    |
| Execution                     | Execute all checks concurrently (for example by wrapping each check and awaiting them together), ensuring every check contributes a result even if one throws           |
| Failure HTTP                  | One or more registered checks report a status other than `"up"` → body `status: "error"` and HTTP **503**                                                               |
| GraphQL                       | Health stays REST-only                                                                                                                                                  |
| Consumers                     | No changes to existing `/health` consumers or their default URLs                                                                                                        |
| Probes                        | DB (#78) / Redis (#79) register checks only; no controller/route edits                                                                                                  |
| Out of slice                  | Probe implementations; Terminus; structured logging/metrics (#75/#76/#80); EPIC-07 stress contracts; `#134` CSS AC                                                      |

## HTTP contract

| Route               | Role      | Success                                     | Failure                                                                                                             |
| ------------------- | --------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /health`       | Liveness  | `200` `{ "status": "ok" }`                  | N/A after Nest bootstrap                                                                                            |
| `GET /health/ready` | Readiness | `200` `{ "status": "ok", "checks": { … } }` | `503` `{ "status": "error", "checks": { … } }` when one or more registered checks report a status other than `"up"` |

**Examples (#77):**

```json
// GET /health
{ "status": "ok" }
```

```json
// GET /health/ready (empty registry)
{ "status": "ok", "checks": {} }
```

**Future shape (after #78/#79 register checks — illustrative only):**

```json
{
  "status": "ok",
  "checks": {
    "database": "up",
    "redis": "up"
  }
}
```

## Components

Stay under `apps/api/src/health/`, following the repo’s Symbol-token + `@Inject` pattern.

| Unit                            | Responsibility                                                                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HealthCheckResult`             | `{ status: string }` — port result object (allows later metadata without changing callers)                                                                                                                            |
| `HealthCheck`                   | `readonly name: string`; `check(): Promise<HealthCheckResult>`                                                                                                                                                        |
| `HEALTH_CHECKS` injection token | Provides an optional collection of registered `HealthCheck` implementations. When none are registered, the service treats the collection as empty.                                                                    |
| `HealthService`                 | `getLiveness()` → frozen `{ status: 'ok' }`. `getReadiness()` → execute all checks concurrently (wrapping each so every check contributes a result even if one throws), build `checks`, set top-level `ok` / `error`. |
| `HealthController`              | Contains no health evaluation logic; delegates entirely to `HealthService` and maps the returned top-level status to the HTTP status code (`ok` → 200, `error` → 503).                                                |
| `HealthModule`                  | Wires controller + service. Does not register `HEALTH_CHECKS` providers in #77 (optional inject ⇒ empty collection). Does **not** import Prisma/Redis.                                                                |

### Readiness data flow

1. Request hits `GET /health/ready`.
2. Controller calls `HealthService.getReadiness()`.
3. Service loads the registered check collection (empty in #77).
4. Service executes all checks concurrently (wrapping each so every check contributes a result even if one throws) and aggregates results.
5. Service returns `{ status, checks }`.
6. Controller maps `status` to HTTP 200 or 503.

### Aggregation and error normalization

- Readiness is `ok` iff every registered check reports `up`. An empty registry is considered healthy.
- Aggregation is best-effort: every registered check is awaited and contributes to the final response, even if another check fails or throws.
- If a check throws or rejects, the service records that check as `{ status: "down" }`, continues aggregating the remaining checks, and returns the aggregated readiness response.
- #77 demonstrates the throw/reject normalization path with a test double (no real DB/Redis probe).

## Testing

| Layer                | Cases                                                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HealthService` unit | Liveness frozen shape; empty registry → `{ status: 'ok', checks: {} }`; fake checks → aggregation (`ok` vs `error`); thrown/rejected check still yields aggregated response              |
| Controller / HTTP    | `GET /health` → **200** + frozen body; `GET /health/ready` (empty registry) → **200** + `{ status: 'ok', checks: {} }`; `GET /health/ready` (failed check) → **503** + `status: "error"` |
| Out of scope         | Prisma/Redis integration tests (belong to #78/#79)                                                                                                                                       |

Existing GraphQL/integration asserts against `GET /health` must remain green without consumer edits.

## Documentation

Document the existence and purpose of `GET /health/ready`; do not rewrite operational or deployment documentation.

- Thin mention beside existing `/health` guidance is enough.
- Do **not** change CI / `wait-on` / Playwright defaults away from `/health`.
- No EPIC-07 stress documentation changes.

## Freeze / non-goals

- No changes to existing `/health` consumers.
- No change to `GET /health` response shape.
- No database or Redis probe implementations (#78 / #79).
- No GraphQL health field.
- No Terminus / new health framework dependencies.
- No structured logging, correlation IDs, or metrics (#75 / #76 / #80).
- No EPIC-07 stress harness, results, or bottleneck contract changes.
- No `#134` CSS acceptance criteria work.

## Follow-on issues

| Issue         | Role after #77                                                                          |
| ------------- | --------------------------------------------------------------------------------------- |
| #78           | Register `DatabaseHealthCheck` using the reserved `up` / `down` check status vocabulary |
| #79           | Register `RedisHealthCheck` without failing purchases incorrectly                       |
| #75–#76 / #80 | Separate logging / correlation / metrics track                                          |

## Definition of Done

- Implementation complete for #77 only (liveness + readiness + registry seam).
- Relevant unit/controller tests added or updated and passing, including HTTP **200** / **503** assertions above.
- ESLint and typecheck pass where applicable.
- Thin docs mention for `/health/ready` only if needed for discoverability.
- No unrelated changes.
- Commit message follows `<type>: <MESSAGE>` (when committing is requested).
