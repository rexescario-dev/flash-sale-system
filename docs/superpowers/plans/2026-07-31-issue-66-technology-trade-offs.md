# #66 Technology Trade-offs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add `docs/technology-trade-offs.md` documenting the rationale behind modular monolith, PostgreSQL as source of truth, GraphQL, and simplified demo identity (plus brief stack selection notes), and wire it from the architecture hub, scalability strategy, and fault-tolerance strategy docs.

**Architecture:** Docs-only focused trade-offs doc (Approach 1). New canonical rationale doc; update `docs/architecture.md` Related docs (alphabetical); update `docs/scalability-strategy.md` and `docs/fault-tolerance-strategy.md` (Related live links, Planned drops #66 / omit empty Planned, Non-goals point to live doc). Leave Redis/concurrency/purchase/scalability/fault-tolerance/testing bodies to existing docs, runbooks to #69/#70, README to #73. No app, schema, CI, Compose, or test changes.

**Tech Stack:** Markdown under `docs/`.

**Base:** `main` @ `fa7cfb0` (or later `origin/main` if still fast-forwardable). Working tree must stay limited to #66 doc files plus this plan/spec.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-66-technology-trade-offs-design.md`

---

## File map

| File                                                                         | Responsibility                                                                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `docs/technology-trade-offs.md`                                              | **Create** — canonical architectural rationale / technology trade-offs                                      |
| `docs/architecture.md`                                                       | **Modify** — Related docs alphabetical, include Technology trade-offs                                       |
| `docs/scalability-strategy.md`                                               | **Modify** — Related link after fault tolerance; Planned drops #66; Non-goals points to live trade-offs doc |
| `docs/fault-tolerance-strategy.md`                                           | **Modify** — Related link after scalability; Planned omitted; Non-goals points to live trade-offs doc       |
| `docs/superpowers/specs/2026-07-31-issue-66-technology-trade-offs-design.md` | Already written (editorial refinements applied); update only if implementation reveals an inconsistency     |
| `docs/superpowers/plans/2026-07-31-issue-66-technology-trade-offs.md`        | This plan                                                                                                   |

**Expected unchanged:** `docs/concurrency-model.md`, `docs/redis-caching-strategy.md`, `docs/purchase-sequence.md`, `docs/local-development.md`, `docs/testing-strategy.md`, `README.md`, `apps/**`, `packages/**`, `e2e/**`, Compose, CI, package scripts.

**Related-docs ordering rule:** `docs/technology-trade-offs.md`, `docs/scalability-strategy.md`, and `docs/fault-tolerance-strategy.md` order related documents by recommended reading flow. `docs/architecture.md` orders related documents alphabetically as the documentation hub. Do not “fix” one ordering to match the other.

---

### Task 1: Create `docs/technology-trade-offs.md`

**Files:**

- Create: `docs/technology-trade-offs.md`

- [x] **Step 1: Write the technology trade-offs doc**

Create `docs/technology-trade-offs.md` with the following content as the expected shape. Implement the document as specified in the design. Minor editorial improvements are acceptable provided they do not change ownership, scope, or architectural meaning:

```markdown
# Technology Trade-offs

This document captures the major architectural decisions behind the current implementation and the trade-offs that motivated them. It explains _why_ these choices were made, not how the system behaves operationally.

**Scope:** This document explains the architectural decisions behind the current implementation. Operational behavior, scalability, fault tolerance, concurrency, and testing are documented separately and linked where relevant.

For how the system scales and how it behaves under failure, see [Scalability strategy](scalability-strategy.md) and [Fault tolerance strategy](fault-tolerance-strategy.md).

## Decision summary

| Decision       | Chosen                        | Alternative considered     |
| -------------- | ----------------------------- | -------------------------- |
| Architecture   | Modular monolith              | Microservices              |
| Persistence    | PostgreSQL as source of truth | Redis as primary store     |
| API            | GraphQL                       | REST                       |
| Authentication | Simplified demo identity      | Production-grade IdP/OAuth |

## Core trade-offs

### Modular monolith vs microservices

The system is a **modular monolith**: a single NestJS API deployable that hosts GraphQL, application modules, and infrastructure adapters, with framework-independent domain logic in `packages/domain`.

**Why chosen:** Flash-sale correctness depends on a transactional purchase path against PostgreSQL. A single deployable keeps that path in-process, avoids distributed sagas, and matches the local Compose demo topology.

**Benefits:** Faster iteration, simpler deployment and local development, and a clear consistency story for inventory reservation and unique purchases.

**Trade-offs:** The API scales as identical horizontal instances sharing PostgreSQL and Redis, not as independently deployed domain services. Deployment and failure domains are coarser than a microservice split.

Horizontal scale-out of the monolith is documented in [Scalability strategy](scalability-strategy.md). Decomposition into services remains a possible later implication if operational complexity justifies it — not a committed roadmap item (see [Future evolution](#future-evolution)).

### PostgreSQL as source of truth vs Redis as primary store

**PostgreSQL** is the authoritative source of truth (system of record) for inventory and purchases. **Redis** is a non-authoritative performance and abuse-protection layer.

**Why chosen:** Purchase admission, stock reservation, and unique-purchase constraints require transactional guarantees. Keeping those decisions in PostgreSQL avoids dual-write correctness hazards.

**Benefits:** Clear ownership of business state; Redis can fail or be slow without inventing a second inventory truth.

**Trade-offs:** PostgreSQL availability bounds write success; Redis cannot be used as a primary store or admission authority. Cached presentation data (including stock displays) may be briefly stale.

Mechanics live in [Concurrency model](concurrency-model.md) and [Purchase sequence](purchase-sequence.md). Redis responsibilities and fail-open behavior live in [Redis caching & rate-limit strategy](redis-caching-strategy.md). Failure implications are summarized in [Fault tolerance strategy](fault-tolerance-strategy.md).

### GraphQL vs REST

**GraphQL** is the API boundary between the React client and the NestJS API.

**Why chosen:** The customer UI needs a typed contract over a small set of catalog and purchase operations. A single API surface aligned with the modular monolith keeps client and server contracts co-evolving without a large REST resource map.

**Benefits:** Strong typing for the web client, flexible field selection for catalog views, and one integration style for the demo product.

**Trade-offs:** GraphQL adds tooling and caching complexity versus simple REST resources, and some external integrators expect REST by default.

**Why acceptable here:** The public operation surface is small (`flashSales`, `flashSale`, `purchaseItem`, `myPurchase`, `myPurchases`), and the React web client is the primary consumer.

### Simplified authentication

Demo identity is intentionally simplified.

**Current approach:**

- The browser persists a local user ID (demo client identity).
- The API accepts that caller-supplied identity for demonstration purposes.
- There are no sessions, JWTs, or external identity providers.

**Trade-off:** This keeps the implementation focused on flash-sale concurrency and consistency challenges. It is **not** suitable for production authentication.

**Related operational implication:** Until real authentication exists, rate limiting for `purchaseItem` is enforced by client IP rather than authenticated user identity. See [Redis caching & rate-limit strategy](redis-caching-strategy.md) for details.

A production deployment would replace this simplified identity model with a proper authentication and authorization system.

## Technology choices

**NestJS** — Selected as the structured, modular host for the GraphQL API and infrastructure adapters (Prisma, Redis) while keeping domain logic separable in `packages/domain`.

**Prisma** — Selected for typed PostgreSQL access aligned with PostgreSQL’s role as the system of record.

**React + Vite** — Selected as the sole frontend stack for a fast local developer experience and a focused customer demo UI.

**PostgreSQL** — Selected as the transactional source of truth for inventory and purchases.

**Redis** — Selected as a non-authoritative cache and coordination layer where applicable, not as a business decision store.

## Future evolution

The following are implications of the current decisions, not a committed product or infrastructure roadmap.

- The modular monolith could be decomposed into services if operational complexity justifies it (aligned with horizontal scale of the API in [Scalability strategy](scalability-strategy.md)).
- PostgreSQL remains the source of truth; Redis deployment characteristics may evolve as availability needs change (see [Fault tolerance strategy](fault-tolerance-strategy.md) for current failure behavior).
- Simplified demo identity would be replaced by a proper authentication and authorization system when moving beyond the current demo scope.
- The API layer can evolve if future integration requirements change, without committing to a specific integration style.

## Non-goals

This document does not cover:

- High-availability design (replicas, failover, multi-AZ, or managed HA services)
- Operational runbooks (Issues #69 / #70)
- Re-documenting Redis strategy, concurrency model, purchase sequence, scalability strategy, fault tolerance strategy, or testing documentation
- README expansion or documentation hub work (#73)
- An ADR pack under `docs/adr/`
- Authentication/authorization system design (OAuth, OIDC, sessions, JWT issuance)
- Application, schema, Compose, CI, or test-suite changes

## Related documentation

- [System architecture](architecture.md)
- [Scalability strategy](scalability-strategy.md)
- [Fault tolerance strategy](fault-tolerance-strategy.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Concurrency model](concurrency-model.md)
- [Purchase sequence](purchase-sequence.md)
- [Local development](local-development.md)
- [Testing strategy](testing-strategy.md)
```

- [x] **Step 2: Sanity-check the new doc**

Confirm:

1. File exists at `docs/technology-trade-offs.md`.
2. Purpose states rationale/why; Scope boundary present; links to scalability + fault tolerance.
3. Decision summary uses: Modular monolith; PostgreSQL as source of truth; GraphQL; Simplified demo identity.
4. Four Core trade-offs subsections present (AC); roughly similar length; no Redis matrix / concurrency SQL / purchase steps / LB Mermaid / failure-mode essay duplication.
5. Auth section = Option B (demo identity, not production-suitable, IP rate-limit + Redis link, one production-replacement sentence; no OAuth/OIDC design).
6. Technology choices = five short rationale entries; no tutorials.
7. Future evolution opens with not-a-roadmap sentence; bullets grounded; no “add REST” commitment wording.
8. Related docs follow reader progression; no Planned section.
9. No README edits; no ownership creep into sibling strategy bodies.

Expected: lean rationale doc that satisfies #66 AC without scope creep.

---

### Task 2: Link from architecture hub

**Files:**

- Modify: `docs/architecture.md` (Related docs section only)

- [x] **Step 1: Add Technology trade-offs to Related docs**

Replace the Related docs block so titles remain alphabetical. Current `main` Related docs (after #65 / #153) for reference:

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

Target block:

```markdown
## Related docs

- [Concurrency model](concurrency-model.md)
- [Fault tolerance strategy](fault-tolerance-strategy.md)
- [Local development](local-development.md)
- [Purchase sequence](purchase-sequence.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Scalability strategy](scalability-strategy.md)
- [Technology trade-offs](technology-trade-offs.md)
- [Testing strategy](testing-strategy.md)
```

Do **not** edit the system diagram, overview, layout, or request-path sections. Do **not** add a Planned entry under architecture. Do **not** reorder the Related docs to match sibling reader progression — architecture Related docs stay alphabetical.

- [x] **Step 2: Verify hub links**

Confirm `docs/technology-trade-offs.md` exists and the new Related relative link resolves from `docs/architecture.md`. Confirm Related titles are alphabetical. Confirm there is **no duplicate** "Technology trade-offs" entry. Confirm `README.md` is untouched.

Expected: hub navigates to the new trade-offs doc exactly once; no nonexistent file links; README unchanged.

---

### Task 3: Update scalability strategy sibling links

**Files:**

- Modify: `docs/scalability-strategy.md` (Non-goals, Related documentation, Planned work only)

- [x] **Step 1: Point Non-goals at the live trade-offs doc**

In the Non-goals list, replace:

```markdown
- Architectural rationale, alternatives, or scaling-limitation essays (Issue #66)
```

with:

```markdown
- Architectural rationale, alternatives, or scaling-limitation essays ([Technology trade-offs](technology-trade-offs.md))
```

Leave the other Non-goals bullets unchanged.

- [x] **Step 2: Add Related documentation link and drop Planned #66**

Replace the Related documentation + Planned work block with:

```markdown
## Related documentation

- [System architecture](architecture.md)
- [Fault tolerance strategy](fault-tolerance-strategy.md)
- [Technology trade-offs](technology-trade-offs.md)
- [Concurrency model](concurrency-model.md)
- [Purchase sequence](purchase-sequence.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Local development](local-development.md)
```

Confirm Technology trade-offs sits immediately after **Fault tolerance strategy**, so readers encounter the architectural rationale after the scalability and fault-tolerance strategy documents. Confirm Issue #66 is no longer listed. Confirm the **Planned work** section is omitted (empty).

- [x] **Step 3: Verify scalability navigation**

Confirm:

1. `docs/scalability-strategy.md` links to `technology-trade-offs.md` in Related docs and Non-goals.
2. Neither document duplicates the other’s ownership (no LB Mermaid / scale topology in trade-offs; no trade-off essays in scalability).
3. No edits to Redis / concurrency / purchase / testing bodies.

Expected: live Related + Non-goals pointers without ownership duplication.

---

### Task 4: Update fault tolerance strategy sibling links

**Files:**

- Modify: `docs/fault-tolerance-strategy.md` (Non-goals, Related documentation, Planned work only)

- [x] **Step 1: Point Non-goals at the live trade-offs doc**

In the Non-goals list, replace:

```markdown
- Architectural rationale, alternatives, or trade-off essays (Issue #66)
```

with:

```markdown
- Architectural rationale, alternatives, or trade-off essays ([Technology trade-offs](technology-trade-offs.md))
```

Leave the other Non-goals bullets unchanged.

- [x] **Step 2: Add Related documentation link and drop Planned #66**

Replace the Related documentation + Planned work block with:

```markdown
## Related documentation

- [System architecture](architecture.md)
- [Scalability strategy](scalability-strategy.md)
- [Technology trade-offs](technology-trade-offs.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Concurrency model](concurrency-model.md)
- [Purchase sequence](purchase-sequence.md)
- [Local development](local-development.md)
```

Confirm Technology trade-offs sits immediately after Scalability strategy. Confirm Issue #66 is no longer listed. Confirm the **Planned work** section is omitted (empty).

- [x] **Step 3: Verify fault-tolerance navigation**

Confirm:

1. `docs/fault-tolerance-strategy.md` links to `technology-trade-offs.md` in Related docs and Non-goals.
2. `docs/technology-trade-offs.md` links to `fault-tolerance-strategy.md` (Purpose and Core trade-offs / Future evolution as designed).
3. Neither document duplicates the other’s ownership (no failure-mode matrix in trade-offs; no rationale essay in fault-tolerance).
4. No edits to Redis / concurrency / purchase / testing bodies.

Expected: bidirectional navigation without circular ownership or duplicated rationale/behavior.

---

### Task 5: Format and docs-only verification

**Files:**

- Verify: `docs/technology-trade-offs.md`, `docs/architecture.md`, `docs/scalability-strategy.md`, `docs/fault-tolerance-strategy.md`

- [x] **Step 1: Format touched markdown**

Format files modified during implementation. If the design/spec or plan files were not modified during implementation, they do not need formatting.

```bash
npx prettier --write \
  docs/technology-trade-offs.md \
  docs/architecture.md \
  docs/scalability-strategy.md \
  docs/fault-tolerance-strategy.md
```

Optional (only if edited in this implementation):

```bash
npx prettier --write \
  docs/superpowers/specs/2026-07-31-issue-66-technology-trade-offs-design.md \
  docs/superpowers/plans/2026-07-31-issue-66-technology-trade-offs.md
```

Expected: files formatted; no unrelated tree churn.

- [x] **Step 2: Spec checklist**

Walk the verification list in review order:

1. Four AC axes present under Core trade-offs
2. Decision summary uses shared terminology: Modular monolith; PostgreSQL as source of truth; GraphQL; Simplified demo identity
3. **Cross-document consistency:** those four decision phrases do not conflict with `architecture.md`, `scalability-strategy.md`, or `fault-tolerance-strategy.md`
4. Purpose includes scope/boundary sentence and links to scalability + fault-tolerance docs
5. Auth section follows Option B (no OAuth/OIDC design)
6. Technology choices = five short rationale entries; no tutorials
7. Future evolution opens with explicit not-a-roadmap sentence; bullets grounded in #64/#65/demo identity only
8. No duplication of Redis matrix, concurrency SQL, purchase steps, scale topology diagram, failure-mode essays, or testing strategy
9. `architecture.md` Related docs alphabetical and includes technology-trade-offs; README unchanged
10. `scalability-strategy.md` and `fault-tolerance-strategy.md` have live Related links; #66 removed from Planned; empty Planned sections omitted; Non-goals point at the live doc
11. Links resolve without introducing circular ownership or duplicated rationale
12. Docs-only diff — no app/schema/Compose/CI/test changes

- [x] **Step 3: Do not commit**

Stop for user review. Do **not** `git commit` unless the user explicitly asks. Leave changes uncommitted.

---

## Spec coverage

| Spec requirement                                                              | Task |
| ----------------------------------------------------------------------------- | ---- |
| Create `docs/technology-trade-offs.md` (Approach 1 body)                      | 1    |
| AC: monolith vs microservices, Postgres vs Redis truth, GraphQL vs REST, auth | 1    |
| Decision summary + shared terminology                                         | 1    |
| Scope/Purpose boundary + #64/#65 links                                        | 1    |
| Auth Option B                                                                 | 1    |
| Brief Technology choices (subordinate to AC)                                  | 1    |
| Future evolution not-a-roadmap + grounded bullets                             | 1    |
| Related docs reader progression; no Planned                                   | 1    |
| Architecture Related hub update (alphabetical)                                | 2    |
| Scalability Related + Planned drop #66 + Non-goals live pointer               | 3    |
| Fault-tolerance Related + Planned drop #66 + Non-goals live pointer           | 4    |
| Cross-doc consistency + docs-only verification; no commit                     | 5    |

## Out of scope reminder

Do not start #69, #70, #71, #73, or #74. Do not reopen #134 CSS AC. Do not expand README into a documentation hub. Do not edit Redis strategy, concurrency-model, purchase-sequence, or testing-strategy content beyond inbound links from the new doc / sibling Planned→Related flips. Do not invent HA, AuthN/OIDC migration design, or an ADR pack. Do not modify application, schema, Compose, or CI.
