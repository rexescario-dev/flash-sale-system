# #72 — Add project screenshots

**Date:** 2026-07-31  
**Issue:** [#72](https://github.com/rexescario-dev/flash-sale-system/issues/72)  
**Epic:** [#88](https://github.com/rexescario-dev/flash-sale-system/issues/88) (EPIC-08 — Documentation & Release)  
**Status:** Design approved  
**Base:** `main` @ `66178e1` (#73 via PR #157)

## Goal

Add representative customer UI screenshots so reviewers can see the happy path (browse → buy → confirmation → history) immediately after Try the app, without turning README into a documentation catalog.

## Acceptance criteria (issue)

- [ ] README or docs include representative UI screenshots

**AC interpretation:** README embeds four representative customer-UI images whose binary assets live under `docs/images/`. No screenshot index page, image metadata docs, or capture automation are required.

| AC topic                        | Satisfied by                                                                |
| ------------------------------- | --------------------------------------------------------------------------- |
| Representative UI screenshots   | Four PNGs in `docs/images/` + README embeds inside `## Try the app`         |
| Reviewer happy-path narrative   | Catalog hero + Sale detail + Purchase success + My purchases                |
| Thin README continuity from #73 | Edits limited to existing `## Try the app` area; no top-level screenshot IA |

## Approach

**README-only thin embed (Approach 1):**

| Surface        | Role after #72                                                              |
| -------------- | --------------------------------------------------------------------------- |
| `README.md`    | Catalog hero + compact `### Screenshots` stacked gallery inside Try the app |
| `docs/images/` | Committed PNG release artifacts                                             |
| Existing hubs  | Unchanged; screenshots are documentation assets, not test fixtures          |

**Rejected alternatives:**

- README embed + `docs/screenshots.md` capture note (new ownership surface for a static artifact).
- Checked-in Playwright screenshot generator / fixture ownership (docs/E2E boundary blur; noisy diffs).
- External hosting / release assets only (fragile links; offline clone loses context).
- Catalog-only or flat gallery without hero (weaker reviewer first impression).
- Journey-aligned images interleaved into each “What to try” step (couples onboarding copy to UI layout).
- Architecture / concurrency / sold-out screenshots in README (belongs in technical hubs).

**Guiding rule:** Screenshots improve the reviewer journey visually. They are release artifacts owned by README presentation, not a documentation subsystem and not Playwright assets.

## Design goals

- Fill the natural visual slot reserved by #73 after Try the app (no placeholders beforehand).
- Show flash-sale behavior, not only navigation: browse → purchase interaction → success → history.
- Keep README thin: no top-level `## Screenshots`, no Documentation index row, no onboarding rewrite.
- Keep capture/maintenance simple and implicit for this repository size.
- Leave #71 / #74 / EPIC-07 and #134 CSS AC untouched.

## Non-goals

- Top-level `## Screenshots`.
- `docs/screenshots.md` or other screenshot hubs.
- Screenshot generator script, CI screenshot job, or Playwright fixture ownership.
- Architecture / concurrency / Redis / sold-out messaging screenshots in README.
- README IA restructuring beyond the reserved Try-the-app slot.
- Rewriting Try-the-app onboarding copy while inserting images.
- Reopening #134 or advancing #71 / #74.
- Application, schema, Compose, CI, or test-suite changes.
- Committing until explicitly requested.

## Ownership model

| Concern                    | Canonical owner                                         |
| -------------------------- | ------------------------------------------------------- |
| Reviewer visual narrative  | `README.md` (`## Try the app`)                          |
| Binary image assets        | `docs/images/*.png`                                     |
| Capture/refresh discipline | #72 implementation rules (no standalone docs owner)     |
| Playwright / smoke how-to  | Existing hubs — link-only if mentioned                  |
| Technical domain docs      | Unchanged hubs (architecture, concurrency, Redis, etc.) |
| README structure           | Established by #73; #72 only fills the visual slot      |

**Conflict rule:** Screenshots are documentation assets, not test fixtures. Do not duplicate Playwright E2E, smoke-testing, testing-strategy, Redis, concurrency, purchase sequence, scalability, fault tolerance, or technology trade-offs bodies — link instead if any mention is needed.

## Design

### Asset layout

```text
docs/images/
  flash-sale-catalog.png
  flash-sale-detail.png
  flash-sale-success.png
  flash-sale-purchases.png
```

Use `docs/images/` (not `screenshots/`) so future non-UI documentation visuals can share the folder. Create the directory if it does not already exist.

### Screenshot set (happy path + one meaningful state)

| File                       | State                                               |
| -------------------------- | --------------------------------------------------- |
| `flash-sale-catalog.png`   | Catalog (`/`) — seeded flash sales visible          |
| `flash-sale-detail.png`    | Sale detail (`/sales/:id`) — **ACTIVE** seeded sale |
| `flash-sale-success.png`   | Purchase success state                              |
| `flash-sale-purchases.png` | My purchases (`/purchases`)                         |

Narrative order: **discover → decide → purchase → verify**.

### Capture process (implementation detail; not checked in)

1. Bring up the normal Compose stack and seed via the documented Try-the-app / local-development workflow.
2. Capture desktop viewport of the four states in order: catalog → sale detail → purchase success → my purchases.
3. Capture method may be manual or a temporary local helper; the helper is **not** checked in. The committed artifacts are only the PNGs.
4. Review before commit:
   - deterministic seeded data; stable seeded labels
   - avoid timestamps, random IDs, machine/user-specific information, or transient states
   - consistent viewport; meaningful stock/status visible on detail/success
   - prefer lossless PNG with reasonable dimensions/file sizes (reject multi‑MB accidents)
5. Commit only the PNGs + README embed changes (when commit is explicitly requested).

**Maintenance rule:** Refresh screenshots only when the user-visible workflow or layout materially changes — not for every CSS tweak.

### README embed structure

README edits are limited to the existing `## Try the app` area: add catalog hero image and `### Screenshots` supporting figures only.

**Placement:** After the open-app / “What to try” onboarding content, before the `---` that precedes `## Quick Start`.

**Illustrative shape** (copy may be tuned in implementation; keep captions short and outcome-oriented):

```md
## Try the app

… existing prerequisites, commands, What to try, endpoints, local-dev link …

![Flash sale catalog](docs/images/flash-sale-catalog.png)

_Catalog — browse available flash sales._

### Screenshots

**Sale detail — choose an active sale**

![Sale detail](docs/images/flash-sale-detail.png)

**Purchase success — completed purchase**

![Purchase success](docs/images/flash-sale-success.png)

**My purchases — review purchase history**

![My purchases](docs/images/flash-sale-purchases.png)
```

### Presentation rules

- Catalog is the hero; three supporting shots under `### Screenshots` as stacked Markdown figures (not a table or horizontal strip).
- Captions stay short and user-oriented — avoid UI/implementation jargon (e.g. no “React component”, “GraphQL mutation”, “Redis-backed inventory”).
- Image references use repository-relative paths (`docs/images/*.png`) so README renders on GitHub and local clones.
- Let GitHub scale images naturally; no HTML width attributes by default.
- Do not rewrite onboarding copy while inserting images; preserve existing commands, seed guidance, and local-dev link.
- Do not add a Documentation index row for screenshots.
- Keep exactly the agreed four images.

## Boundary with siblings

| Doc / issue                                                                                         | Relationship to #72                                                             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| #73 Finalize README                                                                                 | Owns README structure; #72 only fills the reserved Try-the-app visual slot      |
| Playwright E2E / smoke / testing strategy                                                           | Link-only if mentioned; screenshots are documentation assets, not test fixtures |
| Architecture / concurrency / Redis / purchase sequence / scalability / fault tolerance / trade-offs | Unchanged; no README screenshot narrative for those topics                      |
| #71 / EPIC-07                                                                                       | Untouched                                                                       |
| #74 Release readiness                                                                               | Untouched (screenshots become part of README presentation for later review)     |
| #134 CSS AC                                                                                         | Do not reopen                                                                   |

## Out of scope

- Edits outside `## Try the app` in `README.md` (except unavoidable whitespace around the insert).
- New documentation hubs or screenshot generator tooling.
- Application, schema, Compose, CI, or test-suite changes.
- Reopening #134; advancing #71 / #74.
- Committing until explicitly requested.

## Verification

Docs-only checklist (no app/test suite changes required):

1. Four PNGs exist at the agreed `docs/images/` paths and open as valid images.
2. README shows catalog hero + three stacked supporting figures with repository-relative `docs/images/` paths that resolve from repository root.
3. Placement is inside `## Try the app`, before Quick Start separator; no top-level `## Screenshots`.
4. Documentation index remains unchanged; no new screenshot documentation rows or technical screenshot narratives are introduced.
5. Try-the-app onboarding commands, seed guidance, and local-dev link preserved in substance (no rewrite).
6. Images show the intended happy-path states with deterministic seeded data (ACTIVE sale on detail; no obvious personal/machine-specific content).
7. PNG sizes are reasonable (reject multi‑MB accidents).
8. Screenshots remain documentation assets only — not Playwright fixtures or CI artifacts.
9. All committed PNG files are tracked binary assets only; no temporary capture scripts/helpers are included.
10. Implementation diff is limited to `README.md` + `docs/images/*.png` (planning artifacts under `docs/superpowers/` are separate).
11. Format touched markdown with the repo’s canonical check: `pnpm format:check` (fix via `pnpm format` if needed).

No new Jest / Vitest / Playwright cases required.

## Success criteria

- #72 AC satisfied via README embeds + `docs/images/` assets.
- Reviewer can see browse → buy → confirmation → history without leaving the README Try-the-app path.
- Thin README from #73 preserved; no new screenshot subsystem.
- Clear separation from Playwright/smoke hubs and from #71 / #74 / EPIC-07.
- No commit until explicitly requested.

## Handoff after design approval

1. Write spec: `docs/superpowers/specs/2026-07-31-issue-72-project-screenshots-design.md` (this file).
2. Review written spec.
3. Create implementation plan via writing-plans.
4. Execute implementation through subagent-driven-development.

No commit until explicitly requested.
