# #70 Smoke Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `docs/smoke-testing.md` documenting suite discovery and CI usage for this repository’s Playwright smoke suite as implemented, and wire it from testing strategy plus a thinned smoke pointer in the Playwright E2E runbook.

**Architecture:** Docs-only dedicated smoke guide (Approach A). New canonical `docs/smoke-testing.md`; update `docs/testing-strategy.md` and thin #70 placeholders in `docs/playwright-e2e.md`. Build on testing-strategy and playwright-e2e; do not duplicate Playwright runbook, Redis/concurrency/purchase-sequence/scalability/fault-tolerance/trade-offs/testing-strategy bodies. No README, architecture, app, schema, CI, Compose, or test changes.

**Tech Stack:** Markdown under `docs/`.

**Base:** `main` @ `1b14e43` (or later `origin/main` if still fast-forwardable). Working tree must stay limited to #70 doc files plus this plan/spec.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-70-smoke-testing-design.md`

**Terminology:** Issue AC says “tagging”; the guide and this plan use **suite discovery** for that AC piece (Playwright `smoke` project + configured `testMatch` / path layout — not annotation `@tag`s).

---

## File map

| File                                                                 | Responsibility                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `docs/smoke-testing.md`                                              | **Create** — canonical smoke-suite implementation guide                                              |
| `docs/testing-strategy.md`                                           | **Modify** — link smoke guide from Smoke section; Related documentation + Planned drops #70          |
| `docs/playwright-e2e.md`                                             | **Modify** — thin smoke pointer; one-line projects-table link; remove all #70 placeholders / Planned |
| `docs/superpowers/specs/2026-07-31-issue-70-smoke-testing-design.md` | Already written (editorial polish applied); update only if implementation reveals an inconsistency   |
| `docs/superpowers/plans/2026-07-31-issue-70-smoke-testing.md`        | This plan                                                                                            |

**Expected unchanged:** `README.md`, `docs/architecture.md`, `docs/local-development.md`, `docs/concurrency-model.md`, `docs/redis-caching-strategy.md`, `docs/purchase-sequence.md`, `docs/scalability-strategy.md`, `docs/fault-tolerance-strategy.md`, `docs/technology-trade-offs.md`, `apps/**`, `packages/**`, `e2e/**` (code), Compose, CI workflows, package scripts.

**Related-docs ordering rule:** `docs/architecture.md` orders related documents alphabetically (not touched here). Other docs may use reading-flow order.

---

### Task 1: Create `docs/smoke-testing.md`

**Files:**

- Create: `docs/smoke-testing.md`

- [x] **Step 1: Confirm live suite-discovery facts**

From repository root, confirm:

```bash
rg -n "name: 'smoke'|testMatch|e2e:smoke|test:smoke" e2e/playwright.config.ts e2e/package.json package.json
ls e2e/tests/smoke/
rg -n "e2e-smoke:|pnpm e2e:smoke|globalSetup|e2e:seed" .github/workflows/ci.yml | head -40
```

Current implementation (at base commit — verify, do not assume):

- Project `name: 'smoke'` with a configured `testMatch` that selects specs under `e2e/tests/smoke/` (record the live pattern from `e2e/playwright.config.ts`)
- Root `e2e:smoke` → `@flash-sale/e2e` `test:smoke` → `playwright test --project=smoke`
- Spec present under `e2e/tests/smoke/` (at base: `purchase.smoke.spec.ts`)
- CI job `e2e-smoke` runs `pnpm e2e:smoke`; workflow comment says canonical seed is Playwright `globalSetup`

Document the **live** `testMatch` value in the guide at write time; do not treat the regex literal as a permanent contract in prose (prefer “configured `testMatch`” + show current value as illustration).

- [x] **Step 2: Write the smoke testing guide**

Create `docs/smoke-testing.md` with this structure and content. Wording may be adjusted to match repository conventions provided behavior, ownership, and section order stay intact:

````markdown
# Smoke testing

This is the **canonical guide for how this repository’s smoke suite works today**: suite discovery, local execution, CI usage, and how a new smoke spec is picked up.

- _Why_ smoke exists in the layered strategy: [Testing strategy](testing-strategy.md)
- General Playwright setup, lifecycle, environment variables, debugging, traces, and full-suite CI: [Playwright E2E](playwright-e2e.md)
- Bringing the application stack up: [Local development](local-development.md)

Issue wording may say “smoke tagging”; in this repository smoke tests are identified by **suite discovery** (Playwright project + path/`testMatch`), not annotation-based `@tag`s.

## Suite discovery

The smoke suite is discovered through the dedicated Playwright `smoke` project and its configured `testMatch`, rather than annotation-based tags.

Configuration lives in `e2e/playwright.config.ts`:

- Project `name: 'smoke'`
- Configured `testMatch` for that project (at the time of writing: `/smoke\/.*\.spec\.ts/`), which matches specs under `e2e/tests/smoke/`
- Desktop Chrome device preset (same as other E2E projects)

Entry points that select the smoke project:

```bash
pnpm e2e:smoke
```

Root `e2e:smoke` runs `@flash-sale/e2e` `test:smoke`, which is `playwright test --project=smoke`.

Equivalent package forms:

```bash
pnpm --filter @flash-sale/e2e test:smoke
pnpm --filter @flash-sale/e2e exec playwright test --project=smoke
```

The current smoke spec also uses `test.describe('smoke', …)`. That name is organizational only; it is **not** the suite-discovery mechanism.

## What the smoke suite is

At the time of writing, the smoke suite exercises the critical purchase journey (catalog → ACTIVE sale → buy → My Purchases) via `e2e/tests/smoke/purchase.smoke.spec.ts`.

## Running locally

Prerequisites: real stack already up (Postgres, Redis, migrated API, web). Follow [Local development](local-development.md) to start services, then [Playwright E2E](playwright-e2e.md) for browser install, lifecycle, seed via `globalSetup`, environment variables, headed/debug modes, and traces.

With the stack running:

```bash
pnpm e2e:smoke
```

Or the package / `--project` forms listed under Suite discovery.

## CI usage

In `.github/workflows/ci.yml`, job **`e2e-smoke`** executes the smoke suite:

- Installs dependencies, builds, migrates, starts API + web preview against workflow Postgres and Redis services
- Installs Chromium for the e2e package
- Runs `pnpm e2e:smoke`

Database preparation is handled by Playwright `globalSetup` in the current implementation. Do **not** pre-run `e2e:seed` in CI.

For the broader Playwright CI flow (including job **`e2e-full`** / `pnpm e2e`), Chromium install detail, and shared troubleshooting, see [Playwright E2E](playwright-e2e.md).

## Adding a smoke spec

1. Create a `*.spec.ts` file under `e2e/tests/smoke/`.
2. The `smoke` Playwright project discovers it through its configured `testMatch`.
3. Verify with `pnpm e2e:smoke`.

## Relationship to full E2E

The smoke suite is a subset of the repository's Playwright E2E suite. It uses the same tooling, fixtures, and environment, but executes only the smoke Playwright project. For the complete E2E workflow and full-suite execution, see [Playwright E2E](playwright-e2e.md).

## Related documentation

- [Testing strategy](testing-strategy.md)
- [Playwright E2E](playwright-e2e.md)
- [Local development](local-development.md)
````

- [x] **Step 3: Sanity-check the new guide**

Confirm:

1. Section order matches the spec: Purpose → Suite discovery → What the suite is → Running locally → CI usage → Adding a smoke spec → Relationship → Related documentation.
2. No normative “smoke must only…” rules; journey prose uses “at the time of writing”.
3. No headed/`PWDEBUG`/traces/env tables (link playwright-e2e).
4. No Redis / concurrency / purchase-sequence / scalability / fault-tolerance / trade-offs / testing-strategy body duplication.
5. No governance (release gates, flaky policy, ownership, nightly vs PR).
6. Related documentation links resolve to existing files.
7. No Planned section.

---

### Task 2: Wire `docs/testing-strategy.md`

**Files:**

- Modify: `docs/testing-strategy.md`

- [x] **Step 1: Point Smoke section at the guide**

Replace:

```markdown
**CI role:** Playwright smoke provides rapid end-to-end confidence.

Procedures, local debugging, and smoke-specific operational detail belong to Issue #70.
```

with:

```markdown
**CI role:** Playwright smoke provides rapid end-to-end confidence.

Suite discovery, local smoke execution, CI job usage, and how smoke specs are picked up are documented in [Smoke testing](smoke-testing.md).
```

Keep the high-level purpose paragraph and representative command `pnpm e2e:smoke` unchanged.

- [x] **Step 2: Update Related documentation / Planned**

Replace the Related documentation + Planned block with:

```markdown
## Related documentation

- [System architecture](architecture.md)
- [Local development](local-development.md)
- [Playwright E2E](playwright-e2e.md)
- [Smoke testing](smoke-testing.md)
- [Concurrency model](concurrency-model.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)

**Planned work:**

- Issue #71 — Stress testing (k6)
```

Requirements:

- Add [Smoke testing](smoke-testing.md) under Related documentation.
- Remove the Planned line for Issue #70 entirely.
- Leave Issue #71 untouched.
- Do not expand strategy into suite-discovery / CI procedure detail.

---

### Task 3: Thin `docs/playwright-e2e.md` smoke pointers

**Files:**

- Modify: `docs/playwright-e2e.md`

- [x] **Step 1: Update Projects and layout smoke pointer**

Replace:

```markdown
| `smoke` | Smallest suite: critical purchase journey for rapid CI confidence (`tests/smoke/`) |
| `regression` | Broader real-stack journeys beyond smoke (`tests/regression/`) |

Operational config notes: `workers: 1`, `fullyParallel: false`, Desktop Chrome, `trace: 'on-first-retry'`.

Smoke is a **subset** of E2E (same tooling). Deeper smoke workflow guidance belongs to Issue #70.
```

with:

```markdown
| `smoke` | Smallest suite: critical purchase journey for rapid CI confidence (`tests/smoke/`). See [Smoke testing](smoke-testing.md). |
| `regression` | Broader real-stack journeys beyond smoke (`tests/regression/`) |

Operational config notes: `workers: 1`, `fullyParallel: false`, Desktop Chrome, `trace: 'on-first-retry'`.

Smoke is a **subset** of E2E (same tooling). Suite discovery and smoke CI detail: [Smoke testing](smoke-testing.md).
```

Do **not** expand the projects table into `testMatch`, add-a-spec steps, or a smoke CI narrative.

- [x] **Step 2: Thin the Smoke (brief) subsection**

Replace the entire `### Smoke (brief)` subsection so it becomes:

````markdown
### Smoke (brief)

```bash
pnpm e2e:smoke
```

`pnpm e2e:smoke` runs the Playwright smoke project. See [Smoke testing](smoke-testing.md) for how the smoke suite is organized and executed in CI.
````

Remove the sentence “Smoke-specific procedures and operational detail will be expanded in Issue #70.”

Do **not** restate suite discovery (`testMatch`, directory layout) in this subsection. Keep other Running subsections (full suite, by project, file, `-g`, headed, debug) unchanged.

- [x] **Step 3: Remove Planned / remaining #70 placeholders**

Delete the entire trailing Planned section:

```markdown
## Planned

Smoke workflow guidance will be expanded in Issue #70.
```

Search the file for `Issue #70` / `belongs to Issue #70` / `expanded in Issue #70` and ensure none remain.

Leave the overall CI section focused on the Playwright workflow pair (`e2e-smoke` / `e2e-full`); do not duplicate the smoke-focused CI narrative from `smoke-testing.md`.

Optionally add `[Smoke testing](smoke-testing.md)` under Related documentation (reading-flow after Testing strategy is fine). If added, keep the list navigation-only.

---

### Task 4: Verify docs-only completion

**Files:**

- Verify: all files from the file map

- [x] **Step 1: Spec verification checklist**

Confirm against the design verification list:

1. `docs/smoke-testing.md` exists; suite discovery + CI usage covered (AC; issue “tagging” = suite discovery).
2. Purpose = canonical smoke-suite guide; strategy owns why; playwright-e2e owns general Playwright how-to.
3. Section order: Purpose → Suite discovery → What the suite is → Running locally → CI usage → Adding a smoke spec → Relationship → Related documentation.
4. Suite discovery documents Playwright `smoke` project, configured `testMatch`, and `e2e/tests/smoke/`; not annotation `@tag`s; no permanent regex contract wording.
5. Current journey prose is illustrative (“at the time of writing…”).
6. Local commands match root/package scripts; headed/debug/traces/env deferred to playwright-e2e.
7. CI documents `e2e-smoke` → `pnpm e2e:smoke`, workflow services, `globalSetup` database preparation; links playwright-e2e for broader CI; no invented policy.
8. Adding a smoke spec is mechanical (path → suite discovery → verify).
9. Relationship section short; smoke ⊂ Playwright E2E; links runbook.
10. `testing-strategy.md` links smoke guide; #70 removed from Planned; #71 remains.
11. `playwright-e2e.md` keeps smoke command + pointer; no suite-discovery restatement in Running/Smoke; all #70 placeholders gone; empty Planned removed.
12. Cross-links resolve:
    - `testing-strategy.md` → `smoke-testing.md`
    - `playwright-e2e.md` → `smoke-testing.md`
    - `smoke-testing.md` → `testing-strategy.md`, `playwright-e2e.md`, `local-development.md`
13. `README.md` and `docs/architecture.md` unchanged.
14. No duplication of Playwright runbook / strategy / Redis / concurrency / purchase-sequence / scalability / fault-tolerance / trade-offs bodies.
15. Every documented command / script / CI job name exists (`package.json`, `e2e/package.json`, `e2e/playwright.config.ts`, `.github/workflows/ci.yml`).
16. Format touched markdown with `pnpm format:check` (fix via `pnpm format` if needed).

- [x] **Step 2: Confirm expected-unchanged files**

```bash
git status -sb
git diff --name-only
```

Expected changed paths only among:

- `docs/smoke-testing.md` (new)
- `docs/testing-strategy.md`
- `docs/playwright-e2e.md`
- optionally the plan/spec under `docs/superpowers/` if already present in the working tree

`README.md` and `docs/architecture.md` must not appear.

- [x] **Step 3: Format check**

Run:

```bash
pnpm format:check
```

If markdown formatting fails on touched files only, run `pnpm format` and re-check. Do not change unrelated files for style.

- [x] **Step 4: Stop for review**

Do **not** commit unless the user explicitly asks. Summarize files changed and note that #71 waits on EPIC-07.

---

## Self-review (plan author)

**Spec coverage:** Goal/AC → Tasks 1+4. Smoke guide outline → Task 1. Hub edits (testing-strategy + thinned playwright-e2e) → Tasks 2–3. Boundaries/non-goals → Expected unchanged + Task 4 checks 13–15. Terminology (suite discovery vs issue “tagging”), configured `testMatch`, CI `globalSetup` wording, intentional links → Tasks 1–3.

**Placeholders:** None intentional; all #70 forward references are removed by Tasks 2–3.

**Type/name consistency:** Doc title “Smoke testing”; link text `[Smoke testing](smoke-testing.md)` consistent; section title `Related documentation`; “suite discovery” used for AC “tagging”.
