# Stress test bottleneck analysis

Evidence-backed analysis for [EPIC-07 #87](https://github.com/rexescario-dev/flash-sale-system/issues/87) / [#59](https://github.com/rexescario-dev/flash-sale-system/issues/59).
It consumes the gitignored artifacts under `tests/stress/results/<scenario>-<profile>/`. Metrics in this document come only from `k6-summary.json`; correctness checks come only from `verifier.json`.

## Scope & Evidence

### Environment

| Field                               | Value                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| Runner                              | `rex-ThinkPad-P14s-Gen-2i`                                                          |
| Date                                | 2026-07-31                                                                          |
| Test environment                    | `local`                                                                             |
| API limiter — correctness scenarios | Values from `tests/stress/k6/config/correctness.env.example` applied to API process |
| API limiter — high-volume           | Values from `tests/stress/k6/config/performance.env.example` applied to API process |
| Notes                               | k6 env does not reconfigure API rate limits                                         |

### Evidence runs attempted

| Scenario         | Profile               | Limiter     | Artifact dir                                 | Status                                              |
| ---------------- | --------------------- | ----------- | -------------------------------------------- | --------------------------------------------------- |
| `purchase-load`  | `smoke`               | correctness | `tests/stress/results/purchase-load-smoke/`  | usable; verifier `ok: true`                         |
| `oversell`       | `smoke`               | correctness | `tests/stress/results/oversell-smoke/`       | usable; verifier `ok: true`                         |
| `duplicate-race` | `smoke`               | correctness | `tests/stress/results/duplicate-race-smoke/` | usable; verifier `ok: true`                         |
| `high-volume`    | `full` (preferred)    | performance | `tests/stress/results/high-volume-full/`     | usable; verifier `ok: true`                         |
| `high-volume`    | `standard` (fallback) | performance | —                                            | not run; the full profile produced usable artifacts |

### Artifact contract

```text
tests/stress/results/<scenario>-<profile>/
  k6-summary.json
  verifier.json
  report.md
```

- `k6-summary.json` = canonical metrics
- `verifier.json` = canonical correctness
- `report.md` = convenience human summary only (not authoritative for numbers)

### Confidence rubric

| Confidence            | Meaning                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High                  | Supported by multiple relevant metrics and corroborated by representative evidence (for example, multiple runs/profiles or a representative full-capacity run). |
| Medium                | Supported by one representative run or consistent indirect evidence.                                                                                            |
| Low                   | Limited evidence; observation is real but attribution remains tentative.                                                                                        |
| Insufficient evidence | Required artifacts unavailable or the required run could not be completed.                                                                                      |

## Rate Limiter

### Observed

- The performance-limited `high-volume` full run classified 10,000 attempts as 30 successes and 9,970 rate-limited responses; it recorded zero sold-out, duplicate, and unexpected responses.
- The correctness-limited `purchase-load` smoke run recorded 100 successes and zero rate-limited responses.

### Interpretation

- The performance limiter was the primary constraint in the full run: 30 successful purchases correspond to `RATE_LIMIT_PURCHASE_ITEM_MAX`, after which the remaining classified attempts were rate limited.
- The absence of rate limiting in the correctness baseline corroborates that this outcome is limiter-profile dependent rather than evidence of an inventory shortage.

### Evidence

- Scenario / Profile: `high-volume` / `full`, performance limiter
  - `k6-summary.json`: 10,000 attempts; 30 `purchase_success`; 9,970 `purchase_rate_limited`; zero `purchase_sold_out`, `purchase_duplicate`, and `purchase_unexpected`.
- Scenario / Profile: `purchase-load` / `smoke`, correctness limiter
  - `k6-summary.json`: 100 `purchase_success`; zero `purchase_rate_limited`.

### Confidence

High

### Limitations

The run identifies request admission as the observed constraint, but it does not measure limiter backend resource use or host saturation.

## Inventory / Accounting

### Observed

- In `oversell` smoke, 100 attempts produced 10 successes and 90 sold-out responses, with zero rate-limited responses; the summary reports stock 10, unused stock 0, `oversell: false`, and `accountingOk: true`.
- Its verifier passed `purchase_count_lte_stock`, `remaining_stock_identity`, and `purchase_count_matches_k6_success`: purchase count 10 equalled stock 10, remaining stock was 0, and purchase count equalled k6 successes.
- In `high-volume` full, 10,000 attempts produced 30 successes and zero sold-out responses; the summary reports stock 12,000 and `accountingOk: true`. Its verifier recorded purchase count 30, remaining stock 11,970, and stock 12,000.

### Interpretation

- The limited-stock race exhausted inventory without overselling, and both scenario verifiers reconcile persisted purchases, stock, and k6 successes.
- The high-volume run was not inventory-limited: stock remained available while the rate limiter rejected requests.

### Evidence

- Scenario / Profile: `oversell` / `smoke`, correctness limiter
  - `k6-summary.json`: 100 attempts; 10 `purchase_success`; 90 `purchase_sold_out`; zero `purchase_rate_limited`; stock 10; unused stock 0; `oversell: false`; `accountingOk: true`.
  - `verifier.json`: `purchase_count_lte_stock`, `remaining_stock_identity`, and `purchase_count_matches_k6_success` are `ok: true`; purchase count 10; remaining stock 0; stock 10; k6 successes 10.
- Scenario / Profile: `high-volume` / `full`, performance limiter
  - `k6-summary.json`: 10,000 attempts; 30 `purchase_success`; zero `purchase_sold_out`; stock 12,000; `accountingOk: true`.
  - `verifier.json`: `purchase_count_lte_stock`, `remaining_stock_identity`, and `purchase_count_matches_k6_success` are `ok: true`; purchase count 30; remaining stock 11,970; stock 12,000; k6 successes 30.

### Confidence

High

### Limitations

These scenarios validate observed purchase and stock identities; they do not attribute their behavior to a particular database query, lock, or service resource.

## Per-user Uniqueness

### Observed

- In `duplicate-race` smoke, 100 attempts for the fixed user produced one success and 99 duplicate responses, with zero rate-limited, sold-out, and unexpected responses.
- The summary reports stock 10, unused stock 9, and `accountingOk: true`. The verifier passed both `no_duplicate_user_purchases` and `fixed_user_single_purchase`; its recorded purchase count for the fixed user was one.

### Interpretation

- The same-user race preserved per-user uniqueness in this smoke run: the duplicate outcomes and verifier checks agree that only one purchase persisted for the fixed user.

### Evidence

- Scenario / Profile: `duplicate-race` / `smoke`, correctness limiter
  - `k6-summary.json`: 100 attempts; one `purchase_success`; 99 `purchase_duplicate`; zero `purchase_rate_limited`, `purchase_sold_out`, and `purchase_unexpected`; stock 10; unused stock 9; `accountingOk: true`.
  - `verifier.json`: `no_duplicate_user_purchases` and `fixed_user_single_purchase` are `ok: true`; fixed-user purchase count one.

### Confidence

High

### Limitations

This is one smoke-profile race for one fixed user; it does not establish behavior across multiple users, profiles, or API deployments.

## Latency & Throughput Saturation

### Observed

- The `high-volume` full run recorded an end-to-end HTTP duration average of 41.4 ms, p50 of 35.0 ms, p95 of 49.8 ms, and p99 of 81.3 ms.
- It issued 10,000 HTTP requests at 2,397.5 requests/s. In the same run, 30 requests succeeded and 9,970 were rate limited.

### Interpretation

- These are observed end-to-end response-time and request-rate measurements for the performance-limited full run.
- They do not establish successful-purchase capacity beyond the limiter: the rate-limited outcomes dominate this run, so the measurements cannot identify an application or database bottleneck.

### Evidence

- Scenario / Profile: `high-volume` / `full`, performance limiter
  - `k6-summary.json`: HTTP duration average 41.39554784980004 ms, p50 34.971945000000005 ms, p95 49.773705549999995 ms, and p99 81.29496820000104 ms; 10,000 HTTP requests at 2,397.4751109783497 requests/s; 30 `purchase_success`; 9,970 `purchase_rate_limited`.

### Confidence

Medium

### Limitations

The aggregate duration metric does not separate successful purchases from rate-limited responses, and the artifacts contain no server-side resource or tracing data.

## Unresolved candidates

The artifacts do not distinguish database contention, API/database pool exhaustion, limiter-backend saturation, or host resource saturation. These remain candidates for measurement, not conclusions from this evidence.

## Additional instrumentation required

- `pg_stat_statements` / lock metrics (to confirm or reject DB contention hypotheses)
- API / Prisma connection pool metrics
- Redis `INFO` (rate-limit backend / cache behavior)
- Host CPU / RAM / disk during `high-volume`/`full`

## Appendix

### Scenario matrix

| Purpose                      | Scenario         | Profile target                        | Limiter     |
| ---------------------------- | ---------------- | ------------------------------------- | ----------- |
| Capacity / limiter / latency | `high-volume`    | `full` preferred; `standard` fallback | performance |
| Inventory / oversell         | `oversell`       | `smoke` or `standard`                 | correctness |
| Per-user uniqueness          | `duplicate-race` | `smoke` or `standard`                 | correctness |
| Baseline contention          | `purchase-load`  | `smoke` or `standard`                 | correctness |

### Artifact paths

- `tests/stress/results/purchase-load-smoke/k6-summary.json`
- `tests/stress/results/purchase-load-smoke/verifier.json`
- `tests/stress/results/oversell-smoke/k6-summary.json`
- `tests/stress/results/oversell-smoke/verifier.json`
- `tests/stress/results/duplicate-race-smoke/k6-summary.json`
- `tests/stress/results/duplicate-race-smoke/verifier.json`
- `tests/stress/results/high-volume-full/k6-summary.json`
- `tests/stress/results/high-volume-full/verifier.json`

### Reproduce commands

```bash
# Correctness limiter on API process first (see k6/config/correctness.env.example)
pnpm stress:test -- --scenario purchase-load --profile smoke
pnpm stress:test -- --scenario oversell --profile smoke
pnpm stress:test -- --scenario duplicate-race --profile smoke

# Performance limiter on API process (see k6/config/performance.env.example), then:
pnpm stress:test -- --scenario high-volume --profile full
# Run only if the full profile does not produce usable artifacts:
pnpm stress:test -- --scenario high-volume --profile standard
```
