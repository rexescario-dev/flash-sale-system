# Smoke testing

This is the **canonical guide for how this repository’s smoke suite works today**: suite discovery, local execution, CI usage, and how a new smoke spec is picked up.

- _Why_ smoke exists in the layered strategy: [Testing strategy](testing-strategy.md)
- General Playwright setup, lifecycle, environment variables, debugging, traces, and full-suite CI: [Playwright E2E](playwright-e2e.md)
- Bringing the application stack up: [Local development](local-development.md)

Issue wording may say “smoke tagging”; in this repository smoke tests are identified by **suite discovery** (Playwright project + path/`testMatch`), not annotation-based `@tag`s.

## Suite discovery

The smoke suite is discovered through the dedicated Playwright `smoke` project and its configured `testMatch`, rather than annotation-based tags.

Configuration lives in `e2e/playwright.config.ts`:

- Project `name: 'smoke'`
- Configured `testMatch` for that project (at the time of writing: `/smoke\/.*\.spec\.ts/`), which matches specs under `e2e/tests/smoke/`
- Desktop Chrome device preset (same as other E2E projects)

Entry points that select the smoke project:

```bash
pnpm e2e:smoke
```

Root `e2e:smoke` runs `@flash-sale/e2e` `test:smoke`, which is `playwright test --project=smoke`.

Equivalent package forms:

```bash
pnpm --filter @flash-sale/e2e test:smoke
pnpm --filter @flash-sale/e2e exec playwright test --project=smoke
```

The current smoke spec also uses `test.describe('smoke', …)`. That name is organizational only; it is **not** the suite-discovery mechanism.

## What the smoke suite is

At the time of writing, the smoke suite exercises the critical purchase journey (catalog → ACTIVE sale → buy → My Purchases) via `e2e/tests/smoke/purchase.smoke.spec.ts`.

## Running locally

Prerequisites: real stack already up (Postgres, Redis, migrated API, web). Follow [Local development](local-development.md) to start services, then [Playwright E2E](playwright-e2e.md) for browser install, lifecycle, seed via `globalSetup`, environment variables, headed/debug modes, and traces.

With the stack running:

```bash
pnpm e2e:smoke
```

Or the package / `--project` forms listed under Suite discovery.

## CI usage

In `.github/workflows/ci.yml`, job **`e2e-smoke`** executes the smoke suite:

- Installs dependencies, builds, migrates, starts API + web preview against workflow Postgres and Redis services
- Installs Chromium for the e2e package
- Runs `pnpm e2e:smoke`

Database preparation is handled by Playwright `globalSetup` in the current implementation. Do **not** pre-run `e2e:seed` in CI.

For the broader Playwright CI flow (including job **`e2e-full`** / `pnpm e2e`), Chromium install detail, and shared troubleshooting, see [Playwright E2E](playwright-e2e.md).

## Adding a smoke spec

1. Create a `*.spec.ts` file under `e2e/tests/smoke/`.
2. The `smoke` Playwright project discovers it through its configured `testMatch`.
3. Verify with `pnpm e2e:smoke`.

## Relationship to full E2E

The smoke suite is a subset of the repository's Playwright E2E suite. It uses the same tooling, fixtures, and environment, but executes only the smoke Playwright project. For the complete E2E workflow and full-suite execution, see [Playwright E2E](playwright-e2e.md).

## Related documentation

- [Testing strategy](testing-strategy.md)
- [Playwright E2E](playwright-e2e.md)
- [Local development](local-development.md)
