# EPIC-01 — Monorepo & Platform Foundation (Design Spec)

**Status:** Approved  
**Date:** 2026-07-26  
**Epic:** [EPIC-01 #81](https://github.com/rexescario-dev/flash-sale-system/issues/81)  
**Child issues:** #1–#10  
**Repository:** `rexescario-dev/flash-sale-system`

## Goal

Establish a production-oriented monorepo foundation for the Flash Sale System: workspace tooling, NestJS API and React/Vite web scaffolds, Dockerized PostgreSQL/Redis, Prisma (no domain models), GraphQL code-first scaffolding, lint/format/hooks, and CI — with **zero flash-sale business logic**.

## Architectural principle

> Share configuration and intentional contracts. Keep infrastructure and implementation local. Build a modular monolith first, with boundaries that allow future extraction if justified.

## Locked decisions

| Area              | Decision                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Package manager   | pnpm workspaces (`apps/*`, `packages/*`); pin `packageManager`; commit `pnpm-lock.yaml`                     |
| Orchestration     | Turborepo with explicit `dependsOn` (`build` → `^build`, `typecheck` → `^typecheck`)                        |
| Node              | 20 LTS baseline via `.nvmrc`; `engines.node`: `>=20 <23`                                                    |
| Apps              | `apps/api` (NestJS), `apps/web` (React + Vite + TypeScript)                                                 |
| Shared packages   | `typescript-config`, `eslint-config`, `@flash-sale/types` (minimal, non-domain)                             |
| Prisma            | Inside `apps/api`; zero domain models; prefer no fake placeholder model                                     |
| GraphQL           | NestJS code-first + Apollo; in-memory schema; sandbox development-only; codegen deferred to EPIC-03         |
| Infra             | Docker Compose PostgreSQL + Redis with healthchecks; no app containers in EPIC-01                           |
| Redis client      | Deferred to EPIC-04 (Compose service only in EPIC-01)                                                       |
| Quality           | ESLint (shared) + Prettier (format authority) + Husky + lint-staged                                         |
| CI                | GitHub Actions: `pnpm install --frozen-lockfile` → `format:check` → `lint` → `typecheck` → `test` → `build` |
| Delivery          | Six batched PRs; each leaves the repository green                                                           |
| Approach          | Tooling-first monorepo                                                                                      |
| Bootstrap scripts | Local `scripts/` tooling stays separate from the app root                                                   |

## Target repository tree

```text
flash-sale-system/
├── apps/
│   ├── api/                      # NestJS + Prisma + GraphQL (code-first)
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # datasource + generator only
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── health/           # optional liveness (REST + GraphQL)
│   │       ├── prisma/           # PrismaModule / PrismaService
│   │       └── ...
│   └── web/                      # React + Vite + TypeScript shell
├── packages/
│   ├── typescript-config/
│   ├── eslint-config/
│   └── types/                    # @flash-sale/types
├── docker-compose.yml
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── pnpm-lock.yaml
├── .nvmrc
├── .github/workflows/ci.yml
├── .husky/
├── README.md
└── docs/superpowers/
    ├── specs/
    └── plans/
```

## Package boundaries

### Share

- TypeScript config presets (`packages/typescript-config`)
- ESLint config (`packages/eslint-config`)
- Genuine cross-app contracts in `@flash-sale/types` only when both apps need the same type

### Keep local

- Prisma schema, migrations, and Nest PrismaModule
- Nest modules, Vite app, Docker Compose wiring

### `@flash-sale/types` rule

Must contain only genuinely shared, non-domain contracts. Do **not** pre-populate domain models or duplicate Prisma types. Do not force apps to depend on the package for symmetry. Prefer a valid minimal package without inventing `ApiError`/`Result` shapes until both apps use them.

## Applications

### `apps/api`

- NestJS + TypeScript; extends shared TS/ESLint configs
- Liveness only in EPIC-01: `GET /health` → `200` / `{ "status": "ok" }` (process alive; not readiness)
- Optional GraphQL `query { health }` sharing the same `HealthService`
- PrismaModule wired in PR3; GraphQL module in PR4
- Real minimal smoke tests (e.g. health service/controller), not fake test stubs
- Config via `@nestjs/config`; fail-fast validation for required env vars when infra is wired

### `apps/web`

- Vite React TypeScript shell; extends shared configs
- No purchase flow or GraphQL client in EPIC-01
- `VITE_*` vars are public/browser-exposed only; never secrets
- Real minimal smoke test (shell renders)

### Dev commands

```bash
pnpm --filter api dev
pnpm --filter web dev
pnpm dev                  # turbo run dev (both)
```

## Infrastructure

### Docker Compose

- Services: `postgres`, `redis` only
- Healthchecks: `pg_isready`, `redis-cli ping`
- Dev-only credentials documented in `.env.example` (e.g. `flash_sale` / `flash_sale_dev`)
- `.env` gitignored; no production secrets in example

### Prisma

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

No Product/FlashSale/Purchase models. No `_HealthCheck` / `SchemaMeta` unless Prisma migration tooling genuinely requires a model — adapt workflow rather than invent tables.

### Environment

- Required for API (when infra wired): `DATABASE_URL`, `REDIS_URL` (documented even if client deferred), `PORT` (or sensible default)
- Optional web: `VITE_API_URL` with local default if appropriate
- Fail fast when genuinely required vars are missing

## GraphQL (PR4)

- `@nestjs/graphql` + ApolloDriver
- `autoSchemaFile: true` (in-memory); do not commit empty `schema.gql`
- Sandbox/landing page: development only; disabled outside development
- No flash-sale resolvers/mutations
- Minimal `health` query only if Query root required; reuse `HealthService`
- Codegen and web GraphQL client deferred to EPIC-03+

## Quality & CI

### PR5

- ESLint via shared package; Prettier owns formatting (`format` / `format:check`)
- Husky pre-commit + lint-staged on staged files only (keep hooks fast)

### PR6

```text
Checkout → Setup Node → Setup pnpm → Cache store
→ pnpm install --frozen-lockfile
→ pnpm format:check
→ pnpm lint
→ pnpm typecheck
→ pnpm test
→ pnpm build
```

No Docker/Postgres/Redis required in EPIC-01 CI.

## Delivery: six batched PRs

| PR  | Issues             | Focus                                                      |
| --- | ------------------ | ---------------------------------------------------------- |
| PR1 | #1 + package seeds | pnpm, Turbo, shared packages, root scripts (must be green) |
| PR2 | #2 + #3            | NestJS API + React/Vite; liveness; smoke tests             |
| PR3 | #4 + #5 + #9       | Compose + Prisma + env management                          |
| PR4 | #6                 | GraphQL code-first scaffolding                             |
| PR5 | #7 + #8            | ESLint/Prettier + Husky/lint-staged                        |
| PR6 | #10                | GitHub Actions CI                                          |

Each PR must leave the repository in a working state.

## Explicitly out of scope

- Product / FlashSale / Purchase models and purchase flow
- Redis client, caching, rate limiting
- Real GraphQL business operations and GraphQL Code Generator
- GraphQL client on web
- Playwright, k6
- Domain migrations
- Business observability beyond liveness

## Epic success criteria

- Monorepo builds successfully
- NestJS API and React web apps are scaffolded
- Docker Compose, Prisma, GraphQL, linting, Husky, env management, and CI are configured
- No flash-sale business logic
- Child issues #1–#10 closed as their PR batches merge
- EPIC-01 (#81) closable when all of the above hold

## Local workspace note

Application code is developed for `rexescario-dev/flash-sale-system`. Bootstrap automation under a separate `scripts/` directory is tooling-only and is not the application root.
