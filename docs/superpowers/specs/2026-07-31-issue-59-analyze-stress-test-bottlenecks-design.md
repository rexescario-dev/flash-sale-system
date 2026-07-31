# #59 — Analyze stress test bottlenecks (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-07-31
**Issue:** [#59](https://github.com/rexescario-dev/flash-sale-system/issues/59) — Analyze stress test bottlenecks
**Epic:** [#87](https://github.com/rexescario-dev/flash-sale-system/issues/87) (EPIC-07 — Performance & Stress Testing)
**Parent design:** [EPIC-07 performance stress testing](./2026-07-31-epic-07-performance-stress-testing-design.md)
**Sibling designs:** [#54](./2026-07-31-issue-54-flash-sale-load-test-design.md), [#55](./2026-07-31-issue-55-limited-inventory-concurrency-test-design.md), [#56](./2026-07-31-issue-56-same-user-concurrency-test-design.md), [#57](./2026-07-31-issue-57-high-volume-api-test-design.md), [#58](./2026-07-31-issue-58-capture-stress-test-metrics-design.md)
**Depends on:** [#58](https://github.com/rexescario-dev/flash-sale-system/issues/58) on `main` (canonical artifacts: `k6-summary.json`, `verifier.json`, thin `report.md`)
**Repository:** `rexescario-dev/flash-sale-system`

## Goal

Identify stress-test bottlenecks using evidence from local (or designated runner) k6 / verifier / report artifacts — especially `#57` high-volume at `full` when feasible — and publish a living, constraint-centric analysis document. Do not invent metrics, results hubs, or component claims without supportable signals.

## Acceptance criterion

GitHub AC: **Bottlenecks are identified with evidence from local runs.**

Interpretation for this issue: evidence may come from **local or designated-runner** stress runs that produce real `#58` artifacts. “Local runs” in the GitHub AC is not a restriction against a designated CI/agent machine when that machine is the evidence source.

Satisfied when:

1. Representative local (or designated-runner) stress runs produce (or attempt) `#58` artifacts under `tests/stress/results/<scenario>-<profile>/`.
2. `docs/stress/bottlenecks.md` identifies constraints with quoted observed metrics, artifact references, and confidence levels from the rubric below.
3. Missing or incomplete required evidence is recorded as **Insufficient evidence** for the affected constraint area — never filled with speculation.
4. No new analysis tooling, and no changes to the `#54`–`#58` proofs or reporting contract.

## Approach

**Constraint-centric analysis document only (Approach 1):**

| Surface                                                    | Role after #59                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| Fresh local (or designated-runner) `pnpm stress:test` runs | Produce real `#58` artifacts (gitignored) used as evidence   |
| `docs/stress/bottlenecks.md`                               | Living, constraint-centric analysis (primary AC deliverable) |
| `docs/superpowers/specs/…issue-59…-design.md` (this file)  | Implementation design / how #59 was executed                 |
| `tests/stress/README.md`                                   | Thin pointer to `docs/stress/bottlenecks.md`                 |
| `#58` reporter / metrics / scenarios                       | Unchanged consumers — read-only for this issue               |

**Rejected alternatives:**

| Alternative                                          | Why rejected                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| New `stress:bottlenecks` CLI / parsers / aggregators | AC asks for analysis, not tooling; overlaps `#58`/`#60` reporting surface |
| Analysis + tooling hybrid                            | Expands maintenance; blurs issue boundary                                 |
| Scenario-centric narrative only                      | Forces readers to synthesize bottlenecks; mismatches issue title          |
| Artifact dump without interpretation                 | Does not “identify” bottlenecks                                           |
| Close on existing `duplicate-race-smoke` alone       | Insufficient for capacity / limiter / latency claims                      |
| Require both `standard` and `full` high-volume       | Rigid DoD; successful `full` is the primary capacity evidence             |
| Component claims needing APM/pg_stat only            | Blocks naming clearly instrumented gates (e.g. rate limiter)              |

## Locked decisions

| Area                 | Decision                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deliverable          | Evidence-backed analysis document only — no new CLI, parsers, JSON aggregators, report scripts, `handleSummary`, or metrics changes              |
| Design vs analysis   | Design in `docs/superpowers/specs/`; living analysis in `docs/stress/bottlenecks.md`                                                             |
| README               | Thin link from `tests/stress/README.md` only; do not duplicate findings                                                                          |
| Doc organization     | Constraint-centric (Approach 1)                                                                                                                  |
| Section template     | Observed → Interpretation → Evidence → Confidence → Limitations                                                                                  |
| Confidence rubric    | High / Medium / Low / Insufficient evidence (see below)                                                                                          |
| Evidence DoD         | Fresh local (or designated-runner) runs required where feasible; prefer `high-volume`/`full`; `standard` fallback with lower capacity confidence |
| Correctness evidence | `oversell`, `duplicate-race`, `purchase-load` at `smoke` or `standard` to ground inventory/uniqueness/baseline observations                      |
| Attribution          | Observations + evidence-backed interpretations allowed; speculation forbidden                                                                    |
| Missing runs         | Explicit **Insufficient evidence**; no fabricated capacity/bottleneck claims                                                                     |
| Freeze               | `#54`–`#58` thresholds, proofs, stock formulas, and reporting contract unchanged                                                                 |
| Out of slice         | `#60` results hub, `#71` runbook expansion, invented numbers, committed gitignored artifacts, `#134` CSS AC                                      |

## Confidence rubric

| Confidence            | Meaning                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High                  | Supported by multiple relevant metrics and corroborated by representative evidence (for example, multiple runs/profiles or a representative full-capacity run). |
| Medium                | Supported by one representative run or consistent indirect evidence.                                                                                            |
| Low                   | Limited evidence; observation is real but attribution remains tentative.                                                                                        |
| Insufficient evidence | Required artifacts unavailable or the required run could not be completed.                                                                                      |

Use these labels only — do not invent free-form confidence wording.

## Attribution levels

| Level                              | Allowed? | Example                                                                                                                            |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Observation**                    | Yes      | High-volume produced X% `purchase_rate_limited`; throughput plateaued while p99 increased.                                         |
| **Evidence-backed interpretation** | Yes      | The primary observed capacity gate is the purchase rate limiter because limiter saturation coincides with throughput flattening.   |
| **Speculation**                    | No       | “Postgres is the bottleneck.” “Redis CPU is saturated.” “Connection pool exhaustion caused the latency.” (without supporting data) |

## Scope

### In scope

- Attempt the evidence matrix below using existing `pnpm stress:*` commands and `#58` artifacts
- Author `docs/stress/bottlenecks.md` using the constraint-centric template and confidence rubric
- Quote only observed metrics; cite scenario/profile, artifact directory, and metrics referenced per constraint section
- Record environment, reproduce commands, and limitations
- Split unresolved candidates from additional instrumentation required
- Thin `tests/stress/README.md` link to the analysis
- This design spec (+ later implementation plan)

### Out of scope

- New analysis tooling or changes to k6 helpers, reporter, verifier correctness ownership, seeder, or scenario gates
- `#60` results narrative hub / comparisons / recommendations beyond what `#59` needs for bottleneck identification
- Invented k6 results docs (`#71` / `#60`) or committed result artifacts
- External observability stack (APM, `pg_stat`, Redis INFO, host metrics) as a required DoD dependency — may appear only as follow-up instrumentation
- Reopening `#134` CSS AC
- Production application code changes

## Evidence matrix

| Purpose                      | Scenario         | Profile                                              | Limiter     |
| ---------------------------- | ---------------- | ---------------------------------------------------- | ----------- |
| Capacity / limiter / latency | `high-volume`    | `full` preferred; `standard` if `full` cannot finish | performance |
| Inventory / oversell         | `oversell`       | `smoke` or `standard`                                | correctness |
| Per-user uniqueness          | `duplicate-race` | `smoke` or `standard`                                | correctness |
| Baseline contention          | `purchase-load`  | `smoke` or `standard`                                | correctness |

**Profile confidence note:** Observations under `full` support higher-confidence capacity/bottleneck conclusions. Observations under `standard` are valid but capacity conclusions are limited. If `full` was not run, capacity sections must say so explicitly (Insufficient evidence / Low as appropriate) — never treat `standard` as equivalent to `full`.

A constraint section may cite multiple scenarios when they collectively strengthen or refute the interpretation (for example, Rate Limiter citing both `high-volume`/`full` and `purchase-load`/`standard`).

## Artifact contract (read-only)

Consume existing `#58` outputs only:

```text
tests/stress/results/<scenario>-<profile>/
  k6-summary.json
  verifier.json
  report.md
```

Do not rename artifacts, alter canonical summary fields, or commit generated files (remain gitignored).

## Analysis document template

Canonical path: `docs/stress/bottlenecks.md`

```text
1. Scope & Evidence
   - Tested scenarios / profiles
   - Environment
   - Artifact root convention

2. Rate Limiter
   Observed / Interpretation / Evidence / Confidence / Limitations

3. Inventory / Accounting
   Observed / Interpretation / Evidence / Confidence / Limitations

4. Per-user Uniqueness
   Observed / Interpretation / Evidence / Confidence / Limitations

5. Latency & Throughput Saturation
   Observed / Interpretation / Evidence / Confidence / Limitations

6. Unresolved candidates
   - Open questions / possible constraints not yet attributable

7. Additional instrumentation required
   - How to confirm or reject unresolved candidates
   (e.g. pg_stat_statements, connection pool metrics, Redis INFO, host CPU/RAM)

Appendix
   - Scenario matrix
   - Artifact paths
   - Reproduce commands
```

### Evidence subsection format (required per constraint)

Each constraint’s **Evidence** block must include:

- **Scenario / Profile** (e.g. `high-volume` / `full`; list multiple when cited)
- **Artifacts** directory (`tests/stress/results/<scenario>-<profile>/`)
- **Metrics referenced** — only those cited in the Observed or Interpretation sections (e.g. `p95`, `p99`, `performance.http_reqs.rate`, `purchase_rate_limited`, verifier checks). Do not dump unused artifact fields.

Example shape:

```markdown
### Evidence

- Scenario / Profile: `high-volume` / `full`
- Artifacts: `tests/stress/results/high-volume-full/`
- Metrics referenced:
  - `counters.purchase_rate_limited`
  - `performance.http_reqs.rate`
  - `performance.http_req_duration_ms.p99`
```

### Interpretation rules

- **Observed** = artifact-derived facts only (numbers, counters, verifier `ok` / checks).
- **Interpretation** = evidence-backed interpretation labeled as such; must not invent unsupported components.
- Hypotheses without enough signal belong under **Unresolved candidates**, not as named bottlenecks with High/Medium confidence.

## Documentation touchpoints

| File                         | Change                                                                |
| ---------------------------- | --------------------------------------------------------------------- |
| `docs/stress/bottlenecks.md` | Create / fill with evidence-backed analysis                           |
| `tests/stress/README.md`     | One thin link to `docs/stress/bottlenecks.md`; no duplicated findings |
| Root README / `#71` hubs     | Unchanged in `#59`                                                    |
| `#60` hub                    | Out of slice; may later link this analysis without relocating it      |

## Testing / verification for this issue

- No new unit tests expected (docs-only slice).
- Verification = required evidence collected from local (or designated-runner) runs where feasible; analysis quotes only real artifact values; constraint sections with missing runs use **Insufficient evidence**.
- Do not add snapshot tests against generated reports or invent fixture “results docs.”

## Definition of Done

- Design + implementation plan exist for `#59`
- Required evidence collected from local (or designated-runner) runs where feasible; otherwise the corresponding constraint section explicitly records **Insufficient evidence**
- `docs/stress/bottlenecks.md` follows the template, confidence rubric, and evidence format
- `tests/stress/README.md` has a thin link to the analysis
- `#54`–`#58` proofs and reporting contract unchanged
- No new analysis tooling
- No unrelated changes
- No invented `#60` / `#71` results narrative or fabricated bottleneck numbers
- Commit message (when requested) follows `<type>: <MESSAGE>`

## Relationship to later issues

| Issue | How #59 relates without overlapping                                            |
| ----- | ------------------------------------------------------------------------------ |
| #58   | Consumes canonical artifacts; does not change emission or thin `report.md`     |
| #60   | Broader results narrative hub / expected-vs-actual / environment limits matrix |
| #71   | EPIC-08 discoverability / runbook links after stress results exist             |

## Spec self-review checklist

1. No TBD placeholders for locked decisions.
2. Scope matches GitHub #59 AC without absorbing `#60`/`#71` or new tooling.
3. Confidence rubric and Evidence subsection format are normative.
4. Unresolved candidates vs additional instrumentation are separate.
5. Prefer `high-volume`/`full` with honest `standard` fallback.
6. `#54`–`#58` freeze explicit; artifacts remain gitignored.
7. Speculation forbidden; insufficient evidence path explicit.
8. No `#134` CSS AC reopen.
