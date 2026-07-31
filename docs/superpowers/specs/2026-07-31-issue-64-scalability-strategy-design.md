# #64 — Document scalability strategy

**Date:** 2026-07-31  
**Issue:** [#64](https://github.com/rexescario-dev/flash-sale-system/issues/64)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `24e9bb9` (#151 merged; includes #62 / `809c632`)

## Goal

Add a focused scalability-strategy document — `docs/scalability-strategy.md` — that explains **how the application is intended to scale horizontally** (stateless NestJS API instances behind a load balancer, sharing PostgreSQL and Redis), and wire it into the architecture hub. The doc must distinguish the intended deployment architecture from the single-API Compose demo, must not duplicate Redis / concurrency / purchase-sequence detail, and must not expand the README into a documentation hub (#73).

## Acceptance criteria (issue)

- [ ] Docs describe stateless API instances behind a load balancer

Satisfied by `docs/scalability-strategy.md` with a conceptual Mermaid production topology (load balancer → multiple identical NestJS API instances → shared PostgreSQL + Redis) plus an explicit honesty note that local Compose runs one API instance and does not provision a load balancer.

## Approach

**Focused strategy doc (Approach 1):**

| Surface                        | Role                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `docs/scalability-strategy.md` | **Canonical** horizontal-scaling / deployment strategy (Compose reality, conceptual LB topology, why API is stateless) |
| `docs/architecture.md`         | Link the new doc under Related docs; hub only — not a second source of truth                                           |
| `README.md`                    | Unchanged (#73 owns hub assembly)                                                                                      |
| Redis / concurrency / purchase | Unchanged; linked only (one-sentence shared-infra summary + defer)                                                     |
| Future fault tolerance (#65)   | Builds on this topology; referenced by issue number until it exists                                                    |
| Future trade-offs (#66)        | Owns “why” / alternatives; referenced by issue number until it exists                                                  |

## Goals

- Meet #64 AC: document stateless API instances behind a load balancer as the intended deployment architecture.
- Stay honest: Compose ships a single API container for local/demo; no invented HA platform (Kubernetes, ECS, Swarm, etc.).
- Describe PostgreSQL and Redis as **shared infrastructure dependencies**, not implementation guides.
- Prefer a lean doc #73 can later index.
- Preserve the EPIC-08 narrative: #61 shape → #62 purchase flow → #63 correctness → **#64 scale** → #65 survive → #66 why.

## Non-goals

- Fault tolerance, degradation, retries, recovery (#65).
- Architectural rationale, alternatives, scaling limitations essay (#66).
- Redis keys, TTLs, rate-limit algorithm, fail-open detail (`redis-caching-strategy.md`).
- Concurrency guarantees / reservation SQL (`concurrency-model.md`).
- End-to-end purchase request lifecycle (`purchase-sequence.md`).
- AuthN / sticky-session / identity deep-dives.
- Prescribing a specific production platform or shipping multi-instance Compose / K8s manifests.
- README expansion / final doc hub (#73).
- Application, schema, Compose, CI, or test-suite changes.
- Reopening #134 CSS AC; starting #69/#70 runbooks, #71/#74, or EPIC-07 work.

## Ownership model

| Topic                                                                   | Canonical owner                          |
| ----------------------------------------------------------------------- | ---------------------------------------- |
| Horizontal scaling, stateless API, load balancer topology               | **#64 – `docs/scalability-strategy.md`** |
| Redis architecture, cache responsibilities, key strategy                | **`redis-caching-strategy.md`**          |
| Concurrency correctness, atomic reservation, unique purchase constraint | **`concurrency-model.md`**               |
| End-to-end purchase flow                                                | **`purchase-sequence.md`**               |
| Failure handling, degradation, recovery                                 | **#65 – Fault tolerance**                |
| Architectural rationale, alternatives, limitations                      | **#66 – Trade-offs**                     |
| System shape + navigation hub                                           | **`architecture.md`**                    |
| Final README as doc hub                                                 | **#73**                                  |

**Conflict rule:** Horizontal scale / LB / stateless API detail lives in `docs/scalability-strategy.md`. Architecture may only link it. Redis, concurrency, and purchase-sequence docs must not re-own the deployment topology. #65/#66 may reference this topology without redefining it.

**Hub maintenance rule:** Implemented docs move into **Related docs**; only future work remains under **Planned**.

**Related-docs ordering rule:** `docs/scalability-strategy.md` orders related documents by recommended reading flow. `docs/architecture.md` orders related documents alphabetically as the documentation hub. Do not “fix” one ordering to match the other.

## Design

### `docs/scalability-strategy.md` shape

Document sections (reader order):

1. **Title** — `# Scalability Strategy`

2. **Purpose** — Open with an explicit strategy-vs-tooling distinction:

   > This document describes the application's horizontal scalability strategy. It explains the intended deployment architecture rather than prescribing a specific production platform.

3. **Local deployment today** — Compose provisions **one** NestJS API container for local development and demonstration. Honesty note (verbatim):

   > The repository's local Docker Compose environment intentionally deploys a single API instance and does not provision a load balancer. The scalability model below describes the application's deployment architecture, not the local development topology.

4. **Scalability model** — Architectural properties only:
   - Stateless NestJS API instances
   - Shared PostgreSQL as the system of record
   - Shared Redis deployment for cross-instance cache and coordination where applicable
   - Requests may be served by any API instance

5. **Conceptual production topology** (AC home) — One Mermaid diagram with API instances grouped in a subgraph:

   ```mermaid
   flowchart TB
     Clients["Clients"]
     LB["Load balancer"]

     subgraph API["Stateless NestJS API instances"]
       API1["API #1"]
       API2["API #2"]
       API3["API #3"]
     end

     PG["PostgreSQL<br/>(system of record)"]
     Redis["Redis<br/>(shared cache / coordination)"]

     Clients --> LB
     LB --> API1
     LB --> API2
     LB --> API3

     API1 --> PG
     API2 --> PG
     API3 --> PG

     API1 --> Redis
     API2 --> Redis
     API3 --> Redis
   ```

   Caption (plain prose, not bold): Conceptual production deployment topology. Local Docker Compose intentionally runs a single API instance without a load balancer.

6. **Why the API is stateless** — Three bullets only:
   - No in-memory / server-side user sessions for request routing.
   - No affinity (“sticky sessions”) required.
   - Any instance can serve any request.

   Do **not** expand into authentication design. Client-side demo identity may be mentioned in one short clause if needed for honesty, then stop.

7. **Shared infrastructure dependencies** — Strategy-level only:

   > All API instances share the same PostgreSQL database and Redis deployment. Because application state is not stored in individual API processes, any instance can handle any request.
   - PostgreSQL: system of record (link concurrency / purchase sequence as needed).
   - Redis: shared cache / coordination where applicable (link Redis strategy).
   - Avoid transactions, locking, Redis keys, TTLs, reservation logic, or sequence steps here.

8. **Non-goals** — Fault tolerance (#65); trade-offs (#66); Redis/concurrency/purchase-sequence detail; README hub (#73); inventing HA Compose/K8s manifests.

9. **Related documentation** — reader progression order (not alphabetical):

   - [System architecture](architecture.md)
   - [Concurrency model](concurrency-model.md)
   - [Purchase sequence](purchase-sequence.md)
   - [Redis caching & rate-limit strategy](redis-caching-strategy.md)
   - [Local development](local-development.md)

   **Planned work** (issue numbers only — not markdown file links):

   - Issue #65 — Fault tolerance strategy
   - Issue #66 — Technology / architecture trade-offs

### Architecture hub update

In `docs/architecture.md`:

**Related docs** — alphabetical by title, all live files (add Scalability strategy):

- [Concurrency model](concurrency-model.md)
- [Local development](local-development.md)
- [Purchase sequence](purchase-sequence.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Scalability strategy](scalability-strategy.md)
- [Testing strategy](testing-strategy.md)

**Planned architecture documentation** contains only documents that have not yet been implemented. Do **not** add #64 once shipped. #65/#66 stay as future pointers inside `scalability-strategy.md` (and later their own docs), not as architecture Planned entries unless they become architecture-hub docs.

`README.md` unchanged.

### Diagram medium

Mermaid fenced block in markdown (GitHub-native). No committed PNG/SVG. Subgraph groups the API instances so horizontal scaling is visually obvious.

## Boundary with siblings

| Doc / issue              | Owns                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| #64 Scalability strategy | How the app scales horizontally; LB + stateless API topology; shared infra at strategy level |
| #65 Fault tolerance      | What happens when parts of this topology fail                                                |
| #66 Trade-offs           | Why this topology / stack was chosen vs alternatives                                         |
| Redis strategy           | Cache / rate-limit implementation detail                                                     |
| Concurrency model        | Purchase correctness under concurrency                                                       |
| Purchase sequence        | End-to-end purchase request lifecycle                                                        |
| Architecture             | System shape + navigation hub                                                                |

## Out of scope

- Creating fault-tolerance or trade-offs docs (#65 / #66)
- Edits to Redis / concurrency / purchase-sequence bodies beyond inbound links from the new doc
- Code, schema, Compose, CI, or test changes
- New automated tests for documentation
- README changes

## Verification

Docs-only checklist:

1. Mermaid shows Clients → Load balancer → multiple API instances → shared PostgreSQL + Redis (AC).
2. Honesty note states Compose is single-API and has no load balancer.
3. Purpose sentence distinguishes strategy from prescribing a production platform.
4. Shared infra section stays at dependency level (no Redis keys/TTLs, no reservation SQL).
5. No duplication of Redis strategy, concurrency model, or purchase sequence beyond one-sentence summaries + links.
6. `architecture.md` Related docs alphabetical and includes scalability-strategy; README unchanged.
7. Planned pointers for #65/#66 use issue numbers only until those docs exist.
8. No section prescribes Kubernetes, ECS, Docker Swarm, or any specific production deployment platform.
9. Prettier (or repo format check) on touched markdown only.

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #64 AC satisfied via `docs/scalability-strategy.md`.
- Architecture hub links the live scalability doc.
- Clear separation from Redis, concurrency, purchase sequence, #65, and #66.
- Documentation clearly distinguishes the intended production scalability model from the current single-instance Docker Compose development environment; no commit until explicitly requested.
