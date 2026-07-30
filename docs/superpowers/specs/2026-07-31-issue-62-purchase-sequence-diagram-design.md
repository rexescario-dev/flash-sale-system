# #62 — Create purchase sequence diagram

**Date:** 2026-07-31  
**Issue:** [#62](https://github.com/rexescario-dev/flash-sale-system/issues/62)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `37ac24c` (#68 via PR #149)

## Goal

Add a focused purchase-sequence document — `docs/purchase-sequence.md` — that shows the **server-side** `purchaseItem` request lifecycle (Web → Nest GraphQL edge → Redis rate limit → PurchaseFlow → PostgreSQL transaction → best-effort Redis invalidation → GraphQL response), and wire it into the architecture hub. The doc must not duplicate Redis strategy, concurrency guarantees, client TanStack cache refresh, or expand the README into a documentation hub (#73).

## Acceptance criteria (issue)

- [ ] Sequence diagram covers validate → reserve → purchase → commit

Satisfied by a Mermaid sequence diagram in `docs/purchase-sequence.md` whose happy path shows sale validation, atomic reserve, save purchase, and commit inside the PurchaseFlow / PostgreSQL interaction.

The AC’s “purchase” step is represented by **saving the Purchase record** within the transaction. Diagram labels and prose use **save purchase** / **Purchase save** consistently; there is no separate “purchase” message beyond that save.

## Approach

**Dedicated sequence doc (Approach A):**

| Surface                          | Role                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `docs/purchase-sequence.md`      | **Canonical** purchase request lifecycle (sequence + outcome table + non-goals + related) |
| `docs/architecture.md`           | Link the new doc under Related docs; remove Planned #62                                   |
| `docs/concurrency-model.md`      | Replace “planned #62” / issue-only references with a link to `purchase-sequence.md`       |
| `docs/redis-caching-strategy.md` | Unchanged; linked only                                                                    |
| `README.md`                      | Unchanged                                                                                 |

## Goals

- Meet #62 AC: validate → reserve → purchase → commit visible on the happy path.
- Document **current** server behavior only (`PurchaseResolver.purchaseItem`, `PurchaseFlowService.execute`).
- Complement architecture (structure) and concurrency model (correctness under contention).
- Keep Redis interactions high-level (lifeline + short messages); link strategy doc for detail.
- Prefer a lean doc #73 can later index.

## Non-goals

- Redis implementation details (keys, TTLs, fail-open behavior, cache topology).
- Concurrency correctness and transactional guarantees (owned by `docs/concurrency-model.md`).
- Client-side cache refresh (TanStack Query / #129).
- README navigation or onboarding (#73).
- Application, schema, test, Compose, or script changes.
- Reopening #134 CSS AC; starting #73, #71, or #74.

## Ownership model

| Concern                                      | Owner after #62                  |
| -------------------------------------------- | -------------------------------- |
| Purchase request lifecycle (server sequence) | `docs/purchase-sequence.md`      |
| System shape + navigation hub                | `docs/architecture.md`           |
| Concurrency model / correctness guarantees   | `docs/concurrency-model.md`      |
| Redis cache / rate-limit strategy            | `docs/redis-caching-strategy.md` |
| Final README as doc hub                      | #73                              |

**Conflict rule:** Runtime request-flow detail lives in `docs/purchase-sequence.md`. Architecture may only link it. Concurrency and Redis docs must not re-own the end-to-end sequence.

**Hub maintenance rule:** Implemented docs move into **Related docs**; only unfinished work remains under **Planned**.

**Documentation progression:**

| Document          | Primary question                                   |
| ----------------- | -------------------------------------------------- |
| Architecture      | What are the components and how do they connect?   |
| Purchase Sequence | What happens during a purchase request?            |
| Concurrency Model | Why is the purchase flow correct under contention? |

## Design

### One-liner

> Describes the server-side lifecycle of a `purchaseItem` request, from GraphQL mutation through transactional purchase processing and response.

### `docs/purchase-sequence.md` shape

Document sections (reader order):

1. **Title + one-liner** — as above; immediately signals server scope, not UI.

2. **Mermaid sequence diagram** — Required for AC. Participants (left → right):

   - Web
   - Nest (GraphQL Resolver) — API edge (GraphQL **not** a separate lifeline)
   - Redis
   - PurchaseFlow
   - PostgreSQL

   **Happy path:**

   1. Web → Nest: `purchaseItem` mutation
   2. Nest → Redis: rate limit check → allowed
   3. Nest → PurchaseFlow: execute
   4. PurchaseFlow: validate sale status (ACTIVE)
   5. PurchaseFlow → PostgreSQL: begin transaction → reserve stock → save purchase → commit
   6. Nest → Redis: invalidate related caches (note: best-effort; success returned regardless of invalidation outcome)
   7. Nest → Web: SUCCESS response

   Keep the transaction portion visually compact (PurchaseFlow activation with reserve / save / commit steps). Do not expand every SQL statement or Prisma call.

   **`alt` fragments** (control-flow branches only; not one alt per status code):

   | Alt                         | Behavior                                                                           |
   | --------------------------- | ---------------------------------------------------------------------------------- |
   | Rate limit exceeded         | Redis denies → Nest returns rate-limit error to Web (PurchaseFlow not called)      |
   | Sale not active             | Pre-txn validation → `SALE_NOT_STARTED` / `SALE_ENDED` / pre-txn `SOLD_OUT`        |
   | Reservation failed          | Atomic reserve updates 0 rows → `SOLD_OUT`                                         |
   | Unique constraint violation | Purchase save conflicts on unique `(flash_sale_id, user_id)` → `ALREADY_PURCHASED` |

3. **Redis note** (directly under the diagram):

   > Redis interactions in the sequence are intentionally high level. For cache topology, keys, TTLs, and invalidation strategy, see [Redis caching & rate-limit strategy](redis-caching-strategy.md).

   Message labels stay intentional: “Rate limit check”, “Invalidate related caches”. Avoid keys, TTLs, topology, fail-open implementation, and invalidation strategy detail.

4. **Client note** (single sentence outside the sequence):

   > After a successful response, the web application refreshes its local cached data. Client-side cache management is intentionally outside the scope of this server-side sequence.

5. **Outcome table** — grouped by decision point (not by error code):

   | Decision point     | Possible result                                           |
   | ------------------ | --------------------------------------------------------- |
   | Rate limiter       | Rate-limit error (GraphQL error; not a `PurchaseOutcome`) |
   | Sale validation    | `SALE_NOT_STARTED`, `SALE_ENDED`, `SOLD_OUT`              |
   | Atomic reservation | `SOLD_OUT`                                                |
   | Purchase save      | `ALREADY_PURCHASED`                                       |
   | Commit             | `SUCCESS`                                                 |

   **Footnote:** Missing sale throws `FlashSaleNotFoundError` before outcome mapping — prose only, not a Mermaid `alt`.

6. **Non-goals** — phrase as topics owned elsewhere / omitted:

   - Redis implementation details (keys, TTLs, fail-open behavior)
   - Concurrency correctness and transactional guarantees (`concurrency-model.md`)
   - Client-side cache refresh (TanStack Query)
   - README navigation or onboarding (#73)

7. **Related docs** — reading-sequence order:

   1. [System architecture](architecture.md)
   2. [Concurrency model](concurrency-model.md)
   3. [Redis caching & rate-limit strategy](redis-caching-strategy.md)

### Diagram medium

Mermaid fenced `sequenceDiagram` in markdown (GitHub-native). No committed PNG/SVG unless Mermaid proves insufficient for the AC (not expected).

### Architecture hub update

In `docs/architecture.md`:

- Add [Purchase sequence](purchase-sequence.md) under **Related docs**, keeping alphabetical-by-title order with other live docs (Placement: after Local development, before Redis).
- Remove “Purchase sequence (#62)” from **Planned architecture documentation**.
- If Planned becomes empty, remove the Planned subsection entirely.

### Concurrency model update

In `docs/concurrency-model.md`:

- Replace issue-only / “planned” Purchase sequence references with a link to [Purchase sequence](purchase-sequence.md).
- Keep the in-transaction flowchart and correctness narrative unchanged; do not import the e2e sequence into the concurrency doc.

### README

Unchanged. Final README / doc-hub work remains #73.

## Boundary with adjacent docs

| Doc                   | Owns                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| #61 Architecture      | System structure, high-level request-path bullets, hub navigation                                      |
| #62 Purchase sequence | How a `purchaseItem` request flows server-side, including major branch points and outcome mapping      |
| #63 Concurrency model | Why correctness holds under contention (atomic reservation + unique constraint; Redis not correctness) |
| Redis strategy        | Keys, TTLs, invalidation strategy, fail-open                                                           |

Minimal duplication: #62 may show Redis as a participant with short messages and may label txn steps validate → reserve → save → commit; #63 remains authoritative for concurrency guarantees and the failure semantics of reservation / unique conflict.

## Out of scope

- Expanding README into a documentation hub (#73)
- EPIC-07 stress / k6 work (#71, #74)
- Reopening #134 CSS acceptance criteria
- Code, schema, Compose, CI, or test changes
- New automated tests for documentation

## Verification

Docs-only checklist:

1. Mermaid sequence renders and happy path shows validate → reserve → purchase/save → commit (AC).
2. Participants are Web, Nest (GraphQL Resolver), Redis, PurchaseFlow, PostgreSQL — no separate GraphQL lifeline.
3. Four agreed `alt` fragments present; outcome table grouped by decision point.
4. Redis note + strategy link present; no keys/TTLs/fail-open duplication.
5. Client cache note is one sentence outside the sequence; no TanStack detail.
6. `architecture.md` Related includes purchase-sequence; Planned #62 removed.
7. `concurrency-model.md` links live `purchase-sequence.md` (no “planned” wording for #62).
8. README unchanged.
9. Prettier (or repo format check) on touched markdown only.

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #62 AC satisfied via Mermaid in `docs/purchase-sequence.md`.
- Clear separation from architecture hub, concurrency model, and Redis strategy.
- Documentation reflects existing behavior only; no commit until explicitly requested.
