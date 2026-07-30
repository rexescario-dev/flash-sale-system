# #61 System Architecture Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `docs/architecture.md` as the focused architecture entry point with a Mermaid diagram showing React → GraphQL → Nest → PostgreSQL + Redis, plus short overview, monorepo layout, request paths, and related-doc links.

**Architecture:** Docs-only focused hub (Approach B). New canonical architecture doc; optional one-line README pointer. Link out to Redis strategy and local-dev; list #62/#63 as planned issues only. No app, Compose, or script changes. Not #73.

**Tech Stack:** Markdown under `docs/`; Mermaid in GitHub-flavored markdown; existing README.

**Base:** `main` @ `7de8cd0` (or later `origin/main` if still fast-forwardable). Working tree must stay limited to #61 doc files plus this plan/spec.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes unstaged/staged as appropriate for review.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-61-system-architecture-diagram-design.md`

---

## File map

| File                                                                               | Responsibility                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docs/architecture.md`                                                             | **Create** — canonical architecture hub (diagram + overview + layout + paths + links)            |
| `README.md`                                                                        | **Modify** — update Architecture note to a single-sentence pointer + link                        |
| `docs/superpowers/specs/2026-07-31-issue-61-system-architecture-diagram-design.md` | Already written; update only if implementation reveals an inconsistency with the approved design |
| `docs/superpowers/plans/2026-07-31-issue-61-system-architecture-diagram.md`        | This plan                                                                                        |

**Expected unchanged:** `docs/redis-caching-strategy.md`, `docs/local-development.md`, `apps/**`, `packages/**`, `e2e/**`, Compose, CI, package scripts.

---

### Task 1: Create `docs/architecture.md`

**Files:**

- Create: `docs/architecture.md`

- [ ] **Step 1: Write the architecture hub**

Create `docs/architecture.md` following the approved design in the spec. Do not invent new sections or GraphQL operations. Required sections:

1. **Title + one-liner** — Modular monolith; React client → NestJS GraphQL API over PostgreSQL (system of record) and Redis (optimization).
2. **System diagram (Mermaid)** — Must show React (Vite) → GraphQL → NestJS API → PostgreSQL and NestJS API → Redis (AC). Under the diagram, note that PostgreSQL is the authoritative source of truth and Redis is non-authoritative; link to `redis-caching-strategy.md`.
3. **Overview** — Five bullets from the spec, including: NestJS API hosts the application layer and orchestrates business operations. Clarify that domain rules may live in `packages/domain`.
4. **Monorepo layout** — `apps/web`, `apps/api`, `packages/domain`, `packages/types`, shared config packages. Note: domain is framework-independent; infrastructure (Prisma, Redis, GraphQL, NestJS modules) stays in `apps/api`.
5. **Request paths** — Implementation-neutral component paths (not middleware ordering):
   - **Catalog/read:** Web → GraphQL (`flashSales`, `flashSale`) → Flash Sale module → Prisma → PostgreSQL (with Redis used where applicable for caching).
   - **Purchase:** Web → GraphQL (`purchaseItem`) → Purchase module → PostgreSQL transaction (with Redis used where applicable for rate limiting or cache invalidation).
   - One-line note: Additional read operations (`myPurchase`, `myPurchases`) follow the same architecture, with Redis used only where the current implementation applies caching.
6. **Related docs** — Links to `redis-caching-strategy.md` and `local-development.md`. **Planned architecture documentation:** Purchase sequence (#62); Concurrency model (#63). Do not link nonexistent files.

Wording may follow the spec closely but need not be a verbatim paste; prefer clarity and the approved intent.

- [ ] **Step 2: Sanity-check against current repo**

Confirm before finishing:

1. The documented GraphQL operations exist in the current API implementation.
2. Workspace paths listed in the layout section exist in the monorepo.
3. Relative links from `docs/architecture.md` to `redis-caching-strategy.md` and `local-development.md` resolve.
4. No link targets nonexistent architecture files (only issue numbers for #62/#63).
5. Wording stays implementation-neutral on Redis (no per-query cache TTL / insertion-point claims).

Expected: all checks pass; no code changes required.

---

### Task 2: Point README Architecture note at the hub

**Files:**

- Modify: `README.md` (`## Architecture note` section)

- [ ] **Step 1: Update the Architecture note**

Update the Architecture note to a single-sentence pointer to `docs/architecture.md`. Intent example (wording may vary slightly):

> Modular monolith: React → GraphQL → NestJS → PostgreSQL + Redis. See [Architecture](docs/architecture.md).

Do **not** move Workspace layout, Redis, E2E, or Scripts into the architecture hub as part of this task. Do not expand README into a competing architecture document.

- [ ] **Step 2: Spot-check README link**

Confirm `docs/architecture.md` exists after Task 1 and the relative link from repo-root `README.md` resolves to it.

Expected: one-sentence Architecture note; no competing architecture walkthrough in README.

---

### Task 3: Format and verify

**Files:**

- Touch only if format rewrites: `docs/architecture.md`, `README.md`

- [ ] **Step 1: Format touched markdown**

Run the repository's standard formatting command for the touched files (or Prettier directly if no wrapper exists).

Expected: format command exits 0.

- [ ] **Step 2: Docs verification checklist**

Manually confirm:

1. Mermaid diagram shows React → GraphQL → Nest → PostgreSQL + Redis (AC).
2. Overview / layout / request paths match current repo behavior only.
3. No duplicate Redis strategy content; link to the Redis strategy doc present.
4. No links to nonexistent architecture files; #62/#63 listed as planned issues only.
5. README is a one-line pointer, not a second architecture doc.
6. Internal links resolve correctly on GitHub.
7. Format applied to touched markdown only.

- [ ] **Step 3: Working tree scope check**

Run:

```bash
git status -sb
git diff --stat
```

Expected: only `docs/architecture.md`, `README.md`, and (if included in the same change set) the #61 spec/plan under `docs/superpowers/`. No `apps/`, `packages/`, Compose, or CI changes.

Unexpected unrelated changes should be reported rather than incorporated.

- [ ] **Step 4: Stop for review — do not commit**

Do **not** run `git commit` until the user explicitly asks. Present the diff summary for review.

---

## Spec coverage

| Spec requirement                     | Task |
| ------------------------------------ | ---- |
| Mermaid AC diagram                   | 1    |
| Overview (5 bullets + domain note)   | 1    |
| Monorepo layout + infra-in-api note  | 1    |
| Implementation-neutral request paths | 1    |
| Related docs + planned #62/#63       | 1    |
| Optional/preferred README one-liner  | 2    |
| Verification + GitHub link check     | 3    |
| No commit until asked                | 3    |

## Out of scope reminder

Do not start #62, #63, #68, #73, #71, or #74. Do not reopen #134 CSS AC. Do not expand README into a documentation hub.
