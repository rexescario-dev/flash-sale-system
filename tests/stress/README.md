# Stress testing harness (EPIC-07)

Privileged Prisma seed → k6 GraphQL `purchaseItem` → Prisma verify.

## Prerequisites

- Docker Compose stack (or equivalent) with API + PostgreSQL + Redis
- Official [k6](https://k6.io) binary on `PATH` (`k6 version`)
- API started with the intended limiter profile — see `k6/config/*.env.example`
  (k6 env vars do **not** change API rate limits; put values in Compose/`env_file`)
- **#57 `high-volume`:** start API with `k6/config/performance.env.example` (not correctness).
  Hard gates: `unexpected` / `duplicate` / `sold_out == 0`, `success <= seededStock`, accounting identity;
  `RATE_LIMITED` / latency / RPS are observational (success may be 0).
  `pnpm --silent stress:policy --scenario=high-volume --field=expectedLimiterProfile` → `performance` (summary metadata only).
  Wrappers never reconfigure the API limiter.

## Runnable scenarios

| Scenario         | Issue | Notes                                                             |
| ---------------- | ----- | ----------------------------------------------------------------- |
| `harness-smoke`  | #53   | Harness proof; comfortable default seed stock is fine for `smoke` |
| `purchase-load`  | #54   | Baseline concurrent purchase load (strict all-success)            |
| `oversell`       | #55   | Limited inventory / oversell (`0 < purchase_success <= stock`)    |
| `duplicate-race` | #56   | Same-user race (`SUCCESS=1`, `DUPLICATE=N-1`)                     |
| `high-volume`    | #57   | Observation-first capacity/latency (performance limiter; `RATE_LIMITED` allowed) |

## Commands (repo root)

`stress:test` remains the recommended entry point; split-path commands are documented primarily for debugging and advanced workflows.

### Primary path

```bash
# #54 baseline (comfortable stock auto-resolved)
pnpm stress:test -- --scenario purchase-load --profile smoke

# #55 limited inventory (constrained stock auto-resolved)
pnpm stress:test -- --scenario oversell --profile smoke

# #56 same-user / duplicate-race (constant stock 10 auto-resolved)
pnpm stress:test -- --scenario duplicate-race --profile smoke

# #57 high-volume (comfortable stock auto-resolved; API must use performance limiter)
pnpm stress:test -- --scenario high-volume --profile smoke
```

Stock policy via shared profiles + `resolveStock(profile, scenario)`:

| Scenario         | Formula (internal)                          | smoke / standard / full |
| ---------------- | ------------------------------------------- | ----------------------- |
| `purchase-load`  | `max(1000, ceil(attempts * 1.2))`           | 1000 / 1200 / 12000     |
| `high-volume`    | `max(1000, ceil(attempts * 1.2))` (same as purchase-load) | 1000 / 1200 / 12000 |
| `oversell`       | `min(100, max(10, floor(attempts * 0.10)))` | 10 / 100 / 100          |
| `duplicate-race` | constant `10` (profile-independent)         | 10 / 10 / 10            |

### Split path

```bash
STOCK=$(pnpm --silent stress:stock --profile=standard --scenario=oversell)
pnpm stress:seed -- --scenario oversell --stock "$STOCK"
pnpm stress:run -- --scenario oversell --profile standard
pnpm stress:verify -- --scenario oversell --profile standard
```

Same pattern for `duplicate-race` — e.g. `pnpm --silent stress:stock --profile=smoke --scenario=duplicate-race`.

Bare `pnpm --silent stress:stock <profile>` still resolves **purchase-load** comfortable stock (compat).

Running `stress:seed` directly without a resolver-derived `--stock` seeds the generic default (1000), which may prevent the oversell scenario from exercising constrained inventory. **Prefer `stress:test`** (or an explicit resolver-derived `--stock`).

### Harness smoke

```bash
pnpm stress:test -- --scenario harness-smoke --profile smoke
```

`stress:test` exits non-zero if k6 fails or the verifier reports invariant violations.
Unused stock on oversell is an informational warning (exit 0) when correctness gates pass.
Leftover stock on `duplicate-race` is expected (no exhaustion warning); correctness limiter required.
`stress:verify` requires `results/<scenario>-<profile>/k6-summary.json` by default (dual oracle).

## Design

See [EPIC-07 design spec](../../docs/superpowers/specs/2026-07-31-epic-07-performance-stress-testing-design.md),
[#54 design](../../docs/superpowers/specs/2026-07-31-issue-54-flash-sale-load-test-design.md),
[#55 design](../../docs/superpowers/specs/2026-07-31-issue-55-limited-inventory-concurrency-test-design.md),
[#56 design](../../docs/superpowers/specs/2026-07-31-issue-56-same-user-concurrency-test-design.md),
and [#57 design](../../docs/superpowers/specs/2026-07-31-issue-57-high-volume-api-test-design.md).
Results narrative hub lands with #60.
