# #133 — Replace temporary Tailwind bridge with official Tailwind v4

**Date:** 2026-07-30  
**Issue:** [#133](https://github.com/rexescario-dev/flash-sale-system/issues/133)  
**Epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10)  
**Status:** Design approved; implementation plan written

## Goal

Replace the temporary `file:vendor/tailwindcss*` bridge with official Tailwind v4 packages, enable real preflight, and make Compose/`pnpm install` work without any local vendor bridge.

## Context

Issue #122 shipped a local bridge because npm registry access was blocked:

| Feature                 | Bridge behavior        |
| ----------------------- | ---------------------- |
| Vite plugin             | No-op                  |
| `@import "tailwindcss"` | Static handwritten CSS |
| Utility generation      | Limited subset         |
| Preflight               | Disabled               |

`#130` later added bridge utilities (`md:flex` after `.hidden`) so CustomerNav `hidden md:flex` worked. Official Tailwind generates those utilities correctly; the handwritten order hack goes away with the bridge.

Compose `deps` currently copies only package manifests, then runs `pnpm install --frozen-lockfile`. That fails with `ENOENT` on `vendor/tailwindcss-vite` while `file:` deps exist. Removing the bridge removes the need for any vendor `COPY`.

## Approach

**Single PR — official packages + CSS trim (Approach 1).**

Do not stage a temporary preflight-off escape hatch. Do not invent scoped prose wrappers unless a real regression requires them during verification.

## Design

### Dependencies

- Replace the bridge packages with the official Tailwind v4 packages (`tailwindcss` and `@tailwindcss/vite`) using the current compatible v4 release.
- Delete `apps/web/vendor/**`.
- Regenerate `pnpm-lock.yaml` so CI and Compose resolve only registry packages.
- Keep existing `vite.config.ts` registration: `tailwindcss()` from `@tailwindcss/vite`.

### Docker / Compose

- After the package swap, the existing Docker build flow should work without any vendor-specific handling.
- **Acceptance:** `docker compose build web` succeeds without requiring a vendor directory.

### CSS and preflight

- Keep `@import 'tailwindcss';` so the real plugin resolves and generates utilities.
- **Tailwind preflight remains enabled.** Regressions are resolved by utilities or narrowly scoped CSS, not by disabling preflight.
- Remove or narrow legacy global element styling that conflicts with Tailwind preflight. Preserve only intentional application-level globals (for example `:root` color/background/font and `body` layout chrome).
- Convert `NotFoundPage` (and any other callers found during implementation) from bridge-era presentation helpers to utilities.
- Remove legacy presentation helpers that become unused after the migration (for example, `.shell`, `.eyebrow`, `.lede`, `.muted`). Do not force churn on helpers that remain legitimately used.
- Do **not** invent scoped prose wrappers (`.product-detail`, `.prose`, etc.) unless verification surfaces a real need.

### Behavior to preserve

- CustomerNav: links visible at desktop widths; mobile menu toggle works.
- Catalog, sale detail, purchases, and identity flows retain their existing appearance and behavior.
- No expansion into #128 (shared primitives) or #134 (catalog review follow-ups) unless they block this migration.

### Out of scope

- Catalog / sale UX redesign
- Shared Tailwind primitive extraction (#128)
- Unrelated CSS refactors
- Disabling preflight

## Verification

```bash
pnpm install
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web build
```

Behavioral checks:

- `/`, `/sales/:flashSaleId`, `/purchases`, and 404 render correctly under real preflight
- CustomerNav desktop links visible; mobile menu toggle works
- Identity form controls remain usable
- Host e2e smoke green (alt-ports OK if Compose images are stale)
- `docker compose build web` succeeds without requiring a vendor directory
- Production build contains Tailwind-generated CSS rather than the handwritten bridge stylesheet

## Success criteria (maps to #133 AC)

- [ ] No `file:` Tailwind dependencies remain
- [ ] Official `tailwindcss` and `@tailwindcss/vite` installed; lockfile regenerated
- [ ] Vendor bridge files removed
- [ ] No code or configuration references `apps/web/vendor/tailwindcss*`
- [ ] Web builds using the official Tailwind Vite plugin; `@import "tailwindcss"` resolves
- [ ] Preflight enabled; any styling fixes use utilities or narrowly scoped CSS, not preflight-off
- [ ] CustomerNav and customer pages have no unintended regressions
- [ ] Web unit/typecheck/lint/build pass; e2e smoke pass; Compose web build succeeds without vendor
