# Stress testing harness (EPIC-07)

Privileged Prisma seed → k6 GraphQL `purchaseItem` → Prisma verify.

## Prerequisites

- Docker Compose stack (or equivalent) with API + PostgreSQL + Redis
- Official [k6](https://k6.io) binary on `PATH` (`k6 version`)
- API started with the intended limiter profile — see `k6/config/*.env.example`
  (k6 env vars do **not** change API rate limits; put values in Compose/`env_file`)

## Runnable scenarios

| Scenario        | Issue | Notes                                                             |
| --------------- | ----- | ----------------------------------------------------------------- |
| `harness-smoke` | #53   | Harness proof; comfortable default seed stock is fine for `smoke` |
| `purchase-load` | #54   | Baseline concurrent purchase load (strict all-success)            |

Other scenario names may be seeded for later issues, but `pnpm stress:run` / `stress:test` will fail until those scripts land (#55–#57).

## Commands (repo root)

### Primary path (`purchase-load`)

`stress:test` resolves comfortable stock from the shared profile SoT when `--stock` is omitted:

```bash
pnpm stress:test -- --scenario purchase-load --profile smoke
```

Comfortable stock formula: `max(1000, ceil(attempts * 1.2))` (smoke → 1000, standard → 1200, full → 12000).

### Split path (`purchase-load`)

```bash
STOCK=$(pnpm stress:stock standard)
pnpm stress:seed -- --scenario purchase-load --stock "$STOCK"
pnpm stress:run -- --scenario purchase-load --profile standard
pnpm stress:verify -- --scenario purchase-load --profile standard
```

Omitting `--stock` for high-intensity profiles changes the scenario from a comfortable-stock baseline into a stock-constrained run and therefore invalidates the #54 success criteria.

### Harness smoke

```bash
pnpm stress:test -- --scenario harness-smoke --profile smoke
```

`stress:test` exits non-zero if k6 fails or the verifier reports invariant violations.  
`stress:verify` requires `results/<scenario>-<profile>/k6-summary.json` by default (dual oracle).

## Design

See [EPIC-07 design spec](../../docs/superpowers/specs/2026-07-31-epic-07-performance-stress-testing-design.md)
and [#54 design](../../docs/superpowers/specs/2026-07-31-issue-54-flash-sale-load-test-design.md).
Results narrative hub lands with #60.
