# Issue #122 — Customer Flash-Sale Catalog Home Page (Design Spec)

**Status:** Approved
**Date:** 2026-07-30
**Issue:** [#122](https://github.com/rexescario-dev/flash-sale-system/issues/122)
**Parent epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10 — Milestone 10)
**Repository:** `rexescario-dev/flash-sale-system`
**Upstream:** [#121](https://github.com/rexescario-dev/flash-sale-system/issues/121) catalog GraphQL API (`flashSales` + nested `product`) on `main` via [#131](https://github.com/rexescario-dev/flash-sale-system/pull/131) + [#132](https://github.com/rexescario-dev/flash-sale-system/pull/132)
**Not** an EPIC-01 or #118 scope change — customer catalog UI only

## 1. Goal

Replace the instructional landing page at `/` with a browse-first flash-sale catalog so customers can discover sales without knowing a `flashSaleId`, then open an existing detail route.

## 2. Scope / Non-goals

### In scope

- Consume `flashSales` GraphQL (including nested `product`)
- Catalog UI at `/` with initial loading, empty, error + retry, and success grid
- Cards showing product name, optional description, status badge, remaining/total stock, start/end
- Whole-card navigation to `/sales/:flashSaleId`
- Introduce Tailwind CSS in `apps/web` for catalog styling
- Vitest + MSW coverage and stable `data-testid`s
- Preserve existing `/sales/:flashSaleId` behavior and styling

### Non-goals

See **§11 Out of scope**.

## 3. Architecture

**Approach:** Thin feature slice (Approach 1).

```text
EPIC-10 #122
│
├── / → CatalogPage
│       │
│       ├── useFlashSales()
│       │      └── flashSales GraphQL operation
│       │
│       ├── initial loading
│       ├── error → retry (refetch)
│       ├── empty
│       │
│       └── success
│              └── responsive grid (1 / 2 / 3 cols)
│                     └── FlashSaleCard (Link)
│                            ├── SaleStatusBadge
│                            ├── product.name
│                            ├── product.description (optional)
│                            ├── remainingStock / totalStock
│                            └── startsAt / endsAt
│
└── /sales/:flashSaleId
        └── unchanged (behavior + existing CSS)
```

### Architectural principles

> Product details on the catalog come **only** from the nested `product` on each `flashSales` row returned by #121. No second product-fetch path.

> Catalog status is secondary metadata (badge only). Product name and remaining stock remain the visual focus. Card chrome is consistent across statuses.

> The catalog displays `flashSales` in the order returned by the API. #122 performs no client-side sorting, filtering, or pagination.

> The #121 API returns catalog results ordered by `startsAt ASC` (locked in the #121 design). #122 does not re-impose or re-implement that ordering on the client.

> The client does not derive or recalculate sale status from dates or stock; it renders the `status` returned by the API.

## 4. Component responsibilities

| Unit              | Responsibility                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `CatalogPage`     | Owns route `/`; applies state precedence; page shell + responsive grid                               |
| `useFlashSales`   | TanStack Query wrapper; query key `['flashSales']`; exposes `refetch` for retry                      |
| `fetchFlashSales` | GraphQL operation module under `apps/web/src/graphql/operations/`                                    |
| `FlashSaleCard`   | Whole-card `Link` to `/sales/:flashSaleId`; renders name, optional description, stock, window, badge |
| `SaleStatusBadge` | Maps API `status` → colored text badge (presentation only; no status derivation)                     |
| Router            | `/` → `CatalogPage` (replace / rename `LandingPage`); detail route unchanged                         |
| Types             | Introduce catalog-specific types when the detail-page `FlashSale` lacks nested `product` (see §5)    |

Suggested paths (align with existing web layout; adjust only if patterns already diverge):

- `apps/web/src/pages/CatalogPage.tsx` (replaces instructional `LandingPage` at `/`)
- `apps/web/src/hooks/useFlashSales.ts`
- `apps/web/src/graphql/operations/flashSales.ts`
- `apps/web/src/features/catalog/components/FlashSaleCard.tsx`
- `apps/web/src/features/catalog/components/SaleStatusBadge.tsx`

## 5. Data flow and GraphQL contract

Consume the #121 catalog query (no API contract changes in #122).

Operation name follows the existing web convention (`FlashSale`, `MyPurchase`, `PurchaseItem` → PascalCase field-style names):

```graphql
query FlashSales {
  flashSales {
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

### Client types

The catalog query requires `FlashSale.product` to be present. If the existing detail-page `FlashSale` type does not include `product`, introduce a catalog-specific type such as `CatalogFlashSale` rather than weakening or changing the detail-page contract.

```ts
type Product = {
  id: string;
  name: string;
  description: string | null;
};

type CatalogFlashSale = {
  id: string;
  status: FlashSaleStatus;
  remainingStock: number;
  totalStock: number;
  startsAt: string;
  endsAt: string;
  product: Product;
};
```

Do not invent a second product network path. Nested `product` on each catalog row is sufficient.

### Data rules

- Nested `product` only — no per-card product lookups
- Status is API-owned — render returned `status`; do not recalculate locally
- Retry = `useFlashSales().refetch()` (or equivalent Query refetch). No special cache invalidation or client recovery beyond existing GraphQL / TanStack Query behavior
- Dates: concise browser-locale display; no new i18n/date infrastructure

## 6. UI / state behavior

### State precedence

Exact render precedence:

```text
initial loading → loading UI
error           → error + retry
success + []    → empty UI
success + items → catalog grid
```

**Initial loading** means the first load with no settled result yet — not every `isPending` / refetch transition. Refetches, including retry, do **not** replace an already-rendered success or error state with the initial loading UI.

### Status badges (locked)

Card chrome is **identical** across statuses. Status communicated by badge only — **no** Active-specific border, background, or “Shop now” affordance in #122.

| Status     | Label    | Badge color    |
| ---------- | -------- | -------------- |
| `UPCOMING` | Upcoming | Amber / yellow |
| `ACTIVE`   | Active   | Green          |
| `SOLD_OUT` | Sold Out | Red            |
| `ENDED`    | Ended    | Neutral / gray |

### Description rendering

| Value            | UI           |
| ---------------- | ------------ |
| `null`           | Not rendered |
| `""`             | Not rendered |
| non-empty string | Rendered     |

### Layout

Responsive card grid:

- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns
- Sensible max-width / container constraints

### Card content focus

Primary visual weight: **product name** and **remaining stock** (with total). Secondary: status badge, optional description, start/end times.

## 7. Navigation and routing

| Route                 | Behavior                                         |
| --------------------- | ------------------------------------------------ |
| `/`                   | Catalog (not instructional landing)              |
| `/sales/:flashSaleId` | Existing detail/purchase page — **unchanged**    |
| Card click            | Entire card is a `Link` to `/sales/:flashSaleId` |

No nested interactive controls inside the card in #122. If later tickets add in-card actions, refactor link vs interactive regions in #124 / #128.

## 8. Tailwind boundary

- Introduce Tailwind using the project's existing Vite/Tailwind conventions where available; catalog components are the only consumers introduced by #122
- If no prior Tailwind setup exists in the repo, add a conventional Vite + Tailwind setup under `apps/web` only
- **Do not** migrate `/sales/:flashSaleId` (or shared shell redesign) to Tailwind in this ticket — leave existing CSS intact until #124
- **Do not** extract a shared primitives layer — that is #128

## 9. Testing strategy and acceptance matrix

**Stack:** Vitest + Testing Library + existing MSW patterns (`server.use` per operation).

| Case              | Assertions                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Initial loading   | Catalog loading UI / loading `data-testid` visible                                                               |
| Success (N sales) | Exactly N cards; product name; stock; each card links to the corresponding `/sales/:id`                          |
| Empty (`[]`)      | Empty UI; no cards                                                                                               |
| Error + retry     | Error UI remains visible while retry/refetch is in flight; a successful response transitions to the success grid |
| Description       | `null` / `""` omitted; non-empty string shown                                                                    |
| Status badge      | All four mappings: Upcoming amber, Active green, Sold Out red, Ended gray                                        |
| Router smoke      | `/` is catalog (not instructional-only landing); `/sales/:id` still mounts flash-sale page                       |

Playwright customer-journey coverage is owned by **#130**, not #122. Stable test ids below make that ticket straightforward.

## 10. Stable test IDs

Required (names may be adjusted only if a project-wide convention already exists; then document the mapping in the PR):

| Element           | `data-testid`       |
| ----------------- | ------------------- |
| Catalog page root | `catalog-page`      |
| Loading state     | `catalog-loading`   |
| Empty state       | `catalog-empty`     |
| Error state       | `catalog-error`     |
| Retry control     | `catalog-retry`     |
| Sale card         | `catalog-card`      |
| Status badge      | `sale-status-badge` |

`catalog-card` is applied to every card. Each card must expose its sale identity through its `href` (`/sales/:flashSaleId`) and/or accessible name so tests can assert exact cardinality, specific sale links, and correct `flashSaleId` mapping. `data-sale-id` is optional.

Prefer roles/`data-testid` over CSS class selectors (epic guidance). Testing Library queries such as `getAllByRole('link')` plus `href` checks are encouraged.

## 11. Out of scope

- `/sales/:flashSaleId` redesign or Tailwind migration (#124)
- AuthN / persisted `userId` (#123)
- Global navigation shell (#127)
- Shared Tailwind UI primitives (#128)
- Client-side filtering / search / sorting / pagination
- Client-side derivation of sale status
- Product fetching beyond the nested catalog response
- Advanced date formatting / localization infrastructure
- Active-state conversion polish beyond the status badge (#124 / #128)
- Purchase history UI / `myPurchases` (#125 / #126)
- Purchase / Redis contract changes
- Cache invalidation after buy (#129)
- Playwright E2E journey expansion (#130)
- Folding this work into EPIC-01 or #118

## 12. Definition of Done

- [ ] `/` shows the catalog (not instructional-only landing)
- [ ] Users can discover sales without knowing a `flashSaleId`
- [ ] Each sale renders the correct status label and corresponding badge color mapping; each sale’s whole card links to detail
- [ ] Initial loading / empty / error + retry implemented per state precedence
- [ ] Responsive 1–2–3 column UI with Tailwind in `apps/web`
- [ ] Description null/empty rules honored
- [ ] Vitest/MSW acceptance matrix covered; stable `data-testid`s present; cards identifiable by `href` and/or accessible name
- [ ] **Existing `/sales/:flashSaleId` behavior remains unchanged**
- [ ] **All existing tests continue passing** (update only tests that asserted the old instructional landing at `/`)
- [ ] No AuthN, nav shell, shared primitives, purchase/Redis, or EPIC-01/#118 changes

## Locked decisions summary

| Area            | Decision                                                                        |
| --------------- | ------------------------------------------------------------------------------- |
| Approach        | Thin feature slice: page + hook + card + badge                                  |
| Status UX       | Colored text badge only; consistent card chrome; API-owned status               |
| Badge colors    | Upcoming amber, Active green, Sold Out red, Ended gray                          |
| Active emphasis | Deferred to #124 / #128                                                         |
| Navigation      | Whole card is a link; no nested controls                                        |
| Layout          | Responsive grid 1 / 2 / 3 columns                                               |
| Ordering        | Display API order; no client sort/filter/page (#121 returns `startsAt ASC`)     |
| Product data    | Nested `product` from `flashSales` only                                         |
| Types           | `CatalogFlashSale` when detail `FlashSale` lacks `product`                      |
| Loading         | Initial loading only; refetch does not flip back to loading UI                  |
| Retry           | Query `refetch` only                                                            |
| Operation name  | `FlashSales` (mirrors existing `FlashSale` / `MyPurchase` convention)           |
| Tailwind        | Introduce via existing Vite/Tailwind conventions if any; catalog-only consumers |
| Detail page     | Untouched                                                                       |
| Scope framing   | Separate EPIC-10 ticket; not EPIC-01 / #118                                     |
