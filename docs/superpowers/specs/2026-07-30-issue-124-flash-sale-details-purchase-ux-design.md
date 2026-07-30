# Issue #124 — Flash Sale Details & Purchase UX (Design Spec)

**Status:** Approved
**Date:** 2026-07-30
**Issue:** [#124](https://github.com/rexescario-dev/flash-sale-system/issues/124)
**Parent epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10 — Milestone 10)
**Repository:** `rexescario-dev/flash-sale-system`
**Upstream:** Catalog home (#122 / PR #135); persisted local identity (#123 / PR #136) on `main` (`25ae5d2`); nested `product` on `flashSale(id)` from #121
**Not** AuthN/AuthZ, new purchase APIs, or shared design-system extraction (#128)

## 1. Goal

Polish `/sales/:flashSaleId` into a **product-first, conversion-oriented** purchase surface with Tailwind CSS: mobile sticky Buy (layout B), desktop sticky purchase rail (layout C), live countdown from real timestamps, and a stable **Buy Now** CTA with inline helper text. Reuse committed identity only — do not reintroduce sale-page `userId` typing.

## 2. Scope / Non-goals

### In scope

- Rebuild sale detail / purchase UX with Tailwind (catalog emerald visual language)
- Extend client `flashSale` query + `FlashSale` type with required nested `product { id name description }`
- Product column: name, `SaleStatusBadge`, `StockBar`, live countdown, formatted sale window, optional description
- Responsive composition: mobile sticky buy bar + desktop sticky purchase rail
- Reuse `IdentityStrip` / `useUserIdentity` / `isBuyDisabled` / existing GraphQL ops (`flashSale`, `myPurchase`, `purchaseItem`)
- Stable **Buy Now** label; disabled reasons via reserved-height helper text
- Tailwind restyle of request-error and purchase-outcome banners on this surface
- Vitest + MSW coverage; stable `data-testid`s
- Remove obsolete `SaleStatusCard` if unused after the redesign; fold `PurchasePanel` into purchase surfaces

### Non-goals

See **§10 Out of scope**.

## 3. Locked decisions

| Decision              | Choice                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout                | **B on mobile** (product first + sticky Buy) + **C on desktop** (sticky purchase rail)                                                                                                                    |
| Content               | Available API fields only + **live countdown**; **no** price/image placeholders                                                                                                                           |
| CTA                   | Label always **Buy Now** (or **Buying…** while pending); helper explains blockers                                                                                                                         |
| Identity              | Reuse `IdentityStrip` + committed `userId` only; UI label Email; opaque non-whitespace validation (no email-format check)                                                                                 |
| Architecture          | Approach 2 — thin sale-detail feature slice; page orchestrates; children presentational                                                                                                                   |
| Countdown             | `useSaleCountdown(startsAt, endsAt, now?)` — timestamps only; **not** driven by API `status`                                                                                                              |
| Purchase surfaces     | Isomorphic props (`PurchaseSurfaceProps`); rail shows optional summaries; sticky ignores them                                                                                                             |
| Helper                | Derived UI state on the page (or pure helper fn); **no** standalone `BuyDisabledReason` component                                                                                                         |
| StockBar              | Receives `remaining` + `total`; computes fill internally                                                                                                                                                  |
| Responsive visibility | Both surfaces may remain mounted; CSS shows exactly one; page owns composition                                                                                                                            |
| Countdown format      | Always zero-padded `HH:MM:SS` (e.g. `00:01:09`)                                                                                                                                                           |
| Sale window format    | Same calendar day → `Today` + `h:mm A – h:mm A`; else `MMM D, h:mm A – MMM D, h:mm A`. Format using the user's browser locale/timezone (**no UTC rendering**) so the window matches countdown local time. |
| Tick interval         | `1000` ms                                                                                                                                                                                                 |
| Primitives            | Do **not** pull #128 / #133 / #134 forward                                                                                                                                                                |

## 4. Architecture

```text
FlashSalePage (orchestrator)
├── data: useFlashSale / useMyPurchase / usePurchaseItem / useUserIdentity
├── derived: countdown, helper (ReactNode), buyDisabled, pending flags
├── Back link → /
├── Page-level: sale loading (layout skeleton), sale error+retry, myPurchase error+retry
├── Product column (informational only)
│     ├── title + SaleStatusBadge (reuse catalog)
│     ├── StockBar
│     ├── SaleCountdown (+ formatted window)
│     └── optional description
├── lg+: PurchaseRail (sticky purchase surface)
│     ├── IdentityStrip
│     ├── optional remaining + countdown summary
│     ├── Buy Now + reserved-height helper
│     └── purchase outcome / purchase error+retry
└── <lg: StickyBuyBar (fixed bottom purchase surface)
      ├── IdentityStrip
      ├── Buy Now + reserved-height helper
      └── purchase outcome / purchase error+retry
```

### Responsibility boundaries

> **FlashSalePage** orchestrates responsive composition (desktop rail vs mobile sticky bar), data loading, and derived UI state. Child components remain presentational and do **not** decide when they are shown.

> **Product column** is informational only (name, badge, stock, countdown, window, description).

> **PurchaseRail / StickyBuyBar** are purchasing only (identity, Buy, helper, purchase feedback).

> **API `status` and existing eligibility (`isBuyDisabled`) are authoritative** for badges and whether Buy is enabled. The countdown is purely presentational. Do **not** enable or disable purchases from countdown math — that prevents an entire class of eligibility bugs.

> Helper content is derived from purchase/sale/identity state and passed into the purchase surfaces — implementation may be an inline expression or a small pure function, not a dedicated reason component.

> Purchase-related success/failure feedback stays with the purchase surfaces. Page-level load failures stay at the page level.

> Both purchase surfaces may remain mounted simultaneously, but **only one is visually rendered** at any viewport width (responsive CSS). The page owns that composition.

### Architectural principles

> Extend the client `flashSale` query to request nested `product`. The API already guarantees it; the `FlashSale` type treats `product` as required.

> Derive countdown **once** via `useSaleCountdown` with a **1000 ms** interval and pass results down. Do not run multiple intervals in rail + product column.

> Mount `IdentityStrip` in both rail and sticky bar; responsive CSS ensures only one is visible. Prefer this over moving a single DOM node between layouts.

> Mutation pending: button shows **Buying…**, helper is empty/hidden, and existing purchase outcome/error banners remain hidden while pending (avoid stacked feedback).

> Purchase-error **retry** reuses the existing `purchaseItem` mutation with the **current committed identity** — do not invent a separate reload or identity-bypass path.

## 5. Component / module responsibilities

| Unit                                           | Responsibility                                                                                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FlashSalePage`                                | Route orchestration; GraphQL hooks; derive countdown/helper/`buyDisabled`; responsive layout + sticky bottom padding; page-level loading/errors (skeleton approximates final layout to minimize CLS) |
| `useSaleCountdown(startsAt, endsAt, now?)`     | Single **1000 ms** interval; derive mode/label/text from timestamps only; text always zero-padded `HH:MM:SS`; never negative; stable at/after target                                                 |
| `SaleCountdown`                                | Presentational countdown display                                                                                                                                                                     |
| `StockBar`                                     | Presentational remaining/total + progress fill                                                                                                                                                       |
| `PurchaseRail`                                 | Desktop purchase surface (`PurchaseSurfaceProps` + optional summaries). Always reserve helper slot height so the CTA does not move when helper content appears or disappears.                        |
| `StickyBuyBar`                                 | Mobile fixed footer purchase surface (safe-area padding); ignores optional summaries. Same reserved helper-slot height rule as the rail.                                                             |
| `SaleStatusBadge`                              | Reuse from catalog — presentation only                                                                                                                                                               |
| `IdentityStrip` / `useUserIdentity`            | Unchanged commit UX; exact committed string for GraphQL                                                                                                                                              |
| `RequestErrorBanner` / `PurchaseOutcomeBanner` | Tailwind restyle; keep stable test ids                                                                                                                                                               |
| `PurchasePanel`                                | Fold into rail/bar or delete after migration                                                                                                                                                         |
| `SaleStatusCard`                               | **Delete** if nothing else references it                                                                                                                                                             |

Suggested paths (align with existing web layout):

- `apps/web/src/hooks/useSaleCountdown.ts` (+ spec)
- `apps/web/src/features/flash-sale/components/SaleCountdown.tsx`
- `apps/web/src/features/flash-sale/components/StockBar.tsx`
- `apps/web/src/features/flash-sale/components/PurchaseRail.tsx`
- `apps/web/src/features/flash-sale/components/StickyBuyBar.tsx`
- `apps/web/src/features/catalog/components/SaleStatusBadge.tsx` (reuse)
- Update `apps/web/src/graphql/operations/flashSale.ts`, `apps/web/src/graphql/types.ts`, `apps/web/src/pages/FlashSalePage.tsx`
- Update MSW fixtures / page tests under `apps/web/src/`

### Shared purchase surface props

Use the existing client type returned by the `purchaseItem` mutation (`PurchaseItemResult` in `apps/web/src/graphql/types.ts`) — do not invent a parallel outcome abstraction.

```ts
type PurchaseSurfaceProps = {
  buyDisabled: boolean;
  buyPending: boolean;
  /**
   * Presentational helper; omit/undefined when none.
   * Prop allows richer ReactNode later; current UX is a single concise line.
   * Surfaces reserve slot height in rendering (not in this type).
   */
  helper?: React.ReactNode;
  onBuy: () => void;
  // Optional — desktop rail renders; mobile sticky ignores
  remainingSummary?: { remaining: number; total: number };
  countdownSummary?: { label: string; text: string } | null;
  // Purchase feedback (hidden while buyPending)
  purchaseError?: { message: string; onRetry: () => void } | null;
  purchaseOutcome?: PurchaseItemResult | null;
  alreadyPurchased?: boolean;
};
```

`onRetry` must call the existing purchase mutation again with the current committed identity (same path as Buy), not a page reload or alternate GraphQL operation.

Both surfaces embed `IdentityStrip` internally (or receive it as children — prefer embed for isomorphic structure). Both may stay mounted; only one is visually rendered via responsive CSS (`hidden lg:block` / `lg:hidden` or equivalent).

## 6. Data flow and GraphQL

### Client query extension

```graphql
query FlashSale($id: ID!) {
  flashSale(id: $id) {
    id
    status
    remainingStock
    totalStock
    startsAt
    endsAt
    product {
      id
      name
      description
    }
  }
}
```

Widen `FlashSale` with required `product: Product` (same `Product` type as catalog). No API contract changes.

### Identity and purchase

Unchanged from #123:

- `userId === null` ⇒ Guest; no `myPurchase` usefulness; Buy disabled
- Mutations and query keys use the **exact** committed string
- `isBuyDisabled` remains the eligibility gate (identity + ACTIVE + not purchased + not loading/error/pending)

### Countdown derivation

```ts
useSaleCountdown(startsAt: string, endsAt: string, now?: number)
// → { mode: 'starts' | 'ends' | 'none'; label: string; text: string }
// text is always zero-padded HH:MM:SS (e.g. 00:01:09 — never 0:1:9)
```

- Before `startsAt`: mode `starts`, label “Starts in”
- Between `startsAt` and `endsAt`: mode `ends`, label “Ends in”
- At/after `endsAt`: mode `none` (or `00:00:00` then settle); **never** negative durations
- Tick every **1000 ms**
- Optional `now` supports tests
- Does **not** read API `status`

### Sale window formatting

Format `startsAt` / `endsAt` once for the product column using the **user's browser locale/timezone** (no UTC rendering — keep the sale window consistent with countdown local time):

- **Same calendar day:** heading `Today`, range `h:mm A – h:mm A` (e.g. `9:00 AM – 11:00 AM`)
- **Different calendar days:** `MMM D, h:mm A – MMM D, h:mm A` (e.g. `Jul 30, 9:00 AM – Jul 31, 11:00 AM`)

Use one shared formatter (inline helper or small util colocated with the page/feature). Do not leave window formatting to each component.

### Helper content (when Buy disabled and not pending)

Suggested precedence (first match wins). The helper prop is `ReactNode` for future flexibility; **current implementation should render a single concise line**:

1. Guest / no committed identity → “Enter your email to continue.” (presentation; not format validation)
2. `UPCOMING` → prefer “Sale starts in {countdown.text}.” when countdown mode is `starts`
3. `SOLD_OUT` → “This sale is sold out.”
4. `ENDED` → “This sale has ended.”
5. Already purchased → prefer positive status treatment (see §7), not a failure-toned helper
6. Sale loading / myPurchase checking → optional lightweight helper or loading affordance; Buy stays disabled
7. Enabled or pending → no helper (`Buying…` on the button only when pending)

Purchase surfaces reserve helper slot height in their layout (`min-h-[1.25rem]` or equivalent) so the CTA does not jump — that is a rendering concern, not part of the prop type.

## 7. UI states

| State                               | Page                                                                             | Purchase surface                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Sale loading                        | `data-testid="sale-loading"`; skeleton approximates final layout to minimize CLS | Buy disabled                                                                                                    |
| Sale error                          | Page-level error banner + retry                                                  | Buy disabled                                                                                                    |
| Success load                        | Product column + window                                                          | Rail or sticky per breakpoint                                                                                   |
| Guest                               | —                                                                                | Disabled Buy; helper “Enter your email to continue.”                                                            |
| UPCOMING                            | Badge; countdown “Starts in …”                                                   | Disabled; helper with starts-in text                                                                            |
| ACTIVE + identified + not purchased | Countdown “Ends in …”                                                            | Enabled Buy; helper empty (reserved height)                                                                     |
| SOLD_OUT / ENDED                    | Badge; countdown presentational only                                             | Disabled; sold-out / ended helper                                                                               |
| myPurchase loading (identified)     | Optional “Checking purchase status…”                                             | Buy disabled; helper optional                                                                                   |
| Already purchased                   | —                                                                                | Disabled Buy; positive **Purchased** status (“You have already purchased this item.”) — completion, not failure |
| Mutation pending                    | —                                                                                | Disabled; label **Buying…**; **no** helper; hide outcome/error banners while pending                            |
| Purchase error                      | —                                                                                | Banner + retry on purchase surface; retry re-invokes `purchaseItem` with current committed identity             |
| Purchase outcome                    | —                                                                                | Outcome banner on purchase surface                                                                              |
| myPurchase error                    | Page-level banner + retry                                                        | Eligibility still gates Buy                                                                                     |

### Responsive layout

- `<lg`: single column product content + `StickyBuyBar` (`fixed bottom-0 inset-x-0`, safe-area `pb-[env(safe-area-inset-bottom)]`); page bottom padding clears the bar
- `lg+`: `lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8` (or equivalent); rail `lg:sticky lg:top-6` with catalog-aligned chrome (`rounded-xl border …`)
- **Exactly one purchase surface is visible at any viewport width**

### Content hierarchy (product column)

1. Back to products
2. Name + status badge
3. Stock bar (`remaining / total`)
4. Countdown (“Starts in” / “Ends in”)
5. Optional description
6. Formatted sale window (see §6 sale-window rules)

No price. No image placeholders.

## 8. Testing

### Unit / component (Vitest + MSW)

- `useSaleCountdown`: starts/ends/none modes; **boundary** at `00:00:01`, `00:00:00`, and post-target (no negatives, no oscillation)
- `StockBar`: `0/total`, `1/total`, `total/total` fill edge cases
- Purchase surfaces: disabled + helper; pending → Buying… and no helper; already-purchased status
- `FlashSalePage`: product name from nested `product`; back link to `/`; IdentityStrip present; **no** local `userId` input; Buy gating with committed identity; purchase outcome/retry; exactly one surface visible per viewport class strategy (assert via testids / classes as appropriate)
- MSW `flashSale` fixtures include required `product`

### Selectors

Keep existing: `flash-sale-page`, identity strip testids, `sale-status-badge`, purchase outcome/error ids.

Add as needed: `back-to-products`, `stock-bar`, `sale-countdown`, `buy-helper`, `purchase-rail`, `sticky-buy-bar`.

Prefer roles/`data-testid` (no class-based E2E selectors). Do **not** expand Playwright journey coverage in #124 (#130 later).

## 9. Acceptance criteria

- [ ] User understands product and eligibility before Buy (name, status, stock, countdown/window, identity)
- [ ] Buy label stays **Buy Now** (or **Buying…**); disabled reasons are clear via helper / purchased status
- [ ] Success and safe failure/retry are clear on the purchase surface
- [ ] Tailwind-only styling for this page surface (no reliance on legacy `.shell` sale layout)
- [ ] Works on desktop and mobile (B sticky / C rail)
- [ ] Exactly one purchase surface is visible at any viewport width
- [ ] Nested `product` rendered from `flashSale` query; no price/image placeholders
- [ ] Reuses `IdentityStrip` / `useUserIdentity`; no sale-page local userId typing
- [ ] Existing GraphQL ops preserved (`flashSale`, `myPurchase`, `purchaseItem`)

## 10. Out of scope

- AuthN/AuthZ
- New purchase semantics or API changes
- Price, product images, discounts, quantity limits, SKU/variants
- #125 myPurchases API / #126 purchases page / #127 global nav
- #128 shared Tailwind primitives extraction
- #129 purchase cache invalidation beyond what already exists for this page
- #130 Playwright customer-journey expansion
- #133 official Tailwind packages / #134 catalog review follow-ups
- Live multiplayer stock websockets; Redis changes

## 11. Implementation notes

- Visual language: match catalog emerald tokens (`text-emerald-*`, white/70 panels, existing badge colors)
- Back link: React Router `Link` to `/` with stable testid
- Delete `SaleStatusCard` when unused; migrate any tests that targeted it
- E2E page objects (`e2e/pages/sale.page.ts`) may need selector updates if they assumed old markup — keep behavior, prefer testids; no new journey scope
- Do not commit design/plan docs unless the user asks

## 12. Open questions

None — decisions locked in design review (2026-07-30).
