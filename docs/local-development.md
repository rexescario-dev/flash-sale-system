# Local development

Canonical guide for running the Flash Sale System on your machine.

**Choose one day-to-day workflow.** Use either the full Docker Compose stack **or** host/`pnpm` with Compose infra only (Postgres + Redis). Do not start the API and web twice — for example, do not run `docker compose up` for `api`/`web` while also running `pnpm dev`.

## Prerequisites

- **Docker Compose** — required for the full stack (Path A) or for Postgres/Redis when running API and web on the host (Path B).
- **Node.js `>=20 <23` and [pnpm](https://pnpm.io) 10+** — required for Path B and for non-Compose tooling (quality scripts, E2E helpers, etc.). Not required for Path A.

## Environment

Copy the example env file at the **repository root** (not `apps/api/`):

```bash
cp .env.example .env
```

**Compose path (Path A):** When you run the full Docker Compose stack, Compose supplies `DATABASE_URL`, `REDIS_URL`, and API `PORT=3000` for the `api` and `migrate` containers. The API connects to PostgreSQL and Redis using Compose service DNS (`postgres:5432`, `redis:6379`). Compose loads other knobs from `.env` via `env_file`. You normally do not need to edit DB, Redis, or API port values in `.env` for this path.

**Host path (Path B):** Use the localhost values from `.env.example` as-is (`DATABASE_URL` → `localhost:5432`, `REDIS_URL` → `redis://localhost:6379`, `PORT=3000`, `VITE_API_URL=http://localhost:3000`).

## Path A — Full Docker Compose

No Node.js or pnpm installation is required on the host for this workflow.

```bash
cp .env.example .env
docker compose up --build
```

Starts the current Docker Compose application stack:

- `postgres` (`flash-sale-postgres`)
- `redis` (`flash-sale-redis`)
- `migrate` (`flash-sale-migrate`) — one-shot Prisma migration; exits with code 0
- `api` (`flash-sale-api`)
- `web` (`flash-sale-web`) — serves the production web build with `vite preview`

The `api` service waits for Postgres and Redis to be healthy and for `migrate` to complete successfully before starting.

Source changes require rebuilding the images:

```bash
docker compose up --build
```

**Endpoints:**

- Web: http://localhost:5173
- API: http://localhost:3000
- GraphQL: http://localhost:3000/graphql

The web build bakes `VITE_API_URL=http://localhost:3000` for the host browser (set in `docker-compose.yml` build args).

**Optional verification helper** (local DX check; not used by CI):

```bash
bash scripts/verify-compose.sh
```

## Path B — Host / pnpm (Compose infra)

Run Postgres and Redis in Compose; run API and web on the host with pnpm.

1. **Environment** — `cp .env.example .env` (see [Environment](#environment)).

2. **Start infra only:**

   ```bash
   docker compose up -d postgres redis
   ```

3. **Install dependencies:**

   ```bash
   pnpm install
   ```

4. **Apply migrations** — see [Database — Host (Path B)](#host-path-b).

5. **Start API + web:**

   ```bash
   pnpm dev
   ```

   Or run individually:

   ```bash
   pnpm --filter api dev
   pnpm --filter web dev
   ```

**Endpoints** match Path A unless you override ports in `.env`:

- Web: http://localhost:5173
- API: http://localhost:3000
- GraphQL: http://localhost:3000/graphql

## Database

### Compose (Path A)

The `migrate` service runs Prisma migrations automatically when you bring up the full stack. There is no separate migration step for day-to-day Compose use — `api` depends on `migrate` completing successfully.

### Host (Path B)

Use the existing API Prisma scripts:

- `pnpm --filter api prisma:migrate:deploy` — apply pending migrations (typical after pulling changes)
- `pnpm --filter api prisma:migrate` — create/apply migrations during development

### Seed

`pnpm --filter api e2e:seed` is for **E2E/debug only** (writes repo-root `e2e/seed-state.json`; override with `E2E_SEED_STATE_PATH`). It is not part of normal local startup.

For real-stack E2E, Playwright `globalSetup` owns seeding (readiness check + `pnpm --filter api e2e:seed`). See [Playwright E2E](playwright-e2e.md) for lifecycle, commands, and CI notes.

### Reset (Compose)

To wipe volumes and re-run migrations from scratch:

```bash
docker compose down -v
docker compose up --build
```

## Verification

After the stack is up (either path), confirm the three local surfaces:

**API health** — expect `{ "status": "ok" }`:

```bash
curl -sf http://localhost:3000/health
```

Readiness (dependency checks land in later issues): `GET /health/ready` returns `{ "status": "ok", "checks": {} }` after Nest bootstrap when no checks are registered.

**GraphQL** — expect a successful response (for example `__typename`):

```bash
curl -sf http://localhost:3000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ __typename }"}'
```

**Web** — expect HTTP 200:

```bash
curl -sf -o /dev/null -w 'web_http=%{http_code}\n' http://localhost:5173/
```

**Optional helpers:**

- Full Compose contract check: `bash scripts/verify-compose.sh` (fresh stack, health, GraphQL, web, migrate logs, baked `VITE_API_URL` checks)
- Playwright smoke against a running stack: `pnpm e2e:smoke`
- Full Playwright suite: `pnpm e2e`

## Troubleshooting

**Redis port `:6379` already in use** — point the host/API at an alternate Redis:

```text
REDIS_URL=redis://127.0.0.1:6380
```

**API port `:3000` already in use** — rebuild web with the alternate API URL and run smoke with matching health/base URLs:

```bash
PORT=3001 VITE_API_URL=http://127.0.0.1:3001 pnpm --filter web build
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5173 pnpm e2e:smoke
```

For E2E lifecycle, seed ownership, and CI behavior, see [Playwright E2E](playwright-e2e.md).

## Common tasks

Locally essential commands. For build, lint, test, format, and the full script list, see [README — Scripts](../README.md#scripts).

| Command                                   | Use when                                |
| ----------------------------------------- | --------------------------------------- |
| `pnpm dev`                                | Start API + web on the host (Path B)    |
| `pnpm --filter api prisma:migrate:deploy` | Apply pending migrations (Path B)       |
| `pnpm --filter api prisma:migrate`        | Create/apply migrations during dev      |
| `bash scripts/verify-compose.sh`          | Full Compose stack verification         |
| `pnpm e2e:smoke`                          | Playwright smoke (optional; real stack) |
