# Stress testing harness (EPIC-07)

Privileged Prisma seed → k6 GraphQL `purchaseItem` → Prisma verify.

## Prerequisites

- Docker Compose stack (or equivalent) with API + PostgreSQL + Redis
- Official [k6](https://k6.io) binary on `PATH` (`k6 version`)
- API started with the intended limiter profile — see `k6/config/*.env.example`
  (k6 env vars do **not** change API rate limits; put values in Compose/`env_file`)

## Runnable in #53

Only **`harness-smoke`** has a k6 scenario wired. Other scenario names may be seeded for later issues, but `pnpm stress:run` / `stress:test` will fail until those scripts land (#54–#57).

## Commands (repo root)

```bash
pnpm stress:seed -- --scenario harness-smoke --profile smoke
pnpm stress:run -- --scenario harness-smoke --profile smoke
pnpm stress:verify -- --scenario harness-smoke --profile smoke
# or:
pnpm stress:test -- --scenario harness-smoke --profile smoke
```

Correctness smoke (recommended): start the API with `k6/config/correctness.env.example` values, then:

```bash
pnpm stress:test -- --scenario harness-smoke --profile smoke
```

`stress:test` exits non-zero if k6 fails or the verifier reports invariant violations.  
`stress:verify` requires `results/<scenario>-<profile>/k6-summary.json` by default (dual oracle).

## Design

See [EPIC-07 design spec](../../docs/superpowers/specs/2026-07-31-epic-07-performance-stress-testing-design.md).
Results narrative hub lands with #60.
