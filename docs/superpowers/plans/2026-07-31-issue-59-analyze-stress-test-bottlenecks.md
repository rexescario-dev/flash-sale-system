# #59 Analyze Stress Test Bottlenecks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an evidence-backed, constraint-centric bottleneck analysis at `docs/stress/bottlenecks.md` from real local (or designated-runner) `#58` artifacts — preferring `high-volume`/`full` — without new tooling or changes to `#54`–`#58` proofs/reporting.

**Architecture:** Docs-only slice. Run existing `pnpm stress:test` against the evidence matrix; keep gitignored artifacts under `tests/stress/results/<scenario>-<profile>/`. Author `docs/stress/bottlenecks.md` using Observed → Interpretation → Evidence → Confidence → Limitations per constraint. Thin-link from `tests/stress/README.md`. Missing runs → **Insufficient evidence**, never invent numbers.

**Tech Stack:** Existing stress harness (`pnpm stress:test`, k6 binary, Prisma seeder/verifier, `#58` reporter), Markdown docs only.

**Base:** `main` at `#58` merge tip (`bf5fd90` or later).

**Commits:** Commit in logical groups per task (or tight task clusters) using `<type>: <MESSAGE>` convention **only when the user explicitly asks to commit**. Open a PR only when requested.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-59-analyze-stress-test-bottlenecks-design.md`

**Issue AC:**

- [ ] Bottlenecks are identified with evidence from local runs (local or designated-runner artifacts)

**Task order:** Scaffold analysis template → correctness evidence runs → high-volume evidence (`full` then `standard` fallback) → fill constraint sections from real metrics → README link → freeze/DoD verification.

**Worktree:** Prefer isolated worktree via `using-git-worktrees` (e.g. `.worktrees/59-analyze-bottlenecks` on `test/59-analyze-stress-bottlenecks`) before editing. If worktree creation is blocked, work on a feature branch in place.

---

## File map

| File                                                                                   | Responsibility                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `docs/stress/bottlenecks.md`                                                           | **Create** — living constraint-centric analysis (primary deliverable) |
| `tests/stress/README.md`                                                               | Thin link to `docs/stress/bottlenecks.md`; no duplicated findings     |
| `docs/superpowers/specs/2026-07-31-issue-59-analyze-stress-test-bottlenecks-design.md` | Approved design (already written)                                     |
| `docs/superpowers/plans/2026-07-31-issue-59-analyze-stress-test-bottlenecks.md`        | This plan                                                             |
| `tests/stress/results/<scenario>-<profile>/`                                           | **Local only / gitignored** — evidence source; never commit           |

**Expected unchanged:** All k6 scenarios, `metrics.js`, `summary-fields.js`, reporter, verifier correctness ownership, seeder stock formulas, `#54`–`#57` thresholds/gates, root `README.md`, `docs/testing-strategy.md`, apps production code, e2e, CI, `#60`/`#71` bodies, `#134` CSS AC. No new CLI/parsers/aggregators.

**Confidence rubric (copy into analysis; use only these labels):**

| Confidence            | Meaning                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High                  | Supported by multiple relevant metrics and corroborated by representative evidence (for example, multiple runs/profiles or a representative full-capacity run). |
| Medium                | Supported by one representative run or consistent indirect evidence.                                                                                            |
| Low                   | Limited evidence; observation is real but attribution remains tentative.                                                                                        |
| Insufficient evidence | Required artifacts unavailable or the required run could not be completed.                                                                                      |

---

### Task 1: Scaffold `docs/stress/bottlenecks.md`

**Files:**

- Create: `docs/stress/bottlenecks.md`

- [ ] **Step 1: Create `docs/stress/` if needed and write the scaffold**

Create the file with the normative skeleton. Leave Observed/Interpretation as placeholders marked `*(pending evidence runs)*` until Tasks 2–4 fill them. Do **not** invent metric numbers.

````markdown
# Stress test bottleneck analysis

Living evidence-backed analysis for [EPIC-07 #87](https://github.com/rexescario-dev/flash-sale-system/issues/87) / [#59](https://github.com/rexescario-dev/flash-sale-system/issues/59).
Consumes `#58` artifacts under `tests/stress/results/<scenario>-<profile>/` (gitignored).
Does not invent metrics. Broader results narrative lands with `#60`.

## Scope & Evidence

### Environment

| Field                               | Value                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| Runner                              | _(fill after runs — local hostname or designated runner id)_                        |
| Date                                | _(fill)_                                                                            |
| API limiter — correctness scenarios | Values from `tests/stress/k6/config/correctness.env.example` applied to API process |
| API limiter — high-volume           | Values from `tests/stress/k6/config/performance.env.example` applied to API process |
| Notes                               | k6 env does not reconfigure API rate limits                                         |

### Evidence runs attempted

| Scenario         | Profile               | Limiter     | Artifact dir                                     | Status            |
| ---------------- | --------------------- | ----------- | ------------------------------------------------ | ----------------- |
| `purchase-load`  | _(smoke or standard)_ | correctness | `tests/stress/results/purchase-load-<profile>/`  | pending           |
| `oversell`       | _(smoke or standard)_ | correctness | `tests/stress/results/oversell-<profile>/`       | pending           |
| `duplicate-race` | _(smoke or standard)_ | correctness | `tests/stress/results/duplicate-race-<profile>/` | pending           |
| `high-volume`    | `full` (preferred)    | performance | `tests/stress/results/high-volume-full/`         | pending           |
| `high-volume`    | `standard` (fallback) | performance | `tests/stress/results/high-volume-standard/`     | pending if needed |

### Artifact contract

```text
tests/stress/results/<scenario>-<profile>/
  k6-summary.json
  verifier.json
  report.md
```

### Confidence rubric

| Confidence            | Meaning                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High                  | Supported by multiple relevant metrics and corroborated by representative evidence (for example, multiple runs/profiles or a representative full-capacity run). |
| Medium                | Supported by one representative run or consistent indirect evidence.                                                                                            |
| Low                   | Limited evidence; observation is real but attribution remains tentative.                                                                                        |
| Insufficient evidence | Required artifacts unavailable or the required run could not be completed.                                                                                      |

## Rate Limiter

### Observed

_(pending evidence runs)_

### Interpretation

_(pending evidence runs)_

### Evidence

- Scenario / Profile: _(pending)_
- Artifacts: _(pending)_
- Metrics referenced: _(only metrics cited above)_

### Confidence

Insufficient evidence

### Limitations

No Redis or host metrics collected by the harness.

## Inventory / Accounting

### Observed

_(pending evidence runs)_

### Interpretation

_(pending evidence runs)_

### Evidence

- Scenario / Profile: _(pending)_
- Artifacts: _(pending)_
- Metrics referenced: _(only metrics cited above)_

### Confidence

Insufficient evidence

### Limitations

_(pending)_

## Per-user Uniqueness

### Observed

_(pending evidence runs)_

### Interpretation

_(pending evidence runs)_

### Evidence

- Scenario / Profile: _(pending)_
- Artifacts: _(pending)_
- Metrics referenced: _(only metrics cited above)_

### Confidence

Insufficient evidence

### Limitations

_(pending)_

## Latency & Throughput Saturation

### Observed

_(pending evidence runs)_

### Interpretation

_(pending evidence runs)_

### Evidence

- Scenario / Profile: _(pending)_
- Artifacts: _(pending)_
- Metrics referenced: _(only metrics cited above)_

### Confidence

Insufficient evidence

### Limitations

_(pending)_

## Unresolved candidates

_(Fill only after runs — possible constraints not yet attributable, e.g. DB contention, pool exhaustion. Do not present as named High/Medium bottlenecks without signals.)_

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

_(fill after runs)_

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
````

- [ ] **Step 2: Verify scaffold exists and has no invented metric numbers**

Run:

```bash
test -f docs/stress/bottlenecks.md && rg -n 'purchase_rate_limited: [0-9]|p99: [0-9]|throughput: [0-9]' docs/stress/bottlenecks.md || true
```

Expected: file exists; no fabricated numeric claims (pending markers OK).

- [ ] **Step 3: Commit only if the user explicitly asks**

```bash
git add docs/stress/bottlenecks.md
git commit -m "$(cat <<'EOF'
docs: scaffold stress bottleneck analysis (#59)

EOF
)"
```

Skip this step unless the user requested commits.

---

### Task 2: Collect correctness evidence runs

**Files:**

- Read (gitignored): `tests/stress/results/purchase-load-smoke/` (or `-standard/`)
- Read (gitignored): `tests/stress/results/oversell-smoke/` (or `-standard/`)
- Read (gitignored): `tests/stress/results/duplicate-race-smoke/` (or `-standard/`)
- Modify later in Task 4: `docs/stress/bottlenecks.md`

**Prerequisites:**

- Docker Compose (or equivalent) API + PostgreSQL + Redis up
- Official `k6` on `PATH` (`k6 version`)
- API process started with **correctness** limiter from `tests/stress/k6/config/correctness.env.example` (`RATE_LIMIT_PURCHASE_ITEM_MAX=100000`, window 60), then recreate/restart API

- [ ] **Step 1: Confirm correctness limiter + k6**

```bash
k6 version
# Confirm API was restarted with correctness.env.example values (operator check)
```

Expected: k6 prints a version. If API limiter is wrong, correctness runs may show `purchase_rate_limited > 0` and fail scenario gates — fix API env before continuing.

- [ ] **Step 2: Run purchase-load smoke**

```bash
pnpm stress:test -- --scenario purchase-load --profile smoke
```

Expected: exit 0; usable `#58` artifacts at `tests/stress/results/purchase-load-smoke/` (`k6-summary.json` + `verifier.json` required; `report.md` convenience only).

If smoke is flaky due to environment, one retry is allowed. If it still fails for environmental reasons, record **Insufficient evidence** for baseline-contention claims and continue.

- [ ] **Step 3: Run oversell smoke**

```bash
pnpm stress:test -- --scenario oversell --profile smoke
```

Expected: exit 0; artifacts at `tests/stress/results/oversell-smoke/`.

- [ ] **Step 4: Run duplicate-race smoke**

```bash
pnpm stress:test -- --scenario duplicate-race --profile smoke
```

Expected: exit 0; artifacts at `tests/stress/results/duplicate-race-smoke/`.

- [ ] **Step 5: Snapshot key fields for Task 4 (do not commit artifacts)**

```bash
for d in purchase-load-smoke oversell-smoke duplicate-race-smoke; do
  echo "==== $d ===="
  test -f "tests/stress/results/$d/k6-summary.json" && \
    node -e "const s=require('./tests/stress/results/$d/k6-summary.json'); console.log(JSON.stringify({scenario:s.scenario,profile:s.profile,limiterProfile:s.limiterProfile,counters:s.counters,performance:s.performance,accountingOk:s.accountingOk,attempts:s.attempts},null,2))"
  test -f "tests/stress/results/$d/verifier.json" && \
    node -e "const v=require('./tests/stress/results/$d/verifier.json'); console.log(JSON.stringify({ok:v.ok,checks:v.checks},null,2))"
done
```

Expected: each directory has summary + verifier; print counters/performance/verifier `ok` for later citation. Prefer `standard` instead of `smoke` only if the operator chooses a stronger correctness bar — update artifact paths accordingly.

- [ ] **Step 6: Commit only if the user explicitly asks**

No tracked files should change from runs alone (artifacts gitignored). Skip unless the user asked to commit other work.

---

### Task 3: Collect high-volume evidence (`full`, then `standard` fallback)

**Files:**

- Read (gitignored): `tests/stress/results/high-volume-full/` and/or `high-volume-standard/`

**Prerequisites:**

- API restarted with **performance** limiter from `tests/stress/k6/config/performance.env.example` (`RATE_LIMIT_PURCHASE_ITEM_MAX=30`, window 60)
- Confirm policy metadata expectation:

```bash
pnpm --silent stress:policy --scenario=high-volume --field=expectedLimiterProfile
```

Expected: `performance`

- [ ] **Step 1: Attempt high-volume full**

```bash
pnpm stress:test -- --scenario high-volume --profile full
```

Expected (happy path): exit 0; usable `#58` artifacts at `tests/stress/results/high-volume-full/` (`k6-summary.json` + `verifier.json` required; `report.md` expected when reporter succeeds). Hard gates may still pass with many `RATE_LIMITED` (observational). If `full` does not produce usable `#58` artifacts (timeout, OOM, interrupted run, missing summary/verifier, etc.), do **not** invent results — proceed to Step 2 fallback and document the failure reason in Scope & Evidence.

- [ ] **Step 2: Fallback to standard if full does not produce usable `#58` artifacts**

Only if Step 1 did not produce usable `#58` artifacts:

```bash
pnpm stress:test -- --scenario high-volume --profile standard
```

Expected: exit 0; artifacts at `tests/stress/results/high-volume-standard/`. Capacity confidence in the analysis must be limited vs `full` (never claim `standard` ≡ `full`).

If **both** fail, capacity / rate-limiter / latency sections remain **Insufficient evidence** with the environmental reason recorded.

- [ ] **Step 3: Snapshot high-volume fields for Task 4**

```bash
for d in high-volume-full high-volume-standard; do
  f="tests/stress/results/$d/k6-summary.json"
  if [ -f "$f" ]; then
    echo "==== $d ===="
    node -e "const s=require('./$f'); console.log(JSON.stringify({scenario:s.scenario,profile:s.profile,limiterProfile:s.limiterProfile,counters:s.counters,performance:s.performance,accountingOk:s.accountingOk,attempts:s.attempts},null,2))"
    node -e "const v=require('./tests/stress/results/$d/verifier.json'); console.log(JSON.stringify({ok:v.ok,checks:v.checks},null,2))"
  fi
done
```

Expected: at least one high-volume profile’s artifacts, or an explicit note that none exist.

- [ ] **Step 4: Commit only if the user explicitly asks**

Skip unless requested (artifacts must stay untracked).

---

### Task 4: Fill `docs/stress/bottlenecks.md` from real artifacts only

**Files:**

- Modify: `docs/stress/bottlenecks.md`

- [ ] **Step 1: Update Scope & Evidence from actual runs**

Fill Environment (runner, date), Evidence runs attempted table statuses (`ok` / `failed` / `skipped` + reason), and Appendix artifact paths.

**Canonical numeric sources (do not treat all three artifacts as equal):**

| Artifact          | Role                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `k6-summary.json` | Canonical source for metrics (counters, latency, throughput, diagnostics)                      |
| `verifier.json`   | Canonical source for correctness / invariants                                                  |
| `report.md`       | Convenience human summary only — optional for evidence; never authoritative for numeric values |

Quote metrics from the canonical JSON artifacts (`k6-summary.json`, `verifier.json`). `report.md` may be referenced for human-readable context but should not be the authoritative source of numeric values.

- [ ] **Step 2: Fill Rate Limiter section**

Rules:

- Prefer citing `high-volume`/`full` (or `standard` fallback) counters `purchase_rate_limited` and related performance fields.
- May also cite `purchase-load` (expect `purchase_rate_limited == 0` under correctness limiter) as corroboration.
- **Observed** = numbers only; **Interpretation** = evidence-backed (e.g. primary capacity gate is purchase rate limiter when saturation aligns with throughput/latency signals).
- **Evidence** must list Scenario/Profile, Artifacts path(s), and **only** metrics cited in Observed/Interpretation.
- **Bidirectional metric check:** every metric appearing in Observed or Interpretation must also appear in the Evidence list (and vice versa — no unused Evidence metrics).
- Confidence per rubric. Speculation about Redis CPU / Postgres locks → Unresolved candidates, not High/Medium named bottlenecks.

  - [ ] **Step 3: Fill Inventory / Accounting**

  Cite `oversell` (and optionally `duplicate-race` / `purchase-load`) verifier checks + counters (`purchase_success` ≤ stock, accounting identity). No inventing oversell failures if verifier `ok`.

  - [ ] **Step 4: Fill Per-user Uniqueness**

  Cite `duplicate-race` (`purchase_success == 1`, duplicates for remainder, verifier uniqueness). Optional corroboration from other scenarios’ “no duplicate rows” checks.

  - [ ] **Step 5: Fill Latency & Throughput Saturation**

  Cite `performance.http_req_duration_ms.{p50,p95,p99}` and `performance.http_reqs.rate` from high-volume (and optionally purchase-load). Separate observation from interpretation. If only `standard` exists, note limited capacity confidence. If no high-volume artifacts, **Insufficient evidence**.

  - [ ] **Step 6: Fill Unresolved candidates vs Additional instrumentation**

  Keep these as **two separate sections**. Move unsupported component hypotheses (DB contention, pool exhaustion, Redis saturation) to Unresolved candidates. Keep instrumentation list actionable (`pg_stat_statements`, pool metrics, Redis `INFO`, host CPU/RAM).

  - [ ] **Step 7: Self-check — no speculation / metric dump**

  ```bash
  rg -n 'Postgres is the bottleneck|Redis CPU|connection pool exhaustion' docs/stress/bottlenecks.md && echo 'FAIL: speculative phrasing' || echo 'OK: no banned speculative phrases'
  # Ensure pending markers are gone from filled sections (or explicitly Insufficient evidence)
  rg -n 'pending evidence runs' docs/stress/bottlenecks.md || echo 'OK: no pending placeholders'
  ```

  Expected: no banned speculative claims presented as conclusions; no leftover `*(pending evidence runs)*` unless a section intentionally remains insufficient and says so via Confidence = Insufficient evidence (prefer replacing pending text with explicit insufficient-evidence wording).

  - [ ] **Step 8: Commit only if the user explicitly asks**

  ```bash
  git add docs/stress/bottlenecks.md
  git commit -m "$(cat <<'EOF'
  docs: add stress bottleneck analysis (#59)

  EOF
  )"
  ```

  ***

  ### Task 5: Thin README link

  **Files:**

  - Modify: `tests/stress/README.md`

  - [ ] **Step 1: Add a thin pointer near Design / Artifacts**

  Add a short section or line (do not paste findings). Example placement after the Artifacts section or before Design:

  ```markdown
  ## Bottleneck analysis

  Evidence-backed constraint analysis: [docs/stress/bottlenecks.md](../../docs/stress/bottlenecks.md).
  Results narrative hub lands with #60.
  ```

  Also add the `#59` design link alongside other design links in the Design section:

  ```markdown
  [#59 design](../../docs/superpowers/specs/2026-07-31-issue-59-analyze-stress-test-bottlenecks-design.md)
  ```

  Keep root README unchanged. Do not expand `#71` hubs. Do not duplicate bottleneck conclusions in the README.

  - [ ] **Step 2: Verify README stays thin**

  ```bash
  rg -n 'bottlenecks|Bottleneck' tests/stress/README.md
  wc -l tests/stress/README.md
  ```

  Expected: link present; README does not grow into a results narrative (still roughly the same order of magnitude as before — a few added lines only).

  - [ ] **Step 3: Commit only if the user explicitly asks**

  ```bash
  git add tests/stress/README.md
  git commit -m "$(cat <<'EOF'
  docs: link stress bottleneck analysis from harness README (#59)

  EOF
  )"
  ```

  ***

  ### Task 6: Freeze + DoD verification

  **Files:**

  - Verify unchanged: stress harness code under `tests/stress/k6/`, `tests/stress/reporter/`, `tests/stress/verifier/`, `tests/stress/seeder/`, `scripts/stress-*.sh` (except no planned edits)

  - [ ] **Step 1: Confirm no harness code drift**

  ```bash
  git status --short
  git diff --stat
  ```

  Expected: tracked changes are docs only (`docs/stress/bottlenecks.md`, `tests/stress/README.md`, plus this plan/spec if untracked). No modifications to k6 helpers, reporter, scenarios, verifier gates, or seeder formulas. `git status --short` may also show intentionally untracked local gitignored result artifacts under `tests/stress/results/` — those must remain untracked / unstaged (never commit them).

  - [ ] **Step 2: Confirm analysis cites real artifacts**

  For each Confidence ≠ Insufficient evidence section in `docs/stress/bottlenecks.md`, the listed Artifacts directory must exist locally. Bidirectional metric check: every metric in Observed/Interpretation appears in Evidence, and every Evidence metric is cited in Observed/Interpretation. Numeric values must come from `k6-summary.json` / `verifier.json` (not `report.md`).

  ```bash
  # Example check — adjust profiles to what was actually run
  ls tests/stress/results/purchase-load-smoke/k6-summary.json \
    tests/stress/results/oversell-smoke/k6-summary.json \
    tests/stress/results/duplicate-race-smoke/k6-summary.json
  ls tests/stress/results/high-volume-full/k6-summary.json \
    || ls tests/stress/results/high-volume-standard/k6-summary.json \
    || echo 'NO high-volume artifacts — capacity sections must be Insufficient evidence'
  ```

  - [ ] **Step 3: AC checklist**

  - [ ] Bottlenecks identified with evidence from local/designated-runner runs **or** explicit Insufficient evidence where runs failed
  - [ ] `docs/stress/bottlenecks.md` uses constraint-centric template + confidence rubric + Evidence format
  - [ ] Unresolved candidates separate from Additional instrumentation required
  - [ ] `#54`–`#58` proofs/reporting contract unchanged
  - [ ] No `#60`/`#71` invented results hub
  - [ ] No `#134` CSS AC reopen
  - [ ] Artifacts remain gitignored / uncommitted

  - [ ] **Step 4: Commit / PR only if the user explicitly asks**

  Suggested single commit if bundling remaining docs:

  ```bash
  git add docs/stress/bottlenecks.md \
    tests/stress/README.md \
    docs/superpowers/specs/2026-07-31-issue-59-analyze-stress-test-bottlenecks-design.md \
    docs/superpowers/plans/2026-07-31-issue-59-analyze-stress-test-bottlenecks.md
  git commit -m "$(cat <<'EOF'
  docs: add stress bottleneck analysis (#59)

  EOF
  )"
  ```

  Do not push or open a PR unless requested.

  ***

  ## Spec coverage (self-review)

  | Spec requirement                                   | Task(s)           |
  | -------------------------------------------------- | ----------------- |
  | Analysis doc only; no tooling                      | File map + Task 6 |
  | `docs/stress/bottlenecks.md` constraint-centric    | Tasks 1, 4        |
  | Confidence rubric + Evidence format                | Tasks 1, 4        |
  | Local/designated-runner evidence; prefer HV/`full` | Tasks 2–3         |
  | `standard` fallback with lower capacity confidence | Task 3, 4         |
  | Correctness scenarios for inventory/uniqueness     | Task 2, 4         |
  | Multi-scenario citation allowed                    | Task 4            |
  | Unresolved vs instrumentation split                | Task 4 Step 6     |
  | Thin README link                                   | Task 5            |
  | `#54`–`#58` freeze; no `#60`/`#71` invention       | Task 6            |
  | Insufficient evidence when runs fail               | Tasks 2–4         |
  | Commits only when user asks                        | All tasks         |

  ## Placeholder scan

  No TBD/TODO implementation steps. Metric **values** are intentionally filled only after real runs in Tasks 2–4 (scaffold uses pending/Insufficient evidence markers by design).
