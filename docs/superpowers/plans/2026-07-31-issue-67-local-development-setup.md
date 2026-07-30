# #67 Local Development Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `docs/local-development.md` the canonical local-development guide and replace README setup walkthroughs with a thin Compose-first Quick Start that links to it.

**Architecture:** Docs-only extract + thin Quick Start (Approach 1 / Hybrid C). Move validated local-setup wording from `README.md`; add host/`pnpm` path using existing package and Compose commands only. No app, Compose, or script behavior changes. Not #73.

**Tech Stack:** Markdown at repo root and `docs/`; existing Docker Compose, pnpm workspace scripts, `scripts/verify-compose.sh`.

**Base:** `main` @ `7393301` (or later `origin/main` if still fast-forwardable). Working tree must stay limited to #67 doc files plus this plan/spec.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes unstaged/staged as appropriate for review.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-67-local-development-setup-design.md`

---

## File map

| File                                                                           | Responsibility                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `docs/local-development.md`                                                    | **Create** — canonical local-development guide (all setup detail)              |
| `README.md`                                                                    | **Modify** — thin Quick Start; extract setup sections; keep non-setup sections |
| `docs/superpowers/specs/2026-07-31-issue-67-local-development-setup-design.md` | Already written; keep in sync only if implementation discovers a wording fix   |
| `docs/superpowers/plans/2026-07-31-issue-67-local-development-setup.md`        | This plan                                                                      |

**Expected unchanged:** `docker-compose.yml`, `.env.example`, `scripts/verify-compose.sh`, `apps/**`, `e2e/**`, `package.json` scripts, CI workflows.

**README sections to extract (setup-primary):**

| Current README section                      | Disposition                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `## Requirements`                           | Fold into Quick Start prereqs + guide Prerequisites (avoid dual full lists) |
| `## Local stack` (+ Verify Compose)         | Move into guide Path A; README keeps only Quick Start subset                |
| `## Local endpoints`                        | Move into guide Verification / endpoints; Quick Start lists three URLs      |
| Port / Redis collision block under `## E2E` | Move into guide Troubleshooting                                             |
| Compose DNS / bake notes inside Local stack | Move into guide Path A / Environment                                        |

**README sections to leave (non-setup / project understanding):**

| Section                | Notes                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Title + overview       | Keep; light touch OK                                                                            |
| `## Scripts`           | Keep as project reference; do not duplicate as a second full table in the guide                 |
| `## Workspace layout`  | Keep                                                                                            |
| `## Redis`             | Keep design + link to `docs/redis-caching-strategy.md`; drop pure Compose-run DNS if duplicated |
| `## E2E`               | Keep lifecycle, seed ownership, CI Option A; remove moved collision commands                    |
| `## Architecture note` | Keep                                                                                            |

---

### Task 1: Create `docs/local-development.md`

**Files:**

- Create: `docs/local-development.md`

- [ ] **Step 1: Write the canonical guide**

Create `docs/local-development.md` with sections in this order. Prefer **move** of wording from current `README.md` Local stack / endpoints / collision notes. Phrase Compose env as **behavior** (values supplied by the stack; normally no need to edit those in `.env` for Compose). Do **not** invent commands.

Required sections:

1. **Title + intro** — Canonical local-dev guide. Near the top: choose **one** day-to-day workflow (full Compose **or** host/`pnpm` with Compose infra only); do not start API and web twice.
2. **Prerequisites** — Docker Compose for full stack or infra; Node `>=20 <23` + pnpm 10+ for host path / non-Compose tooling.
3. **Environment** — `cp .env.example .env` at repo root. Compose supplies DB/Redis/API port for that path; host path uses localhost values from `.env.example`.
4. **Path A — Full Docker Compose** — Move existing README Compose walkthrough (commands, current stack service descriptions, rebuild note, endpoints, `VITE_API_URL` bake notes, optional `bash scripts/verify-compose.sh`). Prefer “current Docker Compose stack” framing over a forever “five-service” claim in headings.
5. **Path B — Host / pnpm (Compose infra)** — Start infra services only (confirm names in the current Compose file), `pnpm install`, existing Prisma migrate scripts, `pnpm dev` / filter `dev`. Endpoints match Path A unless env overrides ports.
6. **Database** — Compose: document current migration behavior of the stack; no separate Compose migrate ritual. Host: existing Prisma scripts. Seed: `e2e:seed` is E2E/debug only; Playwright `globalSetup` owns real-stack seeding (pointer). Reset: existing Compose `down -v` + bring-up only.
7. **Verification** — Reuse existing verification commands from the repo where possible (especially `scripts/verify-compose.sh`): health, GraphQL success (e.g. `__typename`), web HTTP. Optional: existing test / smoke / verify-compose helpers.
8. **Troubleshooting** — Move Redis/API port collision notes and env overrides from README E2E (same commands).
9. **Common tasks** — Pointer table of representative existing development, testing, formatting, and E2E commands the repo actually exposes — no invented rows; do not duplicate README Scripts documentation.

- [ ] **Step 2: Sanity-check commands against the repo**

Before finishing the file, validate every documented command against the current repository:

- Confirm referenced Compose services exist in the current Compose file (do not hard-code service names in this checklist).
- Confirm package scripts, Compose invocations, and helper scripts (`scripts/verify-compose.sh`, etc.) match what the docs cite.
- Prefer aligning health/GraphQL/web checks with existing helper-script patterns.

Expected: every cited command maps to an existing script, helper, or Compose service.

---

### Task 2: Reshape `README.md` Quick Start + extract

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Replace the existing setup-focused sections (currently including Requirements, Local stack, and Local endpoints) with a Quick Start**

Keep title/overview. Exact headings may differ if README drifted — replace whatever is setup-focused today.

Quick Start should:

- Emphasize that the Compose workflow is the recommended fastest first run.
- List Docker (Docker Compose) as the prerequisite for this path.
- Show `cp .env.example .env` and `docker compose up --build`.
- List the three local URLs (web, API, GraphQL).
- Include a quick verify that reuses an existing verification command from the repo where possible (e.g. health check pattern from `scripts/verify-compose.sh`).
- Link to `[Local development](docs/local-development.md)` for host/`pnpm`, env details, migrations, seed, troubleshooting, and full verification.

Then keep: Scripts table, Workspace layout, Redis (design + link; drop pure run-path DNS if duplicated), E2E (lifecycle, seed ownership, commands, CI Option A; remove moved collision block; optional one-line pointer to local-dev Troubleshooting), Architecture note.

Rules:

- Quick Start = Compose only; no mirrored host walkthrough.
- No competing step-by-step setup left in README.
- Mixed Redis sentence: leave design; move Compose DNS run detail if still duplicated.
- Do not add EPIC-08 stub index links.

- [ ] **Step 2: Diff-read for orphaned setup**

Skim README end-to-end. Confirm there is no second full Compose walkthrough and no leftover collision recipe that contradicts the guide.

Expected: setup detail only in `docs/local-development.md`; README Quick Start + link.

---

### Task 3: Docs verification (DoD)

**Files:**

- Verify: `docs/local-development.md`, `README.md`

- [ ] **Step 1: Command existence check**

Validate every documented command against the current repository (package scripts, Compose configuration, or existing helper scripts). Fix any invented command before finishing.

- [ ] **Step 2: Conflict check**

Confirm:

1. Commands exist.
2. No conflicting step-by-step setup between README and `docs/local-development.md`.
3. README Quick Start alone reaches Compose endpoints; host detail lives only in the guide.
4. Format touched markdown:

```bash
pnpm exec prettier --write README.md docs/local-development.md
```

Expected: Prettier exits 0; files remain readable.

- [ ] **Step 3: Issue AC self-check**

Confirm docs explain Docker, API, and frontend startup for Compose and host paths. Do not close the GitHub issue unless the user asks.

- [ ] **Step 4: Stop before commit**

Do not `git commit` unless the user explicitly requests it. Leave the working tree ready for review.

---

## Spec coverage (self-review)

| Spec requirement                                        | Task |
| ------------------------------------------------------- | ---- |
| Canonical `docs/local-development.md`                   | 1    |
| Thin README Quick Start + link                          | 2    |
| Both Compose and host/`pnpm` paths                      | 1    |
| Choose one workflow                                     | 1    |
| Env behavior phrasing                                   | 1    |
| Migrations / seed / reset rules                         | 1    |
| Lightweight verification + existing helpers             | 1    |
| Move collision troubleshooting                          | 1–2  |
| Common tasks pointer table (no script docs duplication) | 1    |
| Leave Redis / E2E / architecture / workspace / Scripts  | 2    |
| No conflicting setup; command existence; prettier       | 3    |
| No commits until asked                                  | 3    |
| Move, don’t rewrite; mixed-sentence rule                | 1–2  |

## Placeholder scan

None intentional. If implementation finds README wording that cannot move cleanly, preserve meaning and prefer the README’s validated commands over paraphrases that change behavior.
