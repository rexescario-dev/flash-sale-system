# #128 — Standardize shared Tailwind UI primitives

**Date:** 2026-07-31  
**Issue:** [#128](https://github.com/rexescario-dev/flash-sale-system/issues/128)  
**Epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10)  
**Status:** Design approved (chat)  
**Base:** `main` @ `ebde480+` (#134 merged)

## Goal

Extract repeated Tailwind presentation patterns into at most four small, domain-agnostic primitives. Prefer extract-as-patterns-emerge; do not invent a design system.

## Locked decisions

| Decision   | Choice                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------- |
| Scope      | Moderate — ≤4 shared components                                                          |
| Error UX   | Shared `ErrorState` for page-load failures only; keep `RequestErrorBanner` feature-local |
| Location   | `apps/web/src/components/ui/`                                                            |
| Approach   | Direct extract + migrate in one PR series                                                |
| Visual     | No redesign — preserve existing appearance except unavoidable class dedup                |
| CSS / #134 | Do not reopen CSS AC; Tailwind v4 already resolved vendor conflicts                      |

## Principle

> Shared primitives provide presentation only. They must not encode feature-specific copy or behavior. Pages/features own text, retry callbacks, navigation, and business logic.

## Shared primitives

### Layout

```text
apps/web/src/components/ui/
  Button.tsx
  Card.tsx
  ErrorState.tsx
  PageHeader.tsx
```

Optional barrel `index.ts` only if it matches existing import style; otherwise direct file imports are fine.

### `Button`

- Native `<button>`; forward standard button props (`type`, `disabled`, `onClick`, `className`, `data-testid`, …).
- `variant`: `'primary' | 'secondary'` only.
  - `primary`: emerald fill (`rounded bg-emerald-700 … text-white`, `disabled:opacity-50`).
  - `secondary`: text/ghost (`rounded … text-emerald-800`).
- No `size` enum. No `fullWidth` prop — layout via `className` (e.g. `w-full`, `disabled:cursor-not-allowed`).
- Collapse padding to the dominant compact primary (`px-3 py-1.5 text-sm font-semibold`).

### `Card`

- Renders a `div` only — no `as` / polymorphism.
- Base surface: `rounded-lg border border-emerald-900/15 bg-white/70 p-4`.
- Accept `className` + children + other div props for hover/shadow extras.
- Semantic wrappers stay outside (`<Link>`, `<article>`).

### `PageHeader`

- Props: `eyebrow: string`, `title: string`, `description: string`.
- Owns eyebrow / title / lede typography and spacing from Catalog/Purchases.
- Does **not** own `<main>`, max-width, or `IdentityStrip`.

### `ErrorState`

- Props: `title: string`, `message: string`, `onRetry: () => void`, plus standard div props (`data-testid`, `className`, …).
- Neutral page-load failure panel (`rounded-md bg-white/70 p-4`, `role="alert"`).
- Retry uses shared `Button` (`primary`).
- Used by CatalogPage and PurchasesPage only.

## Call-site map

| Consumer                       | Change                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `CatalogPage`                  | `PageHeader` + `ErrorState`; keep main / IdentityStrip / loading / empty / grid                                         |
| `PurchasesPage`                | Same header + error pattern; guest / empty / list stay local                                                            |
| `FlashSaleCard`                | `<Link><Card className={hover…}>…</Card></Link>`                                                                        |
| `PurchaseHistoryPanel`         | `<article><Card>…</Card></article>` (or equivalent outer semantic wrapper)                                              |
| `IdentityStrip`                | Shared `Button` where actions already match primary/secondary; leave genuine link-style actions (e.g. Change) unchanged |
| `PurchaseControls`             | Primary `Button` for Buy; `className` for `w-full` / disabled cursor                                                    |
| `RequestErrorBanner`           | May reuse `Button` for retry; must not wrap/become `ErrorState`                                                         |
| FlashSalePage / nav / NotFound | Untouched structurally                                                                                                  |

## Keep feature-local

`FlashSaleCard`, `PurchaseHistoryPanel`, `SaleStatusBadge`, `StockBar`, purchase outcome/error banners, sale-specific actions and business-state rendering.

## Do not extract

Spinner, Skeleton, EmptyState, StockIndicator, generic Badge, anything with a single consumer.

## Testing

- Light smoke/unit tests for the four primitives.
- Existing Catalog / Purchases / Identity / Flash Sale tests as regression coverage.
- No snapshots; no Storybook.

## Out of scope

- Full design system / Storybook
- Visual redesign
- Reopening CSS AC from #134
- AuthN, nav redesign, API/cache changes
- Merging `RequestErrorBanner` into `ErrorState`

## Acceptance criteria (#128)

- [ ] Repeated patterns componentized where it reduces duplication
- [ ] Tailwind-based; support required states
- [ ] No unnecessary abstractions

## Verification

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```
