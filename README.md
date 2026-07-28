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

## Workspace layout

```text
apps/
  api/          # NestJS + Prisma + GraphQL (code-first)
  web/          # React + Vite
packages/
  typescript-config/
  eslint-config/
  types/        # @flash-sale/types (non-domain contracts only)
```

## Local endpoints

- API liveness: `GET http://localhost:3000/health`
- GraphQL (dev sandbox): `http://localhost:3000/graphql`
- Web: `http://localhost:5173`

## Architecture note

Share configuration and intentional contracts. Keep infrastructure local to the consuming app. Modular monolith first.
