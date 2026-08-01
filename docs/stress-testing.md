# Stress testing results

Canonical results hub for [EPIC-07 #87](https://github.com/rexescario-dev/flash-sale-system/issues/87) / [#60](https://github.com/rexescario-dev/flash-sale-system/issues/60).

This document summarizes available stress scenarios, evidence-backed expected vs actual outcomes, environment limitations, and how to reproduce runs. Constraint-level analysis lives in [bottleneck analysis](stress/bottlenecks.md). Harness commands live in [`tests/stress/README.md`](../tests/stress/README.md). CI automation and expanded runbooks remain [#71](https://github.com/rexescario-dev/flash-sale-system/issues/71).

Do not invent metrics. Every Actual value below is traceable to fresh `#58` artifacts under `tests/stress/results/<scenario>-<profile>/` or to prior-run evidence recorded in [bottleneck analysis](stress/bottlenecks.md).

## Overview

EPIC-07 is a dual-oracle validation layer over purchase-flow concurrency guarantees: k6 classifies GraphQL `purchaseItem` responses; a Prisma verifier asserts persisted invariants. Intensity profiles are `smoke` / `standard` / `full`. Correctness scenarios (#54–#56) use a raised API limiter; high-volume (#57) uses a production-like performance limiter.

| Document                                            | Purpose                                   |
| --------------------------------------------------- | ----------------------------------------- |
| This hub (`docs/stress-testing.md`)                 | Results overview and expected vs actual   |
| [docs/stress/bottlenecks.md](stress/bottlenecks.md) | Evidence-backed bottleneck analysis (#59) |
| [tests/stress/README.md](../tests/stress/README.md) | Harness usage and commands                |
| [docs/testing-strategy.md](testing-strategy.md)     | Where stress fits in the testing pyramid  |

## Scenario matrix

Inventory of runnable scenarios (not results):

| Scenario         | Purpose                                   | Profile(s)                  | Limiter     |
| ---------------- | ----------------------------------------- | --------------------------- | ----------- |
| `purchase-load`  | Baseline concurrent purchase load         | `smoke`, `standard`, `full` | correctness |
| `oversell`       | Limited inventory / no oversell           | `smoke`, `standard`, `full` | correctness |
| `duplicate-race` | Same-user uniqueness under concurrency    | `smoke`, `standard`, `full` | correctness |
| `high-volume`    | Capacity / latency observation under load | `smoke`, `standard`, `full` | performance |
| `harness-smoke`  | Harness wiring proof only                 | `smoke`                     | correctness |

`harness-smoke` is operational proof for the seed→run→verify pipeline; it is not part of the expected-vs-actual results table below.

## Expected vs actual results

| Scenario         | Profile | Expected                                                                                                                                                          | Actual                                                                                                                                 | Evidence        |
| ---------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `purchase-load`  | `smoke` | Completes under correctness limiter without classification/invariant violations (`RATE_LIMITED` / unexpected = 0; successes match attempts for comfortable stock) | 100 successes; 0 rate-limited; verifier `ok: true`                                                                                     | Prior-run (#59) |
| `oversell`       | `smoke` | Successes ≤ stock; no oversell; stock identity holds                                                                                                              | 100 attempts → 10 success, 90 sold-out, 0 rate-limited; stock 10 exhausted; verifier purchase count 10 / remaining 0                   | Prior-run (#59) |
| `duplicate-race` | `smoke` | Exactly one successful purchase for the fixed user; remainder duplicate                                                                                           | 100 attempts → 1 success, 99 duplicate; verifier fixed-user purchase count 1                                                           | Prior-run (#59) |
| `high-volume`    | `full`  | Inventory/uniqueness invariants hold; `RATE_LIMITED` observational (not a hard fail)                                                                              | 10_000 attempts → 30 success, 9_970 rate-limited; verifier purchase count 30 / remaining 11_970; p50≈35ms p95≈50ms p99≈81ms; ~2397 RPS | Prior-run (#59) |

Artifact paths for these rows:

- `tests/stress/results/purchase-load-smoke/`
- `tests/stress/results/oversell-smoke/`
- `tests/stress/results/duplicate-race-smoke/`
- `tests/stress/results/high-volume-full/`

## Other supported profiles

The harness also supports `standard` and `full` for correctness scenarios, and `smoke` / `standard` for `high-volume`. No expected-vs-actual metrics are reported for profile/scenario combinations without evidence.

## Environment limitations

- Evidence runs were executed in a local (or designated-runner) Compose/API/Postgres/Redis stack with the official k6 binary. API limiter knobs come from `tests/stress/k6/config/correctness.env.example` or `performance.env.example` applied to the **API process** — k6 env does not reconfigure rate limits.
- Results are environment-dependent and intended for comparative validation rather than benchmarking across different hardware.
- Full-scale k6 is not a required PR CI gate in EPIC-07; scheduled/CI automation remains [#71](https://github.com/rexescario-dev/flash-sale-system/issues/71).
- Deeper constraint attribution (limiter vs inventory vs latency saturation) is in [bottleneck analysis](stress/bottlenecks.md).

## Reproducing the results

Representative commands (repo root; API must already use the matching limiter profile):

```bash
pnpm stress:test -- --scenario purchase-load --profile smoke
pnpm stress:test -- --scenario oversell --profile smoke
pnpm stress:test -- --scenario duplicate-race --profile smoke
# API on performance limiter first:
pnpm stress:test -- --scenario high-volume --profile full
```

See [`tests/stress/README.md`](../tests/stress/README.md) for full setup, options, and troubleshooting.

## Related documentation

1. [`tests/stress/README.md`](../tests/stress/README.md) — how to run
2. [Bottleneck analysis](stress/bottlenecks.md) — why the results look the way they do
3. [Testing strategy](testing-strategy.md) — where stress fits
4. [EPIC-07 design](superpowers/specs/2026-07-31-epic-07-performance-stress-testing-design.md) and [#60 design](superpowers/specs/2026-08-01-issue-60-document-stress-test-results-design.md)
