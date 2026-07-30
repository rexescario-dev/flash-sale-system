# #68 — Document testing strategy

**Date:** 2026-07-31  
**Issue:** [#68](https://github.com/rexescario-dev/flash-sale-system/issues/68)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `4ab1696` (#63 via PR #148)

## Goal

Add a focused testing-strategy document — `docs/testing-strategy.md` — that explains **why** the repository’s test layers exist and how they fit together (unit, integration, E2E, smoke, and planned stress), and wire it into the architecture hub. The doc must describe current behavior only, leave Playwright/smoke runbooks to #69/#70, leave k6 detail to #71 / EPIC-07, and not expand the README into a documentation hub (#73).

## Acceptance criteria (issue)

- [ ] Unit, integration, E2E, smoke, and stress layers are documented

Satisfied by `docs/testing-strategy.md` with dedicated sections for each layer. Stress is documented as **planned** (not yet in the automated suite), pointing to EPIC-07 / #71, without inventing k6 commands or results.

## Approach

**Focused strategy hub (Approach 1):**

| Surface                        | Role                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `docs/testing-strategy.md`     | **Canonical** testing strategy (philosophy, layers, CI mapping, related/future pointers) |
| `docs/architecture.md`         | Link the new doc under Related docs; keep only unfinished work under Planned             |
| `README.md`                    | Unchanged (#73 owns hub assembly)                                                        |
| Future Playwright / smoke docs | #69 / #70 — operational runbooks; referenced by issue number until they exist            |
| Future k6 / stress docs        | #71 / EPIC-07 — referenced by issue number; no invented commands                         |

## Goals

- Meet #68 AC: all five layers documented honestly against current repo capabilities.
- Keep the doc durable: purpose / tools / locations / representative existing commands (examples, not a complete reference) / CI role per implemented layer — no suite inventories.
- Make smoke explicitly a **subset** of Playwright E2E, not a separate technology.
- Map CI at a conceptual level (which layers participate and why), not as workflow YAML documentation.
- Prefer a lean doc #73 can later index.

## Non-goals

- Playwright / smoke execution runbooks, troubleshooting, or deep CI invocation detail (#69 / #70).
- Invented k6 workflows, scenarios, commands, or expected results (#71 / EPIC-07).
- Duplicating Redis strategy or concurrency-model content (link only; concurrency callout stays one architectural sentence).
- Exhaustive inventories of test files or suites.
- README expansion / final doc hub (#73).
- Application, schema, Compose, CI, or test-suite changes.
- Reopening #134 CSS AC; starting #73 or EPIC-07 / #71 implementation.

## Ownership model

| Concern                         | Owner after #68              |
| ------------------------------- | ---------------------------- |
| Testing strategy / layer intent | `docs/testing-strategy.md`   |
| System shape + navigation hub   | `docs/architecture.md`       |
| Playwright execution how-to     | #69 → future operational doc |
| Smoke procedures / how-to       | #70 → future operational doc |
| Stress / k6 strategy & results  | #71 / EPIC-07                |
| Final README as doc hub         | #73                          |

**Conflict rule:** Layer _why_ / _when_ / _where_ lives in `docs/testing-strategy.md`. Architecture may only link it. #69/#70 own _how to run_ Playwright/smoke. #71 owns stress implementation documentation. Concurrency correctness guarantees remain in `docs/concurrency-model.md`.

**Hub maintenance rule:** Implemented docs move into **Related docs**; only future work remains under **Planned**.

## Design

### `docs/testing-strategy.md` shape

Document sections (reader order):

1. **Title** — `# Testing Strategy`

2. **Testing philosophy** — Principles only (technology-agnostic):
   - Fast feedback close to the change.
   - Use the lowest-cost test that provides sufficient confidence.
   - Exercise real infrastructure only when the behavior depends on it.
   - Test behavior rather than implementation details.
   - Document current repository capabilities only.

3. **Layered strategy** — Short progression: unit → integration → E2E (with smoke as the fast subset) → stress (planned). One or two sentences on how layers complement each other without collapsing responsibilities.

4. **Unit tests**
   - **Purpose:** Confidence in domain and application logic without real infrastructure.
   - **Tools:** Jest (domain + API unit), Vitest (web).
   - **Primary locations:** `packages/domain`, `apps/api` (unit specs), `apps/web`.
   - **Representative existing commands:** `pnpm test` (workspace); package filters as already exposed.
   - Note once (applies to all layers): these are examples of the primary entry points rather than a complete command reference.
   - **CI role:** Unit tests provide fast feedback in automated validation.

5. **Integration tests**
   - **Purpose:** Verify interactions between application components and infrastructure using real services (PostgreSQL, Prisma, GraphQL, and Redis where applicable), including schema validation and transactional concurrency behavior.
   - **Tools:** Jest schema and integration configurations under `apps/api`.
   - **Primary locations:** `apps/api` schema / integration test trees.
   - **Representative existing commands:** `pnpm --filter api test:schema` and `pnpm --filter api test:integration` only.
   - **CI role:** Integration tests validate behavior against real infrastructure.
   - **Concurrency callout** (important architectural decision; do not duplicate `concurrency-model.md`):

     > **Concurrency validation:** Atomic reservation and transactional correctness are verified through integration tests against real infrastructure. They are intentionally **not** validated by browser-based E2E tests or future stress tests.

6. **E2E tests**
   - **Purpose:** Confidence that critical user journeys work across the real stack (web → API → PostgreSQL + Redis).
   - **Tools:** Playwright.
   - **Primary locations:** top-level `e2e/`.
   - **Representative existing commands:** `pnpm e2e` (smoke + regression as currently scripted).
   - **Lifecycle (strategy level only):** Real stack; Playwright `globalSetup` owns deterministic seeding — no runbook depth; point to #69 for execution detail.
   - **CI role:** Full Playwright regression provides comprehensive end-to-end coverage as part of the project's automated validation.

7. **Smoke tests**
   - Explicitly state smoke is a **subset** of E2E (same Playwright stack / tooling).
   - **Purpose:** Smallest Playwright suite that verifies the critical purchase journey and provides rapid confidence for CI (ACTIVE sale view + successful purchase at strategy level — not a procedure dump).
   - **Representative existing command:** `pnpm e2e:smoke`.
   - **CI role:** Playwright smoke provides rapid end-to-end confidence.
   - Procedures / troubleshooting → #70.

8. **Stress testing (planned)** — Use wording aligned with:

   > **Stress Testing (Planned)**
   >
   > Stress testing is not currently part of the automated test suite. The project currently includes unit, integration, E2E, and smoke testing. Stress/load testing is planned for **EPIC-07 / Issue #71**, where the k6-based strategy, scenarios, execution instructions, and CI integration will be introduced. This document intentionally does not include k6 commands or expected results before that work is implemented.

9. **CI mapping** — Conceptual participation only (avoid pipeline policy wording, “quality gate” jargon, workflow YAML, or job-name inventories):
   - Unit tests provide fast feedback.
   - Integration tests validate behavior against real infrastructure.
   - Playwright smoke provides rapid end-to-end confidence.
   - Full Playwright regression validates broader user journeys.
   - Stress testing is not part of the automated suite today (#71).

10. **Related documentation** — dependency / navigation order for existing docs, then planned work:
    - [System architecture](architecture.md)
    - [Local development](local-development.md)
    - [Concurrency model](concurrency-model.md)
    - [Redis caching & rate-limit strategy](redis-caching-strategy.md)
    - **Planned work** (issue numbers only — not markdown file links):
      - Issue #69 — Playwright execution guide
      - Issue #70 — Smoke testing guide
      - Issue #71 — Stress testing (k6)

### Architecture hub update

In `docs/architecture.md`:

**Related docs** — alphabetical by title, all live files (add Testing strategy):

- [Concurrency model](concurrency-model.md)
- [Local development](local-development.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Testing strategy](testing-strategy.md)

**Planned architecture documentation** — unfinished only (unchanged unless something new belongs there):

- Purchase sequence (#62)

Do **not** list #69/#70/#71 under architecture Planned unless those are architecture docs; they stay as future pointers inside `testing-strategy.md`.

## Boundary with siblings

| Doc / issue              | Owns                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------- |
| #68 Testing strategy     | Why layers exist; tools/locations; representative commands; CI mapping; stress planned |
| #69 Playwright execution | How to run / debug Playwright E2E                                                      |
| #70 Smoke testing        | Smoke procedures and operational detail                                                |
| #71 / EPIC-07            | k6 stress strategy, scenarios, results, CI integration                                 |
| Concurrency model        | Purchase correctness guarantees under concurrency                                      |
| #73 README               | Top-level doc hub assembly                                                             |

Minimal duplication: #68 may name `pnpm e2e` / `pnpm e2e:smoke` and the seed ownership sentence at strategy level; #69/#70 own step-by-step execution.

## Out of scope

- Creating Playwright, smoke, or k6 documentation files
- Edits to Redis / concurrency doc bodies beyond inbound links from the new strategy doc
- Code, schema, Compose, CI, or test changes
- New automated tests for documentation
- README changes

## Verification

Docs-only checklist:

1. All five layers appear as dedicated sections (unit, integration, E2E, smoke, stress planned) — AC.
2. Philosophy stays principle-based (no PostgreSQL/Redis lecture in philosophy).
3. Smoke is explicitly a subset of Playwright E2E.
4. Integration purpose uses system-boundary framing; concurrency callout present; no concurrency-model duplication.
5. Stress section has no invented k6 commands or results; points to EPIC-07 / #71.
6. CI mapping is conceptual (layers + participation), not YAML or PR/main policy documentation.
7. Related docs ordered: architecture → local-dev → concurrency → redis → Planned work (#69/#70/#71 by issue number only; no links to nonexistent files).
8. Commands labeled as representative existing examples, not a complete command reference.
9. `architecture.md` Related docs alphabetical and includes testing-strategy; README unchanged.
10. Every cited command exists in root / package `package.json` scripts today.
11. Prettier (or repo format check) on touched markdown only.

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #68 AC satisfied via `docs/testing-strategy.md`.
- Architecture hub links the live testing-strategy doc.
- Clear separation from #69/#70/#71 and from Redis / concurrency strategy docs.
- Documentation reflects existing behavior only; no commit until explicitly requested.
