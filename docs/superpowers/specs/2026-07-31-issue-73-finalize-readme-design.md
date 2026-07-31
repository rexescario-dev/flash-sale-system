# #73 — Finalize README

**Date:** 2026-07-31  
**Issue:** [#73](https://github.com/rexescario-dev/flash-sale-system/issues/73)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved  
**Base:** `main` @ `6baee39` (#70 via PR #156)

## Goal

Make `README.md` the canonical reviewer entry point by making every #73 AC topic discoverable through intentional README content or links to existing documentation hubs, while preserving the thin README structure.

## Acceptance criteria (issue)

- [ ] README includes overview, features, architecture, concurrency, Redis, API, setup, testing, trade-offs, and future work

**AC interpretation (“includes” = discoverable):** each topic is either short intentional README prose (where no dedicated hub exists) or a clear link to an existing hub. The README does not become a second copy of `docs/*` bodies.

| AC topic     | Satisfied by                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Overview     | Top-level README `## Overview`                                                                                                        |
| Features     | Top-level README `## Features` (3–7 bullets)                                                                                          |
| Architecture | Documentation index → [`docs/architecture.md`](../../architecture.md)                                                                 |
| Concurrency  | Documentation index → [`docs/concurrency-model.md`](../../concurrency-model.md)                                                       |
| Redis        | Documentation index → [`docs/redis-caching-strategy.md`](../../redis-caching-strategy.md)                                             |
| API          | Thin `## API` (GraphQL/API endpoints + architecture pointer)                                                                          |
| Setup        | Try the app + Quick Start + Documentation index → [`docs/local-development.md`](../../local-development.md)                           |
| Testing      | Scripts + thin `## E2E` + Documentation index → [`docs/testing-strategy.md`](../../testing-strategy.md)                                |
| Trade-offs   | Documentation index → [`docs/technology-trade-offs.md`](../../technology-trade-offs.md)                                               |
| Future work  | Documentation index → [`docs/technology-trade-offs.md#future-evolution`](../../technology-trade-offs.md#future-evolution) + k6 mentioned only as planned |

## Approach

**Hybrid thin README + AC-minimal Documentation index (Approach 1):**

| Surface                | Role after #73                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `README.md`            | Product identity (Overview/Features), first-run journey, thin E2E/API pointers, AC-minimal doc map  |
| Existing `docs/*`      | Canonical engineering detail for architecture, concurrency, Redis, setup, testing, trade-offs, etc. |
| `docs/architecture.md` | Continues to own deeper related-doc navigation (purchase sequence, scalability, fault tolerance)    |
| Thin `## E2E`          | Operational Playwright/smoke command entry; owns those two outbound links                           |
| #72 Screenshots        | Later; leave a natural slot after Try the app; **no** placeholders in #73                           |
| #71 / EPIC-07          | k6 stress docs remain planned; README may mention k6 only as planned                                |

**Rejected alternatives:**

- Expanding README into topical mini-docs for every AC item (duplicates hubs; fights thin-README direction).
- Pure navigation hub with no Overview/Features prose (feels incomplete for reviewers).
- Creating stub docs (`docs/overview.md`, `docs/features.md`, `docs/api.md`, `docs/future-work.md`).
- Full hub catalog in Documentation (purchase sequence / scalability / fault tolerance / Playwright / smoke) — duplicates architecture Related docs and E2E ownership.
- Grouped multi-tier Documentation index — more structure than #73 needs.

**Guiding rule:** README explains **what this project is and where to find things**. `docs/*` explains **how and why it works**.

## Design goals

- Meet #73 AC via discoverability mapping, not by re-documenting hub bodies.
- Preserve working Try the app / Quick Start / Scripts / Workspace substance.
- Keep k6 in the project story only with explicit planned/future labeling.
- Leave a stable landing page for #72 screenshots after Try the app.
- Leave #71 / #74 / EPIC-07 and #134 CSS AC untouched.

## Non-goals

- No new stub docs (`overview`, `features`, `api`, `future-work`).
- No duplicated technical documentation bodies: architecture, concurrency, Redis, purchase sequence, scalability, fault tolerance, trade-offs, testing strategy, Playwright, or smoke testing.
- No Documentation index rows for purchase sequence, scalability, fault tolerance, Playwright, or smoke testing.
- No #72 screenshots or screenshot placeholders.
- No #71 k6 runbook.
- No #134 CSS reopen.
- No application, schema, CI, Compose, or test changes.

## Ownership model

| Concern                                         | Canonical owner                          |
| ----------------------------------------------- | ---------------------------------------- |
| Product identity / first-run onboarding         | `README.md`                              |
| Architecture diagram & related-doc index        | `docs/architecture.md`                   |
| Purchase sequence / scalability / fault tolerance | Linked from architecture (not README Documentation index) |
| Concurrency                                     | `docs/concurrency-model.md`              |
| Redis strategy                                  | `docs/redis-caching-strategy.md`         |
| Local setup details                             | `docs/local-development.md`              |
| Testing philosophy / layers                     | `docs/testing-strategy.md`               |
| Playwright how-to                               | `docs/playwright-e2e.md` (via README E2E) |
| Smoke suite implementation                      | `docs/smoke-testing.md` (via README E2E) |
| Technology trade-offs + future evolution        | `docs/technology-trade-offs.md`          |
| k6 / stress                                     | #71 / EPIC-07 (planned)                  |
| Screenshots                                     | #72                                      |

**Conflict rule:** Do not restate hub bodies in README. Prefer one outbound path per concern unless context differs (E2E commands vs Testing strategy link).

## Design

### Final README section order

1. Title + one-line intro (current stack; future tooling such as k6 explicitly labeled planned)
2. `## Overview` — short purpose / modular monolith / engineering focus
3. `## Features` — 3–7 capability bullets; if k6 appears, prefer wording such as “Future scalability validation may include k6 load testing” (never bare “k6 load testing” or a bullet that reads like a current feature)
4. `## Try the app` — keep current reviewer path (Compose + seed + what to try); preserve local-dev link; leave natural slot for #72 later (**no** placeholders)
5. `## Quick Start` — keep stack-only Docker path; preserve local-dev link
6. `## Scripts` — keep workspace command table (may lightly clarify e2e rows); **preserve** `#scripts` anchor for inbound links (e.g. local-development)
7. `## Workspace layout` — keep as-is unless a one-line accuracy fix is needed
8. `## E2E` — thin operational pointer only:
   - `pnpm e2e:smoke` / `pnpm e2e`
   - links to `docs/playwright-e2e.md` and `docs/smoke-testing.md`
   - optional one-liner orientation (e.g. seed via Playwright `globalSetup` / CI owns e2e jobs)
   - **Do not** describe Playwright architecture, fixtures, tags, retries, or CI behavior beyond that short orientation
9. `## API` — GraphQL/API endpoints + pointer to `docs/architecture.md` (no schema dump; no `docs/api.md`)
10. `## Documentation` — AC-minimal link list only:

| Label        | Target                                              |
| ------------ | --------------------------------------------------- |
| Architecture | `docs/architecture.md`                              |
| Concurrency  | `docs/concurrency-model.md`                         |
| Redis        | `docs/redis-caching-strategy.md`                    |
| Setup        | `docs/local-development.md`                         |
| Testing      | `docs/testing-strategy.md`                          |
| Trade-offs   | `docs/technology-trade-offs.md`                     |
| Future work  | `docs/technology-trade-offs.md#future-evolution`    |

### Removals / folds

- Remove standalone `## Redis` and `## Architecture note` (folded into Documentation / API).
- Do **not** list Playwright or smoke under Documentation (owned by `## E2E`).
- Do **not** list purchase sequence, scalability, or fault tolerance under Documentation (reachable via architecture Related docs).

### Content rules

- Prefer keep/reshape existing Try the app / Quick Start / Scripts / Workspace — don’t rewrite working onboarding.
- k6 may appear in the intro or Features only as planned/future load testing capability — never as an implemented current capability.
- No duplicate summaries for concurrency, Redis internals, API design, etc.
- Implementation diff is limited to `README.md`. Design/spec/plan artifacts may exist under `docs/superpowers/` as part of the planning workflow.
- No commit until explicitly requested.

### Suggested skeleton (illustrative; copy may be adjusted in implementation)

```md
# Flash Sale System

Short intro (current stack; k6 labeled planned).

## Overview
...

## Features
- ...
- Future scalability validation may include k6 load testing

## Try the app
...

## Quick Start
...

## Scripts
...

## Workspace layout
...

## E2E
- `pnpm e2e:smoke`
- `pnpm e2e`
- docs/playwright-e2e.md
- docs/smoke-testing.md

## API
GraphQL endpoints + architecture pointer

## Documentation
- Architecture → docs/architecture.md
- Concurrency → docs/concurrency-model.md
- Redis → docs/redis-caching-strategy.md
- Setup → docs/local-development.md
- Testing → docs/testing-strategy.md
- Trade-offs → docs/technology-trade-offs.md
- Future work → docs/technology-trade-offs.md#future-evolution
```

## Boundary with siblings

| Doc / issue                 | Owns                                              |
| --------------------------- | ------------------------------------------------- |
| #61–#70 hubs                | Canonical technical documentation                 |
| #73 Finalize README         | Thin entry point + AC discoverability map         |
| #72 Screenshots             | Visual assets after README structure is stable    |
| #71 / EPIC-07               | k6 stress strategy and results                    |
| #74 Release readiness       | Blocked on EPIC-07                                |
| Architecture Related docs   | Purchase sequence, scalability, fault tolerance   |
| README `## E2E`             | Playwright + smoke operational discovery          |

## Out of scope

- Edits to hub doc bodies (none expected; do not “while here” clean hubs)
- New stub documentation files
- Application, schema, Compose, CI, or test-suite changes
- Screenshot capture or image assets (#72)
- k6 documentation (#71)
- Reopening #134 CSS AC
- Committing until explicitly requested

## Verification

Docs-only checklist:

1. Every #73 AC topic is discoverable via intentional README content or a Documentation / E2E / API link (per AC table).
2. All README links resolve to existing files/anchors (`architecture`, `concurrency-model`, `redis-caching-strategy`, `local-development`, `testing-strategy`, `technology-trade-offs`, `#future-evolution`, `playwright-e2e`, `smoke-testing`).
3. No new stub docs; no hub-body rewrites; no purchase-sequence / scalability / fault-tolerance / Playwright / smoke rows in Documentation.
4. Standalone `## Redis` and `## Architecture note` removed; thin `## E2E` kept; Try the app / Quick Start / Scripts / Workspace preserved in substance.
5. k6 appears only with explicit planned/future labeling — never as current capability.
6. E2E section does not describe Playwright architecture, fixtures, tags, retries, or CI behavior beyond a short orientation pointer.
7. No screenshot placeholders for #72.
8. Preserve inbound anchor used by local-dev: `README.md#scripts` still valid.
9. Implementation diff is limited to `README.md` (planning artifacts under `docs/superpowers/` are separate).
10. Format touched markdown with the repo’s canonical check: `pnpm format:check` (fix via `pnpm format` if needed).

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #73 AC satisfied through discoverability mapping above.
- README remains a thin reviewer entry point; hubs remain canonical for engineering detail.
- Clear separation from #72 (screenshots) and #71 / #74 / EPIC-07.
- No commit until explicitly requested.

## Handoff after design approval

1. Write spec: `docs/superpowers/specs/2026-07-31-issue-73-finalize-readme-design.md` (this file).
2. Review written spec.
3. Create implementation plan via writing-plans.
4. Execute implementation through subagent-driven-development.

No commit until explicitly requested.
