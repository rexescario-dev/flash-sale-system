# #63 — Document concurrency control strategy

**Date:** 2026-07-31  
**Issue:** [#63](https://github.com/rexescario-dev/flash-sale-system/issues/63)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `54e5f64` (#61 via PR #147)

## Goal

Add a focused concurrency-model document — `docs/concurrency-model.md` — that explains **why purchase correctness holds under concurrency** using today’s PostgreSQL guarantees (atomic reservation + unique purchase constraint), and wire it into the architecture hub. The doc must not become a purchase-sequence guide (#62), duplicate Redis strategy, or expand the README into a documentation hub (#73).

## Acceptance criteria (issue)

- [ ] Docs explain atomic reservation and unique constraint as correctness guarantees

Satisfied by `docs/concurrency-model.md` with a `## Concurrency Control Strategy` section that introduces both guarantees, plus dedicated guarantee / failure-outcome sections grounded in current `PurchaseFlow` behavior.

## Approach

**Focused model hub (Approach B):**

| Surface                                  | Role                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `docs/concurrency-model.md`              | **Canonical** concurrency model (guarantees, in-txn flow, outcomes, non-goals, related docs) |
| `docs/architecture.md`                   | Link the new doc under Related docs; keep only unfinished work under Planned                 |
| `docs/redis-caching-strategy.md`         | Unchanged; linked only                                                                       |
| `README.md`                              | Unchanged                                                                                    |
| Future `docs/purchase-sequence.md` (#62) | Not created; referenced by issue number only until it exists                                 |

## Goals

- Meet #63 AC: atomic reservation and unique constraint documented as correctness guarantees.
- Document **current** behavior only (`PurchaseFlow` transaction, conditional reservation update, unique `(flash_sale_id, user_id)`).
- Keep Redis discussion to a one-line “not on the correctness path” pointer.
- Leave end-to-end request lifecycle to #62.
- Prefer a lean doc #73 can later index.

## Non-goals

- Purchase sequence / full request lifecycle (#62).
- Rewriting or duplicating `docs/redis-caching-strategy.md` (keys, TTLs, rate limits, invalidation).
- SQL/pseudocode dumps, Prisma API walkthroughs, or Nest exception-mapping essays.
- Invented mechanisms not in the codebase (distributed locks, queues, optimistic version columns, etc.).
- Application, schema, test, Compose, or script changes.
- README expansion / final doc hub (#73).
- Reopening #134 CSS AC; starting #68, #71, #74, or EPIC-07 work.

## Ownership model

| Concern                                    | Owner after #63                          |
| ------------------------------------------ | ---------------------------------------- |
| Concurrency model / correctness guarantees | `docs/concurrency-model.md`              |
| System shape + navigation hub              | `docs/architecture.md`                   |
| Redis cache / rate-limit strategy          | `docs/redis-caching-strategy.md`         |
| Full purchase request lifecycle            | #62 → future `docs/purchase-sequence.md` |
| Final README as doc hub                    | #73                                      |

**Conflict rule:** Correctness-under-concurrency detail lives in `docs/concurrency-model.md`. Architecture may only link it. Redis and purchase-sequence docs must not re-own those guarantees.

**Hub maintenance rule:** Implemented docs move into **Related docs**; only future work remains under **Planned**.

## Design

### `docs/concurrency-model.md` shape

Document sections (reader order):

1. **Title** — `# Concurrency Model`

2. **Overview** — Three concise statements only:
   - PostgreSQL is the source of truth.
   - Purchase correctness is enforced within a single database transaction.
   - Redis is not part of the correctness path (link to `redis-caching-strategy.md`).

3. **`## Concurrency Control Strategy`** (AC home) — Explicitly introduce the two complementary guarantees before flow detail:
   1. Atomic stock reservation.
   2. Database-enforced duplicate purchase prevention.
   - State that both run inside one PostgreSQL transaction used by the purchase flow.

4. **`## In-transaction flow`** — Short Mermaid flowchart (transaction only; no SQL):

   ```text
   Begin transaction
         →
   Atomic stock reservation
   (conditional UPDATE)
         →
   Create purchase
   (unique constraint enforced)
         →
   Commit / Roll back
   ```

   Caption: full Web → GraphQL → Nest → Redis lifecycle belongs to #62 (Purchase sequence); do not link a nonexistent `purchase-sequence.md` file.

5. **`## Concurrency guarantees`**
   - **Atomic stock reservation:** Success means the conditional update affects **exactly one row**; failure means **zero rows** updated. The current reservation update predicates include the active sale window and `remaining_stock > 0`. Phrase the overselling story around “one row updated vs zero,” so both stock exhaustion and window predicates are covered without overemphasizing either, and without pasting SQL.
   - **Duplicate purchase prevention:** Database unique invariant on ordered `(flash_sale_id, user_id)` (Prisma `@@unique([flashSaleId, userId])`) prevents two committed purchases for the same user and sale.

6. **`## Failure outcomes`** (outcome-level only):
   - Reservation fails (zero rows) → `SOLD_OUT`
   - Unique constraint conflict → `ALREADY_PURCHASED`
   - Transaction rollback preserves consistency (no partial stock decrement + purchase row)

   Do not document Prisma error codes or Nest exception class names as the primary story.

7. **`## Non-goals`**
   - End-to-end purchase sequence (#62)
   - Redis keys / TTLs / rate limits (`redis-caching-strategy.md`)
   - Future concurrency mechanisms until implemented
   - README expansion / #73

8. **`## Related documentation`** (dependency / navigation order):
   - [System architecture](architecture.md)
   - [Redis caching & rate-limit strategy](redis-caching-strategy.md)
   - Purchase sequence (#62) — planned (issue number only)

### Architecture hub update

In `docs/architecture.md`:

**Related docs** — alphabetical by title, all live files:

- [Concurrency model](concurrency-model.md)
- [Local development](local-development.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)

**Planned architecture documentation** — unfinished only:

- Purchase sequence (#62)

Remove “Concurrency model (#63)” from Planned once the file exists.

### Diagram medium

Mermaid fenced block in markdown (GitHub-native). No committed PNG/SVG. No SQL or pseudocode snippets in the concurrency doc.

## Boundary with #62

| Doc                   | Owns                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| #63 Concurrency model | Why correctness holds: guarantees, minimal in-txn order, outcomes, Redis not correctness                                              |
| #62 Purchase sequence | How a request flows: React → GraphQL → Nest → validation → txn entry → orchestration → repos → Redis invalidation → response / errors |

Minimal duplication: #63 may say “single PostgreSQL transaction” and show the three in-txn steps; #62 owns everything outside that boundary.

## Out of scope

- Creating or linking `docs/purchase-sequence.md`
- Edits to Redis strategy body beyond existing inbound links
- Code, schema, Compose, CI, or test changes
- New automated tests for documentation

## Verification

Docs-only checklist:

1. `## Concurrency Control Strategy` introduces atomic reservation and unique constraint as guarantees (AC).
2. Mermaid shows begin → reserve → create purchase → commit/rollback only.
3. Guarantee wording uses one-row-updated / zero-rows-updated framing; no SQL dump.
4. Failure outcomes stay at `SOLD_OUT` / `ALREADY_PURCHASED` / rollback consistency.
5. No Redis strategy duplication beyond the overview pointer + related link.
6. No link to nonexistent `purchase-sequence.md`; #62 listed by issue number only.
7. `architecture.md` Related docs alphabetical and includes concurrency-model; Planned has only #62.
8. README unchanged.
9. Prettier (or repo format check) on touched markdown only.

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #63 AC satisfied via `docs/concurrency-model.md`.
- Architecture hub links the live concurrency doc and keeps Planned accurate.
- Clear separation from Redis strategy and future purchase-sequence doc.
- Documentation reflects existing behavior only; no commit until explicitly requested.
