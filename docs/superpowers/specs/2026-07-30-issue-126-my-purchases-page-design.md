# Issue #126 — My Purchases Page (Design Spec)

**Status:** Approved
**Date:** 2026-07-30
**Issue:** [#126](https://github.com/rexescario-dev/flash-sale-system/issues/126)
**Parent epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10 — Milestone 10)
**Repository:** `rexescario-dev/flash-sale-system`
**Baseline:** `main` at/after `200c682` (#125 `myPurchases` API via [PR #138](https://github.com/rexescario-dev/flash-sale-system/pull/138); identity via #123 / [PR #136](https://github.com/rexescario-dev/flash-sale-system/pull/136); sale UX via #124 / [PR #137](https://github.com/rexescario-dev/flash-sale-system/pull/137); catalog via #122 / [PR #135](https://github.com/rexescario-dev/flash-sale-system/pull/135))
**Not** AuthN/AuthZ — opaque local `userId` only; UI must not claim private/authenticated history

## 1. Goal

Add a customer **My Purchases** page at `/purchases` that lists purchase history for the committed local User ID using the #125 `myPurchases` GraphQL query, with Guest / empty / loading / error+retry states and links back to sale details.

## 2. Scope / Non-goals

### In scope

- Route `/purchases` with Tailwind UI matching Catalog/Sale emerald language
- Reuse `IdentityProvider` / `IdentityStrip` / `useUserIdentity` (committed identity only)
- Client GraphQL operation + TanStack Query hook for `myPurchases(userId)`
- Soft stacked single-column purchase panels (layout **C**) using #125 fields only
- Guest soft-empty (no GraphQL), identified-empty, loading, error + refetch retry
- Sale links to `/sales/:flashSaleId` via `flashSale.id`
- Vitest + MSW coverage and stable `data-testid`s
- Add `/purchases` to the router; existing unknown routes continue to resolve to the 404 page

### Non-goals

See **§10 Out of scope**.

## 3. Locked decisions

| Decision                           | Choice                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layout                             | **C** — soft stacked single-column panels (not compact list rows, not catalog card grid)                                                               |
| Panel fields                       | #125 only: product name, absolute local `purchasedAt`, optional clamped description, muted purchase `id`, View sale link                               |
| Status / sale window / qty / price | Deferred until API expansion — **not** in #126                                                                                                         |
| Guest UX                           | Soft empty — IdentityStrip + copy pointing to the strip; **no** duplicate Identify CTA                                                                 |
| `purchasedAt` format               | Absolute local datetime (no relative “ago”, no ticking). Exact locale formatting is implementation-defined; it must remain absolute, local, and stable |
| Architecture                       | **Approach 1** — thin page like Catalog (not a `features/purchases` slice; not shared #128 primitives)                                                 |
| Query enablement                   | Enabled only for committed non-whitespace `userId`                                                                                                     |
| Query key                          | Scoped by the exact committed `userId` (e.g. `['myPurchases', userId]`); may gain dimensions later                                                     |
| Guest definition                   | No usable committed id — aligned with query enablement (`userId` null / empty / whitespace ⇒ Guest UI + no request)                                    |
| State precedence                   | Exactly one body state at a time: **Guest → Pending → Error → Empty → Success**                                                                        |
| Ordering                           | Render rows **exactly** in the order returned by the GraphQL API; **no** client-side sorting                                                           |
| Retry                              | `refetch()` on the existing query instance; does not recreate the query, change identity, or invalidate unrelated queries                              |
| List abstraction                   | Page maps to stacked `PurchaseHistoryPanel[]`; no separate list component required                                                                     |
| Date formatting ownership          | `PurchaseHistoryPanel` formats `purchasedAt` in the user’s local timezone as an absolute datetime                                                      |
| Sale link                          | Navigates to `/sales/:flashSaleId` via the existing client router (`Link`)                                                                             |
| Nav / Redis                        | Do not pull #127 or #129                                                                                                                               |

## 4. Architecture

**Approach:** Thin page (Catalog-shaped).

```text
App (IdentityProvider wraps routes)
└── /purchases → PurchasesPage
      ├── IdentityStrip
      ├── header (brand eyebrow + “My purchases” + short non-AuthN copy)
      └── body (exactly one of Guest → Pending → Error → Empty → Success):
            Guest          → soft empty (no GraphQL)
            Pending        → purchases-loading
            Error + retry  → alert; Try again → refetch() on existing query
            Empty          → identified but no purchases for this User ID
            Success        → stacked PurchaseHistoryPanel[] (GraphQL API order)
```

Exactly one body state renders at a time in the following precedence: **Guest → Pending → Error → Empty → Success**.

### Separation of responsibilities

```text
PurchasesPage
  ├── reads committed userId from useUserIdentity()
  ├── coordinates Guest / Pending / Error / Empty / Success (precedence above)
  └── maps rows to PurchaseHistoryPanel (no separate list abstraction)

useMyPurchases(userId)
  ├── TanStack Query; key scoped by exact committed userId
  └── enabled only when userId is non-whitespace

fetchMyPurchases
  └── GraphQL myPurchases → PurchaseHistoryItem as returned

PurchaseHistoryPanel
  └── presentational; formats purchasedAt; sale link via client router Link
```

### Architectural principles

> GraphQL variables and query keys use the **exact** committed `userId` string. No trim/normalize after validation (same as #123 / purchase APIs). The query key is scoped by that `userId` (e.g. `['myPurchases', userId]`) and may gain other dimensions later.

> Guest means there is no usable committed identity. The page does **not** issue any GraphQL request (not merely “skip MyPurchases”).

> History panels render only fields from #125 `PurchaseHistoryItem`. Do not invent status, sale window, quantity, or price.

> Rows render in exactly the order returned by the GraphQL API. The client must not re-sort.

> IdentityStrip remains the sole Identify / Change / Save / Cancel surface. Guest empty copy may point at the strip but must not add a second CTA.

> Sale links navigate via the existing client router (`Link`), not a raw full-page anchor outside app routing conventions.

> No private/authenticated history framing in copy.

## 5. Component / module responsibilities

| Unit                       | Responsibility                                                                                                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PurchasesPage`            | Route `/purchases`; IdentityStrip; state precedence; maps panels                                                                                                                                                                          |
| `useMyPurchases`           | Query key scoped by exact committed `userId` (e.g. `['myPurchases', userId]`); `enabled` ↔ non-whitespace `userId`; exposes `refetch`                                                                                                     |
| `fetchMyPurchases`         | `apps/web/src/graphql/operations/myPurchases.ts`; maps exactly (`id`, `purchasedAt`, `flashSale.id`, `product.*`)                                                                                                                         |
| `PurchaseHistoryItem` type | Client type mirroring GraphQL; purchase id field is `id`                                                                                                                                                                                  |
| `PurchaseHistoryPanel`     | Soft panel: product name; **Purchased:** absolute local datetime (locale formatting implementation-defined, non-relative); optional description (line-clamp 2–3); muted `id`; **View sale** via client `Link` to `/sales/${flashSale.id}` |
| `IdentityStrip`            | Reused unchanged                                                                                                                                                                                                                          |
| Router                     | Register `/purchases`; unknown routes still hit `NotFoundPage`                                                                                                                                                                            |

## 6. GraphQL contract (consumer of #125)

```graphql
query MyPurchases($userId: ID!) {
  myPurchases(userId: $userId) {
    id
    purchasedAt
    flashSale {
      id
    }
    product {
      id
      name
      description
    }
  }
}
```

| UI need             | Field                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Purchase id (muted) | `PurchaseHistoryItem.id`                                                                                      |
| Sale link           | `PurchaseHistoryItem.flashSale.id` → `/sales/:flashSaleId` via client router `Link`                           |
| Product             | `product.name` (+ optional `description`)                                                                     |
| Timestamp           | `purchasedAt` → absolute local datetime in the panel (locale formatting implementation-defined; non-relative) |

## 7. States / data flow / errors

Exactly one of the following states is rendered, in precedence **Guest → Pending → Error → Empty → Success**.

### Data flow

```text
useUserIdentity().userId
  → Guest (null / empty / whitespace) → soft empty UI; useMyPurchases disabled (no GraphQL)
  → committed non-whitespace id → useMyPurchases(userId)
       → Pending | Error | [] | PurchaseHistoryItem[]
```

### State matrix

| Condition                   | UI                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest                       | Soft empty: e.g. “No purchases to show yet” + “Identify yourself using the banner above…”; IdentityStrip only CTA; **no GraphQL**                           |
| Identified + Pending        | `purchases-loading` visible until resolution                                                                                                                |
| Identified + Error          | Alert + message; **Try again** → `refetch()` on the existing query instance (does not recreate the query, change identity, or invalidate unrelated queries) |
| Identified + `[]` (Empty)   | Empty: **Identified, but no purchases exist for this User ID** (distinct from Guest)                                                                        |
| Identified + rows (Success) | Soft stacked panels in exactly the order returned by the GraphQL API                                                                                        |

### Panel content

```text
[ Purchase panel ]
Product name
Purchased: <absolute local datetime>   ← locale formatting implementation-defined; non-relative
Optional description (clamped 2–3 lines)
Muted purchase id
View sale → /sales/:flashSaleId (client router Link)
```

### Stable `data-testid`s

| Test id              | Where                 |
| -------------------- | --------------------- |
| `purchases-page`     | Page root             |
| `purchases-guest`    | Guest soft empty      |
| `purchases-loading`  | Loading               |
| `purchases-error`    | Error alert           |
| `purchases-retry`    | Retry button          |
| `purchases-empty`    | Identified empty list |
| `purchase-panel`     | Each history panel    |
| `purchase-sale-link` | View sale link        |

Do not add speculative test ids (e.g. `purchase-panel-title`) unless a test needs them.

## 8. Visual language

- Reuse Catalog/Sale emerald Tailwind tokens and page shell (`max-w-6xl`, brand eyebrow, heading)
- Soft panels: light border / background — **not** a multi-column card grid
- No new shared UI primitives (#128 deferred)
- Optional decorative empty illustration is allowed; **no** extra Identify button

## 9. Testing

Prefer existing Catalog / Sale Vitest + MSW patterns.

| Area            | Coverage                                                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Router          | `/purchases` mounts `purchases-page`; unknown routes still 404                                                                                                                          |
| Guest           | Soft empty + IdentityStrip; **no GraphQL request is issued**                                                                                                                            |
| Pending         | Identified + Pending query → `purchases-loading` visible until resolution                                                                                                               |
| Empty           | Identified + `[]` → `purchases-empty` (not Guest)                                                                                                                                       |
| Success         | One/many: name, formatted date, muted `id`, sale `href` `/sales/:id`; **rows render in exactly the order returned by the GraphQL API; tests must not sort expected data independently** |
| Error + retry   | Error UI; retry calls `refetch()` on the existing query instance (no unrelated invalidation); then Success or remains Error                                                             |
| Identity switch | Changing the committed user ID changes the query key and fetches history for the **new exact** `userId`                                                                                 |
| Op unit         | `fetchMyPurchases` maps the GraphQL response exactly as returned (`id`, `purchasedAt`, `flashSale.id`, `product.*`)                                                                     |

**Out of test scope for #126:** Playwright customer journey (#130), Redis / cache invalidation (#129), global nav (#127).

## 10. Out of scope

- AuthN / AuthZ; claiming private or authenticated purchase history
- Expanding GraphQL history with status, sale window, quantity, price, or full `FlashSale`
- Global customer navigation (#127)
- Redis / `myPurchases` cache invalidation (#129)
- Official Tailwind package swap (#133) / catalog review follow-ups (#134)
- Shared Tailwind primitives extraction (#128)
- Playwright end-to-end journey expansion (#130)
- Pagination, client sorting/filtering, receipts beyond existing fields

## 11. Dependencies / sequencing

```text
#123 Local identity  →  #126 Purchases UI
#125 myPurchases API →  #126 Purchases UI
#122 / #126         →  #127 Navigation (later)
#121/#122/#125/#126/#124 → #129 cache invalidation (later)
```

## 12. Success criteria (maps to issue AC)

- [ ] `/purchases` reachable and uses persisted (committed) User ID only
- [ ] Shows that user’s purchases; Guest and identified-empty states handled distinctly
- [ ] Loading / error / retry (`refetch` on existing query instance; no unrelated invalidation) implemented
- [ ] Links to `/sales/:flashSaleId` via client router `Link` and `flashSale.id`
- [ ] Tailwind styling consistent with Catalog/Sale
- [ ] GraphQL mapping preserves `id`, `purchasedAt`, `flashSale.id`, and `product.*` exactly as returned
- [ ] Exactly one body state by precedence Guest → Pending → Error → Empty → Success
- [ ] No GraphQL when Guest; rows in GraphQL API order (no client sort); no #127/#129 scope creep
