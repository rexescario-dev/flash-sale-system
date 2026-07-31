# #73 Finalize README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `README.md` the canonical reviewer entry point by making every #73 AC topic discoverable through intentional README content or links to existing documentation hubs, while preserving the thin README structure.

**Architecture:** Docs-only hybrid README (Approach 1). Add Overview/Features near the top; keep Try the app / Quick Start / Scripts / Workspace; thin operational `## E2E`; add thin `## API`; add AC-minimal `## Documentation` index; remove standalone Redis and Architecture note sections. Build on existing hubs; do not duplicate architecture, concurrency, Redis, purchase sequence, scalability, fault tolerance, trade-offs, testing strategy, Playwright, or smoke bodies — link instead. No new stub docs. No app, schema, CI, Compose, or test changes.

**Tech Stack:** Markdown (`README.md`).

**Base:** `main` @ `6baee39` (or later `origin/main` if still fast-forwardable). Implementation working tree for this issue should stay limited to `README.md` plus this plan/spec under `docs/superpowers/`.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-73-finalize-readme-design.md`

---

## File map

| File                                                                   | Responsibility                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `README.md`                                                            | **Modify** — finalize thin entry point per approved design                                         |
| `docs/superpowers/specs/2026-07-31-issue-73-finalize-readme-design.md` | Already written (editorial polish applied); update only if implementation reveals an inconsistency |
| `docs/superpowers/plans/2026-07-31-issue-73-finalize-readme.md`        | This plan                                                                                          |

**Expected unchanged:** all `docs/*.md` hubs (`architecture`, `concurrency-model`, `redis-caching-strategy`, `local-development`, `testing-strategy`, `playwright-e2e`, `smoke-testing`, `technology-trade-offs`, `purchase-sequence`, `scalability-strategy`, `fault-tolerance-strategy`), `apps/**`, `packages/**`, `e2e/**`, Compose, CI workflows, package scripts.

---

### Task 1: Rewrite `README.md` to the approved section order

**Files:**

- Modify: `README.md`

- [x] **Step 1: Confirm hub targets and inbound `#scripts` anchor still needed**

From repository root:

```bash
test -f docs/architecture.md
test -f docs/concurrency-model.md
test -f docs/redis-caching-strategy.md
test -f docs/local-development.md
test -f docs/testing-strategy.md
test -f docs/playwright-e2e.md
test -f docs/smoke-testing.md
test -f docs/technology-trade-offs.md
rg -n "^## Future evolution" docs/technology-trade-offs.md
rg -n "README.md#scripts" docs/local-development.md
```

Expected: all files exist; `## Future evolution` present; local-development still references `README.md#scripts`.

- [x] **Step 2: Replace `README.md` with the finalized content**

Write `README.md` exactly as below (wording may be lightly adjusted for Prettier/table alignment **only if** ownership, section order, AC mapping, and k6 labeling stay intact — do not add extra sections or hub rows):

````markdown
# Flash Sale System

A concurrency-safe flash-sale system built with NestJS, GraphQL, React, TypeScript, PostgreSQL, Redis, and Playwright. Future scalability validation may include k6 load testing.

## Overview

Flash Sale System is a modular monolith that demonstrates transactional inventory reservation, a GraphQL customer API, Redis as a non-authoritative cache and rate-limit layer, and a layered automated testing strategy. PostgreSQL remains the source of truth for inventory and purchases.

## Features

- Flash sale catalog and purchase lifecycle
- Concurrency-safe stock reservation and purchase flow
- GraphQL API for catalog and purchase operations
- PostgreSQL as the transactional source of truth
- Redis-assisted query caching and purchase rate limiting
- Automated unit, integration, smoke, and E2E testing
- Future scalability validation may include k6 load testing

## Try the app

> **Reviewers / first look — start here.**  
> Bring up Docker, load demo seed data, and exercise the UI in a few minutes. Compose alone migrates an empty database; the seed step is what populates flash sales you can browse and purchase.

**Prerequisites:** Docker (Compose), plus Node.js `>=20 <23` and [pnpm](https://pnpm.io) 10+ for the seed command.

```bash
cp .env.example .env
docker compose up --build -d

# Wait until the API is healthy
curl -sf http://localhost:3000/health

pnpm install
pnpm --filter api e2e:seed
```

**Open the app:** [http://localhost:5173](http://localhost:5173)

**What to try**

1. Confirm the catalog shows seeded sales (for example **E2E Active Ten-Pack**, **E2E Active Last Unit**).
2. Set a local user id in the identity strip (required before purchase).
3. Open an **ACTIVE** sale and complete a purchase; check **My purchases**.

Also available: API [http://localhost:3000](http://localhost:3000) · GraphQL [http://localhost:3000/graphql](http://localhost:3000/graphql).

Full local workflows, env details, and troubleshooting: [Local development](docs/local-development.md).

---

## Quick Start

Stack-only bring-up (no seed) — useful when you only need containers healthy. **No Node.js/pnpm on the host.** For a catalog you can click through, use [Try the app](#try-the-app) above.

**Prerequisite:** Docker (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

**Endpoints:**

- Web: http://localhost:5173
- API: http://localhost:3000
- GraphQL: http://localhost:3000/graphql

Quick verify (expect `{ "status": "ok" }`):

```bash
curl -sf http://localhost:3000/health
```

For host/`pnpm` workflows, environment details, migrations, seed, troubleshooting, and full verification, see [Local development](docs/local-development.md).

## Scripts

| Command                             | Description                   |
| ----------------------------------- | ----------------------------- |
| `pnpm dev`                          | Start API + web via Turborepo |
| `pnpm --filter api dev`             | NestJS API (watch)            |
| `pnpm --filter web dev`             | Vite web                      |
| `pnpm build`                        | Build all packages/apps       |
| `pnpm typecheck`                    | Typecheck the workspace       |
| `pnpm lint`                         | Lint the workspace            |
| `pnpm test`                         | Run tests                     |
| `pnpm format` / `pnpm format:check` | Prettier format / check       |
| `pnpm e2e:smoke`                    | Playwright smoke (real stack) |
| `pnpm e2e`                          | Playwright smoke + regression |

## Workspace layout

```text
apps/
  api/          # NestJS + Prisma + GraphQL (code-first)
  web/          # React + Vite
e2e/            # Playwright real-stack smoke + regression
packages/
  domain/       # @flash-sale/domain
  typescript-config/
  eslint-config/
  types/        # @flash-sale/types (non-domain contracts only)
```

## E2E

Real-stack Playwright suite under `e2e/` (smoke + regression). Canonical seed ownership is Playwright `globalSetup` — do not pre-seed in CI.

```bash
pnpm e2e:smoke
pnpm e2e
```

- Full Playwright prerequisites, lifecycle, environment variables, headed/debug modes, traces, CI jobs, and troubleshooting: [Playwright E2E](docs/playwright-e2e.md)
- Smoke suite discovery and smoke CI usage: [Smoke testing](docs/smoke-testing.md)

Port and Redis collisions: see [Local development — Troubleshooting](docs/local-development.md#troubleshooting).

## API

The customer surface is a GraphQL API served by the NestJS app.

- GraphQL: [http://localhost:3000/graphql](http://localhost:3000/graphql)
- API health: [http://localhost:3000/health](http://localhost:3000/health)

For the modular-monolith topology and request paths, see [Architecture](docs/architecture.md).

## Documentation

| Topic        | Document                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------ |
| Architecture | [System architecture](docs/architecture.md)                                                |
| Concurrency  | [Concurrency model](docs/concurrency-model.md)                                             |
| Redis        | [Redis caching & rate-limit strategy](docs/redis-caching-strategy.md)                      |
| Setup        | [Local development](docs/local-development.md)                                             |
| Testing      | [Testing strategy](docs/testing-strategy.md)                                               |
| Trade-offs   | [Technology trade-offs](docs/technology-trade-offs.md)                                     |
| Future work  | [Technology trade-offs — Future evolution](docs/technology-trade-offs.md#future-evolution) |
````

Content rules while writing:

- Do **not** restore standalone `## Redis` or `## Architecture note`.
- Do **not** add Documentation rows for purchase sequence, scalability, fault tolerance, Playwright, or smoke.
- Do **not** add screenshot placeholders or `#72` TODO comments.
- Do **not** imply k6 is implemented today.
- Do **not** expand E2E into Playwright architecture / fixtures / tags / retries / CI narrative beyond the short orientation already in the template.
- Preserve heading text `## Scripts` so `#scripts` remains valid.

- [x] **Step 3: Confirm section headings match the design order**

```bash
rg -n "^## " README.md
```

Expected headings in order:

```text
## Overview
## Features
## Try the app
## Quick Start
## Scripts
## Workspace layout
## E2E
## API
## Documentation
```

Also confirm these are absent:

```bash
rg -n "^## Redis$|^## Architecture note$" README.md
```

Expected: no matches.

---

### Task 2: Verify AC discoverability, links, and formatting

**Files:**

- Verify: `README.md`
- Do not modify hub docs

- [x] **Step 1: AC discoverability checklist**

Confirm each AC topic is discoverable:

| AC topic     | Check in `README.md`                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| Overview     | `## Overview` present with short prose                                            |
| Features     | `## Features` present with 3–7 bullets                                            |
| Architecture | Documentation links to `docs/architecture.md`                                     |
| Concurrency  | Documentation links to `docs/concurrency-model.md`                                |
| Redis        | Documentation links to `docs/redis-caching-strategy.md`                           |
| API          | `## API` with GraphQL/health endpoints + architecture pointer                     |
| Setup        | Try the app / Quick Start preserved + Documentation → `docs/local-development.md` |
| Testing      | Scripts e2e rows + `## E2E` + Documentation → `docs/testing-strategy.md`          |
| Trade-offs   | Documentation → `docs/technology-trade-offs.md`                                   |
| Future work  | Documentation → `docs/technology-trade-offs.md#future-evolution`                  |

- [x] **Step 2: Resolve every README markdown link target**

```bash
python3 - <<'PY'
import re, pathlib, sys
text = pathlib.Path('README.md').read_text()
targets = re.findall(r'\[[^\]]+\]\(([^)]+)\)', text)
missing = []
for t in targets:
    if t.startswith('http://') or t.startswith('https://'):
        continue
    path, _, frag = t.partition('#')
    if path and not pathlib.Path(path).exists():
        missing.append(t)
        continue
    if frag and path.endswith('.md'):
        body = pathlib.Path(path).read_text()
        # GitHub-style: lowercase, spaces->-, strip punctuation-ish
        headings = re.findall(r'^(#{1,6})\s+(.+)$', body, flags=re.M)
        anchors = set()
        for _, title in headings:
            a = title.strip().lower()
            a = re.sub(r'[^\w\s-]', '', a)
            a = re.sub(r'\s+', '-', a)
            anchors.add(a)
        if frag not in anchors:
            missing.append(t)
if missing:
    print('MISSING:', *missing, sep='\n  ')
    sys.exit(1)
print(f'OK: {len(targets)} links checked')
PY
```

Expected: `OK: … links checked` and exit 0.

- [x] **Step 3: Guard against scope creep and k6 overclaim**

```bash
rg -n "screenshot|TODO|#72|#71|docs/overview|docs/features|docs/api\.md|docs/future-work" README.md || true
rg -n "k6" README.md
```

Expected:

- No screenshot / TODO / stub-doc / #72 / #71 leakage in README
- Every `k6` hit is in planned/future wording (intro and/or Features bullet using the approved phrasing)

Also confirm Playwright/smoke are only under E2E (not Documentation table):

```bash
rg -n "playwright-e2e|smoke-testing" README.md
```

Expected: matches only in the `## E2E` section (not under Documentation).

- [x] **Step 4: Format check**

```bash
pnpm format:check -- README.md
```

If it fails, run:

```bash
pnpm format -- README.md
pnpm format:check -- README.md
```

Expected: format check passes. Re-run the heading-order check from Task 1 Step 3 if Prettier reflows anything material (it should not change headings).

- [x] **Step 5: Diff scope check**

```bash
git status --short
git diff --stat
```

Implementation changes should be limited to `README.md`. Spec/plan under `docs/superpowers/` may also appear as untracked/modified planning artifacts; do **not** edit hub docs, apps, e2e, CI, or Compose.

- [x] **Step 6: Do not commit**

Stop for review. Commit only if the user explicitly asks. When asked, preferred message shape:

```text
docs: finalize README as thin entry point with documentation index
```

Include `README.md` and, if the user wants planning artifacts in the same commit, the `#73` spec/plan under `docs/superpowers/`.

---

## Plan self-review

1. **Spec coverage:** Goal/AC mapping, Overview/Features, Try the app/Quick Start/Scripts/Workspace preserve, E2E thin pointer, API thin pointer, AC-minimal Documentation, Redis/Architecture removal, k6 planned labeling, no stub docs, no #72 placeholders, `#scripts` preservation, format check, no-commit rule — all covered by Tasks 1–2.
2. **Placeholder scan:** No TBD/TODO implementation steps; full README body provided.
3. **Ownership consistency:** Documentation excludes Playwright/smoke/purchase-sequence/scalability/fault-tolerance; E2E owns Playwright/smoke links; architecture remains deeper navigation hub.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-31-issue-73-finalize-readme.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
