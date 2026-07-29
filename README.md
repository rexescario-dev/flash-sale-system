# Flash Sale System

A scalable flash-sale system built with NestJS, GraphQL, React, TypeScript, PostgreSQL, Redis, Playwright, and k6.

> **EPIC-01:** Monorepo foundation, NestJS API, React/Vite web, Docker Compose, Prisma, GraphQL scaffolding, quality hooks, and CI — with no flash-sale business logic yet.

## Requirements

- Node.js 20 (`>=20 <23`) — see `.nvmrc`
- [pnpm](https://pnpm.io) 10+
- Docker (for PostgreSQL + Redis)

## Setup

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm --filter api prisma:generate
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

## Redis / local stack

`docker compose up -d` starts PostgreSQL and Redis as containers `flash-sale-postgres` and `flash-sale-redis` (`REDIS_URL=redis://localhost:6379`). Redis is non-authoritative: query cache for `flashSale` / `myPurchase` plus IP rate limiting for `purchaseItem`, with fail-open fallback to Postgres. See [docs/redis-caching-strategy.md](docs/redis-caching-strategy.md).

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
