# #60 — Document stress test results (Design Spec)

**Status:** Design approved (chat)
**Date:** 2026-08-01
**Issue:** [#60](https://github.com/rexescario-dev/flash-sale-system/issues/60) — Document stress test results
**Epic:** [#87](https://github.com/rexescario-dev/flash-sale-system/issues/87) (EPIC-07 — Performance & Stress Testing)
**Parent design:** [EPIC-07 performance stress testing](./2026-07-31-epic-07-performance-stress-testing-design.md)
**Sibling designs:** [#54](./2026-07-31-issue-54-flash-sale-load-test-design.md), [#55](./2026-07-31-issue-55-limited-inventory-concurrency-test-design.md), [#56](./2026-07-31-issue-56-same-user-concurrency-test-design.md), [#57](./2026-07-31-issue-57-high-volume-api-test-design.md), [#58](./2026-07-31-issue-58-capture-stress-test-metrics-design.md), [#59](./2026-07-31-issue-59-analyze-stress-test-bottlenecks-design.md)
**Depends on:** [#58](https://github.com/rexescario-dev/flash-sale-system/issues/58), [#59](https://github.com/rexescario-dev/flash-sale-system/issues/59) on `main`
**Repository:** `rexescario-dev/flash-sale-system`

## Goal

Publish `docs/stress-testing.md` as the canonical stress-testing results hub so readers can understand available scenarios, evidence-backed expected vs. actual outcomes, environment limitations, and how to reproduce the results, without duplicating the bottleneck analysis (#59) or the future operational runbook (#71).

## Acceptance criteria

GitHub AC: **Docs include scenarios, expected vs actual results, and environment limitations.**

Satisfied when:

1. `docs/stress-testing.md` exists as the canonical entry point with the seven-section content contract below.
2. Expected-vs-actual values are evidence-backed and traceable to either fresh artifacts or `docs/stress/bottlenecks.md`, with an **Evidence** column identifying the source (`Fresh run` or `Prior-run (#59)`).
3. Only evidence-backed scenarios receive documented expected-vs-actual results (the #59 evidence matrix).
4. Environment limitations are documented (local runner, limiter profiles, stack/machine limits, environment-dependence, CI not required this epic).
5. Thin discoverability updates: `tests/stress/README.md` links the hub; `docs/testing-strategy.md` states stress is documented and links hub + bottlenecks, leaving CI/automation to #71.
6. `#54`–`#59` reporting formats, artifact layout, metrics contracts, and analysis remain unchanged.
7. Fresh re-runs are preferred when artifacts can be regenerated, but are **not** a mandatory DoD requirement.

## Approach

**Single results hub at `docs/stress-testing.md` (Approach 1):**

| Surface                                        | Role after #60                                                  |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `docs/stress-testing.md`                       | Canonical results hub / overview (primary AC deliverable)       |
| `docs/stress/bottlenecks.md`                   | Unchanged constraint analysis from #59 — linked, not relocated  |
| `tests/stress/README.md`                       | Operational harness usage; thin pointer to the hub              |
| `docs/testing-strategy.md`                     | High-level strategy with thin links; CI/runbook deferred to #71 |
| Fresh artifacts or prior-run evidence from #59 | Evidence sources for Actual cells                               |

**Rejected alternatives:**

| Alternative                                         | Why rejected                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| Split hub under `docs/stress/results.md` + index    | Extra hop; less discoverable than EPIC-preferred `docs/stress-testing.md` |
| Fat `tests/stress/README.md` as narrative hub       | Conflates ops with project-level reporting; breaks thin-README pattern    |
| Mandatory re-run of all scenarios for DoD           | Couples docs issue to stack availability; #59 already produced evidence   |
| Full profile×scenario sparse results grid           | Noise of “Not run” cells without evidence quality                         |
| Broader `testing-strategy.md` rewrite / #71 runbook | Out of issue boundary                                                     |

## Locked decisions

| Area                  | Decision                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Approach              | Single hub at `docs/stress-testing.md`                                                                         |
| Evidence DoD          | Prefer fresh artifacts when regenerable; else cite `docs/stress/bottlenecks.md` as **prior-run evidence**      |
| Evidence labeling     | Per-row **Evidence** column: `Fresh run` or `Prior-run (#59)`; fresh and prior-run may be mixed                |
| Scenario Results      | Only evidence-backed scenarios receive documented expected-vs-actual results (#59 matrix)                      |
| Other profiles        | Brief inventory note; no metrics without corresponding artifacts                                               |
| `testing-strategy.md` | Thin discoverability update; CI/automation remains #71                                                         |
| README                | Thin pointer to hub; remain operational and concise                                                            |
| Freeze                | `#54`–`#59` reporting formats, artifact layout, metrics contracts, and analysis remain unchanged               |
| Out of slice          | Mandatory full re-run; `#71` runbook/CI; new tooling; invented numbers; committed gitignored artifacts; `#134` |

## Hub content contract

Canonical file: `docs/stress-testing.md`

### Section outline

| #   | Section                    | Role                                                                                            |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Overview                   | Dual-oracle stress layer; hub vs bottlenecks vs README vs testing-strategy; no invented metrics |
| 2   | Scenario matrix            | **Inventory** (not results): Scenario, Purpose, Profile(s), Limiter                             |
| 3   | Expected vs actual results | Evidence-backed summary rows only                                                               |
| 4   | Other supported profiles   | Supported combinations without quantitative claims unless artifacts exist                       |
| 5   | Environment limitations    | Runner, limiter, stack, environment-dependence, CI stance                                       |
| 6   | Reproducing the results    | Brief commands + link to README                                                                 |
| 7   | Related documentation      | Reader-workflow ordered links                                                                   |

### Section 2 — Scenario matrix (inventory)

| Column     | Description                  |
| ---------- | ---------------------------- |
| Scenario   | Runnable scenario            |
| Purpose    | What it validates            |
| Profile(s) | Supported execution profiles |
| Limiter    | correctness / performance    |

Keep this distinct from Section 3. Optionally note `harness-smoke` as harness-only (no results row required).

### Section 3 — Expected vs actual

| Column   | Rule                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Scenario | One of the four evidence rows                                                                                                         |
| Profile  | Evidence profile (`smoke` for correctness trio; `full` for high-volume)                                                               |
| Expected | Scenario acceptance criteria / invariant — not a specific numeric threshold unless the scenario defines one                           |
| Actual   | Evidence-backed summary from `k6-summary.json`, `verifier.json`, or `docs/stress/bottlenecks.md`; avoid reproducing full metric dumps |
| Evidence | `Fresh run` or `Prior-run (#59)`                                                                                                      |

**Evidence-backed expected-vs-actual rows (fixed contract):**

| Scenario         | Profile | Limiter     |
| ---------------- | ------- | ----------- |
| `purchase-load`  | `smoke` | correctness |
| `oversell`       | `smoke` | correctness |
| `duplicate-race` | `smoke` | correctness |
| `high-volume`    | `full`  | performance |

Example Expected phrasing (non-exhaustive):

- `purchase-load` → completes without invariant / classification violations under correctness limiter
- `oversell` → successes ≤ stock; no oversell
- `duplicate-race` → exactly one successful purchase for the fixed user
- `high-volume` → inventory/uniqueness invariants hold; `RATE_LIMITED` is observational

### Section 4 — Other supported profiles

Briefly list that correctness scenarios also support `standard` / `full` (and high-volume supports `smoke` / `standard`) via the harness. State explicitly:

> No expected-vs-actual metrics are reported for profile/scenario combinations without evidence.

### Section 5 — Environment limitations

Must cover at least:

- Local (or designated-runner) environment and limiter-profile prerequisites
- Results are environment-dependent and intended for comparative validation rather than benchmarking across different hardware
- Stress is not a required PR CI gate in this epic
- Pointer to `docs/stress/bottlenecks.md` for deeper constraint analysis

### Section 6 — Reproducing

Intentionally brief:

- Representative `pnpm stress:test -- --scenario … --profile …` commands for the evidence rows (or a subset with a pointer that the same pattern covers the rest)
- “See `tests/stress/README.md` for full setup, options, and troubleshooting.”

### Section 7 — Related documentation (reader workflow order)

1. `tests/stress/README.md` — how to run
2. `docs/stress/bottlenecks.md` — why results look the way they do
3. `docs/testing-strategy.md` — where stress fits
4. EPIC-07 / child designs — design provenance

## Evidence workflow

1. Determine whether the required evidence artifacts can be regenerated.
2. If the required artifacts can be regenerated, prefer fresh runs for the four evidence rows.
3. If fresh artifacts cannot be generated, document results from `docs/stress/bottlenecks.md` and any referenced/remaining artifacts, clearly marking rows as **Prior-run (#59)**.
4. Fresh and prior-run evidence may be mixed on a per-row basis.
5. Each scenario row must identify its evidence source.
6. Never invent metrics. Never commit gitignored artifacts under `tests/stress/results/`.

Documented example regenerate path (ops detail lives in README):

```bash
pnpm stress:test -- --scenario purchase-load --profile smoke
pnpm stress:test -- --scenario oversell --profile smoke
pnpm stress:test -- --scenario duplicate-race --profile smoke
# API on performance limiter first:
pnpm stress:test -- --scenario high-volume --profile full
```

## File map

| Path                                                                                | Change                                                                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `docs/stress-testing.md`                                                            | **Create** — canonical hub                                                                                      |
| `tests/stress/README.md`                                                            | Thin link to hub; remove “lands with #60” placeholders                                                          |
| `docs/testing-strategy.md`                                                          | Thin Stress update: documented + links to hub/bottlenecks; CI/automation → #71                                  |
| `docs/superpowers/specs/2026-08-01-issue-60-document-stress-test-results-design.md` | This design                                                                                                     |
| `docs/superpowers/plans/2026-08-01-issue-60-document-stress-test-results.md`        | Implementation plan                                                                                             |
| `docs/stress/bottlenecks.md`                                                        | No content changes required; optional backlink to the hub if it improves navigation without duplicating content |

## Frozen artifacts / contracts

Do not modify:

- `#54`–`#59` scenario behavior
- Reporter / verifier output contracts
- Artifact directory layout (`tests/stress/results/<scenario>-<profile>/`)
- Metrics schema / `#58` reporting contract
- Stock calculation policy
- Application production code
- E2E / CI implementation
- `#71` scope (runbook / CI automation)
- `#134` CSS acceptance criteria

## Out of scope

- Re-running stress tests as a mandatory requirement
- `#71` operational runbook expansion or CI stress jobs
- New CLI / parsers / aggregators / report tooling
- Relocating or rewriting `docs/stress/bottlenecks.md` analysis
- Invented k6 results docs or fabricated numbers
- Committing gitignored result artifacts
- Reopening `#134` CSS AC

## Definition of Done

- `docs/stress-testing.md` published with all seven required sections
- Four evidence-backed expected-vs-actual rows with **Evidence** column
- Every reported value is traceable to a documented evidence source
- Other supported profiles note without invented metrics
- Environment limitations present
- Thin README + testing-strategy discoverability updates
- `#54`–`#59` freeze holds
- No mandatory re-run; no `#71` invention; no unrelated changes
- Commit message (when requested) follows `<type>: <MESSAGE>`

## Testing / verification for this issue

Docs-only slice — no new unit tests expected.

Verification checklist:

- `docs/stress-testing.md` exists and contains all seven required sections
- Each expected-vs-actual row includes an **Evidence** value (`Fresh run` or `Prior-run (#59)`)
- Every Actual value is traceable to fresh artifacts or `docs/stress/bottlenecks.md`
- No speculative metrics or bottleneck analysis are introduced in the hub
- `tests/stress/README.md` remains operational and concise
- `docs/testing-strategy.md` links to stress documentation without becoming a runbook

## Relationship to adjacent issues

| Issue | How #60 relates without overlapping                                   |
| ----- | --------------------------------------------------------------------- |
| #58   | Consumes canonical artifacts; does not change emission                |
| #59   | Consumes / cites bottleneck analysis; does not relocate or rewrite it |
| #71   | EPIC-08 runbook / CI discoverability after stress results hub exists  |

## Spec self-review checklist

1. No TBD placeholders for locked decisions.
2. Scope matches GitHub #60 AC without absorbing `#59` analysis rewrite or `#71` runbook.
3. Evidence policy prefers fresh runs but does not mandate them.
4. Scenario matrix (inventory) is distinct from expected-vs-actual (results).
5. Fixed four-row expected-vs-actual contract matches #59 evidence matrix.
6. `#54`–`#59` freeze explicit; artifacts remain gitignored.
7. `testing-strategy.md` thin-link only; CI deferred to #71.
8. No `#134` CSS AC reopen.
   )
