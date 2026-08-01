# #60 Document Stress Test Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `docs/stress-testing.md` as the canonical stress-results hub with scenarios, evidence-backed expected vs actual, environment limitations, and reproduce pointers — without inventing numbers or absorbing `#59`/`#71`.

**Architecture:** Docs-only slice. Prefer fresh `#58` artifacts when regenerable; otherwise cite `docs/stress/bottlenecks.md` as prior-run evidence with a per-row **Evidence** column. Keep `tests/stress/README.md` thin; update `docs/testing-strategy.md` discoverability only. Do not modify `#54`–`#59` harness/reporting/analysis contracts.

**Tech Stack:** Existing stress harness (`pnpm stress:test`, k6, Prisma seeder/verifier), Markdown docs only.

**Base:** `main` at `#59` merge tip (`2e07686` or later).

**Commits:** Commit in logical groups per task (or tight task clusters) using `<type>: <MESSAGE>` convention **only when the user explicitly asks to commit**. Open a PR only when requested.

**Spec:** `docs/superpowers/specs/2026-08-01-issue-60-document-stress-test-results-design.md`

**Issue AC:**

- [ ] Docs include scenarios, expected vs actual results, and environment limitations

**Task order:** Worktree → evidence availability check → author hub → thin README + testing-strategy links → optional bottlenecks backlink → freeze/DoD verification.

**Worktree:** Prefer isolated worktree via `using-git-worktrees` (e.g. `.worktrees/60-document-stress-results` on `docs/60-document-stress-results`) before editing. If worktree creation is blocked, work on a feature branch in place.

---

## File map

| File                                                                                         | Responsibility                                              |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `docs/stress-testing.md`                                                                     | **Create** — canonical results hub (primary deliverable)    |
| `tests/stress/README.md`                                                                     | Thin link to hub; remove “lands with #60” placeholders      |
| `docs/testing-strategy.md`                                                                   | Thin Stress section update; CI/automation → #71             |
| `docs/stress/bottlenecks.md`                                                                 | Optional one-line backlink only; no analysis rewrite        |
| `docs/superpowers/specs/2026-08-01-issue-60-document-stress-test-results-design.md`          | Approved design                                             |
| `docs/superpowers/plans/2026-08-01-issue-60-document-stress-test-results.md`                 | This plan                                                   |
| `tests/stress/results/<scenario>-<profile>/`                                                 | **Local only / gitignored** — optional fresh evidence       |

**Frozen artifacts / contracts:** `#54`–`#59` scenario behavior, reporter/verifier contracts, artifact layout, metrics schema, stock policy, app/e2e/CI code, `#71` scope, `#134` CSS AC.

**Prior-run Actual summaries (from `docs/stress/bottlenecks.md` on `main` @ `2e07686` — use when Evidence = Prior-run (#59)):**

| Scenario         | Profile | Actual summary (do not invent beyond this / fresh artifacts)                                                                                                                                 |
| ---------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `purchase-load`  | `smoke` | 100 successes; 0 rate-limited; verifier `ok: true`                                                                                                                                           |
| `oversell`       | `smoke` | 100 attempts; 10 success; 90 sold-out; 0 rate-limited; stock 10; unused 0; `oversell: false`; `accountingOk: true`; verifier purchase count 10 / remaining 0                                   |
| `duplicate-race` | `smoke` | 100 attempts; 1 success; 99 duplicate; 0 rate-limited/sold-out/unexpected; stock 10; unused 9; verifier fixed-user purchase count 1                                                           |
| `high-volume`    | `full`  | 10_000 attempts; 30 success; 9_970 rate-limited; 0 sold-out/duplicate/unexpected; stock 12_000; verifier purchase count 30 / remaining 11_970; p50≈35.0ms p95≈49.8ms p99≈81.3ms; ~2397.5 RPS |

---

### Task 1: Create worktree / branch

**Files:** none yet

- [ ] **Step 1: Ensure `main` is at `#59` tip**

```bash
cd /home/rex/Project/test/app
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
```

Expected: `2e07686…` or later tip that includes `#59`.

- [ ] **Step 2: Create isolated worktree**

```bash
cd /home/rex/Project/test/app
git check-ignore -q .worktrees || echo 'FAIL: .worktrees not ignored'
git worktree add .worktrees/60-document-stress-results -b docs/60-document-stress-results main
cd .worktrees/60-document-stress-results
```

Expected: new worktree on `docs/60-document-stress-results`. If sandbox/permission blocks worktree creation, create the branch in place instead and continue from repo root.

- [ ] **Step 3: Confirm clean baseline**

```bash
git status -sb
test -f docs/stress/bottlenecks.md && echo 'bottlenecks present'
test ! -f docs/stress-testing.md && echo 'hub not yet created'
```

Expected: clean branch; bottlenecks present; hub absent.

---

### Task 2: Determine evidence sources

**Files:**

- Read (optional/gitignored): `tests/stress/results/*/`
- Read: `docs/stress/bottlenecks.md`

- [ ] **Step 1: Inventory local artifacts**

```bash
cd /home/rex/Project/test/app/.worktrees/60-document-stress-results 2>/dev/null || cd /home/rex/Project/test/app
for d in purchase-load-smoke oversell-smoke duplicate-race-smoke high-volume-full; do
  echo "=== $d ==="
  if test -f "tests/stress/results/$d/k6-summary.json" && test -f "tests/stress/results/$d/verifier.json"; then
    echo usable
    node -e "const s=require('./tests/stress/results/$d/k6-summary.json'); const v=require('./tests/stress/results/$d/verifier.json'); console.log(JSON.stringify({scenario:s.scenario,profile:s.profile,counters:s.counters,ok:v.ok},null,2))"
  else
    echo missing
  fi
done
```

- [ ] **Step 2: Optionally attempt fresh regeneration (preferred, not required)**

Only if Compose/API/k6 are available. Correctness limiter on API for the first three; performance limiter for high-volume:

```bash
pnpm stress:test -- --scenario purchase-load --profile smoke
pnpm stress:test -- --scenario oversell --profile smoke
pnpm stress:test -- --scenario duplicate-race --profile smoke
# switch API to performance.env.example values, then:
pnpm stress:test -- --scenario high-volume --profile full
```

If any run fails or the stack is unavailable, skip that row’s fresh path — use Prior-run (#59). Do **not** invent numbers. Do **not** block the issue on regeneration.

- [ ] **Step 3: Record per-row evidence labels for Task 3**

Write a short local note (chat / scratch; not a committed file) listing each of the four rows as `Fresh run` or `Prior-run (#59)`.

---

### Task 3: Author `docs/stress-testing.md`

**Files:**

- Create: `docs/stress-testing.md`
- Read: `docs/stress/bottlenecks.md`
- Read (optional): fresh `tests/stress/results/<scenario>-<profile>/{k6-summary.json,verifier.json}`

- [ ] **Step 1: Create the hub with all seven sections**

Fill Actual cells from fresh artifacts when Evidence is `Fresh run`; otherwise use the Prior-run table in this plan / `docs/stress/bottlenecks.md` and set Evidence to `Prior-run (#59)`. Mixed rows are allowed. Keep Actual cells as short summaries — do not dump full JSON.

Use this skeleton (replace Actual / Evidence per Task 2). The Prior-run values below are the default when no fresh artifacts exist:

````markdown
# Stress testing results

Canonical results hub for [EPIC-07 #87](https://github.com/rexescario-dev/flash-sale-system/issues/87) / [#60](https://github.com/rexescario-dev/flash-sale-system/issues/60).

This document summarizes available stress scenarios, evidence-backed expected vs actual outcomes, environment limitations, and how to reproduce runs. Constraint-level analysis lives in [bottleneck analysis](stress/bottlenecks.md). Harness commands live in [`tests/stress/README.md`](../tests/stress/README.md). CI automation and expanded runbooks remain [#71](https://github.com/rexescario-dev/flash-sale-system/issues/71).

Do not invent metrics. Every Actual value below is traceable to fresh `#58` artifacts under `tests/stress/results/<scenario>-<profile>/` or to prior-run evidence recorded in [bottleneck analysis](stress/bottlenecks.md).

## Overview

EPIC-07 is a dual-oracle validation layer over purchase-flow concurrency guarantees: k6 classifies GraphQL `purchaseItem` responses; a Prisma verifier asserts persisted invariants. Intensity profiles are `smoke` / `standard` / `full`. Correctness scenarios (#54–#56) use a raised API limiter; high-volume (#57) uses a production-like performance limiter.

| Document | Purpose |
| --- | --- |
| This hub (`docs/stress-testing.md`) | Results overview and expected vs actual |
| [docs/stress/bottlenecks.md](stress/bottlenecks.md) | Evidence-backed bottleneck analysis (#59) |
| [tests/stress/README.md](../tests/stress/README.md) | Harness usage and commands |
| [docs/testing-strategy.md](testing-strategy.md) | Where stress fits in the testing pyramid |

## Scenario matrix

Inventory of runnable scenarios (not results):

| Scenario | Purpose | Profile(s) | Limiter |
| --- | --- | --- | --- |
| `purchase-load` | Baseline concurrent purchase load | `smoke`, `standard`, `full` | correctness |
| `oversell` | Limited inventory / no oversell | `smoke`, `standard`, `full` | correctness |
| `duplicate-race` | Same-user uniqueness under concurrency | `smoke`, `standard`, `full` | correctness |
| `high-volume` | Capacity / latency observation under load | `smoke`, `standard`, `full` | performance |
| `harness-smoke` | Harness wiring proof only | `smoke` | correctness |

`harness-smoke` is operational proof for the seed→run→verify pipeline; it is not part of the expected-vs-actual results table below.

## Expected vs actual results

| Scenario | Profile | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- |
| `purchase-load` | `smoke` | Completes under correctness limiter without classification/invariant violations (`RATE_LIMITED` / unexpected = 0; successes match attempts for comfortable stock) | 100 successes; 0 rate-limited; verifier `ok: true` | Prior-run (#59) |
| `oversell` | `smoke` | Successes ≤ stock; no oversell; stock identity holds | 100 attempts → 10 success, 90 sold-out, 0 rate-limited; stock 10 exhausted; verifier purchase count 10 / remaining 0 | Prior-run (#59) |
| `duplicate-race` | `smoke` | Exactly one successful purchase for the fixed user; remainder duplicate | 100 attempts → 1 success, 99 duplicate; verifier fixed-user purchase count 1 | Prior-run (#59) |
| `high-volume` | `full` | Inventory/uniqueness invariants hold; `RATE_LIMITED` observational (not a hard fail) | 10_000 attempts → 30 success, 9_970 rate-limited; verifier purchase count 30 / remaining 11_970; p50≈35ms p95≈50ms p99≈81ms; ~2397 RPS | Prior-run (#59) |

If a row was regenerated locally during this issue, replace Actual with the fresh summary and set Evidence to `Fresh run`.

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
````

- [ ] **Step 2: Verify required sections exist**

```bash
f=docs/stress-testing.md
test -f "$f"
rg -n '^## (Overview|Scenario matrix|Expected vs actual results|Other supported profiles|Environment limitations|Reproducing the results|Related documentation)$' "$f"
rg -n 'Prior-run \(#59\)|Fresh run' "$f"
rg -n 'comparative validation rather than benchmarking' "$f"
```

Expected: file exists; all seven `##` headings match; Evidence labels present; environment sentence present.

- [ ] **Step 3: Commit (only when user asks)**

```bash
git add docs/stress-testing.md
git commit -m "$(cat <<'EOF'
docs: add stress testing results hub for #60

EOF
)"
```

Skip if the user has not asked to commit.

---

### Task 4: Thin-link from `tests/stress/README.md`

**Files:**

- Modify: `tests/stress/README.md`

- [ ] **Step 1: Replace “lands with #60” placeholders with hub links**

There are three occurrences of `Results narrative hub lands with #60.` Replace them so the README points at the hub without duplicating results.

1. In the Artifacts section (after “Do not commit generated artifacts.”), replace:

```markdown
Do not commit generated artifacts. Results narrative hub lands with #60.
```

with:

```markdown
Do not commit generated artifacts. Results hub: [docs/stress-testing.md](../../docs/stress-testing.md).
```

2. In the Bottleneck analysis section, replace:

```markdown
Evidence-backed constraint analysis: [docs/stress/bottlenecks.md](../../docs/stress/bottlenecks.md).
Results narrative hub lands with #60.
```

with:

```markdown
Evidence-backed constraint analysis: [docs/stress/bottlenecks.md](../../docs/stress/bottlenecks.md).
Results hub: [docs/stress-testing.md](../../docs/stress-testing.md).
```

3. In the Design section, replace the trailing:

```markdown
Results narrative hub lands with #60.
```

with:

```markdown
Results hub: [docs/stress-testing.md](../../docs/stress-testing.md).
[#60 design](../../docs/superpowers/specs/2026-08-01-issue-60-document-stress-test-results-design.md).
```

Keep the README operational and concise — do not paste expected-vs-actual tables here.

- [ ] **Step 2: Verify placeholders gone and hub linked**

```bash
rg -n 'lands with #60' tests/stress/README.md && echo 'FAIL: placeholder remains' || echo 'OK: placeholders removed'
rg -n 'docs/stress-testing.md' tests/stress/README.md
```

Expected: no “lands with #60”; hub path referenced.

- [ ] **Step 3: Commit (only when user asks)**

```bash
git add tests/stress/README.md
git commit -m "$(cat <<'EOF'
docs: link stress results hub from harness README

EOF
)"
```

Skip if the user has not asked to commit.

---

### Task 5: Update `docs/testing-strategy.md` discoverability

**Files:**

- Modify: `docs/testing-strategy.md`

- [ ] **Step 1: Update the layered-strategy Stress bullet and the Stress section**

In **Layered strategy**, replace:

```markdown
4. **Stress** — planned load/stress validation (not in the automated suite today).
```

with:

```markdown
4. **Stress** — documented load/stress validation ([results](stress-testing.md); not in the required PR automated suite today).
```

Replace the old planned section:

```markdown
## Stress testing (planned)

Stress testing is not currently part of the automated test suite. The project currently includes unit, integration, E2E, and smoke testing. Stress/load testing is planned for **EPIC-07 / Issue #71**, where the k6-based strategy, scenarios, execution instructions, and CI integration will be introduced. This document intentionally does not include k6 commands or expected results before that work is implemented.
```

with:

```markdown
## Stress testing

Stress testing is documented for EPIC-07. The dual-oracle k6 + Prisma harness lives under `tests/stress/`; scenario results and environment limits are summarized in [Stress testing results](stress-testing.md); constraint analysis is in [Bottleneck analysis](stress/bottlenecks.md). Stress remains outside the required PR automated suite today — CI integration and expanded operational runbooks remain [Issue #71](https://github.com/rexescario-dev/flash-sale-system/issues/71).
```

- [ ] **Step 2: Update CI mapping bullet and Related documentation**

In **CI mapping**, replace:

```markdown
- **Stress testing** — not part of the automated suite today (Issue #71).
```

with:

```markdown
- **Stress testing** — documented locally ([results](stress-testing.md)); not part of the required PR automated suite today (Issue #71 for CI/runbook).
```

In **Related documentation**, add after Smoke testing (keep list style):

```markdown
- [Stress testing results](stress-testing.md)
- [Bottleneck analysis](stress/bottlenecks.md)
```

Replace the Planned work bullet:

```markdown
- Issue #71 — Stress testing (k6)
```

with:

```markdown
- Issue #71 — Stress testing CI / runbook discoverability
```

Do **not** paste k6 command tables or expected-vs-actual numbers into this file.

- [ ] **Step 3: Verify thin update**

```bash
rg -n 'stress-testing.md|stress/bottlenecks.md|#71' docs/testing-strategy.md
rg -n 'planned for \*\*EPIC-07 / Issue #71\*\*' docs/testing-strategy.md && echo 'FAIL: stale planned text' || echo 'OK: planned text updated'
wc -l docs/testing-strategy.md
```

Expected: hub + bottlenecks + #71 links present; old “planned for EPIC-07 / Issue #71” paragraph gone; file remains a strategy doc (not a runbook).

- [ ] **Step 4: Commit (only when user asks)**

```bash
git add docs/testing-strategy.md
git commit -m "$(cat <<'EOF'
docs: link stress results hub from testing strategy

EOF
)"
```

Skip if the user has not asked to commit.

---

### Task 6: Optional bottlenecks backlink + DoD verification

**Files:**

- Modify (optional): `docs/stress/bottlenecks.md`
- Read: `docs/stress-testing.md`, `tests/stress/README.md`, `docs/testing-strategy.md`

- [ ] **Step 1 (optional): Add a single navigation backlink**

Near the top of `docs/stress/bottlenecks.md` (after the opening paragraph), add at most:

```markdown
Results overview: [docs/stress-testing.md](../stress-testing.md).
```

Do **not** rewrite analysis sections or duplicate expected-vs-actual tables. Skip this step entirely if a backlink would feel redundant.

- [ ] **Step 2: Spec verification checklist**

```bash
# Hub exists with seven sections
rg -n '^## (Overview|Scenario matrix|Expected vs actual results|Other supported profiles|Environment limitations|Reproducing the results|Related documentation)$' docs/stress-testing.md

# Evidence column values
rg -n 'Fresh run|Prior-run \(#59\)' docs/stress-testing.md

# No invented speculative bottleneck claims in hub
rg -n 'Postgres is the bottleneck|Redis CPU|connection pool exhaustion' docs/stress-testing.md && echo 'FAIL' || echo 'OK: no speculative hub claims'

# README thin + linked
rg -n 'lands with #60' tests/stress/README.md && echo 'FAIL' || echo 'OK'
rg -n 'docs/stress-testing.md' tests/stress/README.md

# testing-strategy thin + linked
rg -n 'stress-testing.md' docs/testing-strategy.md
rg -n 'RATE_LIMIT_PURCHASE_ITEM_MAX|pnpm stress:test -- --scenario' docs/testing-strategy.md && echo 'FAIL: runbook leaked' || echo 'OK: no runbook leak'

# Freeze: no harness/proof file changes in this issue
git diff --name-only main...HEAD
```

Expected: only docs paths from the file map (plus optional bottlenecks backlink). No `tests/stress/k6/**`, reporter, verifier, seeder, apps, e2e, or CI changes.

- [ ] **Step 3: Confirm no gitignored artifacts staged**

```bash
git status --ignored -u | rg 'tests/stress/results' || echo 'OK: no results noise in status review'
git diff --cached --name-only | rg 'tests/stress/results' && echo 'FAIL: results staged' || echo 'OK: results not staged'
```

- [ ] **Step 4: Final commit when user asks (single squash-style or remaining files)**

```bash
git add docs/stress-testing.md tests/stress/README.md docs/testing-strategy.md docs/stress/bottlenecks.md \
  docs/superpowers/specs/2026-08-01-issue-60-document-stress-test-results-design.md \
  docs/superpowers/plans/2026-08-01-issue-60-document-stress-test-results.md
git status
git commit -m "$(cat <<'EOF'
docs: document stress test results hub for #60

EOF
)"
```

Only when the user explicitly requests commits. Prefer one coherent docs commit if earlier per-task commits were skipped.

---

## Plan self-review

1. **Spec coverage:** Hub seven sections → Task 3; evidence prefer-fresh/prior-run → Task 2; README thin link → Task 4; testing-strategy thin update → Task 5; optional bottlenecks backlink + freeze/DoD → Task 6; `#71`/`#134`/harness freeze called out in header + Task 6.
2. **Placeholder scan:** No TBD/TODO; Actual defaults provided from bottlenecks; Evidence labels explicit.
3. **Type/path consistency:** Hub path `docs/stress-testing.md`; Evidence values `Fresh run` | `Prior-run (#59)`; four-row contract matches spec; commit steps gated on user request.

---

## Execution handoff

Plan complete. Original request already selected **subagent-driven-development**. After approval to execute, create the worktree and dispatch one subagent per task with two-stage review between tasks.
