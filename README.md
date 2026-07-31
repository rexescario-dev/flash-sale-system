# Flash Sale System

A scalable flash-sale system built with NestJS, GraphQL, React, TypeScript, PostgreSQL, Redis, Playwright, and k6.

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

## Redis

Redis is non-authoritative: query cache for `flashSale` / `myPurchase` plus IP rate limiting for `purchaseItem`, with fail-open fallback to Postgres. See [docs/redis-caching-strategy.md](docs/redis-caching-strategy.md).

## E2E

Real-stack Playwright suite under `e2e/` (smoke + regression). Canonical seed ownership is Playwright `globalSetup` — do not pre-seed in CI.

```bash
pnpm e2e:smoke
pnpm e2e
```

Full prerequisites, lifecycle, environment variables, project filters, headed/debug modes, traces, CI jobs, and troubleshooting: [Playwright E2E](docs/playwright-e2e.md).

Port and Redis collisions: see [Local development — Troubleshooting](docs/local-development.md#troubleshooting).

CI runs `e2e-smoke` and `e2e-full` as required checks on pull requests.

## Architecture note

Modular monolith: React → GraphQL → NestJS → PostgreSQL + Redis. See [Architecture](docs/architecture.md).
