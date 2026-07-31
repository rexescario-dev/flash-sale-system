# Playwright E2E

This is the **canonical operational runbook** for this repository’s Playwright end-to-end suite: how to run it, debug it, and interpret the repository-specific configuration and current CI usage.

Testing philosophy and where Playwright fits in the layered strategy live in [Testing strategy](testing-strategy.md).

## Prerequisites

Bring up dependencies in this order:

1. **Local development environment** — follow [Local development](local-development.md) (Compose or host path).
2. **Node / pnpm** — repository `engines` require Node `>=20 <23`; use the workspace `pnpm` via Corepack as documented in local development.
3. **Infrastructure** — PostgreSQL and Redis healthy.
4. **API and web running** — migrated API and web app reachable at the URLs you will pass to Playwright (defaults below).
5. **Browser** — install Chromium for the e2e package (same command CI uses):

```bash
pnpm --filter @flash-sale/e2e exec playwright install chromium --with-deps
```

## Lifecycle

Real-stack E2E follows this sequence:

1. Postgres and Redis are healthy.
2. Migrations are applied.
3. API and web are started.
4. Playwright `globalSetup` runs: readiness check (`waitForStack`) then `pnpm --filter api e2e:seed`.
5. Tests execute under the configured projects.

**Canonical seed ownership** is Playwright `globalSetup`. Do **not** pre-seed in CI.

Manual seed is **debug only**:

```bash
pnpm --filter api e2e:seed
```

That writes repo-root `e2e/seed-state.json` (override with `E2E_SEED_STATE_PATH`).

## Environment variables

Variables consumed by the E2E package / readiness / seed path wiring:

| Variable              | Default                         | Role                                    |
| --------------------- | ------------------------------- | --------------------------------------- |
| `E2E_BASE_URL`        | `http://127.0.0.1:5173`         | Web base URL for Playwright + readiness |
| `E2E_API_HEALTH_URL`  | `http://127.0.0.1:3000/health`  | API health URL polled before seeding    |
| `E2E_SEED_STATE_PATH` | repo-root `e2e/seed-state.json` | Path written/read for seeded sale IDs   |

For application environment variables and alternate ports (`PORT`, `VITE_API_URL`, `REDIS_URL`, and so on), see [Local development](local-development.md).

## Projects and layout

Playwright lives in the top-level `e2e/` package (`@flash-sale/e2e`), with config in `e2e/playwright.config.ts` and specs under `e2e/tests/`.

| Project      | Meaning in this repository                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `smoke`      | Smallest suite: critical purchase journey for rapid CI confidence (`tests/smoke/`). See [Smoke testing](smoke-testing.md). |
| `regression` | Broader real-stack journeys beyond smoke (`tests/regression/`)                                                             |

Operational config notes: `workers: 1`, `fullyParallel: false`, Desktop Chrome, `trace: 'on-first-retry'`.

Smoke is a **subset** of E2E (same tooling). Suite discovery and smoke CI detail: [Smoke testing](smoke-testing.md).

## Running

From the repository root, with the real stack already up:

### Full suite

```bash
pnpm e2e
```

Runs smoke and regression (root script → `@flash-sale/e2e` `test:e2e`).

### Smoke (brief)

```bash
pnpm e2e:smoke
```

`pnpm e2e:smoke` runs the Playwright smoke project. See [Smoke testing](smoke-testing.md) for how the smoke suite is organized and executed in CI.

### By project

```bash
pnpm --filter @flash-sale/e2e test:smoke
pnpm --filter @flash-sale/e2e test:regression
```

Equivalent:

```bash
pnpm --filter @flash-sale/e2e exec playwright test --project=smoke
pnpm --filter @flash-sale/e2e exec playwright test --project=regression
```

### Single file or directory

```bash
pnpm --filter @flash-sale/e2e exec playwright test tests/smoke/purchase.smoke.spec.ts
pnpm --filter @flash-sale/e2e exec playwright test tests/regression
```

Paths are relative to the `e2e/` package (see `testDir: './tests'` in config).

### Filter by title (`-g`)

```bash
pnpm --filter @flash-sale/e2e exec playwright test -g "purchase"
```

### Headed mode

```bash
pnpm --filter @flash-sale/e2e exec playwright test --headed
```

Combine with `--project` or a path as needed.

### Debug mode

```bash
PWDEBUG=1 pnpm --filter @flash-sale/e2e exec playwright test tests/smoke/purchase.smoke.spec.ts
```

## Traces

The suite sets `trace: 'on-first-retry'`. On CI (or when retries are enabled), a failed-then-retried test can produce a trace artifact under Playwright’s output directory.

Open a trace with:

```bash
pnpm --filter @flash-sale/e2e exec playwright show-trace path/to/trace.zip
```

This repository does not configure screenshot or video capture policies for E2E.

## CI

Documented behavior matches `.github/workflows/ci.yml` and the README:

- Job **`e2e-smoke`** installs Chromium, starts API + web preview against workflow services, then runs `pnpm e2e:smoke`.
- Job **`e2e-full`** follows the same stack bring-up, then runs `pnpm e2e`.
- Both jobs are required checks on pull requests (as currently documented for this repository).
- Seed exclusively via Playwright `globalSetup` — workflows must not pre-run `e2e:seed`.

This section describes current workflow behavior only. It is not a branch-protection or future CI design guide.

## Troubleshooting

Likely failures first:

1. **Stack not running** — Confirm Postgres, Redis, API health, and web per [Local development — Verification](local-development.md#verification).
2. **Readiness timeout** — `globalSetup` polls `E2E_API_HEALTH_URL` then `E2E_BASE_URL` (60s default). Ensure those URLs match the process you started.
3. **Port mismatch** — If API/web listen on non-defaults, set matching `E2E_API_HEALTH_URL` / `E2E_BASE_URL` (and rebuild web with the matching `VITE_API_URL` when needed). See [Local development — Troubleshooting](local-development.md#troubleshooting).
4. **Redis / Postgres conflicts** — Port collisions and alternate URLs are covered in [Local development — Troubleshooting](local-development.md#troubleshooting).
5. **Seed-state issues** — Confirm `e2e/seed-state.json` (or `E2E_SEED_STATE_PATH`) was written by the latest `globalSetup` / debug seed and matches the DB under test.

## Related documentation

- [Testing strategy](testing-strategy.md)
- [Smoke testing](smoke-testing.md)
- [Local development](local-development.md)
- [System architecture](architecture.md)
