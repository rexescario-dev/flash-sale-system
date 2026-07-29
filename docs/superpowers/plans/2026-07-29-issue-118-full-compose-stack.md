# Issue #118 — Full Local Compose Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [#118](https://github.com/rexescario-dev/flash-sale-system/issues/118) so `docker compose up --build` starts PostgreSQL, Redis, one-shot Prisma migration, API, and web (`vite preview`) without requiring Node.js or pnpm on the host.

The full Compose workflow is the documented local application workflow for this issue. The plan does **not** add or document `pnpm dev` or any host-based web development workflow. Existing host development capabilities are outside the scope of #118 and must not be removed or modified unless explicitly required by another issue.

**Architecture:** Single root multi-stage `Dockerfile` (`base` → `deps` → build stages that produce deploy artifacts → `api` / `web` / `migrate` targets). Compose extends existing `flash-sale` project: service keys `postgres`/`redis`/`migrate`/`api`/`web` with `flash-sale-*` container names. Browser uses baked `VITE_API_URL=http://localhost:3000`; API/migrate use Compose DNS (`postgres`, `redis`). No hot-reload; no EPIC-01 retrofitting. **No host development workflow is introduced by #118.** Docker Compose owns the complete application lifecycle. pnpm is used internally during Docker image builds; runtime containers execute built API and web artifacts directly. Existing PostgreSQL/Redis Compose services remain unchanged and continue to support existing development workflows. #118 does not require or document host Node/pnpm development.

**Tech Stack:** Docker Compose, Node 20 Alpine, Corepack + pnpm 10.30.3, NestJS API, Prisma, Vite React web, existing `GET /health`.

**Spec:** [docs/superpowers/specs/2026-07-29-issue-118-full-compose-stack-design.md](../specs/2026-07-29-issue-118-full-compose-stack-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Out of scope:** Hot-reload Dev Compose; documenting or requiring host `pnpm`/`pnpm dev` workflows; removing existing host scripts; nginx/Caddy; Compose profiles; AuthN; k6; Redis/purchase contract changes; EPIC-01 scope churn; image-size minimization for migrate.

**Hard invariants (locked):**

1. Service DNS: `postgres` / `redis` — never `flash-sale-postgres` / `flash-sale-redis` in URL strings.
2. `VITE_API_URL` at web **build** time = `http://localhost:3000` (browser-reachable).
3. Compose overrides container `DATABASE_URL`, `REDIS_URL`, and API `PORT=3000` even if `.env` differs.
4. Same `DATABASE_URL` for `migrate` and `api`.
5. No auto-migrate inside the API process.
6. API CMD is `node …/dist/main.js` (not `pnpm start`) relative to the final deploy layout.
7. Web serves via `vite preview` on `0.0.0.0:5173`.
8. Full-stack documented workflow: `docker compose up --build` requires no host Node.js or pnpm. Existing infra Compose services (`postgres`/`redis`) remain unchanged for compatibility with any pre-existing host workflows; #118 does not add, document, or require `pnpm dev`.

**Packaging strategy (preferred — confirm in Task 0):**

| Target    | Preferred packaging                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api`     | Build then `pnpm --filter api deploy --prod <dir>` → copy deploy dir into runtime                                                                                  |
| `web`     | Build then `pnpm --filter web deploy <dir>` **without `--prod`** (Vite is a runtime need for `vite preview`) → copy deploy dir into runtime                        |
| `migrate` | Inherit full `deps` install for local Compose simplicity; copy Prisma assets + run existing `prisma:migrate:deploy` script. Image minimization is **out of scope** |

**Fallback (only if Task 0 proves preferred path fails):** preserve the required pnpm workspace dependency layout carefully. Do **not** blindly `COPY node_modules` unless every symlink target required by pnpm is preserved. Prefer fixing `pnpm deploy` over inventing a fragile manual prune.

**Assumed repo facts (MUST be verified in Task 0 before any Dockerfile work):**

| Assumption                                                                             | How Task 0 verifies                                                 |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `packageManager` is `pnpm@10.30.3`                                                     | Read root `package.json`                                            |
| API build = `prisma:generate` + `nest build` → `apps/api/dist/`                        | Read `apps/api/package.json`; build and `ls`                        |
| Domain is separate workspace runtime (`packages/domain/dist`), not bundled into Nest   | Resolve `@flash-sale/domain` after build; inspect compiled requires |
| `prisma:migrate:deploy` uses `DATABASE_URL` from env (localhost default only if unset) | Print script from `apps/api/package.json`                           |
| Vite is a web **devDependency**                                                        | Read `apps/web/package.json`                                        |
| `GET /health` exists                                                                   | Confirm controller path                                             |
| No existing `Dockerfile` / `.dockerignore`                                             | `ls`                                                                |

> **Task 0 is a hard gate.** Do not start Tasks 1–2 until scripts, workspace graph, and build/deploy outputs match these assumptions (or the plan path is updated to match what was found). Record concrete paths in the Task 0 output block below and implement Task 2 against those paths only.

**Shared Compose DB URL (locked string):**

```text
postgresql://flash_sale:flash_sale_dev@postgres:5432/flash_sale
```

**Shared Compose Redis URL:**

```text
redis://redis:6379
```

---

## Task flow

```text
Task 0  →  verify repo + produce concrete deploy paths
Task 1  →  .dockerignore + base + deps (+ migrate stage using full deps)
Task 2  →  build-api → deploy --prod → api runtime
           build-web → deploy (non-prod) → web runtime
Task 3  →  Compose
Task 4  →  Docs
Task 5  →  Verification
```

---

## File map

| File                 | Responsibility                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `Dockerfile`         | Multi-stage: `base`, `deps`, `build-api`, `build-web`, targets `api` / `web` / `migrate` |
| `.dockerignore`      | Lean build context; keep Prisma migrations                                               |
| `docker-compose.yml` | Add `migrate`, `api`, `web`; keep postgres/redis                                         |
| `README.md`          | Dual workflows; no hot-reload note; one-shot migrate                                     |
| `.env.example`       | Document Compose overrides for DB/Redis/`PORT`                                           |

---

## Task 0: Repository / packaging hard gate

**Files:** read-only inspection (no product code changes). **Blocker for Tasks 1–2.**

- [ ] **Step 1: Verify package scripts and Vite placement**

```bash
node -e "const p=require('./package.json'); console.log(p.packageManager)"
node -e "const p=require('./apps/api/package.json'); console.log(p.scripts.build); console.log(p.scripts.start); console.log(p.scripts['prisma:migrate:deploy'])"
node -e "const p=require('./apps/web/package.json'); console.log('vite deps', !!p.dependencies?.vite); console.log('vite devDeps', !!p.devDependencies?.vite)"
test -f apps/api/src/health/health.controller.ts && echo health_ok
test ! -f Dockerfile && test ! -f .dockerignore && echo no_dockerfile_ok
```

Expected (if assumptions hold): pnpm 10.30.3; migrate script uses `DATABASE_URL=${DATABASE_URL:-…}`; Vite only in web `devDependencies`; no root Dockerfile yet.

If migrate needs more than `DATABASE_URL`, record every required env var before Task 3.

- [ ] **Step 2: Verify build outputs and domain linkage**

```bash
pnpm --filter @flash-sale/domain build
pnpm --filter api build
test -f apps/api/dist/main.js
node -e "console.log(require.resolve('@flash-sale/domain',{paths:['./apps/api']}))"
```

Expected: `apps/api/dist/main.js` exists; domain resolves to `packages/domain` (or pnpm store path for that package), **not** a single bundled file inside `apps/api/dist`.

List workspace packages the API/web builds actually need (read `dependencies` / `devDependencies` of `apps/api`, `apps/web`, `packages/domain`). Those names drive which **sources** to `COPY` in build stages — do not copy packages “because they exist.”

- [ ] **Step 3: Probe API `pnpm deploy --prod` (structure + resolve, do not boot Nest)**

```bash
rm -rf /tmp/flash-sale-api-deploy
# deploy after build from Step 2; if deploy complains about missing dist, rebuild first
pnpm --filter api deploy --prod /tmp/flash-sale-api-deploy
```

Verify **artifact structure and dependency graph** (not a live boot):

```bash
# Entrypoint — adjust path if deploy flattens differently; record actual path
test -f /tmp/flash-sale-api-deploy/dist/main.js \
  || test -f /tmp/flash-sale-api-deploy/apps/api/dist/main.js

test -d /tmp/flash-sale-api-deploy/node_modules

cd /tmp/flash-sale-api-deploy
node -e "console.log('domain', require.resolve('@flash-sale/domain'))"
node -e "console.log('prisma', require.resolve('@prisma/client'))"

# Syntax-check entrypoint without starting Nest / connecting to infra
ENTRY="$(test -f dist/main.js && echo dist/main.js || echo apps/api/dist/main.js)"
node --check "$ENTRY"
```

**Do not** `require()`/`node dist/main.js` as a boot test — Nest will try Postgres/Redis immediately.

**Pass criteria for API preferred path:** deploy dir contains API entrypoint, resolves `@flash-sale/domain` and `@prisma/client`, and `node --check` succeeds on the entrypoint.

If any check fails → lock **workspace-layout fallback** for API and document why.

- [ ] **Step 4: Probe web `pnpm deploy` without `--prod`**

```bash
pnpm --filter web build
rm -rf /tmp/flash-sale-web-deploy
pnpm --filter web deploy /tmp/flash-sale-web-deploy
cd /tmp/flash-sale-web-deploy
# Vite must be present for preview
test -d node_modules/vite || test -d node_modules/.pnpm/node_modules/vite \
  || ls node_modules | head
# Record where dist landed
find . -type d -name dist | head
find . -name 'index.html' | head
```

Confirm preview can be invoked from the deploy dir **without** starting a long-lived process beyond a short help/binary check, e.g.:

```bash
cd /tmp/flash-sale-web-deploy
./node_modules/.bin/vite preview --help | head
```

**Pass criteria for web preferred path:** deploy (non-prod) includes Vite tooling + built assets; preview binary works.

If non-prod deploy fails → attempt carefully preserving workspace layout (symlink-safe). Blind `COPY node_modules` from the monorepo root is **not** the default fallback.

Also sanity-check that `--prod` omits Vite (documents why non-prod is required):

```bash
rm -rf /tmp/flash-sale-web-deploy-prod
pnpm --filter web deploy --prod /tmp/flash-sale-web-deploy-prod || true
# Expect vite missing or preview unusable
```

- [ ] **Step 5: Fill Task 0 output block (required handoff to Task 2)**

Copy this into the PR notes / agent scratch (or a short comment at top of `Dockerfile` once created):

```text
Task 0 output:

Migrate:
  env: DATABASE_URL only? yes/no (+ list extras)
  packaging: full deps install (accepted for #118)

API deployment:
  host probe path: /tmp/flash-sale-api-deploy
  entrypoint relative path: _______________
  domain resolved: yes/no
  @prisma/client resolved: yes/no
  node --check: pass/fail
  preferred path usable: yes/no
  fallback reason (if any): _______________
  workspace sources required for build: _______________

Web deployment:
  host probe path: /tmp/flash-sale-web-deploy
  dist / index.html relative path: _______________
  vite present: yes/no
  preferred non-prod deploy usable: yes/no
  fallback reason (if any): _______________
  workspace sources required for build: _______________
```

- [ ] **Step 6: Optional reference commit** — skip unless user asks

---

## Task 1: `.dockerignore` + `base` + `deps` + `migrate`

**Files:**

- Create: `.dockerignore`
- Create: `Dockerfile` (through `migrate` target; api/web completed in Task 2)

- [ ] **Step 1: Add `.dockerignore`**

```gitignore
.git
.github
.husky
.worktrees
**/.turbo
**/coverage
**/node_modules
**/dist
**/.cache
e2e/playwright-report
e2e/test-results
**/playwright-report
**/test-results
.env
.env.*
!.env.example
```

Do **not** ignore `apps/api/prisma/`. Prefer a lean ignore; add exceptions only if a build step fails for a missing needed file.

- [ ] **Step 2: Create `Dockerfile` — `base`, `deps`, `migrate`**

Honest packaging note for migrate (locked for #118):

> Migration image may carry the full installed workspace dependency tree for simplicity. Image minimization is out of scope.

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY e2e/package.json e2e/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile

# migrate: full deps accepted for local Compose simplicity
FROM deps AS migrate
COPY apps/api/prisma apps/api/prisma
COPY apps/api/package.json apps/api/package.json
WORKDIR /app
ENV DATABASE_URL=postgresql://flash_sale:flash_sale_dev@postgres:5432/flash_sale
CMD ["pnpm", "--filter", "api", "prisma:migrate:deploy"]
```

Do not hard-code extra env in the image beyond what Task 0 proved necessary; Compose will supply `DATABASE_URL` at runtime (image `ENV` above is only a build-time default if useful — prefer Compose-only if cleaner).

- [ ] **Step 3: Smoke-build migrate**

```bash
docker build --target migrate -t flash-sale-migrate:test .
```

Expected: success.

- [ ] **Step 4: Optional reference commit** — skip unless user asks

---

## Task 2: `build-api` / `build-web` + deploy artifacts + runtimes

**Files:**

- Modify: `Dockerfile`

> Dockerfile snippets below are **shapes**, not copy-paste gospel. Exact `COPY` lists for workspace **sources** must match Task 0’s dependency-graph list. Exact `CMD` / entrypoint paths must match Task 0’s recorded deploy layout.

### API path (preferred)

```text
deps
  → build-api
      → build required workspace packages (e.g. domain)
      → pnpm --filter api build   # prisma generate + nest build
      → pnpm --filter api deploy --prod /out/api
  → api runtime
      → COPY /out/api → /app
      → CMD node <entrypoint from Task 0>
```

- [ ] **Step 1: Implement `build-api` + `api` stages**

```dockerfile
FROM deps AS build-api
# COPY only workspace sources required by Task 0 graph — example only:
# COPY packages/typescript-config packages/typescript-config
# COPY packages/domain packages/domain
# COPY apps/api apps/api
# Do NOT add eslint-config/types/etc. unless Task 0 showed they are required to build.
RUN pnpm --filter @flash-sale/domain build \
 && pnpm --filter api build \
 && pnpm --filter api deploy --prod /out/api

FROM base AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build-api /out/api/ ./
# HEALTHCHECK: Node 20 fetch — avoids Alpine wget/curl package variance
HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Replace with Task 0 entrypoint path:
CMD ["node", "dist/main.js"]
```

If preferred deploy path failed in Task 0, implement the documented fallback instead — still produce an isolated `/out/api`-like directory in `build-api` before the runtime stage copies it (do not ad-hoc copy random host paths).

Verify:

```bash
docker build --target api -t flash-sale-api:test .
docker run --rm --entrypoint sh flash-sale-api:test -c 'node --check dist/main.js || node --check apps/api/dist/main.js'
```

### Web path (preferred: non-prod deploy)

```text
deps
  → build-web
      → ARG/ENV VITE_API_URL=http://localhost:3000
      → build web
      → pnpm --filter web deploy /out/web    # WITHOUT --prod
  → web runtime
      → COPY /out/web → /app
      → CMD vite preview --host 0.0.0.0 --port 5173
         (via pnpm script or ./node_modules/.bin/vite — match Task 0)
```

- [ ] **Step 2: Implement `build-web` + `web` stages**

```dockerfile
FROM deps AS build-web
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
# COPY workspace sources required by Task 0 graph only
RUN pnpm --filter web build \
 && pnpm --filter web deploy /out/web

FROM base AS web
WORKDIR /app
COPY --from=build-web /out/web/ ./
EXPOSE 5173
# Prefer invoking vite directly (pnpm is for image builds; not the web runtime command):
CMD ["./node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
# Only if Task 0 proves bin path differs under deploy layout, adjust the path — do not prefer `pnpm preview`.
```

**Fallback warning:** If forced to copy from the full workspace instead of deploy, you must preserve pnpm symlink targets. Blind:

```dockerfile
COPY --from=build-web /app/node_modules ./node_modules
```

is **unsafe** unless every linked package path also exists in the image. Prefer repairing `pnpm deploy` over this fallback.

- [ ] **Step 3: Build both targets**

```bash
docker build --target api -t flash-sale-api:test .
docker build --target web --build-arg VITE_API_URL=http://localhost:3000 -t flash-sale-web:test .
```

Expected: both succeed. Record final image workdirs/`CMD` for Task 5 path-agnostic checks.

- [ ] **Step 4: Optional reference commit** — skip unless user asks

---

## Task 3: Compose services

**Files:**

- Modify: `docker-compose.yml`

- [ ] **Step 1: Extend Compose**

Keep existing `postgres` / `redis`. Append:

```yaml
migrate:
  container_name: flash-sale-migrate
  build:
    context: .
    target: migrate
  environment:
    DATABASE_URL: postgresql://flash_sale:flash_sale_dev@postgres:5432/flash_sale
  depends_on:
    postgres:
      condition: service_healthy
  restart: 'no'

api:
  container_name: flash-sale-api
  build:
    context: .
    target: api
  ports:
    - '3000:3000'
  env_file:
    - .env
  environment:
    DATABASE_URL: postgresql://flash_sale:flash_sale_dev@postgres:5432/flash_sale
    REDIS_URL: redis://redis:6379
    PORT: '3000'
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    migrate:
      condition: service_completed_successfully

web:
  container_name: flash-sale-web
  build:
    context: .
    target: web
    args:
      VITE_API_URL: http://localhost:3000
  ports:
    - '5173:5173'
  depends_on:
    api:
      condition: service_healthy
```

Notes:

- Reviewers need a root `.env` (`cp .env.example .env`) for `env_file`. Explicit `environment` keys always win for DB/Redis/`PORT`.
- Web → api `service_healthy` is **full-stack readiness convenience**, not a Vite network dependency.
- Rely on Dockerfile `HEALTHCHECK` so Compose `service_healthy` works.

- [ ] **Step 2: Optional reference commit** — skip unless user asks

---

## Task 4: Docs

**Files:**

- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Update README**

Document the Docker-based full Compose workflow for #118 only. Do **not** add or expand a host `pnpm dev` / host web workflow in README as part of this issue. Leave pre-existing host-oriented sections untouched unless they conflict; prefer adding a clear **Full Compose stack** section rather than rewriting the whole README around host apps.

````markdown
## Local stack

### Full Compose stack

```bash
cp .env.example .env
docker compose up --build
```
````

Starts the complete five-service stack:

- `flash-sale-postgres`
- `flash-sale-redis`
- `flash-sale-migrate` — one-shot Prisma migration; exits with code 0
- `flash-sale-api`
- `flash-sale-web` — serves the production web build with `vite preview`

No Node.js or pnpm installation is required on the host.

Source changes require rebuilding the images:

```bash
docker compose up --build
```

Endpoints:

- Web: http://localhost:5173
- API: http://localhost:3000
- GraphQL: http://localhost:3000/graphql

The API container connects to PostgreSQL and Redis using Compose service DNS:

- PostgreSQL: `postgres:5432`
- Redis: `redis:6379`

The web build uses `VITE_API_URL=http://localhost:3000`, which is reachable by the browser from the host.

````

Leave existing E2E docs intact; do not claim this stack replaces Playwright lifecycle. Do not document `pnpm --filter api prisma:*` or `pnpm dev` as part of the #118 Compose path.

- [ ] **Step 2: Update `.env.example`**

Near `DATABASE_URL` / `REDIS_URL` / `PORT`:

```bash
# These localhost values are used for local configuration outside the Compose network.
# When running the full Docker Compose stack, Compose overrides DATABASE_URL,
# REDIS_URL, and API PORT=3000 for the api/migrate containers.
# Containers use Compose service DNS:
#   PostgreSQL: postgres:5432
#   Redis: redis:6379
````

- [ ] **Step 3: Optional reference commit** — skip unless user asks

---

## Task 5: Verification (DoD)

**Files:** none (commands only)

- [ ] **Step 1: Fresh full stack**

```bash
docker compose down -v
docker compose up --build -d
docker compose ps -a
docker compose logs migrate --no-color | tail -40
```

Expected: migrate exited 0; postgres/redis/api/web running; api healthy.

- [ ] **Step 2: API + GraphQL**

```bash
curl -sf http://localhost:3000/health
curl -sf http://localhost:3000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ __typename }"}'
```

Expected: health 200; GraphQL reachable.

- [ ] **Step 3: Web load + baked API URL (path-agnostic)**

```bash
curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:5173/

docker compose exec web sh -c "grep -R 'localhost:3000' /app 2>/dev/null | head -5"
docker compose exec web sh -c "grep -RE 'http://api:|http://flash-sale-api' /app 2>/dev/null | head -5 || true"
```

Acceptance:

- Web returns 200
- Built assets under `/app` contain `localhost:3000`
- Must **not** contain `http://api:` or `http://flash-sale-api`

If Task 2 recorded a narrower dist path, you may also grep that specific path, but `/app` search is the default acceptance check.

- [ ] **Step 4: Existing postgres/redis services still start alone**

```bash
docker compose down
docker compose up -d postgres redis
docker compose ps
```

Expected: only postgres + redis long-running. Do **not** require verifying host `pnpm`/`pnpm dev` as part of #118.

- [ ] **Step 5: Migrate failure gate**

Create throwaway override `docker-compose.migrate-fail.yml`:

```yaml
services:
  migrate:
    environment:
      DATABASE_URL: postgresql://flash_sale:flash_sale_dev@invalid-host:5432/flash_sale
```

```bash
docker compose -f docker-compose.yml -f docker-compose.migrate-fail.yml up --build migrate api
docker compose -f docker-compose.yml -f docker-compose.migrate-fail.yml ps -a
docker compose -f docker-compose.yml -f docker-compose.migrate-fail.yml logs migrate --no-color | tail -40
docker compose -f docker-compose.yml -f docker-compose.migrate-fail.yml down
rm -f docker-compose.migrate-fail.yml
```

Expected from `ps -a` / logs:

- migrate exited **non-zero**
- api **never** reached running/healthy (`service_completed_successfully` gate)

- [ ] **Step 6: Naming**

```bash
docker compose up --build -d
docker ps --format '{{.Names}}' | sort
docker compose down
```

Expected running names include `flash-sale-postgres`, `flash-sale-redis`, `flash-sale-api`, `flash-sale-web`.

- [ ] **Step 7: Optional reference commit / PR** — only when user asks

---

## Spec coverage checklist

| Spec requirement                                           | Task |
| ---------------------------------------------------------- | ---- |
| Root multi-stage Dockerfile targets api/web/migrate        | 1–2  |
| pnpm in images / Corepack 10.30.3                          | 1    |
| `VITE_API_URL=http://localhost:3000` bake                  | 2–3  |
| Compose DNS for DB/Redis; PORT=3000                        | 3    |
| Same DATABASE_URL migrate+api                              | 3    |
| One-shot migrate; no API auto-migrate                      | 1, 3 |
| API healthcheck; web waits on healthy api (readiness only) | 2–3  |
| vite preview :5173                                         | 2–3  |
| Infra-only workflow preserved                              | 3–5  |
| README + .env.example                                      | 4    |
| Fresh `down -v` + migrate-failure gate (`ps -a`)           | 5    |
| flash-sale-* container names                               | 3, 5 |
| API `deploy --prod` / web non-prod `deploy` preferred      | 0, 2 |
| Task 0 hard gate + concrete paths for Task 2               | 0    |
| Migrate may use full deps (minimization OOS)               | 1    |

## Placeholder / ambiguity scan

- No architectural TBD. Packaging path decided by Task 0 with recorded paths.
- Dockerfile examples are labeled as shapes; Task 2 must follow Task 0 output paths only.
- Blind workspace `node_modules` copy is explicitly **not** the default web fallback.
