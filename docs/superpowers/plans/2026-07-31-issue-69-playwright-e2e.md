# #69 Playwright E2E Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `docs/playwright-e2e.md` documenting prerequisites and commands for this repository’s Playwright E2E suite, and wire it from testing strategy, architecture, local development, and a minimal README retarget.

**Architecture:** Docs-only focused runbook (Approach 1). New canonical Playwright operational guide; update hubs and README pointers. Build on `docs/testing-strategy.md`; do not duplicate Redis/concurrency/purchase-sequence/scalability/fault-tolerance/trade-offs/testing-strategy bodies. Smoke depth deferred to #70. No app, schema, CI, Compose, or test changes.

**Tech Stack:** Markdown under `docs/` (+ minimal `README.md` retarget).

**Base:** `main` @ `4dc3be7` (or later `origin/main` if still fast-forwardable). Working tree must stay limited to #69 doc files plus this plan/spec.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-69-playwright-e2e-design.md`

---

## File map

| File                                                                  | Responsibility                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `docs/playwright-e2e.md`                                              | **Create** — canonical Playwright operational runbook                                                              |
| `docs/testing-strategy.md`                                            | **Modify** — link runbook from E2E; Related documentation + Planned drops #69                                      |
| `docs/architecture.md`                                                | **Modify** — Related docs alphabetical, include Playwright E2E                                                     |
| `docs/local-development.md`                                           | **Modify** — retarget E2E lifecycle/seed/CI pointers from README → runbook                                         |
| `README.md`                                                           | **Modify** — minimal retarget: keep overview + primary commands; link runbook; avoid historical “Option A” wording |
| `docs/superpowers/specs/2026-07-31-issue-69-playwright-e2e-design.md` | Already written (editorial refinements applied); update only if implementation reveals an inconsistency            |
| `docs/superpowers/plans/2026-07-31-issue-69-playwright-e2e.md`        | This plan                                                                                                          |

**Expected unchanged:** `docs/concurrency-model.md`, `docs/redis-caching-strategy.md`, `docs/purchase-sequence.md`, `docs/scalability-strategy.md`, `docs/fault-tolerance-strategy.md`, `docs/technology-trade-offs.md`, `apps/**`, `packages/**`, `e2e/**` (code), Compose, CI workflows, package scripts.

**Related-docs ordering rule:** `docs/architecture.md` orders related documents alphabetically as the documentation hub. Other docs may use reading-flow order. Do not “fix” one ordering to match the other.

---

### Task 1: Create `docs/playwright-e2e.md`

**Files:**

- Create: `docs/playwright-e2e.md`

- [x] **Step 1: Write the Playwright E2E runbook**

Create `docs/playwright-e2e.md`. The following outline and examples describe the required content and structure. Wording may be adjusted to match repository conventions provided the documented behavior remains accurate and ownership/scope do not change:

````markdown
# Playwright E2E

This is the **canonical operational runbook** for this repository’s Playwright end-to-end suite: how to run it, debug it, and interpret the repository-specific configuration and current CI usage.

Testing philosophy and where Playwright fits in the layered strategy live in [Testing strategy](testing-strategy.md).

## Prerequisites

Bring up dependencies in this order:

1. **Local development environment** — follow [Local development](local-development.md) (Compose or host path).
2. **Node / pnpm** — repository `engines` require Node `>=20 <23`; use the workspace `pnpm` via Corepack as documented in local development.
3. **Infrastructure** — PostgreSQL and Redis healthy.
4. **API and web running** — migrated API and web app reachable at the URLs you will pass to Playwright (defaults below).
5. **Browser** — install Chromium for the e2e package (same command CI uses):

```bash
pnpm --filter @flash-sale/e2e exec playwright install chromium --with-deps
```
````

## Lifecycle

Real-stack E2E follows this sequence:

1. Postgres and Redis are healthy.
2. Migrations are applied.
3. API and web are started.
4. Playwright `globalSetup` runs: readiness check (`waitForStack`) then `pnpm --filter api e2e:seed`.
5. Tests execute under the configured projects.

**Canonical seed ownership** is Playwright `globalSetup`. Do **not** pre-seed in CI.

Manual seed is **debug only**:

```bash
pnpm --filter api e2e:seed
```

That writes repo-root `e2e/seed-state.json` (override with `E2E_SEED_STATE_PATH`).

## Environment variables

Variables consumed by the E2E package / readiness / seed path wiring:

| Variable              | Default                         | Role                                    |
| --------------------- | ------------------------------- | --------------------------------------- |
| `E2E_BASE_URL`        | `http://127.0.0.1:5173`         | Web base URL for Playwright + readiness |
| `E2E_API_HEALTH_URL`  | `http://127.0.0.1:3000/health`  | API health URL polled before seeding    |
| `E2E_SEED_STATE_PATH` | repo-root `e2e/seed-state.json` | Path written/read for seeded sale IDs   |

For application environment variables and alternate ports (`PORT`, `VITE_API_URL`, `REDIS_URL`, and so on), see [Local development](local-development.md).

## Projects and layout

Playwright lives in the top-level `e2e/` package (`@flash-sale/e2e`), with config in `e2e/playwright.config.ts` and specs under `e2e/tests/`.

| Project      | Meaning in this repository                                                         |
| ------------ | ---------------------------------------------------------------------------------- |
| `smoke`      | Smallest suite: critical purchase journey for rapid CI confidence (`tests/smoke/`) |
| `regression` | Broader real-stack journeys beyond smoke (`tests/regression/`)                     |

Operational config notes: `workers: 1`, `fullyParallel: false`, Desktop Chrome, `trace: 'on-first-retry'`.

Smoke is a **subset** of E2E (same tooling). Deeper smoke workflow guidance belongs to Issue #70.

## Running

From the repository root, with the real stack already up:

### Full suite

```bash
pnpm e2e
```

Runs smoke and regression (root script → `@flash-sale/e2e` `test:e2e`).

### Smoke (brief)

```bash
pnpm e2e:smoke
```

Runs the `smoke` project only. Smoke-specific procedures and operational detail will be expanded in Issue #70.

### By project

```bash
pnpm --filter @flash-sale/e2e test:smoke
pnpm --filter @flash-sale/e2e test:regression
```

Equivalent:

```bash
pnpm --filter @flash-sale/e2e exec playwright test --project=smoke
pnpm --filter @flash-sale/e2e exec playwright test --project=regression
```

### Single file or directory

```bash
pnpm --filter @flash-sale/e2e exec playwright test tests/smoke/purchase.smoke.spec.ts
pnpm --filter @flash-sale/e2e exec playwright test tests/regression
```

Paths are relative to the `e2e/` package (see `testDir: './tests'` in config).

### Filter by title (`-g`)

```bash
pnpm --filter @flash-sale/e2e exec playwright test -g "purchase"
```

### Headed mode

```bash
pnpm --filter @flash-sale/e2e exec playwright test --headed
```

Combine with `--project` or a path as needed.

### Debug mode

```bash
PWDEBUG=1 pnpm --filter @flash-sale/e2e exec playwright test tests/smoke/purchase.smoke.spec.ts
```

## Traces

The suite sets `trace: 'on-first-retry'`. On CI (or when retries are enabled), a failed-then-retried test can produce a trace artifact under Playwright’s output directory.

Open a trace with:

```bash
pnpm --filter @flash-sale/e2e exec playwright show-trace path/to/trace.zip
```

This repository does not configure screenshot or video capture policies for E2E.

## CI

Documented behavior matches `.github/workflows/ci.yml` and the README:

- Job **`e2e-smoke`** installs Chromium, starts API + web preview against workflow services, then runs `pnpm e2e:smoke`.
- Job **`e2e-full`** follows the same stack bring-up, then runs `pnpm e2e`.
- Both jobs are required checks on pull requests (as currently documented for this repository).
- Seed exclusively via Playwright `globalSetup` — workflows must not pre-run `e2e:seed`.

This section describes current workflow behavior only. It is not a branch-protection or future CI design guide.

## Troubleshooting

Likely failures first:

1. **Stack not running** — Confirm Postgres, Redis, API health, and web per [Local development — Verification](local-development.md#verification).
2. **Readiness timeout** — `globalSetup` polls `E2E_API_HEALTH_URL` then `E2E_BASE_URL` (60s default). Ensure those URLs match the process you started.
3. **Port mismatch** — If API/web listen on non-defaults, set matching `E2E_API_HEALTH_URL` / `E2E_BASE_URL` (and rebuild web with the matching `VITE_API_URL` when needed). See [Local development — Troubleshooting](local-development.md#troubleshooting).
4. **Redis / Postgres conflicts** — Port collisions and alternate URLs are covered in local development troubleshooting.
5. **Seed-state issues** — Confirm `e2e/seed-state.json` (or `E2E_SEED_STATE_PATH`) was written by the latest `globalSetup` / debug seed and matches the DB under test.

## Related documentation

- [Testing strategy](testing-strategy.md)
- [Local development](local-development.md)
- [System architecture](architecture.md)

## Planned

Smoke workflow guidance will be expanded in Issue #70.

````

- [x] **Step 2: Sanity-check against repo facts**

Confirm before leaving Task 1:

1. Defaults match `e2e/playwright.config.ts` and `e2e/readiness.ts`.
2. `workers` / `fullyParallel` / `trace` / projects match `e2e/playwright.config.ts`.
3. Root scripts `e2e` / `e2e:smoke` and package scripts `test:e2e` / `test:smoke` / `test:regression` exist.
4. CI job names and commands match `.github/workflows/ci.yml` (`e2e-smoke` → `pnpm e2e:smoke`, `e2e-full` → `pnpm e2e`).
5. No links to Redis/concurrency/purchase-sequence/scalability/fault-tolerance/trade-offs bodies (strategy/local-dev/architecture only).
6. No “Option A” wording; no screenshot/video policies; smoke depth deferred to #70.

---

### Task 2: Wire `docs/testing-strategy.md`

**Files:**

- Modify: `docs/testing-strategy.md`

- [x] **Step 1: Point E2E lifecycle at the runbook**

Replace:

```markdown
**Lifecycle (strategy level):** Real stack. Playwright `globalSetup` owns deterministic seeding for the suite. Operational runbooks and troubleshooting belong to Issue #69.
````

with:

```markdown
**Lifecycle (strategy level):** Real stack. Playwright `globalSetup` owns deterministic seeding for the suite. Operational execution, debugging, and troubleshooting are documented in [Playwright E2E](playwright-e2e.md).
```

- [x] **Step 2: Update Related documentation / Planned**

In `## Related documentation`, add the runbook (reading-flow after local development is fine):

```markdown
## Related documentation

- [System architecture](architecture.md)
- [Local development](local-development.md)
- [Playwright E2E](playwright-e2e.md)
- [Concurrency model](concurrency-model.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)

**Planned work:**

- Issue #70 — Smoke testing guide
- Issue #71 — Stress testing (k6)
```

Remove the Planned line for Issue #69 entirely.

Leave the Smoke section’s “belong to Issue #70” sentence unchanged.

---

### Task 3: Wire `docs/architecture.md`

**Files:**

- Modify: `docs/architecture.md`

- [x] **Step 1: Add Playwright E2E to Related docs (alphabetical)**

Under `## Related docs`, insert alphabetically by link title. Expected list after edit:

```markdown
## Related docs

- [Concurrency model](concurrency-model.md)
- [Fault tolerance strategy](fault-tolerance-strategy.md)
- [Local development](local-development.md)
- [Playwright E2E](playwright-e2e.md)
- [Purchase sequence](purchase-sequence.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Scalability strategy](scalability-strategy.md)
- [Technology trade-offs](technology-trade-offs.md)
- [Testing strategy](testing-strategy.md)
```

Do **not** rename the hub heading `## Related docs`.

---

### Task 4: Retarget `docs/local-development.md`

**Files:**

- Modify: `docs/local-development.md`

- [x] **Step 1: Point seed / E2E lifecycle at the runbook**

Replace the Seed subsection pointer:

```markdown
For real-stack E2E, Playwright `globalSetup` owns seeding (readiness check + `pnpm --filter api e2e:seed`). See the README [E2E](../README.md#e2e) section for lifecycle and CI notes.
```

with:

```markdown
For real-stack E2E, Playwright `globalSetup` owns seeding (readiness check + `pnpm --filter api e2e:seed`). See [Playwright E2E](playwright-e2e.md) for lifecycle, commands, and CI notes.
```

- [x] **Step 2: Retarget troubleshooting E2E pointer**

Replace:

```markdown
For E2E lifecycle, seed ownership, and CI requirements, see [README — E2E](../README.md#e2e).
```

with:

```markdown
For E2E lifecycle, seed ownership, and CI behavior, see [Playwright E2E](playwright-e2e.md).
```

Keep port/Redis troubleshooting content in this file. Optional helpers may still list `pnpm e2e:smoke` / `pnpm e2e`.

---

### Task 5: Minimal README retarget

**Files:**

- Modify: `README.md`

- [x] **Step 1: Retarget the E2E section**

Update the existing `## E2E` section so it remains a concise overview that keeps primary commands and points to the runbook (survive small README drift on `main`). Target shape:

````markdown
## E2E

Real-stack Playwright suite under `e2e/` (smoke + regression). Canonical seed ownership is Playwright `globalSetup` — do not pre-seed in CI.

```bash
pnpm e2e:smoke
pnpm e2e
```
````

Full prerequisites, lifecycle, environment variables, project filters, headed/debug modes, traces, CI jobs, and troubleshooting: [Playwright E2E](docs/playwright-e2e.md).

Port and Redis collisions: see [Local development — Troubleshooting](docs/local-development.md#troubleshooting).

CI runs `e2e-smoke` and `e2e-full` as required checks on pull requests.

```

Requirements:

- Keep primary commands visible.
- Link `docs/playwright-e2e.md`.
- Do **not** use historical “Option A” wording in new/rewritten sentences.
- No new documentation-hub sections (#73).
- Scripts table rows for `pnpm e2e` / `pnpm e2e:smoke` may remain unchanged.

---

### Task 6: Verify docs-only completion

**Files:**

- Verify: all files from the file map

- [x] **Step 1: Spec verification checklist**

Confirm against the design verification list:

1. `docs/playwright-e2e.md` exists; AC (commands + prerequisites) covered.
2. Purpose = canonical operational runbook; strategy owns philosophy.
3. Prerequisites dependency-ordered; link to local-development.
4. Numbered lifecycle; `globalSetup` seed ownership; no CI pre-seed.
5. Env defaults match `playwright.config.ts` / `readiness.ts` / `global-setup.ts`.
6. Smoke/regression meanings stated; smoke depth → #70.
7. Running covers full / smoke / project / file / `-g` / headed / `PWDEBUG`.
8. Traces only `on-first-retry`.
9. CI documents existing jobs only; no invented policies; no “Option A”.
10. Troubleshooting ordered by likelihood; port/Redis → local-dev.
11. Related documentation navigation-only; Planned mentions #70.
12. `testing-strategy.md` links runbook; #69 removed from Planned.
13. `architecture.md` Related docs includes Playwright E2E alphabetically.
14. `local-development.md` E2E pointers → runbook.
15. README primary commands + runbook link; no hub expansion.
16. No duplication of Redis / concurrency / purchase-sequence / scalability / fault-tolerance / trade-offs / testing-strategy bodies.
17. Every documented command, environment variable, script, and CI job referenced in the runbook exists in the repository.
18. Format touched markdown with the repository’s markdown formatting check (currently `pnpm format:check`; fix via `pnpm format` if needed).

- [x] **Step 2: Format check**

Run the repository’s markdown formatting check (currently `pnpm format:check`).

If markdown formatting fails on touched files only, run `pnpm format` and re-check. Do not change unrelated files for style.

- [x] **Step 3: Stop for review**

Do **not** commit unless the user explicitly asks. Summarize files changed and note that #70 is next for smoke depth.

---

## Self-review (plan author)

**Spec coverage:** Goal/AC → Tasks 1+6. Runbook outline → Task 1. Hub/README/strategy/local-dev edits → Tasks 2–5. Boundaries/non-goals → Expected unchanged + Task 6 checks 16–17. Editorial rules (Related documentation, relative links, no Option A, format command) → Tasks 1/5/6.

**Placeholders:** None intentional beyond #70 planned note required by spec.

**Type/name consistency:** Doc title “Playwright E2E”; link text consistent across hubs; section title `Related documentation` in new runbook and testing-strategy; architecture keeps `Related docs`.
```
