# #65 — Document fault tolerance strategy

**Date:** 2026-07-31  
**Issue:** [#65](https://github.com/rexescario-dev/flash-sale-system/issues/65)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `742d9bd` (#152 / #64 merged)

## Goal

Add `docs/fault-tolerance-strategy.md` documenting the **current** failure behavior for Redis, API, PostgreSQL, and timeout handling within the topology documented in `scalability-strategy.md`. Wire it from `docs/architecture.md`, and replace the planned #65 reference in `scalability-strategy.md` with a live related-doc link. No README hub work (#73).

## Acceptance criteria (issue)

- [ ] Redis, API, Postgres, and timeout failure modes are documented

Satisfied by `docs/fault-tolerance-strategy.md` covering those four modes as current implemented behavior, with Redis fail-open summarized by reference to `redis-caching-strategy.md`, API dual-honesty between Compose and the documented horizontal topology, PostgreSQL request failure semantics (`INTERNAL_SERVER_ERROR`) and availability SPOF, and the current timeout behavior.

## Approach

**Focused failure-behavior doc (Approach 1):**

| Surface                                                       | Role                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `docs/fault-tolerance-strategy.md`                            | Canonical fault-tolerance and failure-behavior strategy               |
| `docs/architecture.md`                                        | Link under Related docs (alphabetical); hub only                      |
| `docs/scalability-strategy.md`                                | Drop #65 from Planned; add live Related link (bidirectional)          |
| `README.md`                                                   | Unchanged (#73 owns hub assembly)                                     |
| Redis / concurrency / purchase / scalability / testing bodies | Unchanged; linked only                                                |
| Future trade-offs                                             | Owns “why” / alternatives; referenced by issue number until it exists |
| Future runbooks                                               | Own Playwright / smoke execution guides; not started here             |

## Goals

- Meet #65 AC: document Redis, API, Postgres, and timeout failure modes as **current** behavior.
- Build on the documented scalability topology by reference; do not redraw or re-own the load-balancer diagram.

## Non-goals

- High-availability design (replicas, failover, multi-AZ, managed HA services).
- Operational runbooks (#69 / #70).
- Architectural rationale or alternatives essay (#66).
- Re-documenting Redis strategy, concurrency model, purchase sequence, scalability strategy, and testing documentation (those docs remain authoritative; link only).
- README expansion / final doc hub (#73).
- Inventing application timeout, retry, or circuit-breaker policy that does not exist.
- Application, schema, Compose, CI, or test-suite changes.
- Reopening #134 CSS AC; starting full #73, #71, or #74; EPIC-07-gated #71/#74 work.

## Ownership model

| Topic                                                        | Canonical owner                              |
| ------------------------------------------------------------ | -------------------------------------------- |
| Failure modes, degradation, current timeout behavior         | **#65 – `docs/fault-tolerance-strategy.md`** |
| Horizontal scalability topology                              | **`scalability-strategy.md`**                |
| Redis architecture, cache responsibilities, fail-open matrix | **`redis-caching-strategy.md`**              |
| Concurrency correctness, atomic reservation, unique purchase | **`concurrency-model.md`**                   |
| End-to-end purchase flow                                     | **`purchase-sequence.md`**                   |
| Architectural rationale, alternatives, limitations           | **#66 – Trade-offs**                         |
| System shape + navigation hub                                | **`architecture.md`**                        |
| Final README as doc hub                                      | **#73**                                      |

**Conflict rule:** Failure behavior is owned exclusively by `fault-tolerance-strategy.md`. Other documents may reference this document but must not duplicate its owned behavior (Redis fail-open behavior, timeout behavior, API degradation semantics, PostgreSQL availability notes).

**Hub maintenance rule:** Implemented docs move into **Related docs**; only future work remains under **Planned**.

**Related-docs ordering rule:** `docs/fault-tolerance-strategy.md` and `docs/scalability-strategy.md` order related documents by recommended reading flow. `docs/architecture.md` orders related documents alphabetically as the documentation hub. Do not “fix” one ordering to match the other.

## Design

### `docs/fault-tolerance-strategy.md` shape

Document sections (reader order):

1. **Title** — `# Fault Tolerance Strategy`

2. **Purpose** — Open with an explicit current-behavior distinction:

   > Describes the current fault-tolerance and degradation behavior of the system within the topology documented by [Scalability strategy](scalability-strategy.md). This document reflects implemented behavior only; it is not a high-availability, operational runbook, or future platform design.

3. **Failure modes** (AC home)

   #### Redis

   > Redis is a non-authoritative performance optimization. When Redis is unavailable or Redis operations fail, the application follows the canonical fail-open caching strategy so requests continue against PostgreSQL where possible. See [Redis caching & rate-limit strategy](redis-caching-strategy.md) for the complete behavior matrix and operational details.

   Do **not** copy the fail-open table, event names list, keys, or TTLs.

   #### API process failure
   - **Current repository deployment (Compose):** A single API process. If the process exits or becomes unavailable, requests fail until the process is restarted.
   - **Horizontal deployment** (see [Scalability strategy](scalability-strategy.md)): When multiple stateless API instances run behind a load balancer, failure of a single instance reduces capacity but does not make the service unavailable as long as healthy instances remain.

   Do **not** redraw the full Clients → LB → API × N → Postgres/Redis diagram; link #64.

   #### PostgreSQL failure

   Reader order:

   1. **Role** — PostgreSQL is the authoritative system of record and a shared dependency.
   2. **Failure behavior** — If PostgreSQL is unavailable or returns unexpected errors, affected requests fail; unexpected database failures surface as GraphQL `INTERNAL_SERVER_ERROR`.
   3. **Current implementation** — No application-level retry, circuit breaker, or database timeout policy is implemented.
   4. **Availability note** — In the topology documented by [Scalability strategy](scalability-strategy.md), the shared PostgreSQL instance is an availability single point of failure.
   5. **Cross-reference** — Link [Concurrency model](concurrency-model.md) and [Purchase sequence](purchase-sequence.md) for transactional correctness and reservation flow. Do not restate reservation SQL or sequence steps.

   #### Timeout behavior
   - **API:** No application request timeout; requests continue until completed or terminated by the client or surrounding infrastructure.
   - **Redis:** Redis client operations fail quickly under the current client configuration, after which the application follows the fail-open caching strategy (link Redis strategy). Configuration values (`maxRetriesPerRequest: 1`, `enableOfflineQueue: false`) may appear in a brief parenthetical or note, not as architectural policy.
   - **PostgreSQL:** No application-enforced query timeout; blocked or long-running operations remain pending until the database, infrastructure, or client terminates them. Unexpected database failures surface as GraphQL `INTERNAL_SERVER_ERROR`.

4. **Health endpoint**

   `GET /health` returns `{ "status": "ok" }` and reports **process liveness only; it is not a readiness or dependency-health endpoint**. It does not probe PostgreSQL or Redis.

5. **Non-goals** — HA/replicas/failover; runbooks (#69/#70); trade-offs (#66); duplication of sibling strategy docs; README hub (#73); inventing timeout/retry/circuit-breaker policy; code/Compose/CI changes.

6. **Related documentation** — reader progression order (not alphabetical):

   - [System architecture](architecture.md)
   - [Scalability strategy](scalability-strategy.md)
   - [Redis caching & rate-limit strategy](redis-caching-strategy.md)
   - [Concurrency model](concurrency-model.md)
   - [Purchase sequence](purchase-sequence.md)
   - [Local development](local-development.md)

   **Planned work** (issue numbers only — not markdown file links):

   - Issue #66 — Technology / architecture trade-offs

### Architecture hub update

In `docs/architecture.md`:

**Related docs** — alphabetical by title, all live files (add Fault tolerance strategy):

- [Concurrency model](concurrency-model.md)
- [Fault tolerance strategy](fault-tolerance-strategy.md)
- [Local development](local-development.md)
- [Purchase sequence](purchase-sequence.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Scalability strategy](scalability-strategy.md)
- [Testing strategy](testing-strategy.md)

`README.md` unchanged.

### Scalability strategy sibling update

In `docs/scalability-strategy.md`:

1. **Related documentation** — add a live link to [Fault tolerance strategy](fault-tolerance-strategy.md) immediately after [System architecture](architecture.md) (reader order: topology → survive).
2. **Planned work** — remove “Issue #65 — Fault tolerance strategy”; leave only Issue #66.
3. **Non-goals** — replace the “Fault tolerance, degradation, retries, or recovery (Issue #65)” bullet with a link to the live doc, e.g. `Fault tolerance, degradation, retries, or recovery ([Fault tolerance strategy](fault-tolerance-strategy.md))`, so #65 is no longer framed as future work.

## Boundary with siblings

| Doc / issue              | Owns                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| #65 Fault tolerance      | What happens when parts of the #64 topology fail (current behavior)                          |
| #64 Scalability strategy | How the app scales horizontally; LB + stateless API topology; shared infra at strategy level |
| #66 Trade-offs           | Why this topology / stack was chosen vs alternatives                                         |
| Redis strategy           | Cache / rate-limit implementation detail and fail-open matrix                                |
| Concurrency model        | Purchase correctness under concurrency                                                       |
| Purchase sequence        | End-to-end purchase request lifecycle                                                        |
| Architecture             | System shape + navigation hub                                                                |

## Out of scope

- Creating trade-offs or runbook docs (#66 / #69 / #70)
- Edits to Redis / concurrency / purchase-sequence / testing bodies beyond inbound links from the new doc (and the scalability Planned→Related flip)
- Code, schema, Compose, CI, or test changes
- New automated tests for documentation
- README changes
- Reopening #134; starting full #73 / #71 / #74

## Verification

Docs-only checklist:

1. Redis, API, Postgres, and timeout failure modes are present (AC).
2. Redis section is a short fail-open summary + link; no fail-open table / event matrix copy.
3. API section states Compose single-process unavailability and #64 multi-instance capacity-loss semantics; no full topology redraw.
4. Postgres section covers SoR, `INTERNAL_SERVER_ERROR`, no retry/circuit-breaker/DB timeout, availability SPOF, and links concurrency + purchase-sequence.
5. Timeout section documents current absence of application request/DB timeouts; Redis “fail quickly” is framed as client configuration, not dual-owned policy.
6. Health section states process liveness only; not readiness or dependency health.
7. `architecture.md` Related docs alphabetical and includes fault-tolerance-strategy; README unchanged.
8. `scalability-strategy.md` has a live Related link to fault tolerance and no longer lists #65 under Planned.
9. No section invents HA, runbooks, or unimplemented retry/timeout/circuit-breaker policy.
10. Links resolve without introducing circular ownership or duplicated behavioral descriptions.
11. Prettier (or repo format check) on touched markdown only.

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #65 AC satisfied via `docs/fault-tolerance-strategy.md`.
- Architecture hub links the live fault-tolerance doc.
- Bidirectional navigation with `scalability-strategy.md`.
- Clear separation from Redis, concurrency, purchase sequence, scalability, testing, #66, and runbooks.
- Documentation describes current implemented behavior only; no commit until explicitly requested.
