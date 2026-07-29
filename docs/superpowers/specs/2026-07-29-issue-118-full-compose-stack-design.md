# Issue #118 — Full Local Application Stack in Docker Compose (Design Spec)

**Status:** Draft (pending user review)
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

brings up:

- `flash-sale-postgres`
- `flash-sale-redis`
- `flash-sale-migrate` (one-shot Prisma migrate)
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

| Area                          | Decision                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Scope framing                 | Separate DX/infra issue; do not fold into EPIC-01                                                                         |
| Web serve                     | `vite preview` on `0.0.0.0:5173` (not nginx/Caddy; not `vite dev`)                                                        |
| Dockerfile layout             | Single root multi-stage `Dockerfile` with dedicated targets: `api`, `web`, `migrate`                                      |
| pnpm                          | Corepack + `pnpm@10.30.3` (match root `packageManager`); images install with `pnpm install --frozen-lockfile`             |
| Compose project               | `name: flash-sale` (unchanged from #117)                                                                                  |
| Service keys                  | `postgres`, `redis`, `migrate`, `api`, `web`                                                                              |
| Container names               | `flash-sale-postgres`, `flash-sale-redis`, `flash-sale-migrate`, `flash-sale-api`, `flash-sale-web`                       |
| Internal DNS                  | API/migrate use `postgres:5432` and `redis:6379` (service names, not container names)                                     |
| Browser API URL               | `VITE_API_URL=http://localhost:3000` (build-time bake; never Docker-internal DNS)                                         |
| Infra-only workflow           | Explicit: `docker compose up -d postgres redis` then host `pnpm dev`                                                      |
| Full-stack workflow           | Explicit: `docker compose up --build`                                                                                     |
| Migrate vs API                | Dedicated migrate target/service; `restart: "no"`; api waits for `service_completed_successfully`                         |
| API runtime CMD               | `node apps/api/dist/main.js` (Node + compiled app + prod deps; not `pnpm start`)                                          |
| Web runtime                   | Keeps tooling needed for `pnpm --filter web preview …`                                                                    |
| API healthcheck               | **In scope** — `GET /health` via healthcheck; web depends on `api` `service_healthy`                                      |
| Env precedence                | Compose always overrides `DATABASE_URL` / `REDIS_URL` for containers; host `.env` localhost values remain for host `pnpm` |
| Migrate ↔ API DB              | Same Compose PostgreSQL credentials/database for both services                                                            |
| Profiles / nginx / AuthN / k6 | Out of scope                                                                                                              |

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

| Consumer                       | Variable       | Value                            | Why                                         |
| ------------------------------ | -------------- | -------------------------------- | ------------------------------------------- |
| Browser (baked into web build) | `VITE_API_URL` | `http://localhost:3000`          | Reachable from host browser, not Docker DNS |
| API / migrate containers       | `DATABASE_URL` | `postgresql://…@postgres:5432/…` | Compose service DNS                         |
| API container                  | `REDIS_URL`    | `redis://redis:6379`             | Compose service DNS                         |

### Lifecycle

```text
postgres healthy + redis healthy
        ↓
migrate  →  prisma migrate deploy  →  exit 0
        ↓
api starts → GET /health becomes healthy
        ↓
web starts (vite preview :5173)
```

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

Compose migrate + api
  DATABASE_URL → postgres (service DNS) — same value for both
  REDIS_URL    → redis   (api only)
```

- Prefer `env_file: .env` for non-infra knobs (cache TTLs, rate limits, `PORT`, `NODE_ENV`, etc.).
- Always set `DATABASE_URL` / `REDIS_URL` explicitly under Compose `environment` so host localhost values never leak into containers.
- Do not bake `.env` into images; runtime config comes from Compose.

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
├── production dependencies
└── CMD: node apps/api/dist/main.js

web (runtime)
├── Node + Corepack/pnpm as needed for preview
├── apps/web/dist
├── workspace metadata required for `pnpm --filter web preview`
└── CMD: pnpm --filter web preview --host 0.0.0.0 --port 5173

migrate
├── Prisma CLI
├── complete apps/api/prisma/** (schema + migrations)
└── any generated Prisma artifacts required by the repo’s migrate command
```

### Implementation notes (resolve during build, not open design questions)

1. **Prisma generation placement** — ensure generated client exists in the final `api` image; migrate includes generated artifacts only if `prisma migrate deploy` / the wrapped script requires them.
2. **pnpm workspace runtime copies** — multi-stage COPY must preserve enough of the workspace/`node_modules` layout that `vite preview` and the API runtime resolve correctly (symlinks are the failure mode to verify).
3. **`VITE_API_URL`** — `ARG` default `http://localhost:3000`, promoted to `ENV` for the web build; Compose may pass `build.args.VITE_API_URL`.

### `.dockerignore`

Exclude (non-exhaustive): `.git`, `**/node_modules`, `**/dist`, coverage, Playwright artifacts/reports, local env files that should not be baked into images.

Do **not** exclude `apps/api/prisma/schema.prisma` or `apps/api/prisma/migrations/**`.

## §3 — Compose YAML shape, docs, verification

### Service sketch

- **postgres / redis** — unchanged healthchecks and `flash-sale-*` container names from #117.
- **migrate** — `build.target: migrate`; `DATABASE_URL` with `@postgres:5432`; `depends_on` postgres healthy; `restart: "no"`.
- **api** — `build.target: api`; publish `3000:3000`; explicit `DATABASE_URL` + `REDIS_URL`; depends on postgres healthy, redis healthy, migrate completed successfully; healthcheck against `http://localhost:3000/health` (e.g. `wget --spider -q`).
- **web** — `build.target: web` + `args.VITE_API_URL=http://localhost:3000`; publish `5173:5173`; depends on api healthy.

### Docs

| File           | Change                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| README         | Document infra-only vs full-stack workflows; endpoints; state that the full Compose stack has **no hot reload** — source changes require rebuilding web/API images |
| `.env.example` | Comment that Compose overrides DB/Redis URLs inside containers; host localhost values remain for `pnpm`                                                            |

### Acceptance criteria (from #118 + design lock)

- [ ] `docker compose up --build` starts the complete local stack
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

### Verification matrix

1. **Fresh full stack** — `docker compose down -v && docker compose up --build`
2. **Migration** — `flash-sale-migrate` exits 0
3. **API** — `GET /health` → 200; GraphQL endpoint accessible
4. **Web** — `http://localhost:5173` loads
5. **Browser networking** — GraphQL from the page targets `localhost:3000`, not Compose DNS names
6. **Infra-only** — `docker compose down` then `docker compose up -d postgres redis` + `pnpm dev` still viable
7. **Naming** — containers are `flash-sale-{postgres,redis,migrate,api,web}`

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

- Exact multi-stage COPY lists for pnpm symlink correctness
- Whether migrate image includes generated Prisma client
- Alpine healthcheck tool choice (`wget` vs `curl` vs Node fetch) given base image packages

```

```
