# #66 — Document technology trade-offs

**Date:** 2026-07-31  
**Issue:** [#66](https://github.com/rexescario-dev/flash-sale-system/issues/66)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `fa7cfb0` (#153 / #65 merged)

## Goal

Add `docs/technology-trade-offs.md` documenting the **rationale** behind major architectural decisions (modular monolith, PostgreSQL as source of truth, GraphQL, simplified demo identity), plus brief stack selection notes (NestJS, Prisma, React + Vite, PostgreSQL, Redis) that provide context for the four architectural decisions. Wire it from `docs/architecture.md`, and replace planned #66 references in `scalability-strategy.md` and `fault-tolerance-strategy.md` with live related-doc links. No README hub work (#73).

## Acceptance criteria (issue)

- [ ] Trade-offs cover monolith vs microservices, Postgres vs Redis truth, GraphQL vs REST, auth simplification

Satisfied by `docs/technology-trade-offs.md` covering those four axes under Core trade-offs, with a Decision summary table using shared terminology, brief Technology choices paragraphs, and a grounded Future evolution section that is explicitly not a roadmap.

## Approach

**Focused trade-offs doc (Approach 1):**

| Surface                                                        | Role                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `docs/technology-trade-offs.md`                                | Canonical architectural rationale / technology trade-offs             |
| `docs/architecture.md`                                         | Link under Related docs (alphabetical); hub only                      |
| `docs/scalability-strategy.md`                                 | Drop #66 from Planned; add live Related link; Non-goals → live doc    |
| `docs/fault-tolerance-strategy.md`                             | Drop #66 from Planned (omit empty Planned); Non-goals → live doc      |
| `README.md`                                                    | Unchanged (#73 owns hub assembly)                                     |
| Redis / concurrency / purchase / scalability / fault / testing | Unchanged; linked only                                                |
| Future runbooks                                                | Own Playwright / smoke execution guides (#69 / #70); not started here |

## Goals

- Meet #66 AC: document monolith vs microservices, Postgres vs Redis truth, GraphQL vs REST, and auth simplification as **decision rationale** for the current implementation.
- Complement EPIC-08 narrative: #61 shape → #62 purchase → #63 concurrency → #64 scale → #65 survive → **#66 why**.
- Keep “why” separate from operational “how” (#64 / #65) and implementation detail (Redis / concurrency / purchase / testing).

## Non-goals

- High-availability design (replicas, failover, multi-AZ, managed HA services).
- Operational runbooks (#69 / #70).
- Re-documenting Redis strategy, concurrency model, purchase sequence, scalability strategy, fault tolerance strategy, or testing strategy (those docs remain authoritative; link only).
- README expansion / final doc hub (#73).
- ADR pack under `docs/adr/` (different artifact; out of #66 scope).
- Inventing AuthN / OAuth / OIDC migration design beyond one production-replacement sentence.
- Speculative commitments (e.g. “we will add REST endpoints”) not grounded in existing docs.
- Application, schema, Compose, CI, or test-suite changes.
- Reopening #134 CSS AC; starting full #73, #71, or #74; EPIC-07-gated #71/#74 work.

## Ownership model

| Topic                                                              | Canonical owner                           |
| ------------------------------------------------------------------ | ----------------------------------------- |
| Architectural rationale, trade-offs, alternatives, and limitations | **#66 – `docs/technology-trade-offs.md`** |
| System shape + navigation hub                                      | **`architecture.md`**                     |
| Horizontal scalability topology                                    | **`scalability-strategy.md`**             |
| Failure modes, degradation, current timeout behavior               | **`fault-tolerance-strategy.md`**         |
| Redis architecture, cache responsibilities, fail-open matrix       | **`redis-caching-strategy.md`**           |
| Concurrency correctness, atomic reservation, unique purchase       | **`concurrency-model.md`**                |
| End-to-end purchase flow                                           | **`purchase-sequence.md`**                |
| Testing approach                                                   | **`testing-strategy.md`**                 |
| Final README as doc hub                                            | **#73**                                   |

**Conflict rule:** “Why we chose X” lives exclusively in `technology-trade-offs.md`. Other documents may reference this document but must not duplicate its trade-off essays.

**Hub maintenance rule:** Implemented docs move into **Related docs**; only future work remains under **Planned**. If Planned becomes empty, omit the section.

**Related-docs ordering rule:** `docs/technology-trade-offs.md`, `docs/scalability-strategy.md`, and `docs/fault-tolerance-strategy.md` order related documents by recommended reading flow. `docs/architecture.md` orders related documents alphabetically as the documentation hub. Do not “fix” one ordering to match the other.

## Design

### `docs/technology-trade-offs.md` shape

Document sections (reader order):

1. **Title** — `# Technology Trade-offs`

2. **Purpose** — Open with decision-rationale framing and an explicit scope boundary:

   > This document captures the major architectural decisions behind the current implementation and the trade-offs that motivated them. It explains _why_ these choices were made, not how the system behaves operationally.

   > **Scope:** This document explains the architectural decisions behind the current implementation. Operational behavior, scalability, fault tolerance, concurrency, and testing are documented separately and linked where relevant.

   Immediately link [Scalability strategy](scalability-strategy.md) and [Fault tolerance strategy](fault-tolerance-strategy.md) for operational detail.

3. **Decision summary** — compact table using shared terminology (Chosen column must match sibling wording):

   | Decision       | Chosen                        | Alternative considered     |
   | -------------- | ----------------------------- | -------------------------- |
   | Architecture   | Modular monolith              | Microservices              |
   | Persistence    | PostgreSQL as source of truth | Redis as primary store     |
   | API            | GraphQL                       | REST                       |
   | Authentication | Simplified demo identity      | Production-grade IdP/OAuth |

   Align phrases with existing docs: “Modular monolith” and “source of truth” / “system of record” from `architecture.md`; “Demo client identity” / browser-stored identity from `scalability-strategy.md`. Prefer **Simplified demo identity** in the Chosen column as the #66 label; prose may also say “demo client identity” when linking to scalability wording.

4. **Core trade-offs** (AC home) — four subsections of roughly similar length. Each follows: why chosen → benefits → trade-offs / limits → related docs or evolution pointer. Do **not** restate topology diagrams, fail-open matrices, reservation SQL, or purchase sequence steps.

   #### Modular monolith vs microservices
   - Why chosen for this flash-sale system (single deployable NestJS API, shared domain package, simpler consistency story).
   - Benefits: simpler local Compose demo, transactional purchase path without distributed sagas, faster iteration.
   - Trade-offs: shared deployable unit; scale is primarily horizontal API instances sharing Postgres/Redis (link [Scalability strategy](scalability-strategy.md)), not independent service scaling.
   - Evolution pointer: could be decomposed if operational complexity justifies it — implication only, not a commitment (see Future evolution).

   #### PostgreSQL as source of truth vs Redis as primary store
   - PostgreSQL guarantees inventory and purchase correctness (link [Concurrency model](concurrency-model.md) / [Purchase sequence](purchase-sequence.md) for mechanics — do not copy them).
   - Redis is acceleration / abuse protection only (link [Redis caching & rate-limit strategy](redis-caching-strategy.md)).
   - Failure implications: Postgres unavailable → requests fail; Redis unavailable → fail-open where applicable (link [Fault tolerance strategy](fault-tolerance-strategy.md)).
   - Do **not** copy the Redis fail-open table, keys, or TTLs.

   #### GraphQL vs REST
   - Why GraphQL fits: typed client/API contract for catalog + purchase operations; single API surface aligned with the modular monolith.
   - Downsides: caching complexity, tooling/learning cost, less familiar for some integrators.
   - Why acceptable here: small operation surface (`flashSales`, `flashSale`, `purchaseItem`, `myPurchase`, `myPurchases`); web client is the primary consumer.

   #### Simplified authentication (Option B)
   - **Current approach:** Demo identity is intentionally simplified. The browser persists a local user ID. The API accepts that caller-supplied identity for demonstration purposes. There are no sessions, JWTs, or external identity providers.
   - **Trade-off:** Keeps the implementation focused on flash-sale concurrency and consistency challenges. Is **not** suitable for production authentication.
   - **Related operational implication:** Until real authentication exists, rate limiting is enforced by client IP rather than authenticated user identity. Link [Redis caching & rate-limit strategy](redis-caching-strategy.md); do not restate the rate-limit matrix.
   - **Production note (one sentence only):** A production deployment would replace this simplified identity model with a proper authentication and authorization system.
   - Do **not** design OAuth/OIDC, sessions, or AuthN epic details.

5. **Technology choices (brief)** — one short paragraph each on **why selected**, not how they work:
   - NestJS — structured modular API host for GraphQL + infrastructure adapters.
   - Prisma — typed PostgreSQL access aligned with the system-of-record role.
   - React + Vite — sole frontend; fast local DX for the customer demo UI.
   - PostgreSQL — transactional source of truth for inventory and purchases.
   - Redis — non-authoritative cache and coordination where applicable.

   Keep each paragraph selection-rationale only. No tutorials, version matrices, or getting-started guides.

6. **Future evolution** — Open with an explicit non-roadmap sentence:

   > The following are implications of the current decisions, not a committed product or infrastructure roadmap.

   Then 3–6 bullets tightly bounded to existing documentation / current demo identity, for example:
   - Modular monolith could be decomposed into services if operational complexity justifies it (aligned with horizontal scale of the API in [Scalability strategy](scalability-strategy.md)).
   - PostgreSQL remains the source of truth; Redis deployment characteristics may evolve as availability needs change (see [Fault tolerance strategy](fault-tolerance-strategy.md) for current failure behavior — do not invent HA design here).
   - Simplified demo identity would be replaced by a proper authentication and authorization system when moving beyond the current demo scope.
   - The API layer can evolve if future integration requirements change, without committing to a specific integration style.

7. **Non-goals** — HA/replicas/failover design; runbooks (#69/#70); duplication of sibling strategy docs; README hub (#73); ADR pack; inventing AuthN/OIDC migration design; code/Compose/CI changes.

8. **Related documentation** — reader progression order (not alphabetical):

   - [System architecture](architecture.md)
   - [Scalability strategy](scalability-strategy.md)
   - [Fault tolerance strategy](fault-tolerance-strategy.md)
   - [Redis caching & rate-limit strategy](redis-caching-strategy.md)
   - [Concurrency model](concurrency-model.md)
   - [Purchase sequence](purchase-sequence.md)
   - [Local development](local-development.md)
   - [Testing strategy](testing-strategy.md)

   No **Planned work** section once #66 ships (this doc is the rationale leaf; runbooks are not “planned” from this doc’s ownership).

### Architecture hub update

In `docs/architecture.md`:

**Related docs** — alphabetical by title, all live files (add Technology trade-offs):

- [Concurrency model](concurrency-model.md)
- [Fault tolerance strategy](fault-tolerance-strategy.md)
- [Local development](local-development.md)
- [Purchase sequence](purchase-sequence.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Scalability strategy](scalability-strategy.md)
- [Technology trade-offs](technology-trade-offs.md)
- [Testing strategy](testing-strategy.md)

`README.md` unchanged.

### Scalability strategy sibling update

In `docs/scalability-strategy.md`:

1. **Related documentation** — add a live link to [Technology trade-offs](technology-trade-offs.md) immediately after [Fault tolerance strategy](fault-tolerance-strategy.md), so readers encounter the architectural rationale after the scalability and fault-tolerance strategy documents.
2. **Planned work** — remove “Issue #66 — Technology / architecture trade-offs”. If Planned becomes empty, omit the **Planned work** section.
3. **Non-goals** — replace the Issue #66 trade-offs bullet with a link to the live doc, e.g. `Architectural rationale, alternatives, or scaling-limitation essays ([Technology trade-offs](technology-trade-offs.md))`.

### Fault tolerance strategy sibling update

In `docs/fault-tolerance-strategy.md`:

1. **Related documentation** — add a live link to [Technology trade-offs](technology-trade-offs.md) after [Scalability strategy](scalability-strategy.md) (reader order: shape → scale → why → redis/concurrency/purchase → local). Concrete order:

   - [System architecture](architecture.md)
   - [Scalability strategy](scalability-strategy.md)
   - [Technology trade-offs](technology-trade-offs.md)
   - [Redis caching & rate-limit strategy](redis-caching-strategy.md)
   - [Concurrency model](concurrency-model.md)
   - [Purchase sequence](purchase-sequence.md)
   - [Local development](local-development.md)

2. **Planned work** — remove Issue #66; omit the **Planned work** section if empty.
3. **Non-goals** — replace the Issue #66 trade-off essay bullet with a link to the live doc.

## Boundary with siblings

| Doc / issue               | Owns                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| #66 Technology trade-offs | Why the architecture, persistence model, API style, authentication approach, and stack were chosen |
| #64 Scalability strategy  | How the app scales horizontally; LB + stateless API topology; shared infra at strategy level       |
| #65 Fault tolerance       | What happens when parts of the #64 topology fail (current behavior)                                |
| Redis strategy            | Cache / rate-limit implementation detail and fail-open matrix                                      |
| Concurrency model         | Purchase correctness under concurrency                                                             |
| Purchase sequence         | End-to-end purchase request lifecycle                                                              |
| Architecture              | System shape + navigation hub                                                                      |
| Testing strategy          | What/how we test                                                                                   |

## Out of scope

- Creating runbook docs (#69 / #70)
- Edits to Redis / concurrency / purchase-sequence / testing bodies beyond inbound links from the new doc (and the scalability/fault-tolerance Planned→Related flip)
- Code, schema, Compose, CI, or test changes
- New automated tests for documentation
- README changes
- Reopening #134; starting full #73 / #71 / #74

## Verification

Docs-only checklist:

1. Four AC axes present under Core trade-offs (monolith vs microservices, Postgres vs Redis truth, GraphQL vs REST, auth simplification).
2. Decision summary table uses shared terminology: Modular monolith; PostgreSQL as source of truth; GraphQL; Simplified demo identity.
3. **Cross-document consistency:** Terminology for the four decisions matches wording used in `architecture.md`, `scalability-strategy.md`, and `fault-tolerance-strategy.md`; no conflicting descriptions are introduced.
4. Purpose includes scope/boundary sentence and links to scalability + fault-tolerance docs.
5. Auth section follows Option B (demo identity + IP rate-limit one-liner + one production-replacement sentence; no OAuth/OIDC design).
6. Technology choices = five short rationale entries; no tutorials.
7. Future evolution opens with explicit not-a-roadmap sentence; bullets grounded in #64/#65/demo identity only.
8. No duplication of Redis matrix, concurrency SQL, purchase steps, scale topology diagram, failure-mode essays, or testing strategy.
9. `architecture.md` Related docs alphabetical and includes technology-trade-offs; README unchanged.
10. `scalability-strategy.md` and `fault-tolerance-strategy.md` have live Related links; #66 removed from Planned; empty Planned sections omitted; Non-goals point at the live doc.
11. Links resolve without introducing circular ownership or duplicated rationale.
12. Prettier (or repo format check) on touched markdown only.

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #66 AC satisfied via `docs/technology-trade-offs.md`.
- Architecture hub links the live trade-offs doc.
- Bidirectional navigation with `scalability-strategy.md` and `fault-tolerance-strategy.md`.
- Clear separation from Redis, concurrency, purchase sequence, scalability, fault tolerance, testing, and runbooks.
- No commit until explicitly requested.
- Documentation describes decision rationale for the current architecture only.
