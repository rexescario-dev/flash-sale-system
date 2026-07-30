# Issue #130 — Expand Playwright Customer-Journey Feature Tests (Design Spec)

**Status:** Approved (chat + file review edits applied)  
**Date:** 2026-07-30  
**Issue:** [#130](https://github.com/rexescario-dev/flash-sale-system/issues/130)  
**Parent epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10 — Milestone 10)  
**Repository:** `rexescario-dev/flash-sale-system`  
**Baseline:** `main` @ `6039811` (#129 purchase cache invalidation via [PR #141](https://github.com/rexescario-dev/flash-sale-system/pull/141); catalog #122; identity #123; sale UX #124; myPurchases API #125; purchases page #126; nav #127)  
**Not** AuthN/AuthZ — opaque local `userId` only; real-stack Playwright (no MSW as E2E authority)

## 1. Goal

Cover the catalog → identity → buy → history customer journey with **stable selectors**: prefer accessible roles first; use stable `data-testid`s only when needed. Avoid CSS/Tailwind/DOM-hierarchy selectors.

Smoke validates the primary user workflow end-to-end. Regression covers combinatorial / alternate-path behavior. Tests assert **observable user-facing behavior** after #129 React Query invalidation/refetch; they must not depend on or assert stale client caches.

## 2. Scope / Non-goals

### In scope

- Extend Playwright e2e seed + `seed-state.json` with a deterministic status matrix (see §4)
- Page objects + thin specs: extend `SalePage`; add `CatalogPage`, `PurchasesPage`; standalone `CustomerNav` helper
- **Smoke:** Catalog → ACTIVE sale → identify → purchase → CustomerNav “My Purchases” → verify **the purchase created in this test** is visible (product name or other unique identifier)
- **Regression:** deep-link purchase; duplicate; ACTIVE→SOLD_OUT transition; pre-seeded status gates; user switch
- Prefer accessible roles; reuse existing stable `data-testid`s; introduce new `data-testid`s only where no stable semantic selector exists
- Align with existing `e2e/` package conventions (`smoke` / `regression` projects, `workers: 1`, globalSetup seed)

### Non-goals

See **§8 Out of scope**.

## 3. Locked decisions

| Decision              | Choice                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smoke vs regression   | **B** — smoke = catalog-first happy path; edges in regression                                                                                                   |
| Selectors             | **C** — roles first; reuse existing testids; add testid only when blocked; **do not** rename existing testids to match issue wording                            |
| Seed matrix           | **A** — ACTIVE(10), ACTIVE(1), SOLD_OUT, UPCOMING, ENDED; pre-seeded SOLD_OUT **complements** (does not replace) the transition regression                      |
| Post-buy navigation   | **A** — click CustomerNav My Purchases (no `goto` fallback in smoke)                                                                                            |
| E2E structure         | **1** — page objects + thin specs                                                                                                                               |
| #129 posture          | Validate post-purchase **observable user-facing behavior** after invalidation/refetch; **do not** depend on or assert cached state; no Redis assertions         |
| Regression isolation  | Each regression spec independently executable against a freshly seeded environment; no ordering dependencies between regressions                                |
| Roles vs testid       | Prefer accessible names (`getByRole`) over `data-testid` whenever both are equally stable                                                                       |
| Compose / vendor      | Do **not** fix Dockerfile vendor COPY / #133 in this ticket; local verification may use host API/web on alt ports against Compose Postgres/Redis                |

## 4. Seed matrix

Canonical entrypoint remains Playwright `globalSetup` → `pnpm --filter api e2e:seed`. Specs read IDs via `loadSeedState()` / typed `SeedState` — **never hard-code sale UUIDs** in specs.

| SeedState key       | Fixture                         | Purpose                                                                 |
| ------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| `activeStock10Id`   | ACTIVE, stock 10                | Smoke happy path; deep-link; user switch; duplicate                     |
| `activeStock1Id`    | ACTIVE, stock 1                 | **Only** runtime ACTIVE → SOLD_OUT transition                           |
| `soldOutId`         | Pre-exhausted SOLD_OUT          | Static catalog/detail status + Buy disabled                             |
| `upcomingId`        | UPCOMING                        | Status visible, Buy disabled                                            |
| `endedId`           | ENDED                           | Status visible, Buy disabled                                            |

### Product naming

Each seeded sale gets a **stable, unique, human-readable product name** (e.g. “Active Stock 10”, “Upcoming Sale”) so tests can use accessible names where appropriate and avoid accidental duplicate names.

### Ownership / cleanup

Keep existing E2E ID-prefix reset + Redis key clear for planted sales. Expand planted-id list to cover the full matrix.

## 5. Architecture — page objects

```text
e2e/
  pages/
    catalog.page.ts      ← CatalogPage
    sale.page.ts         ← SalePage (extend existing)
    purchases.page.ts    ← PurchasesPage
    customer-nav.ts      ← CustomerNav helper (cross-page)
  tests/
    helpers/seed-state.ts
    smoke/…
    regression/…
```

### Separation of responsibilities

| Unit           | Responsibility                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `CatalogPage`  | Catalog interactions + catalog-scoped status expectations                                              |
| `SalePage`     | Sale detail: identify, buy, outcomes, buy disabled, detail status — **no** cross-page navigation       |
| `PurchasesPage`| Purchase history visibility / empty / expect specific purchase                                         |
| `CustomerNav`  | Cross-page nav only (`openFlashSales`, `openPurchases`)                                                |
| Specs          | Compose page-object methods into journeys; own scenario logic                                          |

### CatalogPage (intent API)

- `goto()`
- `expectVisible()`
- `openSaleByProductName(name)` — **preferred** when the catalog exposes an accessible product name
- `openSaleById(id)` — available for deterministic fixtures where name lookup is impractical
- `expectSaleStatus(…)` (optional; encapsulate badge locators)

### SalePage (extend; stay on detail)

- Identify user (existing IdentityStrip flow)
- Purchase / expect purchase success
- Expect already purchased / Buy disabled
- Expect sold out / upcoming / ended on the detail surface
- Keep deep-link `gotoSale(id)`
- Do **not** navigate to catalog or purchases from this object

### PurchasesPage (high-level asserts)

- `expectVisible()`
- `expectPurchaseVisible(…)` — must identify **this test’s** purchase (e.g. product name), not merely “list non-empty”
- `expectEmptyState()`
- Internals may use `purchase-panel`; callers need not know that

### CustomerNav (standalone)

- `openFlashSales()`
- `openPurchases()` — prefer role link (`My Purchases`) when equally stable; else existing `nav-purchases` testid

### Selector inventory (reuse; illustrative)

Prefer roles/labels. Known stable testids include: `catalog-page`, `catalog-card`, `sale-status-badge`, `flash-sale-page`, `sale-status`, `purchase-rail` / `sticky-buy-bar`, IdentityStrip ids, `already-purchased`, `purchase-outcome*`, `customer-nav`, `nav-flash-sales`, `nav-purchases`, `purchases-page`, `purchase-panel`, guest/empty purchases ids.

Issue #130’s suggested names (`catalog`, `sale-card`, …) are **not** binding; do not rename production testids to match.

## 6. Scenarios

### Smoke (one journey)

1. `catalog.goto()` → `expectVisible()`
2. Open ACTIVE(10) sale (prefer product name; id fallback if needed)
3. Identify unique user → buy → expect purchase success
4. Wait for the purchase-success state to settle before navigating to My Purchases
5. `nav.openPurchases()` (CustomerNav click — **no** `page.goto` fallback)
6. `purchases.expectVisible()` → `expectPurchaseVisible(productName|unique marker for this purchase)`

Replaces today’s deep-link-only smoke. Confirms catalog routing, identity, mutation, global nav, and post-#129 `myPurchases` refetch.

### Regression (independent specs)

| Spec                    | Asserts                                                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deep-link purchase      | Alternate entry: `sale.gotoSale(activeStock10)` → identify → buy → success                                                                                       |
| Duplicate (keep)        | Already purchased + Buy disabled; reload still gated — keep if already stable; no rewrite for structure alone                                                    |
| Sold-out transition     | ACTIVE(1) → buy last unit → detail status SOLD_OUT — complements pre-seeded SOLD_OUT                                                                             |
| Status gates            | For pre-seeded SOLD_OUT / UPCOMING / ENDED: verify the expected disabled state and status on the surface under test (catalog, detail, or both). Avoid bundling unrelated surface assertions into a single opaque expectation. |
| User switch             | (1) A buys ACTIVE(10); (2) switch to B; (3) B not already-purchased; (4) B can buy; (5) B’s purchases page does **not** display A’s purchase. Optional A revisit **not** required |

**Principle:** Each regression is independently executable against a freshly seeded environment. Unique `userId`s per test (`Date.now()` / random). Keep `workers: 1`.

### #129 posture

Assert observable user-facing behavior after buy (success banner, already-purchased / disabled Buy, purchases list contents). Do not assert cache keys, TTL, or Redis. Do not write tests that assume stale client caches.

## 7. Files (representative)

Representative touch points — **extend existing specs where appropriate**. The implementation plan decides whether to extend an existing file or create a new one; this design does not force regression filenames.

```text
apps/api/test/e2e/seed/scenarios.ts          (extend matrix)
apps/api/test/e2e/seed/seed.ts               (SeedState + plant + redis clear)
apps/api/test/factories or product naming    (stable, unique, human-readable product names as needed)
e2e/tests/helpers/seed-state.ts              (typed SeedState)
e2e/pages/catalog.page.ts                    (new)
e2e/pages/purchases.page.ts                  (new)
e2e/pages/customer-nav.ts                    (new)
e2e/pages/sale.page.ts                       (extend as needed)
e2e/tests/smoke/…                            (catalog-first journey; replace deep-link-only smoke)
e2e/tests/regression/…                       (deep-link; duplicate; sold-out transition; status gates; user switch — extend or add)
```

Playwright config projects (`smoke` / `regression`) stay as-is unless a trivial `testMatch` tweak is required.

## 8. Out of scope

- #128 shared Tailwind UI primitives
- #133 official Tailwind packages / Compose Dockerfile vendor COPY fix
- #134 catalog code-review follow-ups
- Renaming existing `data-testid`s to match issue wording
- k6 / concurrency load (EPIC-07)
- MSW as E2E authority
- AuthN/AuthZ
- Redis or server-side cache changes
- Expanding into unrelated UI polish

## 9. Acceptance criteria

- [ ] Smoke covers catalog → ACTIVE sale → identify → buy → CustomerNav My Purchases → **this test’s** purchase visible
- [ ] Regression covers deep-link, duplicate, sold-out transition, pre-seeded status gates, user switch (independently runnable)
- [ ] Seed matrix exposes stable IDs for ACTIVE(10), ACTIVE(1), SOLD_OUT, UPCOMING, ENDED with stable, unique, human-readable product names
- [ ] Selectors: roles preferred; existing testids reused; no class-based selectors; no gratuitous testid renames
- [ ] Real-stack Playwright; aligns with `e2e/` conventions
- [ ] Post-buy assertions tolerate/expect #129 invalidation/refetch (no stale-cache assumptions)
- [ ] Pre-seeded SOLD_OUT complements ACTIVE(1) transition; neither replaces the other
- [ ] Smoke and regression remain deterministic under `workers: 1` using shared seeded state and unique `userId`s

## 10. Local verification note

At baseline (`6039811`), Compose `web`/`api` images may be stale relative to EPIC-10 UI, and a full Compose rebuild can fail on missing `vendor/` COPY before `pnpm install` (#133). #130 does not fix that. Prefer verifying against a host-built API/web pointed at Compose Postgres/Redis (alt ports) when Compose images lag `main`.
