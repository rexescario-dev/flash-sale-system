# Flash Sale System

A scalable flash-sale system built with NestJS, GraphQL, React, TypeScript, PostgreSQL, Redis, Playwright, and k6.

> **EPIC-01 (in progress):** Monorepo foundation — shared TypeScript/ESLint config and Turborepo workspace. Apps, Docker, GraphQL, hooks, and CI land in follow-up PRs.

## Requirements

- Node.js 20 (`>=20 <23`) — see `.nvmrc`
- [pnpm](https://pnpm.io) 10+

## Setup

```bash
pnpm install
```

## Scripts

| Command                             | Description              |
| ----------------------------------- | ------------------------ |
| `pnpm build`                        | Build workspace packages |
| `pnpm typecheck`                    | Typecheck the workspace  |
| `pnpm lint`                         | Lint the workspace       |
| `pnpm test`                         | Run tests                |
| `pnpm format` / `pnpm format:check` | Prettier format / check  |

## Workspace layout

```text
packages/
  typescript-config/
  eslint-config/
  types/        # @flash-sale/types (non-domain contracts only)
```

## Architecture note

Share configuration and intentional contracts. Keep infrastructure local to the consuming app. Modular monolith first.
