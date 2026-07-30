# Issue #127 — Global Customer Navigation (Design Spec)

**Status:** Approved (chat); implementation plan written (uncommitted)  
**Date:** 2026-07-30  
**Issue:** [#127](https://github.com/rexescario-dev/flash-sale-system/issues/127)  
**Parent epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10 — Milestone 10)  
**Repository:** `rexescario-dev/flash-sale-system`  
**Baseline:** `main` @ `d474d1e` (#126 My Purchases UI via [PR #139](https://github.com/rexescario-dev/flash-sale-system/pull/139); catalog #122; identity #123; sale UX #124; myPurchases API #125)  
**Not** AuthN/AuthZ — opaque local `userId` only; header identity is read-only status

## 1. Goal

Add responsive **global customer navigation** so catalog, sale detail, and purchase history feel like one app: brand, section links, active section indication, mobile disclosure menu, and a compact read-only identity status — while page-level `IdentityStrip` remains the sole Identify / Change / Save surface.

## 2. Scope / Non-goals

### In scope

- Layout-route shell on `/`, `/sales/:flashSaleId`, `/purchases`
- Logo/app name **Flash Sale Store**; links **Flash Sales** + **My Purchases**
- Compact read-only identity status in the nav (consumes `IdentityProvider` only)
- Active section state; mobile hamburger / disclosure menu
- Tailwind CSS; stable `data-testid`s
- Vitest coverage for shell presence, links, active state, identity copy, mobile open/close/navigate

### Non-goals

See **§9 Out of scope**.

## 3. Locked decisions

| Decision             | Choice                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Architecture         | **Approach 1** — React Router layout route (`CustomerLayout` + `Outlet`); NotFound outside shell         |
| Identity placement   | **B** — compact read-only status in nav; keep page `IdentityStrip` / purchase-surface strips for editing |
| Mobile nav           | **A** — hamburger / disclosure menu; desktop stays horizontal                                            |
| Brand + labels       | **C** — **Flash Sale Store** · **Flash Sales** · **My Purchases**                                        |
| Active section       | **Flash Sales** active for `/` **and** `/sales/:id`; **My Purchases** active for `/purchases`            |
| Layout landmark      | Pages keep their own `<main>`; `CustomerLayout` is a non-`<main>` shell (avoid nested landmarks)         |
| Identity editing     | Never in the header; no Identify / Change / Save / Copy / Reset in nav                                   |
| Escape to close menu | Nice-to-have only — **not** a required acceptance or brittle test                                        |
| Shared UI primitives | Do **not** extract #128 shared Tailwind primitives in this ticket                                        |
| Cache / Playwright   | Do **not** pull #129 Redis invalidation or #130 Playwright journey expansion                             |

## 4. Architecture

`IdentityProvider` continues to wrap the application; `CustomerLayout` is introduced within the existing router.

```text
IdentityProvider (unchanged wrap)
└── Routes
    ├── element: CustomerLayout          ← shell only
    │     ├── CustomerNav
    │     │     ├── brand Link → /
    │     │     ├── NavLink Flash Sales → /
    │     │     ├── NavLink My Purchases → /purchases
    │     │     ├── IdentityStatus (read-only)
    │     │     └── mobile menu button + disclosure
    │     └── <Outlet />                 ← not wrapped in <main>
    │           ├── /              → CatalogPage      (keeps IdentityStrip)
    │           ├── /sales/:id     → FlashSalePage    (strip in purchase surfaces)
    │           └── /purchases     → PurchasesPage    (keeps IdentityStrip)
    └── * → NotFoundPage                 ← no customer-nav
```

### Separation of responsibilities

| Unit               | Responsibility                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `CustomerLayout`   | Render `CustomerNav` + `<Outlet />`. No fetching, no identity writes, no page business logic.                               |
| `CustomerNav`      | Brand, section links, active styling, responsive desktop/mobile chrome, hosts `IdentityStatus`. No page-specific knowledge. |
| `IdentityStatus`   | Read-only Guest / committed copy from `useUserIdentity()`. No editing controls.                                             |
| Pages              | Unchanged ownership of identity editing and content `<main>`.                                                               |
| `IdentityProvider` | Unchanged; nav is a pure consumer — **no new identity state** in the header.                                                |

### Files (expected)

```text
apps/web/src/app/CustomerLayout.tsx
apps/web/src/app/router.tsx                    (modify — nest customer routes)
apps/web/src/features/nav/CustomerNav.tsx
apps/web/src/features/nav/CustomerNav.test.tsx
apps/web/src/app/router.test.tsx               (modify — shell vs 404)
```

`IdentityStatus` may be a separate file (e.g. `features/nav/IdentityStatus.tsx`) or a private component colocated with `CustomerNav`; both satisfy this design.

Do **not** move identity commit/storage logic into `features/nav`.

## 5. UX & behavior

### Desktop

Horizontal bar: brand **Flash Sale Store** (`Link` → `/`) · **Flash Sales** · **My Purchases** · compact **IdentityStatus**.

### Mobile

Compact header: menu button · brand · IdentityStatus. Disclosure panel lists Flash Sales + My Purchases with active highlight. Close menu when a nav link is followed. Do not require Escape handling for acceptance.

### Active section (section model, not destination-only)

| Path         | Flash Sales | My Purchases |
| ------------ | ----------- | ------------ |
| `/`          | active      | —            |
| `/sales/:id` | active      | —            |
| `/purchases` | —           | active       |

Use `NavLink` with active-state logic that matches the table above (Flash Sales: `/` or pathname starting with `/sales/`; My Purchases: `/purchases`) — e.g. `className` / `children` callback, `useLocation`, or another equivalent approach. The implementation is not prescribed; the observable behavior is. Primary contract for tests: `aria-current="page"` on the active link.

### IdentityStatus copy

- Guest → `Shopping as Guest`
- Committed → `Shopping as {userId}` (exact committed string)

Copy should exactly match the existing `IdentityStrip` wording where applicable.

### Sale page

Existing back navigation remains unchanged (do not rename existing sale-page test ids in this issue). Flash Sales stays section-active while on the sale.

## 6. Stable `data-testid`s

| Element         | `data-testid`         |
| --------------- | --------------------- |
| Nav root        | `customer-nav`        |
| Brand           | `nav-brand`           |
| Flash Sales     | `nav-flash-sales`     |
| My Purchases    | `nav-purchases`       |
| Identity status | `nav-identity-status` |
| Menu button     | `nav-menu-button`     |
| Menu panel      | `nav-menu`            |

Prefer roles / `data-testid` / `aria-current` over class-based selectors.

## 7. Testing

### Router

- `/`, `/sales/:id`, `/purchases` render `customer-nav`
- `*` NotFound does **not** render `customer-nav`

### CustomerNav

- Brand → `/`; Flash Sales → `/`; My Purchases → `/purchases`
- `aria-current="page"` on Flash Sales for `/` and `/sales/:id`
- `aria-current="page"` on My Purchases for `/purchases`
- Guest vs committed identity copy; **no** Identify / Change / Save controls in nav
- Mobile: menu closed initially; opens/closes via button; closes after navigation

### Regression

Existing Catalog, Sale, Purchases, and `IdentityStrip` tests continue to pass (page ownership unchanged).

**Out of test scope for #127:** Playwright journey expansion (#130), Redis / cache invalidation (#129), Escape key unless implemented as free polish without a required test.

## 8. Success criteria (maps to issue AC)

- [ ] Navigation available on catalog, sale detail, and purchases
- [ ] Users can navigate between Flash Sales and My Purchases
- [ ] Mobile usable (hamburger disclosure); current **section** indicated via `aria-current`
- [ ] Tailwind styling consistent with emerald customer UI
- [ ] Reuses `IdentityProvider` / `useUserIdentity`; **CustomerNav reflects current identity without introducing new identity state**
- [ ] Page-level IdentityStrip / purchase-surface editing unchanged
- [ ] Stable `data-testid`s from §6; NotFound outside shell
- [ ] No Auth menus, admin nav, #128/#129/#130 scope creep

## 9. Out of scope

- AuthN / AuthZ menus; admin navigation
- Moving Identify / Change / Save into the header (Option A)
- Shared Tailwind primitives extraction (#128)
- Official Tailwind package swap (#133) / catalog review follow-ups (#134)
- Redis / purchase cache invalidation (#129)
- Playwright customer-journey expansion (#130)
- Required Escape-to-close menu behavior

## 10. Dependencies / sequencing

```text
#122 catalog + #126 purchases  →  #127 Navigation (this)
#127                          →  #130 Playwright (later)
UI patterns may later feed      #128 shared primitives (later)
```

## 11. Notes for implementers

- Use nested routes: parent `element={<CustomerLayout />}` with child path routes; keep `path="*"` sibling outside the layout.
- Keep `IdentityStatus` free of write APIs (separate file or colocated private component).
- Do not wrap `<Outlet />` in `<main>`; pages already own that landmark.
- Sale-page IdentityStrip continues to live inside purchase rail / sticky bar — do not add a duplicate top-of-page strip on FlashSalePage solely for nav consistency.
