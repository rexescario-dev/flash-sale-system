# #134 — Address #122 catalog code-review follow-ups

**Date:** 2026-07-31  
**Issue:** [#134](https://github.com/rexescario-dev/flash-sale-system/issues/134)  
**Epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10)  
**Status:** Design approved (chat)  
**Base:** `main` @ `aaada40+` (Tailwind v4 migration merged)

## Goal

Close remaining #122 catalog review debt on current `main` without expanding into #128 or Purchases retry cleanup.

## Re-scoped acceptance (post-#133)

| Original AC                                         | Disposition                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| Timer-based mid-retry assertion (`setTimeout(250)`) | **Still open** — replace with deferred/release Promise gate            |
| Global `h1` / `button` vs catalog utilities         | **Closed by the Tailwind v4 migration** — document + lightweight guard |
| Empty `.sm:px-6` vendor stub                        | **N/A** — vendor bridge removed by the Tailwind v4 migration           |
| Assert stock text on CatalogPage success path       | **Still open**                                                         |
| `FlashSaleCard` `trim()` vs locked `null` / `""`    | **Keep as documented enhancement** + whitespace-only unit test         |

### CSS conflict (explicit)

> Original CSS review item is closed by the Tailwind v4 migration. That migration removed the vendor bridge, leaving only global `:root`/`body` styles; no catalog-local CSS changes are required.

Catalog continues to rely on Tailwind utility classes rather than custom CSS.

## Approach

**Catalog-only deferred gate** (Approach 1). No shared retry helper. No Purchases retry changes. No production CSS changes.

## Design

### Retry gate (`CatalogPage.retry.test.tsx`)

1. First MSW `FlashSales` response returns GraphQL errors.
2. Second response awaits an unresolved Promise (hold gate).
3. Click retry.
4. While held: assert error UI still visible; success UI (catalog cards / sale link) **not** yet rendered. Do **not** assert “no loading.” Do **not** require a request-count assertion.
5. Release the gate; assert success UI appears.

Pattern reference: deferred `resolve` in `FlashSalePage.test.tsx` (“never shows SUCCESS before the backend returns”).

### Stock assertion (`CatalogPage.test.tsx`)

On the existing success-path test, assert the user-visible stock string from the UI contract:

`{remainingStock} / {totalStock} remaining`

Current fixtures render both cards with **`2 / 5 remaining`**.

### Description `trim()` enhancement (`FlashSaleCard`)

`FlashSaleCard.tsx` is expected to remain unchanged. Document whitespace-only omission as extending #122 (`null` / `""` omitted). Add a **distinct** unit test (separate from null/`""` cases).

### CSS guard (narrow)

New vitest that fails if:

1. `apps/web/src/styles.css` contains **element selectors** targeting `h1` or `button`, ignoring occurrences in class names or comments (implementation chooses simplest detection).
2. Any file matching `apps/web/src/**/catalog*.css` exists.

No new catalog CSS files. No changes to production `styles.css` expected.

### Docs / issue note

- Spec/plan note (this file + plan).
- GitHub comment on #134 during implementation summarizing CSS disposition.

## Out of scope

- Shared MSW retry-gate helper
- `PurchasesPage.retry.test.tsx` timer cleanup
- #128 shared Tailwind primitives
- Catalog redesign / new components
- AuthN / nav work

## Verification

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

**Production behavior:** Unchanged except the documented whitespace-only description omission.
