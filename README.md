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
