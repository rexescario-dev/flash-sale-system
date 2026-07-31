# #58 — Capture stress test metrics (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-07-31
**Issue:** [#58](https://github.com/rexescario-dev/flash-sale-system/issues/58) — Capture stress test metrics
**Epic:** [#87](https://github.com/rexescario-dev/flash-sale-system/issues/87) (EPIC-07 — Performance & Stress Testing)
**Parent design:** [EPIC-07 performance stress testing](./2026-07-31-epic-07-performance-stress-testing-design.md)
**Sibling designs:** [#54](./2026-07-31-issue-54-flash-sale-load-test-design.md), [#55](./2026-07-31-issue-55-limited-inventory-concurrency-test-design.md), [#56](./2026-07-31-issue-56-same-user-concurrency-test-design.md), [#57](./2026-07-31-issue-57-high-volume-api-test-design.md)
**Depends on:** [#53](https://github.com/rexescario-dev/flash-sale-system/issues/53)–[#57](https://github.com/rexescario-dev/flash-sale-system/issues/57) on `main`
**Repository:** `rexescario-dev/flash-sale-system`

## Goal

Establish a canonical reporting contract for EPIC-07 stress scenarios so every runnable scenario emits consistent machine-readable artifacts and a thin human-readable report generated from real k6 and verifier outputs.

## Acceptance criterion

GitHub AC: **Metrics include success/failure counts, p95/p99 latency, and throughput.**

Satisfied when every runnable scenario’s `k6-summary.json` includes:

- success/failure bucket counters (`purchase_success`, `purchase_sold_out`, `purchase_duplicate`, `purchase_rate_limited`, `purchase_unexpected`),
- latency percentiles including **p95** and **p99** (plus p50),
- throughput, represented by `performance.http_reqs.rate`,

and each completed `stress:test` smoke run also produces `verifier.json` plus a thin factual `report.md` rendered from those artifacts.

Do **not** invent bottleneck analysis (`#59`), results narrative hubs (`#60` / `#71`), or committed metric numbers without real runs. Keep `#54`–`#57` proofs unchanged.

## Approach

**Centralize in `metrics.js` + thin reporter module (Approach 1):**

| Surface                                          | Role after #58                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `tests/stress/k6/helpers/metrics.js`             | Canonical base summary: metadata, counters, performance, shared diagnostics                        |
| Runnable k6 scenarios                            | Attach shared trend-stat config; emit base via `buildHandleSummary`; additive scenario fields only |
| `tests/stress/reporter/*` + `pnpm stress:report` | Pure renderer: `k6-summary.json` + `verifier.json` → thin `report.md`                              |
| `scripts/stress-test.sh`                         | `seed → run → verify → report`; preserve k6/verify exit precedence                                 |
| `tests/stress/verifier/*`                        | Unchanged correctness ownership; keep reading `counters.purchase_success` (+ existing fallbacks)   |
| `tests/stress/README.md`                         | Thin artifact contract + pipeline + reproduce commands                                             |

**Rejected alternatives:**

| Alternative                                        | Why rejected                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| A — Harden JSON only; defer `report.md` to `#60`   | Epic already promises `report.md`; `#60` would become artifact completion |
| C — Schema validation without emitting `report.md` | Defensive; doesn’t advance the observable reporting surface               |
| Reporter inside verifier                           | Couples presentation to correctness; harder to regenerate reports         |
| Reporter inside k6 `handleSummary`                 | Incomplete (no verifier outcome); awkward pending lifecycle               |
| Post-process-only normalization in Markdown        | Leaves divergent machine schemas; future consumers still see N shapes     |
| Formal JSON Schema validation now                  | Valuable later; biggest gap is consistent emission + missing `report.md`  |
| Rename `verifier.json` → `verification.json`       | Churn without benefit; breaks artifact continuity                         |
| Dual-read of both verifier filenames               | Compatibility code with no migration underway                             |

## Locked decisions

| Area                    | Decision                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Reporting surface       | Canonical `k6-summary.json` + thin mechanical `report.md` (Approach 1 / Q1-B)                                 |
| Reporter placement      | Separate `stress:report` stage after verify (Q2-B)                                                            |
| Verifier artifact name  | Keep `verifier.json` (Q3-A); no rename; no dual-read                                                          |
| `stress:test` reporting | Always invoke reporter after verification completes (Q4-A); best-effort render; never mask k6/verify exit     |
| Real-run DoD            | Local `smoke` for every runnable scenario (Q5-A); artifacts gitignored                                        |
| Schema ownership        | `buildHandleSummary()` owns canonical base; scenario fields additive only                                     |
| Performance shape       | Nested `performance.http_req_duration_ms` + `performance.http_reqs` (match current `#57` shape)               |
| Nullability             | Base object keys never omitted; missing measurements are `null`, not removed keys                             |
| Shared diagnostics      | Always emit `attempts`, `classifiedTotal`, `accountingOk` (derived)                                           |
| Trend stats             | All runnable scenarios attach shared trend-stat configuration so the performance block populates consistently |
| Compatibility           | Do not remove existing verifier summary-read fallbacks; standardize future emission                           |
| Docs                    | Thin `tests/stress/README.md` only; no sample outputs / committed artifacts                                   |
| Freeze                  | Do not change `#54`–`#57` thresholds, stock formulas, or proofs                                               |
| Out of slice            | `#59`/`#60`/`#71` narrative; JSON Schema validation; `#134` CSS AC                                            |

## Scope

### In scope

- Expand shared `buildHandleSummary()` to emit the normative base schema (metadata, counters, performance, shared diagnostics)
- Ensure all runnable scenarios attach shared trend-stat configuration and emit the canonical base
- Keep scenario-specific summary fields additive only
- Remove duplicated local performance extraction from `high-volume.js` once shared helper owns it
- Add `tests/stress/reporter/*` + `pnpm stress:report`
- Wire `stress:test`: `seed → run → verify → report` with formal exit precedence
- Unit tests for reporter + helper/base-schema coverage (fixture-based)
- Thin `tests/stress/README.md` updates (artifact contract, pipeline, reproduce commands)
- Prove with local `smoke` runs for every runnable scenario

### Out of scope

- Bottleneck analysis (`#59`)
- Results narrative hub / comparisons / recommendations (`#60`)
- Invented k6 results docs (`#71` / `#60`) without real runs
- Formal JSON Schema validation of summaries
- Renaming `verifier.json`
- Changing `#54`–`#57` k6 thresholds / gates / seeder stock semantics
- Scenario-specific report rendering logic or interpretive prose
- Committing generated result artifacts
- Root README / hub expansion beyond the existing thin pointer pattern
- Reopening `#134` CSS AC

### Explicit non-goal

No scenario-specific report rendering logic; `report.md` is generated from the canonical summary and `verifier.json` without interpretation.

## Ownership (sources of truth)

| Component | Role                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------- |
| k6        | Source of truth for execution metrics                                                               |
| Verifier  | Source of truth for correctness / invariants                                                        |
| Reporter  | Non-authoritative renderer combining existing artifacts; introduces no new measurements or verdicts |

## Architecture

```text
Scenario
    │
    ▼
buildHandleSummary()   ← canonical base
    │
    ▼
k6-summary.json
         │
         ▼
      verifier
         │
         ▼
    verifier.json
         │
         └──────────┐
                    ▼
             stress:report   ← consumes k6-summary.json + verifier.json
                    │
                    ▼
               report.md
```

**Pipeline:**

```text
seed → run → verify → report
```

`stress:run` / `stress:verify` remain independently usable. `stress:report` consumes both `k6-summary.json` and `verifier.json`, assumes completed machine artifacts, and never reruns k6 or verification. `stress:test` is the convenience wrapper that orchestrates the full sequence.

## Canonical `k6-summary.json` schema

The base schema is **normative** for all runnable scenarios. Scenario-specific fields are additive only and must not remove, rename, or change the meaning of base fields.

**Base (every runnable scenario):**

```json
{
  "scenario": "oversell",
  "profile": "smoke",
  "limiterProfile": "correctness",
  "environment": "local",
  "startedAt": "ISO-8601",
  "counters": {
    "purchase_success": 0,
    "purchase_sold_out": 0,
    "purchase_duplicate": 0,
    "purchase_rate_limited": 0,
    "purchase_unexpected": 0
  },
  "performance": {
    "http_req_duration_ms": {
      "avg": null,
      "p50": null,
      "p95": null,
      "p99": null
    },
    "http_reqs": {
      "count": null,
      "rate": null
    }
  },
  "attempts": 100,
  "classifiedTotal": 100,
  "accountingOk": true
}
```

**Field rules:**

| Field / block     | Rule                                                                                                                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Counters          | Always present; `0` if unused                                                                                                                                                                                                                                                 |
| `performance`     | Always present; numeric or `null` if k6 omitted a stat                                                                                                                                                                                                                        |
| Throughput        | Represented by `performance.http_reqs.rate` (not a separately derived field)                                                                                                                                                                                                  |
| `startedAt`       | UTC ISO-8601 timestamp of scenario script start: each scenario captures it once in init context (module load) and passes it into `buildHandleSummary` via metadata. Must **not** be computed inside `handleSummary` (that would be end-of-run / report time). Not seed start. |
| Base keys         | Never omitted; missing measurements → `null`, not removed keys                                                                                                                                                                                                                |
| `attempts`        | Expected number of purchase attempts configured for the scenario/profile (not observed `http_reqs.count`)                                                                                                                                                                     |
| `classifiedTotal` | Sum of the five purchase counters                                                                                                                                                                                                                                             |
| `accountingOk`    | Derived as `classifiedTotal === attempts`; diagnostic only — not an additional source of truth                                                                                                                                                                                |
| Trend-stat config | All runnable scenarios attach the shared trend-stat configuration so the canonical performance block is populated consistently                                                                                                                                                |
| Additive fields   | e.g. `stock`, `unusedStock`, `oversell`, `fixedUserId`, `warnings`, existing `purchaseSuccess` aliases used by verifier                                                                                                                                                       |
| Verifier compat   | Continues to read `counters.purchase_success` (and existing fallbacks). `#58` does not remove compatibility paths                                                                                                                                                             |

## Reporter and `report.md`

**Artifact paths (unchanged names):**

```text
results/<scenario>-<profile>/
  k6-summary.json
  verifier.json
  report.md
```

**Responsibility:** The reporter is a pure renderer: it derives no new metrics, performs no verification, and introduces no new pass/fail decisions.

**CLI (`pnpm stress:report`):**

- Default paths from `--scenario` + `--profile`
- Explicit `--summary`, `--verifier`, and `--out` override the scenario/profile-derived default paths
- Standalone missing inputs → non-zero exit with a clear error
- Never fabricates missing inputs; never reruns k6 or verification

**Rendered content (facts only):**

- Metadata (scenario, profile, limiterProfile, environment, startedAt)
- Attempts
- Counters (success + failure buckets)
- Latency p50 / p95 / p99 (+ avg when present)
- Throughput (`http_reqs.rate`)
- Verifier `ok` + check list
- Warnings only if present in the canonical summary or verifier artifacts

Fields are rendered directly from the input artifacts. Missing values are shown as unavailable (or omitted from presentation), never synthesized.

No interpretation, bottleneck claims, recommendations, comparisons, or scenario-specific prose templates.

## Pipeline exit precedence

1. Preserve the first non-zero exit from **run** or **verify**.
2. Always invoke the reporter after verification completes, regardless of verifier outcome. The reporter renders whatever artifacts are available and never fabricates missing inputs.
3. If reporting fails:
   - if an earlier stage already failed, retain that original failure;
   - otherwise return a non-zero exit indicating reporting failed.

## Scenario touchpoints

Runnable scenarios: `harness-smoke`, `purchase-load`, `oversell`, `duplicate-race`, `high-volume`.

- Attach shared trend-stat configuration; call enriched `buildHandleSummary` for the base object
- Keep existing thresholds / gates / default functions unchanged
- Scenario-specific summary fields remain additive only; no scenario may remove or redefine canonical base fields
- Delete duplicated local performance extraction from `high-volume.js` once the shared helper owns it
- No changes to seeder stock formulas or `#54`–`#57` proofs

## Documentation

Update `tests/stress/README.md` only to document:

- Artifact contract (`k6-summary.json`, `verifier.json`, `report.md`)
- Pipeline (`seed → run → verify → report`)
- Reproduce commands for local `smoke` runs per runnable scenario

Do **not** document sample outputs or checked-in artifacts. Link EPIC-07 / `#58` design; do not invent `#60` / `#71` narrative. Keep root README thin.

## Testing

- Reporter unit tests with fixtures (`k6-summary.json` + `verifier.json` → expected markdown shape; missing inputs fail)
- Shared summary helper unit coverage for canonical base fields (counters + performance keys + diagnostics) where testable outside k6
- Reporter tests assert presence and ordering of major sections, not exact whitespace or formatting
- No snapshot tests against real generated reports; no fabricated results docs

## Definition of Done

- Each runnable scenario successfully completes a local smoke run and emits the complete artifact trio (`k6-summary.json`, `verifier.json`, `report.md`) with the canonical reporting fields defined in this spec
- ESLint and typecheck pass where applicable
- `#54`–`#57` thresholds / proofs unchanged
- Artifacts remain gitignored
- No unrelated changes
- No invented `#59` / `#60` / `#71` narrative or committed metric numbers

## Relationship to later issues

| Issue   | How #58 relates without overlapping                                                         |
| ------- | ------------------------------------------------------------------------------------------- |
| #54–#57 | Consume/harden emission only; proofs, thresholds, and stock formulas unchanged              |
| #59     | Bottleneck analysis from real artifacts — no invented numbers here                          |
| #60     | Human-oriented narrative hub / comparisons / recommendations — not thin per-run `report.md` |
| #71     | EPIC-08 discoverability / runbook links after stress results exist                          |

## Spec self-review checklist

1. No TBD placeholders for locked decisions.
2. Scope matches GitHub #58 AC (success/failure counts, p95/p99, throughput) without absorbing `#59`/`#60`.
3. Artifact names match epic + existing harness (`verifier.json`, not `verification.json`).
4. Reporter is non-authoritative; exit precedence is deterministic.
5. Base schema normative; additive scenario fields explicit; nullability explicit.
6. `#54`–`#57` freeze and dual-oracle compatibility called out.
7. Real-run DoD + gitignored artifacts; no invented results docs.
8. No `#134` CSS AC reopen.
