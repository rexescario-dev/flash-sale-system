# Testing Strategy

## Testing philosophy

- Prefer **fast feedback** close to the change.
- Use the **lowest-cost test** that provides sufficient confidence.
- Exercise **real infrastructure only when the behavior depends on it**.
- Test **behavior**, not implementation details.
- Document **current repository capabilities only** — do not invent tools, commands, or CI policies that are not present yet.

## Layered strategy

Tests are organized in complementary layers:

1. **Unit** — fast confidence in domain and application logic without real infrastructure.
2. **Integration** — confidence at system boundaries with real services.
3. **E2E** — confidence in critical user journeys across the real stack; **smoke** is the smallest Playwright subset of that layer.
4. **Stress** — planned load/stress validation (not in the automated suite today).

Each layer answers a different question. Higher layers do not replace lower ones, and browser-based E2E is not the concurrency or load harness.

## Unit tests

**Purpose:** Confidence in domain and application logic without real infrastructure.

**Tools:** Jest (`packages/domain`, `apps/api` unit specs) and Vitest (`apps/web`).

**Primary locations:**

- `packages/domain`
- `apps/api` (unit specs alongside application code)
- `apps/web`

**Representative existing commands** (examples of primary entry points, not a complete command reference):

```bash
pnpm test
```

Package-scoped entry points also exist where packages expose a `test` script (for example `pnpm --filter api test`, `pnpm --filter web test`, `pnpm --filter @flash-sale/domain test`).

**CI role:** Unit tests provide fast feedback in automated validation.

## Integration tests

**Purpose:** Verify interactions between application components and infrastructure using real services (PostgreSQL, Prisma, GraphQL, and Redis where applicable), including schema validation and transactional concurrency behavior.

**Tools:** Jest schema and integration configurations under `apps/api`.

**Primary locations:** `apps/api` schema and integration test trees (for example `apps/api/test/`).

**Representative existing commands** (examples of primary entry points, not a complete command reference):

```bash
pnpm --filter api test:schema
pnpm --filter api test:integration
```

**CI role:** Integration tests validate behavior against real infrastructure.

> **Concurrency validation:** Atomic reservation and transactional correctness are verified through integration tests against real infrastructure. They are intentionally **not** validated by browser-based E2E tests or future stress tests. See [Concurrency model](concurrency-model.md).

## E2E tests

**Purpose:** Confidence that critical user journeys work across the real stack (web → API → PostgreSQL + Redis).

**Tools:** Playwright.

**Primary locations:** top-level `e2e/`.

**Representative existing commands** (examples of primary entry points, not a complete command reference):

```bash
pnpm e2e
```

**Lifecycle (strategy level):** Real stack. Playwright `globalSetup` owns deterministic seeding for the suite. Operational execution, debugging, and troubleshooting are documented in [Playwright E2E](playwright-e2e.md).

**CI role:** Full Playwright regression provides comprehensive end-to-end coverage as part of the project's automated validation.

## Smoke tests

Smoke testing is a **subset** of E2E — the same Playwright stack and tooling, not a separate technology.

**Purpose:** The smallest Playwright suite that verifies the critical purchase journey (view an ACTIVE sale and complete a successful purchase) and provides rapid confidence for CI.

**Representative existing commands** (examples of primary entry points, not a complete command reference):

```bash
pnpm e2e:smoke
```

**CI role:** Playwright smoke provides rapid end-to-end confidence.

Suite discovery, local smoke execution, CI job usage, and how smoke specs are picked up are documented in [Smoke testing](smoke-testing.md).

## Stress testing (planned)

Stress testing is not currently part of the automated test suite. The project currently includes unit, integration, E2E, and smoke testing. Stress/load testing is planned for **EPIC-07 / Issue #71**, where the k6-based strategy, scenarios, execution instructions, and CI integration will be introduced. This document intentionally does not include k6 commands or expected results before that work is implemented.

## CI mapping

At a conceptual level, automated validation covers:

- **Unit tests** — provide fast feedback.
- **Integration tests** — validate behavior against real infrastructure.
- **Playwright smoke** — provides rapid end-to-end confidence.
- **Full Playwright regression** — validates broader user journeys.
- **Stress testing** — not part of the automated suite today (Issue #71).

This mapping describes layer participation, not workflow YAML, job names, or branch-protection policy.

## Related documentation

- [System architecture](architecture.md)
- [Local development](local-development.md)
- [Playwright E2E](playwright-e2e.md)
- [Smoke testing](smoke-testing.md)
- [Concurrency model](concurrency-model.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)

**Planned work:**

- Issue #71 — Stress testing (k6)
