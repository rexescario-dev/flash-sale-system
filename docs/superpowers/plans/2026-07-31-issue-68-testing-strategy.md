# #68 Testing Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `docs/testing-strategy.md` documenting unit, integration, E2E, smoke, and planned stress layers, and link it from the architecture hub.

**Architecture:** Docs-only focused strategy hub (Approach 1). New canonical testing-strategy doc; update `docs/architecture.md` Related docs (alphabetical). Leave Playwright/smoke runbooks to #69/#70, k6 to #71, README to #73. No app, schema, CI, or test changes.

**Tech Stack:** Markdown under `docs/`.

**Base:** `main` @ `4ab1696` (or later `origin/main` if still fast-forwardable). Working tree must stay limited to #68 doc files plus this plan/spec.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-68-testing-strategy-design.md`

---

## File map

| File                                                                    | Responsibility                                                                            |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `docs/testing-strategy.md`                                              | **Create** — canonical testing strategy (philosophy, layers, CI mapping, related/planned) |
| `docs/architecture.md`                                                  | **Modify** — Related docs alphabetical, include Testing strategy; Planned stays #62 only  |
| `docs/superpowers/specs/2026-07-31-issue-68-testing-strategy-design.md` | Already written; update only if implementation reveals an inconsistency                   |
| `docs/superpowers/plans/2026-07-31-issue-68-testing-strategy.md`        | This plan                                                                                 |

**Expected unchanged:** `docs/concurrency-model.md`, `docs/redis-caching-strategy.md`, `docs/local-development.md`, `README.md`, `apps/**`, `packages/**`, `e2e/**`, Compose, CI, package scripts.

---

### Task 1: Create `docs/testing-strategy.md`

**Files:**

- Create: `docs/testing-strategy.md`

- [x] **Step 1: Write the testing strategy doc**

Create `docs/testing-strategy.md` following the approved design. Required sections and intent (wording may follow the draft below closely; prefer clarity over verbatim paste):

````markdown
# Testing Strategy

## Testing philosophy

- Prefer **fast feedback** close to the change.
- Use the **lowest-cost test** that provides sufficient confidence.
- Exercise **real infrastructure only when the behavior depends on it**.
- Test **behavior**, not implementation details.
- Document **current repository capabilities only** — do not invent tools, commands, or CI policies that are not present yet.

## Layered strategy

Tests are organized in complementary layers:

1. **Unit** — fast confidence in domain and application logic without real infrastructure.
2. **Integration** — confidence at system boundaries with real services.
3. **E2E** — confidence in critical user journeys across the real stack; **smoke** is the smallest Playwright subset of that layer.
4. **Stress** — planned load/stress validation (not in the automated suite today).

Each layer answers a different question. Higher layers do not replace lower ones, and browser-based E2E is not the concurrency or load harness.

## Unit tests

**Purpose:** Confidence in domain and application logic without real infrastructure.

**Tools:** Jest (`packages/domain`, `apps/api` unit specs) and Vitest (`apps/web`).

**Primary locations:**

- `packages/domain`
- `apps/api` (unit specs alongside application code)
- `apps/web`

**Representative existing commands** (examples of primary entry points, not a complete command reference):

```bash
pnpm test
```
````

Package-scoped entry points also exist where packages expose a `test` script (for example `pnpm --filter api test`, `pnpm --filter web test`, `pnpm --filter @flash-sale/domain test`).

**CI role:** Unit tests provide fast feedback in automated validation.

## Integration tests

**Purpose:** Verify interactions between application components and infrastructure using real services (PostgreSQL, Prisma, GraphQL, and Redis where applicable), including schema validation and transactional concurrency behavior.

**Tools:** Jest schema and integration configurations under `apps/api`.

**Primary locations:** `apps/api` schema and integration test trees (for example `apps/api/test/`).

**Representative existing commands** (examples of primary entry points, not a complete command reference):

```bash
pnpm --filter api test:schema
pnpm --filter api test:integration
```

**CI role:** Integration tests validate behavior against real infrastructure.

> **Concurrency validation:** Atomic reservation and transactional correctness are verified through integration tests against real infrastructure. They are intentionally **not** validated by browser-based E2E tests or future stress tests. See [Concurrency model](concurrency-model.md).

## E2E tests

**Purpose:** Confidence that critical user journeys work across the real stack (web → API → PostgreSQL + Redis).

**Tools:** Playwright.

**Primary locations:** top-level `e2e/`.

**Representative existing commands** (examples of primary entry points, not a complete command reference):

```bash
pnpm e2e
```

**Lifecycle (strategy level):** Real stack. Playwright `globalSetup` owns deterministic seeding for the suite. Operational runbooks and troubleshooting belong to Issue #69.

**CI role:** Full Playwright regression provides comprehensive end-to-end coverage as part of the project's automated validation.

## Smoke tests

Smoke testing is a **subset** of E2E — the same Playwright stack and tooling, not a separate technology.

**Purpose:** The smallest Playwright suite that verifies the critical purchase journey (view an ACTIVE sale and complete a successful purchase) and provides rapid confidence for CI.

**Representative existing commands** (examples of primary entry points, not a complete command reference):

```bash
pnpm e2e:smoke
```

**CI role:** Playwright smoke provides rapid end-to-end confidence.

Procedures, local debugging, and smoke-specific operational detail belong to Issue #70.

## Stress testing (planned)

Stress testing is not currently part of the automated test suite. The project currently includes unit, integration, E2E, and smoke testing. Stress/load testing is planned for **EPIC-07 / Issue #71**, where the k6-based strategy, scenarios, execution instructions, and CI integration will be introduced. This document intentionally does not include k6 commands or expected results before that work is implemented.

## CI mapping

At a conceptual level, automated validation covers:

- **Unit tests** — provide fast feedback.
- **Integration tests** — validate behavior against real infrastructure.
- **Playwright smoke** — provides rapid end-to-end confidence.
- **Full Playwright regression** — validates broader user journeys.
- **Stress testing** — not part of the automated suite today (Issue #71).

This mapping describes layer participation, not workflow YAML, job names, or branch-protection policy.

## Related documentation

- [System architecture](architecture.md)
- [Local development](local-development.md)
- [Concurrency model](concurrency-model.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)

**Planned work:**

- Issue #69 — Playwright execution guide
- Issue #70 — Smoke testing guide
- Issue #71 — Stress testing (k6)

````

Notes for the implementer:

- Do **not** invent k6 commands or results.
- Do **not** link nonexistent markdown files for #69/#70/#71.
- Do **not** duplicate Redis strategy or concurrency-model body text beyond the concurrency callout + link.
- Keep philosophy technology-agnostic (PostgreSQL/Redis belong under Integration / E2E purpose, not philosophy).

- [x] **Step 2: Sanity-check against current repo**

Confirm documentation matches **current** repository capabilities:

1. Root scripts include `pnpm test`, `pnpm e2e`, `pnpm e2e:smoke`.
2. `apps/api` exposes `test:schema` and `test:integration`.
3. Domain uses Jest; web uses Vitest; Playwright lives under `e2e/`.
4. No k6 package script or stress suite is documented as existing.
5. Relative links to `architecture.md`, `local-development.md`, `concurrency-model.md`, and `redis-caching-strategy.md` resolve.
6. Planned work uses issue numbers only — no `playwright-*.md` / `smoke-*.md` / `stress-*.md` file links.

Expected: all checks pass; no code changes required.

---

### Task 2: Update architecture hub navigation

**Files:**

- Modify: `docs/architecture.md` (Related docs section only)

- [x] **Step 1: Add Testing strategy to Related docs**

Replace the Related docs block so titles remain alphabetical and Planned stays #62 only.

Current block for reference:

```markdown
## Related docs

- [Concurrency model](concurrency-model.md)
- [Local development](local-development.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)

**Planned architecture documentation:**

- Purchase sequence (#62)
````

Target block:

```markdown
## Related docs

- [Concurrency model](concurrency-model.md)
- [Local development](local-development.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Testing strategy](testing-strategy.md)

**Planned architecture documentation:**

- Purchase sequence (#62)
```

Do not edit diagram, overview, layout, or request-path sections. Do not add #69/#70/#71 under architecture Planned.

- [x] **Step 2: Verify hub links**

Confirm `docs/testing-strategy.md` exists and all four Related relative links resolve from `docs/architecture.md`. Confirm Planned mentions only #62.

Expected: hub navigates to the new testing strategy doc; no nonexistent file links.

---

### Task 3: Format and docs-only verification

**Files:**

- Verify: `docs/testing-strategy.md`, `docs/architecture.md`

- [x] **Step 1: Format touched markdown**

```bash
npx prettier --write \
  docs/testing-strategy.md \
  docs/architecture.md \
  docs/superpowers/specs/2026-07-31-issue-68-testing-strategy-design.md \
  docs/superpowers/plans/2026-07-31-issue-68-testing-strategy.md
```

Expected: files formatted; no unrelated tree churn.

- [x] **Step 2: Spec checklist**

Walk the design verification list:

1. All five layers appear as dedicated sections (unit, integration, E2E, smoke, stress planned) — AC
2. Philosophy is principle-based (no PostgreSQL/Redis lecture in philosophy)
3. Smoke is explicitly a subset of Playwright E2E
4. Integration uses system-boundary framing; concurrency callout present; no concurrency-model duplication
5. Stress has no invented k6 commands/results; points to EPIC-07 / #71
6. CI mapping is conceptual — no YAML, job inventories, or “required on PR/main” policy wording
7. Related docs ordered: architecture → local-dev → concurrency → redis → Planned work (#69/#70/#71)
8. Commands labeled as representative existing examples, not a complete command reference
9. `architecture.md` Related alphabetical + includes testing-strategy; Planned = #62 only; README untouched
10. Every cited command exists in root / package `package.json` scripts today
11. No app/schema/CI/test changes in the diff

- [x] **Step 3: Do not commit**

Stop for user review. Do **not** `git commit` unless the user explicitly asks. Leave changes uncommitted.

---

## Spec coverage

| Spec requirement                                         | Task |
| -------------------------------------------------------- | ---- |
| Create `docs/testing-strategy.md` (Approach 1 body)      | 1    |
| AC: unit / integration / E2E / smoke / stress documented | 1    |
| Philosophy principles; smoke as E2E subset               | 1    |
| Concurrency callout; no Redis/concurrency duplication    | 1    |
| Stress planned wording; no invented k6                   | 1    |
| Conceptual CI mapping                                    | 1    |
| Related + Planned work pointers                          | 1    |
| Architecture Related hub update                          | 2    |
| Docs-only verification; no commit                        | 3    |

## Out of scope reminder

Do not start #69, #70, #71, #73, or EPIC-07. Do not reopen #134 CSS AC. Do not expand README into a documentation hub. Do not edit Redis strategy or concurrency-model content beyond inbound links from the new doc.
