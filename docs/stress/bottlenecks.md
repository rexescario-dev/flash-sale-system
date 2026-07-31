# Stress test bottleneck analysis

Living evidence-backed analysis for [EPIC-07 #87](https://github.com/rexescario-dev/flash-sale-system/issues/87) / [#59](https://github.com/rexescario-dev/flash-sale-system/issues/59).
Consumes `#58` artifacts under `tests/stress/results/<scenario>-<profile>/` (gitignored).
Does not invent metrics. Broader results narrative lands with `#60`.

## Scope & Evidence

### Environment

| Field | Value |
| ----- | ----- |
| Runner | *(fill after runs — local hostname or designated runner id)* |
| Date | *(fill)* |
| API limiter — correctness scenarios | Values from `tests/stress/k6/config/correctness.env.example` applied to API process |
| API limiter — high-volume | Values from `tests/stress/k6/config/performance.env.example` applied to API process |
| Notes | k6 env does not reconfigure API rate limits |

### Evidence runs attempted

| Scenario | Profile | Limiter | Artifact dir | Status |
| -------- | ------- | ------- | ------------ | ------ |
| `purchase-load` | *(smoke or standard)* | correctness | `tests/stress/results/purchase-load-<profile>/` | pending |
| `oversell` | *(smoke or standard)* | correctness | `tests/stress/results/oversell-<profile>/` | pending |
| `duplicate-race` | *(smoke or standard)* | correctness | `tests/stress/results/duplicate-race-<profile>/` | pending |
| `high-volume` | `full` (preferred) | performance | `tests/stress/results/high-volume-full/` | pending |
| `high-volume` | `standard` (fallback) | performance | `tests/stress/results/high-volume-standard/` | pending if needed |

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

| Confidence | Meaning |
| ---------- | ------- |
| High | Supported by multiple relevant metrics and corroborated by representative evidence (for example, multiple runs/profiles or a representative full-capacity run). |
| Medium | Supported by one representative run or consistent indirect evidence. |
| Low | Limited evidence; observation is real but attribution remains tentative. |
| Insufficient evidence | Required artifacts unavailable or the required run could not be completed. |

## Rate Limiter

### Observed

*(pending evidence runs)*

### Interpretation

*(pending evidence runs)*

### Evidence

- Scenario / Profile: *(pending)*
- Artifacts: *(pending)*
- Metrics referenced: *(only metrics cited above)*

### Confidence

Insufficient evidence

### Limitations

No Redis or host metrics collected by the harness.

## Inventory / Accounting

### Observed

*(pending evidence runs)*

### Interpretation

*(pending evidence runs)*

### Evidence

- Scenario / Profile: *(pending)*
- Artifacts: *(pending)*
- Metrics referenced: *(only metrics cited above)*

### Confidence

Insufficient evidence

### Limitations

*(pending)*

## Per-user Uniqueness

### Observed

*(pending evidence runs)*

### Interpretation

*(pending evidence runs)*

### Evidence

- Scenario / Profile: *(pending)*
- Artifacts: *(pending)*
- Metrics referenced: *(only metrics cited above)*

### Confidence

Insufficient evidence

### Limitations

*(pending)*

## Latency & Throughput Saturation

### Observed

*(pending evidence runs)*

### Interpretation

*(pending evidence runs)*

### Evidence

- Scenario / Profile: *(pending)*
- Artifacts: *(pending)*
- Metrics referenced: *(only metrics cited above)*

### Confidence

Insufficient evidence

### Limitations

*(pending)*

## Unresolved candidates

*(Fill only after runs — possible constraints not yet attributable, e.g. DB contention, pool exhaustion. Do not present as named High/Medium bottlenecks without signals.)*

## Additional instrumentation required

- `pg_stat_statements` / lock metrics (to confirm or reject DB contention hypotheses)
- API / Prisma connection pool metrics
- Redis `INFO` (rate-limit backend / cache behavior)
- Host CPU / RAM / disk during `high-volume`/`full`

## Appendix

### Scenario matrix

| Purpose | Scenario | Profile target | Limiter |
| ------- | -------- | -------------- | ------- |
| Capacity / limiter / latency | `high-volume` | `full` preferred; `standard` fallback | performance |
| Inventory / oversell | `oversell` | `smoke` or `standard` | correctness |
| Per-user uniqueness | `duplicate-race` | `smoke` or `standard` | correctness |
| Baseline contention | `purchase-load` | `smoke` or `standard` | correctness |

### Artifact paths

*(fill after runs)*

### Reproduce commands

```bash
# Correctness limiter on API process first (see k6/config/correctness.env.example)
pnpm stress:test -- --scenario purchase-load --profile smoke
pnpm stress:test -- --scenario oversell --profile smoke
pnpm stress:test -- --scenario duplicate-race --profile smoke

# Performance limiter on API process (see k6/config/performance.env.example), then:
pnpm stress:test -- --scenario high-volume --profile full
# Fallback if full does not produce usable #58 artifacts:
pnpm stress:test -- --scenario high-volume --profile standard
```
