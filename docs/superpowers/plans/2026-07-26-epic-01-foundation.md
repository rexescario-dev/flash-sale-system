# EPIC-01 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver EPIC-01 (#81) as six green PRs: monorepo tooling, NestJS + Vite apps, Docker/Prisma/env, GraphQL scaffolding, quality hooks, and CI — with no flash-sale business logic.

**Architecture:** Tooling-first pnpm + Turborepo monorepo. Shared config packages first; apps consume them; Prisma stays in `apps/api`; GraphQL is Nest code-first with in-memory schema; Redis Compose service only until EPIC-04.

**Tech Stack:** Node 20, pnpm, Turborepo, NestJS, React, Vite, TypeScript, Prisma, PostgreSQL, Redis, Apollo GraphQL, ESLint, Prettier, Husky, GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-07-26-epic-01-foundation-design.md](../specs/2026-07-26-epic-01-foundation-design.md)

**Do not commit** unless the user explicitly asks.

---

## File map (final EPIC-01)

| Path                           | Responsibility                                |
| ------------------------------ | --------------------------------------------- |
| `package.json`                 | Root scripts → turbo; engines; packageManager |
| `pnpm-workspace.yaml`          | `apps/*`, `packages/*`                        |
| `turbo.json`                   | Task graph with `dependsOn`                   |
| `.nvmrc`                       | `20`                                          |
| `.gitignore`                   | node_modules, dist, .env, coverage, etc.      |
| `packages/typescript-config/*` | Shared tsconfig presets                       |
| `packages/eslint-config/*`     | Shared ESLint config                          |
| `packages/types/*`             | `@flash-sale/types` minimal package           |
| `apps/api/*`                   | NestJS API (PR2+)                             |
| `apps/web/*`                   | Vite React app (PR2+)                         |
| `docker-compose.yml`           | Postgres + Redis (PR3)                        |
| `.env.example`                 | Documented dev vars (PR3)                     |
| `.github/workflows/ci.yml`     | CI (PR6)                                      |
| `.husky/pre-commit`            | lint-staged (PR5)                             |

---

## PR1 — Monorepo foundation (#1 + package seeds)

### Task 1: Root workspace files

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `README.md`
- Create: `.prettierrc`
- Create: `.prettierignore`

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "flash-sale-system",
  "private": true,
  "packageManager": "pnpm@10.30.3",
  "engines": {
    "node": ">=20 <23"
  },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,yml,yaml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,yml,yaml}\""
  },
  "devDependencies": {
    "prettier": "^3.6.2",
    "turbo": "^2.5.4",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 4: Write `.nvmrc`** (`20`), `.gitignore`, Prettier configs, minimal `README.md` (setup + scripts + architecture sketch).

---

### Task 2: `packages/typescript-config`

**Files:**

- Create: `packages/typescript-config/package.json`
- Create: `packages/typescript-config/base.json`
- Create: `packages/typescript-config/nestjs.json`
- Create: `packages/typescript-config/vite.json`

- [ ] **Step 1: Package manifest**

```json
{
  "name": "@flash-sale/typescript-config",
  "version": "0.0.0",
  "private": true,
  "license": "MIT"
}
```

- [ ] **Step 2: Presets**

`base.json` — strict ES2022, `skipLibCheck`, `declaration` optional false for apps.  
`nestjs.json` — extends base; `module`/`moduleResolution` NodeNext; `emitDecoratorMetadata`, `experimentalDecorators`, `outDir` dist.  
`vite.json` — extends base; `jsx` react-jsx; `module` ESNext; `moduleResolution` bundler; `noEmit` true.

- [ ] **Step 3: Scripts** — no build needed; `lint`/`typecheck`/`test`/`build` can be `"echo 'no-op'"` or omitted (turbo skips missing). Prefer explicit no-op scripts so turbo is green:

```json
"scripts": {
  "build": "node -e \"process.exit(0)\"",
  "lint": "node -e \"process.exit(0)\"",
  "typecheck": "node -e \"process.exit(0)\"",
  "test": "node -e \"process.exit(0)\""
}
```

---

### Task 3: `packages/eslint-config` (skeleton)

**Files:**

- Create: `packages/eslint-config/package.json`
- Create: `packages/eslint-config/index.js`
- Create: `packages/eslint-config/package.json` scripts no-op for PR1

- [ ] **Step 1:** Export a minimal flat-config array (or legacy `.eslintrc`-style export) that apps will consume in PR2/PR5. PR1 only needs the package to install and no-op pipeline tasks.

---

### Task 4: `packages/types` (`@flash-sale/types`)

**Files:**

- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/README.md`

- [ ] **Step 1: Manifest**

```json
{
  "name": "@flash-sale/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "node -e \"process.exit(0)\"",
    "test": "node -e \"process.exit(0)\""
  },
  "devDependencies": {
    "@flash-sale/typescript-config": "workspace:*",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: `src/index.ts`** — empty module with a short comment that types are added only for genuine cross-app contracts. No invented `ApiError` / domain types.

```ts
/**
 * @flash-sale/types
 * Add exports only when both apps/api and apps/web share a real contract.
 * Do not mirror Prisma models or flash-sale domain types here.
 */
export {};
```

- [ ] **Step 3: Build with tsc** to `dist/`.

---

### Task 5: Install and verify PR1 green

- [ ] **Step 1:** Run `pnpm install` at repo root  
      Expected: lockfile created; packages linked

- [ ] **Step 2:** Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm format:check`  
      Expected: all exit 0

- [ ] **Step 3:** Do **not** commit unless asked

**PR1 acceptance (#1):** Workspace layout exists; root scripts defined; `.gitignore` + `.env.example` stub optional (full `.env.example` in PR3 — add minimal `.env.example` note or empty stub documenting “see PR3”); README exists; project builds with no business logic.

---

## PR2 — Applications (#2, #3)

### Task 6: NestJS `apps/api`

**Files:**

- Create: `apps/api/package.json`, `tsconfig.json`, `src/main.ts`, `src/app.module.ts`
- Create: `apps/api/src/health/health.module.ts`, `health.service.ts`, `health.controller.ts`
- Create: `apps/api/src/health/health.service.spec.ts` (smoke)

- [ ] Scaffold Nest app under `apps/api` consuming `@flash-sale/typescript-config`
- [ ] `GET /health` → `{ "status": "ok" }` via `HealthService`
- [ ] `pnpm --filter api dev` starts watch mode
- [ ] Jest (or Vitest) smoke test for HealthService
- [ ] Do not add Prisma/GraphQL yet

### Task 7: Vite React `apps/web`

**Files:**

- Create: `apps/web/*` Vite React TS template
- Create: smoke test rendering shell

- [ ] Extends shared TS config; `pnpm --filter web dev` works
- [ ] Minimal shell UI; no GraphQL client
- [ ] Real render smoke test

**Verify:** `pnpm build && pnpm test && pnpm typecheck` green.

---

## PR3 — Infrastructure (#4, #5, #9)

### Task 8: Docker Compose

**Files:**

- Create: `docker-compose.yml`
- Create: `.env.example` (dev credentials)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: flash_sale
      POSTGRES_PASSWORD: flash_sale_dev
      POSTGRES_DB: flash_sale
    ports: ['5432:5432']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U flash_sale -d flash_sale']
      interval: 5s
      timeout: 5s
      retries: 10
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 10
```

### Task 9: Prisma in `apps/api`

**Files:**

- Create: `apps/api/prisma/schema.prisma` (datasource + generator only)
- Create: `apps/api/src/prisma/prisma.module.ts`, `prisma.service.ts`
- Wire `@nestjs/config` with fail-fast for `DATABASE_URL`

- [ ] `prisma generate` in api build/prep
- [ ] No domain models; no fake `_HealthCheck` table
- [ ] Redis URL documented; no Redis client module

**Verify:** `docker compose up -d` → healthy; `pnpm --filter api` generate + build.

---

## PR4 — GraphQL (#6)

### Task 10: Nest GraphQL code-first

**Files:**

- Modify: `apps/api` AppModule
- Create: `apps/api/src/health/health.resolver.ts`

- [ ] ApolloDriver, `autoSchemaFile: true`, playground/sandbox only when `NODE_ENV !== 'production'`
- [ ] `query { health }` → `"ok"` via shared HealthService
- [ ] No flash-sale resolvers/mutations

**Verify:** API starts; GraphQL sandbox in dev; REST `/health` still works.

---

## PR5 — Developer quality (#7, #8)

### Task 11: ESLint + Prettier + Husky

- [ ] Wire apps to `@flash-sale/eslint-config`
- [ ] Root `format` / `format:check` already present; ensure they cover apps
- [ ] Husky pre-commit + lint-staged on staged TS/JS only
- [ ] Failing lint blocks commit

**Verify:** `pnpm lint && pnpm format:check` green.

---

## PR6 — CI (#10)

### Task 12: GitHub Actions

**Files:**

- Create: `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

**Verify:** Workflow file valid; local commands match CI order.

---

## Epic close

- [ ] Close #1–#10 as PR batches land
- [ ] Confirm #81 success criteria
- [ ] No domain/business logic present

## Spec coverage checklist

| Spec item                          | Tasks                      |
| ---------------------------------- | -------------------------- |
| pnpm + Turbo + Node 20             | 1–5                        |
| Shared TS/ESLint/types packages    | 2–4                        |
| Nest + Vite + health + smoke tests | 6–7                        |
| Compose + Prisma + env             | 8–9                        |
| GraphQL code-first                 | 10                         |
| ESLint/Prettier/Husky              | 11                         |
| CI frozen lockfile + format:check  | 12                         |
| No domain logic                    | All (enforced by omission) |
