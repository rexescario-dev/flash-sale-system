# #70 — Document smoke testing

**Date:** 2026-07-31  
**Issue:** [#70](https://github.com/rexescario-dev/flash-sale-system/issues/70)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `1b14e43` (#69 via PR #155)

## Goal

Add a focused smoke-suite implementation guide — `docs/smoke-testing.md` — that documents **smoke suite discovery and CI usage as implemented**, wire it from `docs/testing-strategy.md` and a thinned smoke pointer in `docs/playwright-e2e.md`, and leave README / architecture unchanged. Build on `docs/testing-strategy.md` and `docs/playwright-e2e.md`; do not duplicate the full Playwright runbook, Redis strategy, concurrency model, purchase sequence, scalability, fault tolerance, technology trade-offs, or testing-strategy body — link instead. Do not expand README into the doc hub (#73).

## Acceptance criteria (issue)

- [ ] Smoke tagging and CI usage are documented

Issue wording says “tagging”; this design (and the guide) use **suite discovery** for the same AC piece, because the implementation identifies smoke tests via the Playwright `smoke` project and its configured `testMatch` / path layout — not annotation-based `@tag`s.

Satisfied by `docs/smoke-testing.md` covering suite discovery (Playwright `smoke` project, configured `testMatch`, specs under `e2e/tests/smoke/`), local execution commands, current CI job usage (`e2e-smoke` → `pnpm e2e:smoke`), and mechanical “add a smoke spec” steps — with testing-strategy and playwright-e2e pointing at that canonical guide.

## Approach

**Dedicated smoke guide (Approach A):**

| Surface                    | Role after #70                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/smoke-testing.md`    | **Canonical** guide for how this repository’s smoke suite works today (suite discovery, local run, CI, layout, adding a spec)           |
| `docs/testing-strategy.md` | Layer _why_; link the smoke guide; remove #70 from Planned                                                                              |
| `docs/playwright-e2e.md`   | Keep smoke command + one-paragraph pointer; remove #70 placeholders; do **not** restate suite discovery (`testMatch`, directory layout) |
| `README.md`                | Unchanged for #70                                                                                                                       |
| `docs/architecture.md`     | Unchanged for #70 (smoke is an execution/testing concern, not architecture)                                                             |
| Future k6 / stress (#71)   | Unchanged; still planned under EPIC-07                                                                                                  |

**Rejected alternatives:** Expanding `playwright-e2e.md` into the smoke home (mixes Playwright runbook with smoke practice); expanding `testing-strategy.md` with discovery/CI procedure (mixes strategy and implementation); README or architecture index updates (dilutes hubs / fights #73).

**Depth (locked):** Current-state only — observable behavior from the codebase. Factual / descriptive prose (“at the time of writing, the smoke suite exercises…”), not normative inclusion criteria. No release gates, PR requirements, ownership, flaky policy, nightly vs PR scheduling, or mandatory criteria for inclusion.

## Goals

- Meet #70 AC with a single canonical home for suite discovery + CI usage.
- Preserve complementary questions: strategy = _Why smoke?_; playwright-e2e = _How do I use Playwright?_; smoke-testing = _How does this repo’s smoke suite work?_
- Prefer lean docs #73 can later index; keep README out of the specialized-guide graph for this issue.
- Leave #71 / EPIC-07 untouched.

## Non-goals

- Duplicating bodies of Playwright E2E runbook, testing strategy, Redis strategy, concurrency model, purchase sequence, scalability, fault tolerance, or technology trade-offs (link only).
- Invented governance: release gates, PR/branch-protection essays, flaky policy, ownership, nightly vs PR scheduling, mandatory inclusion criteria.
- README expansion or full #73.
- Architecture Related-docs changes.
- Application, schema, Compose, CI workflow, or test-suite code changes.
- k6 / stress documentation (#71 / EPIC-07).
- Reopening #134 CSS AC; starting unscoped #73 or EPIC-07 / #71 / #74.

## Ownership model

| Concern                                                                                                                               | Canonical owner             |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Testing philosophy, layers, and why smoke exists                                                                                      | `docs/testing-strategy.md`  |
| Playwright setup, execution, debugging, reporters, traces, environment, and general E2E workflow                                      | `docs/playwright-e2e.md`    |
| Smoke suite implementation as it exists today (suite discovery, local execution, CI usage, current suite layout, adding a smoke spec) | `docs/smoke-testing.md`     |
| Local infrastructure bring-up                                                                                                         | `docs/local-development.md` |

**Complementary questions:**

- `docs/testing-strategy.md` → _Why do we have smoke tests?_
- `docs/playwright-e2e.md` → _How do I use Playwright?_
- `docs/smoke-testing.md` → _How does this repository's smoke suite work?_

**Conflict rule:** Smoke guide owns smoke _implementation as it exists today_. Playwright runbook owns general E2E _how-to_. Strategy owns _why_. Link outward rather than restating Playwright execution details, testing rationale, concurrency / fault tolerance / scalability, purchase sequence, or technology trade-offs.

**Hub maintenance rule:** Implemented docs move into Related documentation; only unfinished work remains under Planned. Remove every #70 forward reference when the guide lands; delete an empty Planned section.

**Link intentionality:** Hubs point to the smoke guide; the smoke guide links back to strategy, playwright-e2e, and local-development. Do not restate suite discovery (`testMatch` / directory layout) in `playwright-e2e.md`.

## Design

### `docs/smoke-testing.md` shape

Document sections (reader order):

1. **Purpose** — `# Smoke testing` (or equivalent). State this is the **canonical guide for how this repository’s smoke suite works today**. Testing philosophy / why smoke exists → [Testing strategy](testing-strategy.md). General Playwright setup, lifecycle, env, debugging, traces → [Playwright E2E](playwright-e2e.md). Stack bring-up → [Local development](local-development.md).

2. **Suite discovery** — Lead with how the suite is identified:
   - Dedicated Playwright project `name: 'smoke'` in `e2e/playwright.config.ts`
   - The configured `testMatch` for the `smoke` project (specs under `e2e/tests/smoke/`; document the live pattern from config at write time, without treating a specific regex literal as a permanent contract)
   - Root script `pnpm e2e:smoke` → `@flash-sale/e2e` `test:smoke` → `playwright test --project=smoke`
   - Prefer wording that smoke is discovered through the Playwright project and its configured `testMatch`, rather than annotation-based tags
   - Optional one-liner: current `test.describe('smoke', …)` is organizational naming in the existing spec, not the suite-discovery mechanism

3. **What the smoke suite is (factual / illustrative)** — Descriptive only. Example tone:

   > At the time of writing, the smoke suite exercises the critical purchase journey (catalog → ACTIVE sale → buy → My Purchases) via `e2e/tests/smoke/purchase.smoke.spec.ts`.

   Do **not** prescribe “smoke must only contain…” rules.

4. **Running locally** — Real stack already up (link local-development + playwright-e2e for lifecycle / seed / browser install). Commands:
   - `pnpm e2e:smoke`
   - `pnpm --filter @flash-sale/e2e test:smoke`
   - `pnpm --filter @flash-sale/e2e exec playwright test --project=smoke`
   - Do **not** restate headed / `PWDEBUG` / traces / env tables — link playwright-e2e

5. **CI usage** — Implementation-focused, matching `.github/workflows/ci.yml`:
   - Job **`e2e-smoke`** executes the smoke suite
   - Command: `pnpm e2e:smoke`
   - Relies on workflow services (Postgres + Redis) and job bring-up of API + web as in the workflow
   - Database preparation is handled by Playwright `globalSetup` in the current implementation (do not pre-run `e2e:seed` in CI)
   - One sentence pointing to [Playwright E2E](playwright-e2e.md) for the broader CI flow (`e2e-full`, Chromium install detail, shared troubleshooting)
   - Do not invent branch-protection or future scheduling policy; may briefly note required-check wording only if already documented elsewhere and then link rather than expand

6. **Adding a smoke spec (mechanical)** — Purely path-based:
   1. Create a `*.spec.ts` file under `e2e/tests/smoke/`
   2. The `smoke` Playwright project discovers it through `testMatch`
   3. Verify with `pnpm e2e:smoke`

   No discussion of whether a test _belongs_ in smoke.

7. **Relationship to full E2E** — Keep short:

   > The smoke suite is a subset of the repository's Playwright E2E suite. It uses the same tooling, fixtures, and environment, but executes only the smoke Playwright project. For the complete E2E workflow and full-suite execution, see [Playwright E2E](playwright-e2e.md).

   Avoid introducing unnecessary “regression” terminology here unless needed for a single clarifying noun already defined in playwright-e2e; prefer the wording above.

8. **Related documentation** — Navigation only:
   - [Testing strategy](testing-strategy.md)
   - [Playwright E2E](playwright-e2e.md)
   - [Local development](local-development.md)

   No Planned section for #70 leftovers.

### Hub edits

**`docs/testing-strategy.md`:**

- Keep high-level smoke explanation and representative command `pnpm e2e:smoke`.
- Replace “Procedures, local debugging, and smoke-specific operational detail belong to Issue #70” with a link to [Smoke testing](smoke-testing.md) as the canonical implementation guide.
- Related documentation: add [Smoke testing](smoke-testing.md).
- Planned work: remove Issue #70; leave Issue #71 untouched.
- Do not expand strategy into discovery / CI procedure.

**`docs/playwright-e2e.md`:**

- Mention the `smoke` project where relevant; keep the smoke command.
- Thin smoke subsection to something like: `pnpm e2e:smoke` runs the Playwright smoke project. See [Smoke testing](smoke-testing.md) for how the smoke suite is organized and executed in CI.
- Projects table may keep a **one-line** smoke meaning + link to the smoke guide; do **not** expand it into discovery detail (`testMatch`, add-a-spec steps, smoke CI narrative).
- Do **not** restate `testMatch`, directory layout, or other discovery details in the Running / Smoke subsection.
- Leave the CI section focused on the overall Playwright workflow; smoke-testing owns the smoke-focused CI narrative.
- Remove all “planned in #70” / “expanded in Issue #70” / “belongs to Issue #70” placeholders (including under Projects); remove the entire Planned section if it becomes empty.

**Unchanged:** `README.md`, `docs/architecture.md`, application / CI / test code, other strategy docs.

## Boundary with siblings

| Doc / issue          | Owns                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| #68 Testing strategy | Why layers exist; strategy-level smoke purpose                                          |
| #69 Playwright E2E   | How to run / debug this repo’s Playwright; overall Playwright execution and CI workflow |
| #70 Smoke testing    | Suite discovery, local smoke run, smoke CI job, adding a smoke spec                     |
| #71 / EPIC-07        | k6 stress strategy, scenarios, results, CI integration                                  |
| Local development    | Bring stack up; port/Redis troubleshooting                                              |
| Architecture         | Index of focused docs (no smoke link required for #70)                                  |
| #73 README           | Top-level doc hub assembly                                                              |

Minimal duplication: strategy and playwright-e2e may name `pnpm e2e:smoke`; smoke-testing owns suite discovery, smoke CI detail, and mechanical add steps.

## Out of scope

- README or architecture edits
- Edits to Redis / concurrency / purchase-sequence / scalability / fault-tolerance / trade-offs bodies beyond inbound links if needed
- Code, schema, Compose, CI workflow, or Playwright suite changes
- New automated tests for documentation
- Committing until explicitly requested

## Verification

Docs-only checklist:

1. `docs/smoke-testing.md` exists and documents suite discovery + CI usage (AC; issue “tagging” = suite discovery).
2. Purpose states canonical smoke-suite guide; strategy owns why; playwright-e2e owns general Playwright how-to.
3. Section order: Purpose → Suite discovery → What the suite is → Running locally → CI usage → Adding a smoke spec → Relationship → Related documentation.
4. Suite discovery documents the Playwright `smoke` project, its configured `testMatch`, and `e2e/tests/smoke/`; clarifies not annotation `@tag`s without dwelling on negatives; does not treat a specific regex literal as a permanent contract.
5. Current journey prose is illustrative (“at the time of writing…”), not normative.
6. Local commands match root / package scripts; headed / debug / traces / env deferred to playwright-e2e.
7. CI documents `e2e-smoke` → `pnpm e2e:smoke`, workflow services, and that database preparation is handled by Playwright `globalSetup` in the current implementation; links playwright-e2e for broader CI; no invented policy.
8. Adding a smoke spec is purely mechanical (path → suite discovery → verify).
9. Relationship section is short; smoke ⊂ Playwright E2E; links runbook.
10. `testing-strategy.md` links smoke guide; #70 removed from Planned; #71 remains.
11. `playwright-e2e.md` keeps smoke command + pointer; no suite-discovery restatement; all #70 placeholders gone; empty Planned removed.
12. Cross-links resolve cleanly:
    - `testing-strategy.md` → `smoke-testing.md`
    - `playwright-e2e.md` → `smoke-testing.md`
    - `smoke-testing.md` → `testing-strategy.md`, `playwright-e2e.md`, `local-development.md`
13. README and architecture unchanged.
14. No duplication of Playwright runbook / strategy / Redis / concurrency / purchase-sequence / scalability / fault-tolerance / trade-offs bodies.
15. Every documented command and referenced root/package script / CI job name exists in the repository (`package.json`, `e2e/package.json`, `e2e/playwright.config.ts`, `.github/workflows/ci.yml`).
16. Format touched markdown with the repo’s canonical check: `pnpm format:check` (fix via `pnpm format` if needed).

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #70 AC satisfied via `docs/smoke-testing.md`.
- Strategy and playwright-e2e discover the guide without README/architecture churn.
- Clear separation from #69 runbook and from #71 / EPIC-07.
- Documentation reflects existing behavior only; no commit until explicitly requested.
