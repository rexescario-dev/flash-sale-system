# Flash Sale System

A scalable flash-sale system built with NestJS, GraphQL, React, TypeScript, PostgreSQL, Redis, Playwright, and k6.

> **EPIC-01:** Monorepo foundation, NestJS API, React/Vite web, Docker Compose, Prisma, GraphQL scaffolding, quality hooks, and CI — with no flash-sale business logic yet.

## Requirements

- Docker (Docker Compose) for the full local application stack
- Node.js 20 (`>=20 <23`) and [pnpm](https://pnpm.io) 10+ only if you use existing non-Compose tooling (quality scripts, E2E helpers, etc.)

## Local stack

### Full Compose stack

```bash
cp .env.example .env
docker compose up --build
```

Starts the complete five-service stack:

- `flash-sale-postgres`
- `flash-sale-redis`
- `flash-sale-migrate` — one-shot Prisma migration; exits with code 0
- `flash-sale-api`
- `flash-sale-web` — serves the production web build with `vite preview`

No Node.js or pnpm installation is required on the host for this workflow.

Source changes require rebuilding the images:

```bash
docker compose up --build
```

Endpoints:

- Web: http://localhost:5173
- API: http://localhost:3000
- GraphQL: http://localhost:3000/graphql

The API container connects to PostgreSQL and Redis using Compose service DNS (`postgres:5432`, `redis:6379`). The web build bakes `VITE_API_URL=http://localhost:3000` for the host browser.

Keep `.env` at the **repository root** (not `apps/api/`). Compose loads non-infra knobs via `env_file` and overrides `DATABASE_URL`, `REDIS_URL`, and API `PORT=3000` for containers.

### Verify Compose stack

Optional local DX check (not used by CI):

```bash
bash scripts/verify-compose.sh
```

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

## Local endpoints

- API liveness: `GET http://localhost:3000/health`
- GraphQL (dev sandbox): `http://localhost:3000/graphql`
- Web: `http://localhost:5173`

## Redis

Redis is non-authoritative: query cache for `flashSale` / `myPurchase` plus IP rate limiting for `purchaseItem`, with fail-open fallback to Postgres. See [docs/redis-caching-strategy.md](docs/redis-caching-strategy.md). In the full Compose stack the API uses `redis://redis:6379` (Compose DNS).

## E2E

Lifecycle: Postgres/Redis healthy → migrate → start API + web → Playwright `globalSetup` (readiness + `pnpm --filter api e2e:seed`) → tests.

Canonical seed ownership is Playwright `globalSetup`. Do not pre-seed in CI.

Manual seed (debug only): `pnpm --filter api e2e:seed` (writes repo-root `e2e/seed-state.json`; override with `E2E_SEED_STATE_PATH`).

Commands: `pnpm e2e:smoke` · `pnpm e2e`

If local Redis `:6379` is busy: `REDIS_URL=redis://127.0.0.1:6380`. If API `:3000` is busy:

```bash
PORT=3001 VITE_API_URL=http://127.0.0.1:3001 pnpm --filter web build
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5173 pnpm e2e:smoke
```

CI uses Option A: `e2e-smoke` and `e2e-full` are both required checks on pull requests.

## Architecture note

Share configuration and intentional contracts. Keep infrastructure local to the consuming app. Modular monolith first.
