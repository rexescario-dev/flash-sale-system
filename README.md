# Flash Sale System

A scalable flash-sale system built with NestJS, GraphQL, React, TypeScript, PostgreSQL, Redis, Playwright, and k6.

> **EPIC-01:** Monorepo foundation, NestJS API, React/Vite web, Docker Compose, Prisma, GraphQL scaffolding, quality hooks, and CI — with no flash-sale business logic yet.

## Quick Start

The **full Docker Compose stack** is the recommended fastest first run — no Node.js or pnpm required on the host.

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

## Redis

Redis is non-authoritative: query cache for `flashSale` / `myPurchase` plus IP rate limiting for `purchaseItem`, with fail-open fallback to Postgres. See [docs/redis-caching-strategy.md](docs/redis-caching-strategy.md).

## E2E

Lifecycle: Postgres/Redis healthy → migrate → start API + web → Playwright `globalSetup` (readiness + `pnpm --filter api e2e:seed`) → tests.

Canonical seed ownership is Playwright `globalSetup`. Do not pre-seed in CI.

Manual seed (debug only): `pnpm --filter api e2e:seed` (writes repo-root `e2e/seed-state.json`; override with `E2E_SEED_STATE_PATH`).

Commands: `pnpm e2e:smoke` · `pnpm e2e`

Port and Redis collisions: see [Local development — Troubleshooting](docs/local-development.md#troubleshooting).

CI uses Option A: `e2e-smoke` and `e2e-full` are both required checks on pull requests.

## Architecture note

Share configuration and intentional contracts. Keep infrastructure local to the consuming app. Modular monolith first.
