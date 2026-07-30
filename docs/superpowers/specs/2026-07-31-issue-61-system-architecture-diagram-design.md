# #61 — Create system architecture diagram

**Date:** 2026-07-31  
**Issue:** [#61](https://github.com/rexescario-dev/flash-sale-system/issues/61)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `7de8cd0` (#67 via PR #146)

## Goal

Add a focused architecture entry point — `docs/architecture.md` — that shows how the current system is shaped (React → GraphQL → Nest → Postgres/Redis), so contributors and reviewers can orient quickly. The doc is the hub #73 can later index; it must not become a second README or absorb later EPIC-08 topics (#62, #63, Redis deep dive).

## Acceptance criteria (issue)

- [ ] Architecture diagram shows React → GraphQL → Nest → Postgres/Redis

Satisfied by a Mermaid system diagram in `docs/architecture.md` with those layers labeled (React as Vite web; Nest as NestJS API; both PostgreSQL and Redis as Nest backends).

## Approach

**Focused hub (Approach B):**

| Surface                            | Role                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `docs/architecture.md`             | **Canonical** architecture entry point for #61 (diagram + short hub sections)          |
| `README.md` `## Architecture note` | Optional one-sentence pointer + link to `docs/architecture.md` (README stays thin)     |
| `docs/redis-caching-strategy.md`   | Unchanged; linked from architecture hub                                                |
| `docs/local-development.md`        | Unchanged; linked from architecture hub                                                |
| Future #62 / #63 docs              | Not created; listed under “Planned architecture documentation” with issue numbers only |

## Goals

- Meet #61 AC with a Mermaid diagram of the live stack.
- Document **current** behavior only (ops that exist today).
- Keep Redis discussion high-level and link to the dedicated strategy doc.
- Leave clear space for #62 (purchase sequence) and #63 (concurrency).
- Prefer a lean hub #73 can reference later.

## Non-goals

- Purchase sequence diagrams (#62) or concurrency strategy (#63).
- Rewriting or duplicating `docs/redis-caching-strategy.md`.
- Domain-port / adapter deep dive, Prisma schema detail, or GraphQL schema dump.
- Final README assembly (#73) or a documentation index of all EPIC-08 children.
- Application, infrastructure, Compose, or script behavior changes.
- Inventing ops, layers, or data stores that are not in the current codebase.
- Reopening #134 CSS AC or starting #73 / #71 / #74 work.

## Ownership model

| Concern                              | Owner after #61                  |
| ------------------------------------ | -------------------------------- |
| System shape + request-path overview | `docs/architecture.md`           |
| Redis cache / rate-limit strategy    | `docs/redis-caching-strategy.md` |
| How to run locally                   | `docs/local-development.md`      |
| Purchase sequence                    | #62 (planned)                    |
| Concurrency model                    | #63 (planned)                    |
| Final README as doc hub              | #73                              |

**Conflict rule:** Architecture detail lives in `docs/architecture.md`. README may only point at it; it must not grow into a competing architecture document.

## Design

### `docs/architecture.md` shape

Document sections (reader order):

1. **Title + one-liner** — Modular monolith; client talks GraphQL; NestJS API sits over PostgreSQL (system of record) and Redis (optimization).

2. **Mermaid system diagram** — Required for AC. Nodes/edges must convey:

   - React (Vite) → GraphQL → NestJS API
   - NestJS API → PostgreSQL
   - NestJS API → Redis

   Place a short note under the diagram: Redis is non-authoritative (cache / rate limiting); PostgreSQL is the authoritative source of truth. Point to `docs/redis-caching-strategy.md` for detail.

3. **Short architecture overview** — Five bullets, current wording:

   - React is the only frontend.
   - GraphQL is the API boundary.
   - NestJS API hosts the application layer and orchestrates business operations.
   - PostgreSQL is the system of record.
   - Redis is an optimization layer, not the source of truth.

   Domain rules may live in `packages/domain`; Nest hosts application orchestration and the API edge. Do not imply “all business logic lives in Nest.”

4. **Monorepo layout** — List:

   - `apps/web` — React + Vite frontend
   - `apps/api` — NestJS + Prisma + GraphQL
   - `packages/domain` — framework-independent domain logic
   - `packages/types` — non-domain shared contracts
   - shared config packages (`typescript-config`, `eslint-config`)

   Explicit note: `packages/domain` is framework-independent; infrastructure (Prisma, Redis, GraphQL, NestJS modules) stays in `apps/api`. Aligns with existing principle (share intentional contracts; keep infra local to the consuming app) without becoming a ports/adapters essay.

5. **High-level request paths** — Intentionally linear and implementation-neutral (components, not middleware ordering); current ops only:

   - **Catalog/read:** Web → GraphQL (`flashSales`, `flashSale`) → Flash Sale module → Prisma → PostgreSQL (with Redis used where applicable for caching).
   - **Purchase:** Web → GraphQL (`purchaseItem`) → Purchase module → PostgreSQL transaction (with Redis used where applicable for rate limiting or cache invalidation).

   Add a one-line note (not separate sections): Additional read operations (`myPurchase`, `myPurchases`) follow the same architecture, with Redis used only where the current implementation applies caching.

6. **Related docs**

   - Links: `docs/redis-caching-strategy.md`, `docs/local-development.md`
   - **Planned architecture documentation:**
     - Purchase sequence (#62)
     - Concurrency model (#63)

   Do not link to nonexistent files.

### README touch (optional, preferred)

Replace or extend `## Architecture note` with a single sentence plus link to `docs/architecture.md`. Do not move workspace layout, Redis blurb, or E2E notes into the architecture hub as part of #61.

### Diagram medium

Mermaid fenced block in markdown (GitHub-native). No committed PNG/SVG for #61 unless Mermaid proves insufficient for the AC (not expected).

## Out of scope

- #62–#66, #68–#74 documentation topics (beyond planned pointers for #62/#63)
- EPIC-07 stress / k6 work
- Code, schema, Compose, or test changes
- New automated tests for documentation

## Verification

Docs-only checklist:

1. Mermaid diagram renders and shows React → GraphQL → Nest → Postgres/Redis.
2. Overview / layout / request paths match current repo behavior only.
3. No duplicate Redis strategy content; link present.
4. No links to nonexistent architecture files; #62/#63 listed as planned issues only.
5. README (if touched) remains a one-line pointer, not a second architecture doc.
6. Internal links resolve correctly on GitHub.
7. Prettier (or repo format check) on touched markdown only.

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #61 AC satisfied via Mermaid in `docs/architecture.md`.
- `docs/architecture.md` is the architecture entry point (focused hub).
- Clear separation from Redis strategy, local-dev guide, and planned #62/#63 docs.
- Documentation reflects existing behavior only; no commit until explicitly requested.
