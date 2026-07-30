# #67 — Document local development setup

**Date:** 2026-07-31  
**Issue:** [#67](https://github.com/rexescario-dev/flash-sale-system/issues/67)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved (chat)  
**Base:** `main` @ `7393301` (EPIC-10 / #128 via PR #145)

## Goal

Establish a single authoritative local-development guide and a thin README Quick Start so a contributor can answer: **"How do I get this project running on my machine?"**

## Acceptance criteria (issue)

- [ ] Docs explain Docker, API, and frontend startup

Satisfied by documenting **both** the full Docker Compose workflow and the host/`pnpm` workflow (with Postgres/Redis via Compose infra).

## Approach

**Hybrid + Extract (Approach 1 / location C):**

| Surface                         | Role                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `docs/local-development.md`     | **Canonical** local-development reference                            |
| `README.md` Quick Start         | Concise onboarding (~5 minutes); Compose-first; links to the guide   |
| Remaining README non-setup bits | Unchanged until dedicated EPIC-08 issues or #73                      |

Prefer **move, don’t rewrite** when extracting from the current README. Preserve user-facing local-dev notes (for example port / Redis collision guidance) by moving them. Content that is not local-development-specific stays in the README.

## Goals

- Make `docs/local-development.md` the canonical local-development guide.
- Give `README.md` a thin Quick Start ending with a link to that guide.
- Document Compose and host/`pnpm` startup paths using existing supported commands.
- Prefer moving validated wording over rewriting.

## Non-goals

- Architecture, concurrency, Redis design rationale, testing philosophy, or CI documentation work.
- EPIC-08 documentation index / stub links to docs that do not exist yet.
- Application, infrastructure, or script behavior changes.
- Final README assembly (#73).
- Reopening prior implementation issues (#134 CSS AC, #77 health endpoint work, etc.).
- **No behavioral changes** — documentation describes the current project state only; do not invent or recommend new workflows.
- **Verification commands reuse existing supported commands only** — do not invent alternate startup, migration, seed, or health-check workflows for documentation.

## Ownership model

| Concern                         | Owner after #67                                      |
| ------------------------------- | ---------------------------------------------------- |
| How to run locally (detail)     | `docs/local-development.md`                          |
| Fastest first run               | `README.md` Quick Start                              |
| How the system works / design   | Stay in README (or later dedicated docs), not #67    |
| Final README as doc hub         | #73                                                  |

**Conflict rule (DoD):** After extraction, no competing step-by-step setup remains between README and `docs/local-development.md`. README = Quick Start + link; detail lives in the guide.

## Design

### `docs/local-development.md` shape

Document sequence (contributor order):

1. **Prerequisites** — Docker / Docker Compose; Node.js `>=20 <23` and pnpm 10+ for the host path.
2. **Environment** — Copy `.env.example` → `.env` at **repository root**. Phrase Compose env as behavior: when using Docker Compose, DB/Redis/API port values are supplied by the Compose configuration; developers normally do not need to edit those in `.env` for that path. Host path uses the localhost values from `.env.example` as today.
3. **Path A — Full Compose** — `docker compose up --build`; the current Docker Compose stack; endpoints; rebuild note; optional `bash scripts/verify-compose.sh`.
4. **Path B — Host / pnpm** — Postgres + Redis via Compose; migrate with existing API Prisma scripts; `pnpm` / filter `dev` for API + web.
5. **Database** — Compose: document the current migration behavior performed by the Compose stack; do not introduce a separate Compose migration workflow. Host: cite existing `pnpm --filter api prisma:migrate:deploy` / `prisma:migrate`. Seed: `pnpm --filter api e2e:seed` is **E2E/debug only**; note Playwright `globalSetup` owns seeding in real-stack E2E (pointer only). Reset: only document existing patterns (for example Compose `down -v` then bring the stack back up so migrate runs again)—no invented product “dev seed” or “reset DB” command.
6. **Verification** (lightweight) — `GET /health` → `{ "status": "ok" }`; GraphQL endpoint responds successfully (for example using the existing `__typename` query); web loads on `:5173`; optional existing test / smoke / verify-compose helpers.
7. **Troubleshooting** — Move existing port `:3000` / Redis `:6379` collision notes and env overrides from README; do not invent new recipes.
8. **Common tasks** — Pointer table referencing existing scripts without duplicating their documentation.

Near the top: **choose one** day-to-day workflow (full Compose **or** host/`pnpm` with infra containers) so API/web are not started twice.

### README after #67

- Keep project overview (and light existing framing).
- Add **Quick Start** optimized for the fastest successful first run (Compose only): prerequisites → clone context → `cp .env.example .env` → `docker compose up --build` → endpoints → brief verify → link to `docs/local-development.md` (host workflow lives there).
- **Extract** setup-primary sections into the guide (`Local stack`, local run endpoints used only for verify, collision notes, etc.).
- **Leave alone** (criterion: helps understand the project rather than get it running): Redis strategy blurb (link to `docs/redis-caching-strategy.md`), E2E lifecycle / CI notes, architecture note, workspace layout.
- **Keep** the Scripts table as a project reference; only drop rows that become literal duplicates of Quick Start.
- Mixed sentences (half setup / half design): leave design in README; move only run-path details.

### Extraction rule

When extracting from `README.md`, preserve any user-facing notes still relevant to local development by **moving** them rather than rewriting. Any content that is not local-development-specific remains in the README until its dedicated documentation issue or #73.

## Out of scope

- #61–#66, #68–#74 documentation topics
- EPIC-07 stress / k6 work
- Changing health endpoint semantics (#77), Compose stack, or seed ownership
- New automated tests for documentation

## Verification

Docs-only checklist:

1. Every command cited exists in root / `apps/api` / `apps/web` `package.json` or `scripts/verify-compose.sh`.
2. No conflicting step-by-step setup between the two files.
3. README Quick Start alone reaches Compose endpoints; host detail does not contradict README.
4. Prettier (or repo format check) on touched markdown only.

No new Jest / Vitest / Playwright cases required.

## Success criteria

- Both Compose and host/`pnpm` workflows documented.
- Single canonical local-development guide at `docs/local-development.md`.
- README provides only a thin Quick Start for local run.
- Documentation reflects existing behavior only.

## Suggested EPIC-08 follow-on order (context only)

Not part of #67 delivery: #67 → #61 → #63 → #68 → remaining feature docs → #73 → #71 (after EPIC-07 #60) → #74.
