# #65 Fault Tolerance Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `docs/fault-tolerance-strategy.md` documenting current Redis, API, PostgreSQL, and timeout failure behavior within the documented scalability topology, and wire it from the architecture hub and scalability strategy doc.

**Architecture:** Docs-only focused strategy doc (Approach 1). New canonical fault-tolerance doc; update `docs/architecture.md` Related docs (alphabetical); update `docs/scalability-strategy.md` (Related link after architecture, Planned drops #65, Non-goals points to live doc). Leave trade-offs to #66, runbooks to #69/#70, Redis/concurrency/purchase/scalability/testing bodies to existing docs, README to #73. No app, schema, CI, Compose, or test changes.

**Tech Stack:** Markdown under `docs/`.

**Base:** `main` @ `742d9bd` (or later `origin/main` if still fast-forwardable). Working tree must stay limited to #65 doc files plus this plan/spec.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-65-fault-tolerance-strategy-design.md`

---

## File map

| File                                                                            | Responsibility                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `docs/fault-tolerance-strategy.md`                                              | **Create** — canonical fault-tolerance and failure-behavior strategy                                          |
| `docs/architecture.md`                                                          | **Modify** — Related docs alphabetical, include Fault tolerance strategy                                      |
| `docs/scalability-strategy.md`                                                  | **Modify** — Related link after architecture; Planned drops #65; Non-goals points to live fault-tolerance doc |
| `docs/superpowers/specs/2026-07-31-issue-65-fault-tolerance-strategy-design.md` | Already written (editorial refinements applied); update only if implementation reveals an inconsistency       |
| `docs/superpowers/plans/2026-07-31-issue-65-fault-tolerance-strategy.md`        | This plan                                                                                                     |

**Expected unchanged:** `docs/concurrency-model.md`, `docs/redis-caching-strategy.md`, `docs/purchase-sequence.md`, `docs/local-development.md`, `docs/testing-strategy.md`, `README.md`, `apps/**`, `packages/**`, `e2e/**`, Compose, CI, package scripts.

**Related-docs ordering rule:** `docs/fault-tolerance-strategy.md` and `docs/scalability-strategy.md` order related documents by recommended reading flow. `docs/architecture.md` orders related documents alphabetically as the documentation hub. Do not “fix” one ordering to match the other.

---

### Task 1: Create `docs/fault-tolerance-strategy.md`

**Files:**

- Create: `docs/fault-tolerance-strategy.md`

- [x] **Step 1: Write the fault tolerance strategy doc**

Create `docs/fault-tolerance-strategy.md` with the following content as the expected shape. Implement the document as specified in the design. Minor editorial improvements are acceptable provided they do not change ownership, scope, or architectural meaning:

```markdown
# Fault Tolerance Strategy

Describes the current fault-tolerance and degradation behavior of the system within the topology documented by [Scalability strategy](scalability-strategy.md). This document reflects implemented behavior only; it is not a high-availability, operational runbook, or future platform design.

## Failure modes

### Redis

Redis is a non-authoritative performance optimization. When Redis is unavailable or Redis operations fail, the application follows the canonical fail-open caching strategy so requests continue against PostgreSQL where possible. See [Redis caching & rate-limit strategy](redis-caching-strategy.md) for the complete behavior matrix and operational details.

### API process failure

- **Current repository deployment (Compose):** A single API process. If the process exits or becomes unavailable, requests fail until the process is restarted.
- **Horizontal deployment** (see [Scalability strategy](scalability-strategy.md)): When multiple stateless API instances run behind a load balancer, failure of a single instance reduces capacity but does not make the service unavailable as long as healthy instances remain.

### PostgreSQL failure

PostgreSQL is the authoritative system of record and a shared dependency.

If PostgreSQL is unavailable or returns unexpected errors, affected requests fail. Unexpected database failures surface as GraphQL `INTERNAL_SERVER_ERROR`.

No application-level retry, circuit breaker, or database timeout policy is implemented.

In the topology documented by [Scalability strategy](scalability-strategy.md), the shared PostgreSQL instance is an availability single point of failure.

Transactional correctness and the purchase request lifecycle are documented in [Concurrency model](concurrency-model.md) and [Purchase sequence](purchase-sequence.md).

### Timeout behavior

- **API:** No application request timeout; requests continue until completed or terminated by the client or surrounding infrastructure.
- **Redis:** Redis client operations fail quickly under the current client configuration (including `maxRetriesPerRequest: 1` and `enableOfflineQueue: false`), after which the application follows the fail-open caching strategy. See [Redis caching & rate-limit strategy](redis-caching-strategy.md).
- **PostgreSQL:** No application-enforced query timeout; blocked or long-running operations remain pending until the database, infrastructure, or client terminates them. Unexpected database failures surface as GraphQL `INTERNAL_SERVER_ERROR`.

## Health endpoint

`GET /health` returns `{ "status": "ok" }` and reports process liveness only; it is not a readiness or dependency-health endpoint. It does not probe PostgreSQL or Redis.

## Non-goals

This document does not cover:

- High-availability design (replicas, failover, multi-AZ, or managed HA services)
- Operational runbooks (Issues #69 / #70)
- Architectural rationale, alternatives, or trade-off essays (Issue #66)
- Re-documenting Redis strategy, concurrency model, purchase sequence, scalability strategy, or testing documentation
- README expansion or documentation hub work (#73)
- Application timeout, retry, or circuit-breaker policies that are not implemented today
- A specific production platform (Kubernetes, ECS, Docker Swarm, etc.)

## Related documentation

- [System architecture](architecture.md)
- [Scalability strategy](scalability-strategy.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Concurrency model](concurrency-model.md)
- [Purchase sequence](purchase-sequence.md)
- [Local development](local-development.md)

**Planned work**

- Issue #66 — Technology / architecture trade-offs
```

- [x] **Step 2: Sanity-check the new doc**

Confirm:

1. File exists at `docs/fault-tolerance-strategy.md`.
2. Purpose states current/implemented behavior only; not HA/runbook/platform design.
3. Redis section is a short fail-open summary + link; no fail-open table, event matrix, keys, or TTLs.
4. API section has Compose single-process unavailability and horizontal capacity-loss semantics; no full LB topology Mermaid redraw.
5. Postgres section covers SoR → failure/`INTERNAL_SERVER_ERROR` → no retry / circuit breaker / application DB timeout → SPOF → concurrency/purchase links (that order).
6. Timeout section covers API / Redis / PostgreSQL as current behavior only; Redis config flags are parenthetical, not dual-owned policy.
7. Health section: process liveness only; not readiness or dependency health.
8. Related docs follow reader progression (architecture → scalability → Redis → concurrency → purchase → local development); Planned #66 by issue number only.
9. No HA invention; no README edits; no Redis/concurrency/purchase/scalability/testing body duplication.

Expected: lean failure-behavior doc that satisfies #65 AC without scope creep.

---

### Task 2: Link from architecture hub

**Files:**

- Modify: `docs/architecture.md` (Related docs section only)

- [x] **Step 1: Add Fault tolerance strategy to Related docs**

Replace the Related docs block so titles remain alphabetical. Current `main` Related docs (after #64 / #152) for reference:

```markdown
## Related docs

- [Concurrency model](concurrency-model.md)
- [Local development](local-development.md)
- [Purchase sequence](purchase-sequence.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Scalability strategy](scalability-strategy.md)
- [Testing strategy](testing-strategy.md)
```

Target block:

```markdown
## Related docs

- [Concurrency model](concurrency-model.md)
- [Fault tolerance strategy](fault-tolerance-strategy.md)
- [Local development](local-development.md)
- [Purchase sequence](purchase-sequence.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Scalability strategy](scalability-strategy.md)
- [Testing strategy](testing-strategy.md)
```

Do **not** edit the system diagram, overview, layout, or request-path sections. Do **not** add a Planned entry for #65/#66 under architecture. Do **not** reorder the Related docs to match the reader progression used by sibling docs — architecture Related docs stay alphabetical.

- [x] **Step 2: Verify hub links**

Confirm `docs/fault-tolerance-strategy.md` exists and the new Related relative link resolves from `docs/architecture.md`. Confirm Related titles are alphabetical. Confirm there is **no duplicate** "Fault tolerance strategy" entry. Confirm `README.md` is untouched.

Expected: hub navigates to the new fault-tolerance doc exactly once; no nonexistent file links; README unchanged.

---

### Task 3: Update scalability strategy sibling links

**Files:**

- Modify: `docs/scalability-strategy.md` (Non-goals, Related documentation, Planned work only)

- [x] **Step 1: Point Non-goals at the live fault-tolerance doc**

In the Non-goals list, replace:

```markdown
- Fault tolerance, degradation, retries, or recovery (Issue #65)
```

with:

```markdown
- Fault tolerance, degradation, retries, or recovery ([Fault tolerance strategy](fault-tolerance-strategy.md))
```

Leave the other Non-goals bullets unchanged (including Issue #66 for trade-offs).

- [x] **Step 2: Add Related documentation link and drop Planned #65**

Replace the Related documentation + Planned work block with:

```markdown
## Related documentation

- [System architecture](architecture.md)
- [Fault tolerance strategy](fault-tolerance-strategy.md)
- [Concurrency model](concurrency-model.md)
- [Purchase sequence](purchase-sequence.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Local development](local-development.md)

**Planned work**

- Issue #66 — Technology / architecture trade-offs
```

Confirm Fault tolerance strategy sits immediately after System architecture (reader order: topology → survive). Confirm Issue #65 is no longer listed under Planned.

- [x] **Step 3: Verify bidirectional navigation**

Confirm:

1. `docs/scalability-strategy.md` links to `fault-tolerance-strategy.md` in Related docs.
2. `docs/fault-tolerance-strategy.md` links to `scalability-strategy.md` in Related docs (and in Purpose / API / Postgres sections as designed).
3. Neither doc re-owns the other’s content (no topology Mermaid in fault-tolerance; no failure-mode matrix in scalability).
4. No edits to Redis / concurrency / purchase / testing bodies.

Expected: bidirectional Related links without circular ownership or duplicated behavioral descriptions.

---

### Task 4: Format and docs-only verification

**Files:**

- Verify: `docs/fault-tolerance-strategy.md`, `docs/architecture.md`, `docs/scalability-strategy.md`

- [x] **Step 1: Format touched markdown**

Format files modified during implementation. If the design/spec or plan files were not modified during implementation, they do not need formatting.

```bash
npx prettier --write \
  docs/fault-tolerance-strategy.md \
  docs/architecture.md \
  docs/scalability-strategy.md
```

Optional (only if edited in this implementation):

```bash
npx prettier --write \
  docs/superpowers/specs/2026-07-31-issue-65-fault-tolerance-strategy-design.md \
  docs/superpowers/plans/2026-07-31-issue-65-fault-tolerance-strategy.md
```

Expected: files formatted; no unrelated tree churn.

- [x] **Step 2: Spec checklist**

Walk the verification list in review order (content → links → ownership → no implementation changes):

1. Redis, API, Postgres, and timeout failure modes are present (AC)
2. Redis section is a short fail-open summary + link; no fail-open table / event matrix copy
3. API section states Compose single-process unavailability and horizontal multi-instance capacity-loss semantics; no full topology redraw
4. Postgres section covers SoR, `INTERNAL_SERVER_ERROR`, no retry / circuit breaker / application DB timeout, availability SPOF, and links concurrency + purchase-sequence
5. Timeout section documents current absence of application request/DB timeouts; Redis “fail quickly” is framed as client configuration, not dual-owned policy
6. Health section states process liveness only; not readiness or dependency health
7. `architecture.md` Related docs alphabetical and includes fault-tolerance-strategy; README unchanged
8. `scalability-strategy.md` has a live Related link to fault tolerance and no longer lists #65 under Planned
9. Links resolve without introducing circular ownership or duplicated behavioral descriptions
10. No section invents HA, runbooks, or unimplemented retry/timeout/circuit-breaker policy
11. Docs-only diff — no app/schema/Compose/CI/test changes

- [x] **Step 3: Do not commit**

Stop for user review. Do **not** `git commit` unless the user explicitly asks. Leave changes uncommitted.

---

## Spec coverage

| Spec requirement                                                           | Task |
| -------------------------------------------------------------------------- | ---- |
| Create `docs/fault-tolerance-strategy.md` (Approach 1 body)                | 1    |
| AC: Redis / API / Postgres / timeout failure modes                         | 1    |
| Redis short fail-open + link only                                          | 1    |
| API dual honesty (Compose vs horizontal)                                   | 1    |
| Postgres SoR / INTERNAL_SERVER_ERROR / no retry / SPOF / correctness links | 1    |
| Timeout current-behavior section                                           | 1    |
| Health: process liveness only                                              | 1    |
| Related docs reader progression + Planned #66                              | 1    |
| Architecture Related hub update (alphabetical)                             | 2    |
| Scalability Related link + Planned drop #65 + Non-goals live pointer       | 3    |
| Bidirectional navigation without ownership duplication                     | 3–4  |
| Docs-only verification; no commit                                          | 4    |

## Out of scope reminder

Do not start #66, #69, #70, #71, #73, or #74. Do not reopen #134 CSS AC. Do not expand README into a documentation hub. Do not edit Redis strategy, concurrency-model, purchase-sequence, or testing-strategy content beyond inbound links from the new doc / scalability sibling flip. Do not invent HA, timeout, retry, or circuit-breaker policy. Do not modify application, schema, Compose, or CI.
