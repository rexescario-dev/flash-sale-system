# Issue #118 — Full Local Application Stack in Docker Compose (Design Spec)

**Status:** Draft (pending user review — revised after feedback)
**Date:** 2026-07-29
**Issue:** [#118](https://github.com/rexescario-dev/flash-sale-system/issues/118)
**Repository:** `rexescario-dev/flash-sale-system`
**Depends on:** `main` at/after `4214bc6` (EPIC-06 #116 + Compose/env #117)
**Not** an EPIC-01 scope change — separate infrastructure / developer-experience issue

## Goal

Extend the existing Compose environment beyond PostgreSQL + Redis so a reviewer can clone the repository, run **one command**, and get the complete application stack without installing Node/pnpm locally.

```bash
docker compose up --build
```

starts the complete **five-service** stack: `flash-sale-migrate` runs to completion and exits with code 0, while the four long-running services remain active:

- `flash-sale-postgres`
- `flash-sale-redis`
- `flash-sale-migrate` (one-shot Prisma migrate; exits 0)
- `flash-sale-api`
- `flash-sale-web` (`vite preview` on `:5173`)

Then:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- GraphQL: `http://localhost:3000/graphql`

## Architectural principle

> Production-like containers — **not** hot-reload / bind-mount Dev Compose. Source changes in the full Compose stack require rebuilding the web/API images.

> Migrations run in a dedicated one-shot service. The API process must **not** auto-migrate on every startup.

> Browser-reachable URLs and Compose-internal DNS are distinct. `VITE_API_URL` is baked for the host browser; API infrastructure URLs use Compose service DNS.

## Locked decisions

| Area                          | Decision                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope framing                 | Separate DX/infra issue; do not fold into EPIC-01                                                                                                                      |
| Web serve                     | `vite preview` on `0.0.0.0:5173` (not nginx/Caddy; not `vite dev`)                                                                                                     |
| Dockerfile layout             | Single root multi-stage `Dockerfile` with dedicated targets: `api`, `web`, `migrate`                                                                                   |
| pnpm                          | Corepack + `pnpm@10.30.3` (match root `packageManager`); images install with `pnpm install --frozen-lockfile`                                                          |
| Runtime dependency packaging  | Prefer `pnpm deploy --prod` for isolated API (and web if workable); fall back to preserving the required workspace `node_modules` layout if deploy is awkward          |
| Compose project               | `name: flash-sale` (unchanged from #117)                                                                                                                               |
| Service keys                  | `postgres`, `redis`, `migrate`, `api`, `web`                                                                                                                           |
| Container names               | `flash-sale-postgres`, `flash-sale-redis`, `flash-sale-migrate`, `flash-sale-api`, `flash-sale-web`                                                                    |
| Internal DNS                  | API/migrate use `postgres:5432` and `redis:6379` (service names, not container names)                                                                                  |
| Browser API URL               | `VITE_API_URL=http://localhost:3000` (build-time bake; never Docker-internal DNS)                                                                                      |
| Infra-only workflow           | Explicit: `docker compose up -d postgres redis` then host `pnpm dev`                                                                                                   |
| Full-stack workflow           | Explicit: `docker compose up --build`                                                                                                                                  |
| Migrate vs API                | Dedicated migrate target/service; `restart: "no"`; api waits for `service_completed_successfully`                                                                      |
| API runtime CMD               | `node apps/api/dist/main.js` (Node + compiled app + prod deps; not `pnpm start`)                                                                                       |
| API published port            | Compose always sets `PORT=3000` to match `ports: ["3000:3000"]` and healthcheck                                                                                        |
| Web runtime                   | Keeps tooling needed for `pnpm --filter web preview …`                                                                                                                 |
| API healthcheck               | **In scope** — `GET /health` via healthcheck; web depends on `api` `service_healthy` as a **full-stack readiness convenience** (not a Vite preview network dependency) |
| Env precedence                | Use `.env` for non-infra config; explicitly override container values that must match Compose networking/ports (`DATABASE_URL`, `REDIS_URL`, `PORT=3000`)              |
| Migrate env                   | Self-sufficient from Compose env (no baked `.env`); verify `prisma:migrate:deploy` needs (at least `DATABASE_URL`; add `NODE_ENV`/other only if required)              |
| Migrate ↔ API DB              | Same Compose PostgreSQL credentials/database for both services                                                                                                         |
| Profiles / nginx / AuthN / k6 | Out of scope                                                                                                                                                           |

## Architecture

```text
Browser
   │
   │ http://localhost:5173
   ▼
flash-sale-web  (vite preview)
   │
   │ GraphQL (browser-reachable)
   │ http://localhost:3000/graphql
   ▼
flash-sale-api
   │
   ├──► postgres:5432   (Compose service DNS)
   └──► redis:6379      (Compose service DNS)
```

### Networking distinction

| Consumer                       | Variable       | Value                            | Why                                                     |
| ------------------------------ | -------------- | -------------------------------- | ------------------------------------------------------- |
| Browser (baked into web build) | `VITE_API_URL` | `http://localhost:3000`          | Reachable from host browser, not Docker DNS             |
| API / migrate containers       | `DATABASE_URL` | `postgresql://…@postgres:5432/…` | Compose service DNS (identical value for migrate + api) |
| API container                  | `REDIS_URL`    | `redis://redis:6379`             | Compose service DNS                                     |
| API container                  | `PORT`         | `3000`                           | Must match published port and healthcheck               |

### Lifecycle

```text
postgres healthy
      │
      ▼
migrate → prisma migrate deploy → exit 0
      │
      ├──────────────────┐
      ▼                  ▼
redis healthy        api starts
                         │
                         ▼
                    /health healthy
                         │
                         ▼
                       web
```

Notes:

- `migrate` depends only on **postgres** healthy (not redis).
- `api` depends on postgres healthy, redis healthy, and migrate `service_completed_successfully`.
- `web` waits for API health so `docker compose up` reaches a usable full-stack state before the web service starts. This is a **startup/readiness convenience**, not a network dependency of Vite preview (static assets do not require the API to serve `dist`).

Compose conditions (locked):

```yaml
migrate:
  depends_on:
    postgres:
      condition: service_healthy
  restart: 'no'

api:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    migrate:
      condition: service_completed_successfully
  environment:
    PORT: '3000'
  healthcheck:
    test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:3000/health']
    # exact tool may vary by Alpine base packages during implementation

web:
  depends_on:
    api:
      condition: service_healthy
```

`depends_on` provides ordering/readiness gates, not a substitute for application-level correctness. API healthcheck turns Nest readiness into a Compose signal.

## §1 — Compose + env

### Workflows

```bash
# Host-based development (infra only)
docker compose up -d postgres redis
pnpm dev

# Full containerized stack (no hot reload; rebuild images after source changes)
docker compose up --build
```

With five services defined, plain `docker compose up` starts **all** services. Document the two explicit workflows above; do not imply infra-only is the “default with only those started.”

### Environment precedence

```text
Host pnpm
  DATABASE_URL → localhost
  REDIS_URL    → localhost
  PORT         → from host .env (may vary)

Compose migrate + api
  DATABASE_URL → postgres (service DNS) — same value for both
  REDIS_URL    → redis   (api only)
  PORT         → 3000    (api only; Compose override)

Compose migrate
  DATABASE_URL → required
  NODE_ENV / other → only if prisma:migrate:deploy needs them
```

- Use `.env` / `env_file` for non-infrastructure configuration (cache TTLs, rate limits, etc.).
- Explicitly override container runtime values that must match Compose networking/published ports — especially `DATABASE_URL`, `REDIS_URL`, and **`PORT=3000`**.
- Healthcheck must target the same port the process listens on (`http://localhost:3000/health`).
- Do not bake `.env` into images; runtime config comes from Compose.
- Confirm during implementation that the existing `api` `prisma:migrate:deploy` script can run in the `migrate` target with only the environment variables supplied by Compose (typically `DATABASE_URL`; document any extras such as `NODE_ENV`).

## §2 — Root Dockerfile

```text
base
├── Node 20 Alpine
├── Corepack
└── pnpm 10.30.3

deps
├── root manifests (package.json, pnpm-lock.yaml, pnpm-workspace.yaml)
├── all workspace package.json manifests (apps/*, packages/*; include e2e if listed)
└── pnpm install --frozen-lockfile

build-api
├── domain + API source (+ required tsconfigs)
├── Prisma schema
├── prisma generate (via existing scripts or explicit RUN)
├── build @flash-sale/domain
└── build api

build-web
├── web source (+ packages needed for build)
├── ARG/ENV VITE_API_URL=http://localhost:3000
└── Vite production build

api (runtime)
├── Node
├── compiled API + compiled domain
├── Prisma client
├── production dependencies (see packaging path below)
└── CMD: node apps/api/dist/main.js

web (runtime)
├── Node + Corepack/pnpm as needed for preview
├── apps/web/dist
├── workspace metadata / prod deps required for `pnpm --filter web preview`
└── CMD: pnpm --filter web preview --host 0.0.0.0 --port 5173

migrate
├── Prisma CLI
├── complete apps/api/prisma/** (schema + migrations)
└── any generated Prisma artifacts required by the repo’s migrate command
```

### Runtime dependency packaging (decision path)

Investigate in this order during implementation:

| Option            | Approach                                                                  | When to use                                                               |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **A (preferred)** | `pnpm --filter api deploy --prod …` (and web if supported)                | Cleaner isolated deploy dir; avoids carrying full workspace symlink graph |
| **B (fallback)**  | Copy enough of the installed workspace/`node_modules` into runtime images | If `pnpm deploy` is awkward with current workspace structure              |
| **C (avoid)**     | Manually prune `node_modules` by hand                                     | Only if image size becomes an explicit goal; fragile                      |

> Determine whether `pnpm deploy --prod` can produce reliable isolated API/web runtime artifacts; otherwise preserve the required pnpm workspace dependency layout in the runtime images.

Symlink breakage after multi-stage `COPY` is the primary failure mode to verify for either path.

### Other implementation notes

1. **Prisma generation placement** — ensure generated client exists in the final `api` image; migrate includes generated artifacts only if `prisma migrate deploy` / the wrapped script requires them.
2. **`VITE_API_URL`** — `ARG` default `http://localhost:3000`, promoted to `ENV` for the web build; Compose may pass `build.args.VITE_API_URL`.

### `.dockerignore`

Exclude (non-exhaustive): `.git`, `**/node_modules`, `**/dist`, coverage, Playwright artifacts/reports, local env files that should not be baked into images.

Do **not** exclude `apps/api/prisma/schema.prisma` or `apps/api/prisma/migrations/**`.

## §3 — Compose YAML shape, docs, verification

### Service sketch

- **postgres / redis** — unchanged healthchecks and `flash-sale-*` container names from #117.
- **migrate** — `build.target: migrate`; same `DATABASE_URL` as api (`@postgres:5432`); Compose-only env (no baked `.env`); `depends_on` postgres healthy; `restart: "no"`.
- **api** — `build.target: api`; publish `3000:3000`; explicit `DATABASE_URL`, `REDIS_URL`, **`PORT=3000`**; depends on postgres healthy, redis healthy, migrate completed successfully; healthcheck against `http://localhost:3000/health`.
- **web** — `build.target: web` + `args.VITE_API_URL=http://localhost:3000`; publish `5173:5173`; depends on api healthy (readiness convenience only).

### Docs

| File           | Change                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| README         | Document infra-only vs full-stack workflows; endpoints; state that the full Compose stack has **no hot reload** — source changes require rebuilding web/API images; note migrate is one-shot and exits |
| `.env.example` | Comment that Compose overrides DB/Redis URLs and API `PORT` inside containers; host localhost values remain for `pnpm`                                                                                 |

### Acceptance criteria (from #118 + design lock)

- [ ] `docker compose up --build` starts the complete five-service stack (migrate exits 0; four long-running services stay up)
- [ ] PostgreSQL and Redis remain available to the API through Compose service DNS
- [ ] Prisma migrations execute successfully via one-shot migrate service
- [ ] API reachable at `http://localhost:3000`; GraphQL at `/graphql`
- [ ] Web reachable at `http://localhost:5173`
- [ ] Browser requests from the web app reach the API via `localhost:3000`
- [ ] `VITE_API_URL` is browser-reachable (not Docker-internal DNS)
- [ ] API and web images install dependencies using pnpm
- [ ] New services use `flash-sale-*` container names
- [ ] Infra-only workflow (`docker compose up -d postgres redis` + host `pnpm`) still works
- [ ] README documents one-command Compose vs host `pnpm dev`
- [ ] Fresh volume start works (`docker compose down -v` then `up --build`)
- [ ] API healthcheck + web waits for api healthy
- [ ] API container listens on `PORT=3000` matching published ports/healthcheck
- [ ] Failed migrate (non-zero exit) prevents api from starting (`service_completed_successfully`)

### Verification matrix

1. **Fresh full stack** — `docker compose down -v && docker compose up --build`
2. **Migration** — `flash-sale-migrate` exits 0
3. **API** — `GET /health` → 200; GraphQL endpoint accessible
4. **Web** — `http://localhost:5173` loads
5. **Browser networking** — GraphQL from the page targets `localhost:3000`, not Compose DNS names
6. **Infra-only** — `docker compose down` then `docker compose up -d postgres redis` + `pnpm dev` still viable
7. **Naming** — containers are `flash-sale-{postgres,redis,migrate,api,web}`
8. **Migrate failure gate** — temporarily force migrate to fail; confirm migrate exits non-zero and api does not start (manual implementation verification; not a permanent automated suite)

## Out of scope

- Hot-reload / volume-mounted Dev Compose
- Compose profiles (can revisit later if dual workflows need isolation)
- nginx / Caddy production static hosting
- AuthN, k6, Observability (other epics)
- Changing Redis authority or purchase correctness contracts
- Retroactive EPIC-01 scope changes

## Definition of Done

- Implementation complete for #118 only
- Relevant docs updated (README + `.env.example` as needed)
- Compose build and stack verified locally per verification matrix
- No unrelated changes
- Commit message follows `<type>: <MESSAGE>`
- Follow-up PR from worktree; design → plan → implement sequence

## Open implementation details (not design blockers)

These are resolved during the implementation plan / coding, against the locked constraints above:

- Whether `pnpm deploy --prod` works for api/web; otherwise preserve required workspace dependency layout
- Exact multi-stage COPY lists when using the workspace-copy fallback
- Whether migrate image includes generated Prisma client
- Exact env vars required by `prisma:migrate:deploy` beyond `DATABASE_URL`
- Alpine healthcheck tool choice (`wget` vs `curl` vs Node fetch) given base image packages
