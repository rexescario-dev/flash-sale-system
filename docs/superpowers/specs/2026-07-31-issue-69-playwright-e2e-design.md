# #69 — Document Playwright E2E execution

**Date:** 2026-07-31  
**Issue:** [#69](https://github.com/rexescario-dev/flash-sale-system/issues/69)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `4dc3be7` (#66 via PR #154)

## Goal

Add a focused Playwright operational runbook — `docs/playwright-e2e.md` — that documents **commands and prerequisites** for running and debugging this repository’s Playwright E2E suite **as implemented**, wire it from strategy / architecture / local-dev hubs, and minimally retarget the README so newcomers can find the runbook. Build on `docs/testing-strategy.md`; do not duplicate Redis strategy, concurrency model, purchase sequence, scalability, fault tolerance, technology trade-offs, or the testing-strategy body — link instead. Leave smoke workflow depth to #70. Do not expand README into the doc hub (#73).

## Acceptance criteria (issue)

- [ ] Commands and prerequisites for Playwright E2E are documented

Satisfied by `docs/playwright-e2e.md` covering prerequisites, lifecycle, env vars actually used, primary scripts, operator affordances supported by the current config, current CI jobs, and repository-specific troubleshooting — with hubs and README pointing at that canonical runbook.

## Approach

**Focused runbook (Approach 1):**

| Surface                     | Role after #69                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `docs/playwright-e2e.md`    | **Canonical** operational runbook for Playwright (execution, debugging, repository-specific configuration, and current CI usage) |
| `docs/testing-strategy.md`  | Layer _why_; link the runbook; remove #69 from Planned                                                                           |
| `docs/architecture.md`      | Related-docs link (alphabetical)                                                                                                 |
| `docs/local-development.md` | Stack provisioning; retarget E2E lifecycle/seed/CI pointers → runbook (not README)                                               |
| `README.md`                 | Brief E2E overview + primary commands (`pnpm e2e`, `pnpm e2e:smoke`) + link to runbook — **minimal retarget only**               |
| Future smoke guide (#70)    | Deepens smoke workflow; #69 leaves a short smoke subsection + forward reference                                                  |
| Future k6 / stress (#71)    | Unchanged; still planned under EPIC-07                                                                                           |

**Rejected alternatives:** Expanding `testing-strategy.md` into a procedure manual (mixes strategy and operations); making README the canonical runbook (fights #73); package-local `e2e/README.md` as sole canonical doc (weaker hub discoverability).

## Goals

- Meet #69 AC with a repository-centric runbook (not a general Playwright manual).
- Document current-state core **plus** standard Playwright CLI affordances usable against this config without new scripts or reporters.
- Preserve EPIC-08 ownership: strategy = why; runbook = how; local-dev = bring stack up; architecture = index; README = onboarding + quick commands.
- Leave #70 a natural place to expand smoke without reorganizing docs.
- Prefer lean docs #73 can later index.

## Non-goals

- Duplicating bodies of Redis strategy, concurrency model, purchase sequence, scalability, fault tolerance, technology trade-offs, or testing strategy (link only).
- Screenshot / video policies, flake playbooks, or extensive best-practice essays not backed by repo configuration.
- Invented CI policies, branch-protection essays, or future workflow design.
- Full smoke operational guide (#70).
- k6 / stress documentation (#71 / EPIC-07).
- README hub expansion or full #73.
- Application, schema, Compose, CI workflow, or test-suite code changes.
- Reopening #134 CSS AC; starting unscoped #73 or EPIC-07 / #71 / #74.

## Ownership model

| Concern                                         | Owner after #69             |
| ----------------------------------------------- | --------------------------- |
| Testing strategy / layer intent                 | `docs/testing-strategy.md`  |
| Playwright operational runbook                  | `docs/playwright-e2e.md`    |
| Smoke procedures / workflow depth               | #70 → future smoke guide    |
| Local stack provisioning & port troubleshooting | `docs/local-development.md` |
| System shape + documentation index              | `docs/architecture.md`      |
| Onboarding + quick commands                     | `README.md`                 |
| Stress / k6                                     | #71 / EPIC-07               |
| Final README as doc hub                         | #73                         |

**Conflict rule:** Strategy owns _why_ / layers. Runbook owns _how to operate this repo’s Playwright setup_. Local-dev owns bringing the application stack up. Architecture indexes live docs. README onboards with primary commands and links. #70 owns smoke workflow depth. Do not copy Redis / concurrency / purchase-sequence / scalability / fault-tolerance / trade-offs / testing-strategy bodies into the runbook.

**Hub maintenance rule:** Implemented docs move into Related documentation; only unfinished work remains under Planned.

**Depth rule (locked):** Current-state core + supported Playwright operator affordances (`--project`, path / `-g`, `--headed`, `PWDEBUG`, trace viewing for configured `trace: 'on-first-retry'`). No aspirational reporters or non-configured media.

## Design

### `docs/playwright-e2e.md` shape

Document sections (reader order):

1. **Title / purpose** — `# Playwright E2E` (or equivalent clear title). Explicitly state this is the **canonical operational runbook** for this repository’s Playwright suite. Testing philosophy and layer rationale live in [Testing strategy](testing-strategy.md).

2. **Prerequisites** — Highest → lowest dependency chain:
   1. Local development environment — link [Local development](local-development.md)
   2. Node / pnpm (engines as in root package)
   3. Infrastructure (Postgres + Redis) healthy
   4. API and web application running and reachable
   5. Browser install as used today: `pnpm --filter @flash-sale/e2e exec playwright install chromium --with-deps`

3. **Lifecycle** — Short **numbered** sequence (not long prose):
   1. Postgres / Redis healthy
   2. Migrations applied
   3. API + web started
   4. Playwright `globalSetup`: readiness (`waitForStack`) + `pnpm --filter api e2e:seed`
   5. Tests run

   Call out: **canonical seed ownership is Playwright `globalSetup`**; do not pre-seed in CI. Manual `pnpm --filter api e2e:seed` is **debug only** (writes repo-root `e2e/seed-state.json`; override with `E2E_SEED_STATE_PATH`).

4. **Environment variables** — Only variables actually consumed by the E2E package / readiness / seed path wiring:
   - `E2E_BASE_URL` — default `http://127.0.0.1:5173`
   - `E2E_API_HEALTH_URL` — default `http://127.0.0.1:3000/health`
   - `E2E_SEED_STATE_PATH` — default repo-root `e2e/seed-state.json`

   Pointer only to local-development for underlying application env / alternate ports (`PORT`, `VITE_API_URL`, `REDIS_URL`, etc.).

5. **Projects & layout** — Top-level `e2e/` (`@flash-sale/e2e`). Briefly explain repository meaning:
   - **`smoke`** — smallest Playwright project; critical purchase journey; rapid CI confidence (`testMatch: smoke/`)
   - **`regression`** — broader real-stack journeys (`testMatch: regression/`)
   - Config notes that matter operationally: `workers: 1`, `fullyParallel: false`, `trace: 'on-first-retry'`, Desktop Chrome

6. **Running** — Day-to-day progression:
   - Full suite: `pnpm e2e` (root → `@flash-sale/e2e` `test:e2e` → both projects)
   - Smoke: `pnpm e2e:smoke` — brief; smoke workflow depth → Issue #70 / future smoke guide
   - Project: `pnpm --filter @flash-sale/e2e exec playwright test --project=smoke` (or `regression`) / package scripts `test:smoke` / `test:regression`
   - Single file / path filter
   - Title/name filter `-g`
   - Headed: `--headed`
   - Debug: `PWDEBUG=1`

   Prefer root scripts where they exist; show filter/`exec` forms when needed for affordances.

7. **Traces** — Document only configured behavior: `trace: 'on-first-retry'`; how to open a produced trace. No screenshot/video policies.

8. **CI (as implemented)** — Document the current CI behavior as reflected in the repository and README. Existing jobs in `.github/workflows/ci.yml`:
   - `e2e-smoke` runs `pnpm e2e:smoke`
   - `e2e-full` runs `pnpm e2e`
   - Both jobs participate as required PR checks per current README / workflow comments (do not introduce historical “Option A” terminology in the permanent runbook)
   - Canonical seed via `globalSetup` only — do not pre-run `e2e:seed` in CI
   - Chromium install step as in workflow

   Resist branch-protection / future workflow design essays.

9. **Troubleshooting** — Ordered by likelihood:
   1. Services / stack not running
   2. Readiness timeout (`E2E_API_HEALTH_URL` / `E2E_BASE_URL`)
   3. Port mismatch (API/web vs env)
   4. Redis / Postgres conflicts — link local-development troubleshooting
   5. Seed-state path / stale `e2e/seed-state.json` issues

10. **Related documentation** — Navigation only (use this section title consistently; relative links under `docs/`):
    - [Testing strategy](testing-strategy.md)
    - [Local development](local-development.md)
    - [System architecture](architecture.md)

11. **Planned** — Brief: smoke workflow guidance will be expanded in Issue #70. No other placeholders.

### Hub / README / strategy edits

**`README.md` (minimal retarget):**

- Keep short E2E overview and primary commands.
- Add link to `docs/playwright-e2e.md` as the full execution / debug / CI guide.
- Trim only what would otherwise duplicate the runbook (lifecycle/seed detail can point to the runbook rather than grow). No new hub sections. Prefer describing current CI behavior without historical “Option A” wording in new or rewritten sentences.

**`docs/testing-strategy.md`:**

- E2E section: replace “Operational runbooks… Issue #69” with a concrete link to `playwright-e2e.md`.
- Related documentation / Planned: add runbook under Related documentation (or as the E2E operational pointer); remove #69 from Planned; keep #70 / #71 as planned until those docs exist.
- Do not expand strategy into procedures.

**`docs/architecture.md`:**

- Add `[Playwright E2E](playwright-e2e.md)` under the existing `## Related docs` section (keep that hub heading as-is), alphabetical by title among live files. New runbook prose uses `## Related documentation`.

**`docs/local-development.md`:**

- Retarget E2E lifecycle / seed / CI pointers from README → `playwright-e2e.md`.
- Keep Compose/host setup and port/Redis troubleshooting here; runbook links back for those.

## Boundary with siblings

| Doc / issue          | Owns                                                            |
| -------------------- | --------------------------------------------------------------- |
| #68 Testing strategy | Why layers exist; strategy-level seed ownership sentence        |
| #69 Playwright E2E   | How to run / debug this repo’s Playwright; current CI job usage |
| #70 Smoke testing    | Smoke workflow / procedures / operational detail                |
| #71 / EPIC-07        | k6 stress strategy, scenarios, results, CI integration          |
| Local development    | Bring stack up; port/Redis troubleshooting                      |
| Architecture         | Index of focused docs                                           |
| #73 README           | Top-level doc hub assembly (beyond intentional small retargets) |

Minimal duplication: README and strategy may name `pnpm e2e` / `pnpm e2e:smoke`; runbook owns step-by-step execution and operator affordances. Smoke command appears briefly in #69 with forward reference; #70 owns depth.

## Out of scope

- Creating a separate smoke documentation file (#70)
- Edits to Redis / concurrency / purchase-sequence / scalability / fault-tolerance / trade-offs bodies beyond inbound links if needed
- Code, schema, Compose, CI workflow, or Playwright suite changes
- New automated tests for documentation
- Committing until explicitly requested

## Verification

Docs-only checklist:

1. `docs/playwright-e2e.md` exists and documents prerequisites + commands (AC).
2. Purpose states canonical operational runbook; strategy owns philosophy.
3. Prerequisites ordered dependency-chain style; link local-development.
4. Lifecycle is a numbered sequence; `globalSetup` seed ownership explicit; no CI pre-seed.
5. Env section limited to E2E-consumed vars with defaults matching `playwright.config.ts` / `readiness.ts` / `global-setup.ts`.
6. Smoke and regression project meanings stated; smoke depth deferred to #70.
7. Running covers full / smoke / project / file / `-g` / headed / `PWDEBUG`.
8. Traces document only `on-first-retry`.
9. CI names existing jobs only; no invented policies.
10. Troubleshooting ordered by likelihood; port/Redis detail links local-dev.
11. Related docs navigation-only; Planned mentions #70 briefly.
12. `testing-strategy.md` links runbook; #69 removed from Planned.
13. `architecture.md` Related documentation includes Playwright E2E alphabetically.
14. `local-development.md` E2E pointers retarget to runbook.
15. README keeps primary commands + runbook link; no hub expansion.
16. No duplication of Redis / concurrency / purchase-sequence / scalability / fault-tolerance / trade-offs / testing-strategy bodies.
17. Every documented command and referenced root/package script exists in the repository.
18. Format touched markdown with the repo’s canonical check: `pnpm format:check` (fix via `pnpm format` if needed).

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #69 AC satisfied via `docs/playwright-e2e.md`.
- Strategy, architecture, local-dev, and README discover the runbook without making README the hub.
- Clear separation from #70 and from other EPIC-08 architecture docs.
- Documentation reflects existing behavior only; no commit until explicitly requested.
