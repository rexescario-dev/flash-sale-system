# Issue #127 — Global Customer Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [#127](https://github.com/rexescario-dev/flash-sale-system/issues/127) — global customer nav (brand, Flash Sales, My Purchases, compact identity status, mobile disclosure) on primary customer routes via a layout shell.

**Architecture:** React Router layout route `CustomerLayout` → `CustomerNav` + `<Outlet />`. NotFound stays outside the shell. Compact `IdentityStatus` is read-only; pages keep `IdentityStrip` / purchase-surface editing. No new identity state.

**Tech Stack:** React 19, React Router 7, Vitest + Testing Library, existing Tailwind bridge in `apps/web`.

**Spec:** [docs/superpowers/specs/2026-07-30-issue-127-global-customer-navigation-design.md](../specs/2026-07-30-issue-127-global-customer-navigation-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Baseline:** `origin/main` @ `d474d1e` (#126 via [PR #139](https://github.com/rexescario-dev/flash-sale-system/pull/139)).

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Out of scope:** Auth menus; admin nav; header identity editing; #128 primitives; #129 Redis; #130 Playwright; #133/#134; required Escape-to-close.

**Hard invariants (locked):**

1. Customer shell on `/`, `/sales/:flashSaleId`, `/purchases` only; `*` NotFound has **no** `customer-nav`.
2. Labels: **Flash Sale Store** · **Flash Sales** · **My Purchases**.
3. **Flash Sales** section-active for `pathname === '/'` **or** `pathname.startsWith('/sales/')`; **My Purchases** for `/purchases`. Observable contract: `aria-current="page"`.
4. Active-state logic must implement the section table above. Naive `NavLink` matching for `to="/"` is unsafe (nearly every path would match). Implementation approach is not prescribed beyond observable behavior.
5. Identity in nav is **read-only**; copy must match `IdentityStrip`: `Shopping as Guest` / `Shopping as {userId}`. No Identify / Change / Save in nav. Seed/clear identity in tests via `identityStorage.set(...)` / `identityStorage.clear()` — never hard-code the storage key; prefer the identity abstraction over `localStorage.clear()`.
6. Mobile: hamburger disclosure; closed by default; closes after navigation. Escape is optional and **not** required in tests.
7. Do not wrap `<Outlet />` in `<main>`; ensure existing page `<main>` landmarks remain unchanged; do not rename sale `back-to-products` testid; do not pull #128/#129/#130.

**Implementation convention:**

> The design spec is authoritative for behavior. The **existing codebase** is authoritative for conventions (emerald Tailwind, IdentityProvider wrappers in tests, router test MSW patterns). Prefer minimal diffs. Code blocks below are **examples** (one acceptable approach), not mandatory implementations — fit project conventions as long as invariants and test contracts hold.

---

## File map

| Path                                             | Responsibility                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `apps/web/src/features/nav/IdentityStatus.tsx`   | Read-only identity copy (`useUserIdentity`)                                            |
| `apps/web/src/features/nav/CustomerNav.tsx`      | Brand, section links, active state, desktop/mobile chrome, hosts IdentityStatus        |
| `apps/web/src/features/nav/CustomerNav.test.tsx` | Links, aria-current, identity copy, no edit controls, mobile open/close/nav            |
| `apps/web/src/app/CustomerLayout.tsx`            | `CustomerNav` + `<Outlet />` only                                                      |
| `apps/web/src/app/router.tsx`                    | Nest customer routes under layout; `*` outside                                         |
| `apps/web/src/app/router.test.tsx`               | **Extend** existing cases — shell on customer routes incl. `/sales/:id`; no nav on 404 |

`IdentityStatus` as a separate file is the plan default (easy unit focus); colocating it privately inside `CustomerNav.tsx` also satisfies the spec — pick one and stay consistent.

---

## Task flow

```text
Task 1  →  IdentityStatus + CustomerNav (TDD)
Task 2  →  CustomerLayout + router nesting + router tests (TDD)
Task 3  →  Full web verification
```

---

### Task 1: `IdentityStatus` + `CustomerNav`

**Files:**

- Create: `apps/web/src/features/nav/IdentityStatus.tsx`
- Create: `apps/web/src/features/nav/CustomerNav.tsx`
- Create: `apps/web/src/features/nav/CustomerNav.test.tsx`

- [ ] **Step 1: Write the failing CustomerNav tests**

Example test file (structure required; helpers/assertions may match local style):

```tsx
// apps/web/src/features/nav/CustomerNav.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { IdentityProvider } from '../identity/IdentityProvider';
import { identityStorage } from '../identity/identity-storage';
import { CustomerNav } from './CustomerNav';

function renderNav(path: string) {
  return render(
    <IdentityProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            element={
              <>
                <CustomerNav />
                <div data-testid="outlet-stub">outlet</div>
              </>
            }
            path="*"
          />
        </Routes>
      </MemoryRouter>
    </IdentityProvider>,
  );
}

afterEach(() => {
  identityStorage.clear();
});

describe('CustomerNav', () => {
  it('exposes brand and section links with correct hrefs', () => {
    renderNav('/');
    expect(screen.getByTestId('customer-nav')).toBeInTheDocument();
    expect(screen.getByTestId('nav-brand')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('nav-flash-sales')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('nav-purchases')).toHaveAttribute('href', '/purchases');
    expect(screen.getByTestId('nav-brand')).toHaveTextContent('Flash Sale Store');
    expect(screen.getByTestId('nav-flash-sales')).toHaveTextContent('Flash Sales');
    expect(screen.getByTestId('nav-purchases')).toHaveTextContent('My Purchases');
  });

  it('marks Flash Sales current on /', () => {
    renderNav('/');
    expect(screen.getByTestId('nav-flash-sales')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-purchases')).not.toHaveAttribute('aria-current');
  });

  it('marks Flash Sales current on /sales/:id', () => {
    renderNav('/sales/sale-1');
    expect(screen.getByTestId('nav-flash-sales')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-purchases')).not.toHaveAttribute('aria-current');
  });

  it('marks My Purchases current on /purchases', () => {
    renderNav('/purchases');
    expect(screen.getByTestId('nav-purchases')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-flash-sales')).not.toHaveAttribute('aria-current');
  });

  it('shows Guest identity copy with no edit controls', () => {
    renderNav('/');
    expect(screen.getByTestId('nav-identity-status')).toHaveTextContent('Shopping as Guest');
    expect(screen.queryByTestId('identity-identify')).not.toBeInTheDocument();
    expect(screen.queryByTestId('identity-change')).not.toBeInTheDocument();
    expect(screen.queryByTestId('identity-save')).not.toBeInTheDocument();
  });

  it('shows committed identity copy from IdentityProvider', () => {
    identityStorage.set('buyer-nav');
    renderNav('/');
    expect(screen.getByTestId('nav-identity-status')).toHaveTextContent('Shopping as buyer-nav');
  });

  it('opens and closes the mobile disclosure', async () => {
    const user = userEvent.setup();
    renderNav('/');

    const button = screen.getByTestId('nav-menu-button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('nav-menu')).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('nav-menu')).not.toBeInTheDocument();
  });

  it('closes the disclosure after navigation', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              element={
                <>
                  <CustomerNav />
                  <div data-testid="page">home</div>
                </>
              }
              path="/"
            />
            <Route
              element={
                <>
                  <CustomerNav />
                  <div data-testid="page">purchases</div>
                </>
              }
              path="/purchases"
            />
          </Routes>
        </MemoryRouter>
      </IdentityProvider>,
    );

    await user.click(screen.getByTestId('nav-menu-button'));
    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();

    await user.click(screen.getByTestId('nav-purchases'));
    expect(screen.getByTestId('page')).toHaveTextContent('purchases');
    expect(screen.getByTestId('nav-menu-button')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('nav-menu')).not.toBeInTheDocument();
  });
});
```

**Responsive markup constraints (behavior only):**

- Spec testids from design §6 must exist; **no duplicate** canonical section-link testids in the DOM at once.
- When the disclosure is open, `nav-menu` is present; when closed, `queryByTestId('nav-menu')` is null.
- Desktop and mobile may share one link set or use separate markup — implementer’s choice, as long as the constraints above hold and links remain accessible.

- [ ] **Step 2: Run tests — expect FAIL**

Run:

```bash
cd apps/web && pnpm exec vitest run src/features/nav/CustomerNav.test.tsx
```

Expected: FAIL (module / component not found).

- [ ] **Step 3: Implement IdentityStatus + CustomerNav**

Example implementation (one acceptable approach):

```tsx
// apps/web/src/features/nav/IdentityStatus.tsx
import { useUserIdentity } from '../identity/IdentityProvider';

export function IdentityStatus() {
  const { userId } = useUserIdentity();
  const text = userId === null ? 'Shopping as Guest' : `Shopping as ${userId}`;
  return (
    <p className="text-sm text-emerald-900" data-testid="nav-identity-status">
      {text}
    </p>
  );
}
```

```tsx
// apps/web/src/features/nav/CustomerNav.tsx
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { IdentityStatus } from './IdentityStatus';

function flashSalesActive(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/sales/');
}

function purchasesActive(pathname: string): boolean {
  return pathname === '/purchases' || pathname.startsWith('/purchases/');
}

export function CustomerNav() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const salesCurrent = flashSalesActive(pathname);
  const purchasesCurrent = purchasesActive(pathname);

  function closeMenu() {
    setMenuOpen(false);
  }

  const linkClass = (active: boolean) =>
    [
      'text-sm font-semibold',
      active
        ? 'text-emerald-900 underline underline-offset-4'
        : 'text-emerald-800/80 hover:text-emerald-950',
    ].join(' ');

  return (
    <nav className="border-b border-emerald-100 bg-emerald-50/80" data-testid="customer-nav">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <button
          aria-controls="customer-nav-menu"
          aria-expanded={menuOpen}
          className="rounded border border-emerald-200 px-2 py-1 text-sm font-semibold text-emerald-900 md:hidden"
          data-testid="nav-menu-button"
          onClick={() => {
            setMenuOpen((open) => !open);
          }}
          type="button"
        >
          Menu
        </button>

        <Link
          className="text-base font-bold text-emerald-950"
          data-testid="nav-brand"
          onClick={closeMenu}
          to="/"
        >
          Flash Sale Store
        </Link>

        <div
          className={[
            'w-full flex-col gap-2 md:flex md:w-auto md:flex-1 md:flex-row md:items-center md:gap-4',
            menuOpen ? 'flex' : 'hidden md:flex',
          ].join(' ')}
          data-testid={menuOpen ? 'nav-menu' : undefined}
          id="customer-nav-menu"
        >
          <NavLink
            aria-current={salesCurrent ? 'page' : undefined}
            className={linkClass(salesCurrent)}
            data-testid="nav-flash-sales"
            onClick={closeMenu}
            to="/"
          >
            Flash Sales
          </NavLink>
          <NavLink
            aria-current={purchasesCurrent ? 'page' : undefined}
            className={linkClass(purchasesCurrent)}
            data-testid="nav-purchases"
            onClick={closeMenu}
            to="/purchases"
          >
            My Purchases
          </NavLink>
        </div>

        <div className="ml-auto">
          <IdentityStatus />
        </div>
      </div>
    </nav>
  );
}
```

Notes:

- Pure pathname helpers (`flashSalesActive` / `purchasesActive`) outside the component are encouraged — easy to reason about and optionally unit-test.
- Meet the `aria-current="page"` contract however you like (`NavLink`, `Link`, `useLocation`, etc.).
- Match Catalog emerald Tailwind language; exact classes are not prescribed.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/web && pnpm exec vitest run src/features/nav/CustomerNav.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/web/src/features/nav/IdentityStatus.tsx apps/web/src/features/nav/CustomerNav.tsx apps/web/src/features/nav/CustomerNav.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add CustomerNav with read-only identity status

EOF
)"
```

---

### Task 2: `CustomerLayout` + router nesting

**Files:**

- Create: `apps/web/src/app/CustomerLayout.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/router.test.tsx`

- [ ] **Step 1: Extend existing router tests (do not replace them)**

Keep current page assertions and MSW catalog stub. **Add** to the existing cases:

```tsx
// In 'renders catalog at /':
expect(screen.getByTestId('customer-nav')).toBeInTheDocument();

// In 'renders flash sale page shell at /sales/:flashSaleId':
expect(screen.getByTestId('customer-nav')).toBeInTheDocument();
expect(screen.getByTestId('nav-flash-sales')).toHaveAttribute('aria-current', 'page');

// In 'renders purchases page at /purchases':
expect(screen.getByTestId('customer-nav')).toBeInTheDocument();
expect(screen.getByTestId('nav-purchases')).toHaveAttribute('aria-current', 'page');

// In 'renders not found for unknown routes':
expect(screen.queryByTestId('customer-nav')).not.toBeInTheDocument();
```

- [ ] **Step 2: Run router tests — expect FAIL on missing `customer-nav`**

```bash
cd apps/web && pnpm exec vitest run src/app/router.test.tsx
```

Expected: FAIL — `customer-nav` not found on customer routes.

- [ ] **Step 3: Implement layout + nest routes**

Example implementation (one acceptable approach):

```tsx
// apps/web/src/app/CustomerLayout.tsx
import { Outlet } from 'react-router-dom';

import { CustomerNav } from '../features/nav/CustomerNav';

export function CustomerLayout() {
  return (
    <>
      <CustomerNav />
      <Outlet />
    </>
  );
}
```

```tsx
// apps/web/src/app/router.tsx
import { Route, Routes } from 'react-router-dom';

import { CatalogPage } from '../pages/CatalogPage';
import { FlashSalePage } from '../pages/FlashSalePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PurchasesPage } from '../pages/PurchasesPage';
import { CustomerLayout } from './CustomerLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route element={<CatalogPage />} path="/" />
        <Route element={<FlashSalePage />} path="/sales/:flashSaleId" />
        <Route element={<PurchasesPage />} path="/purchases" />
      </Route>
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}
```

Ensure `CustomerLayout` does **not** wrap `<Outlet />` in `<main>` — page-owned `<main>` landmarks must remain unchanged.

- [ ] **Step 4: Run router + nav tests — expect PASS**

```bash
cd apps/web && pnpm exec vitest run src/app/router.test.tsx src/features/nav/CustomerNav.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/web/src/app/CustomerLayout.tsx apps/web/src/app/router.tsx apps/web/src/app/router.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): nest customer routes under CustomerLayout shell

EOF
)"
```

---

### Task 3: Full web verification

**Files:** none new (regression only)

- [ ] **Step 1: Run full web suite**

```bash
cd /home/rex/Project/test/app/apps/web && pnpm test && pnpm typecheck && pnpm lint
```

Expected: all tests PASS; typecheck clean; lint clean.

If Catalog/Sale/Purchases tests fail only because of duplicate headings or unexpected nav text, fix nav copy/structure — do **not** remove page `IdentityStrip`s, change sale back-link testids, or introduce a layout-level `<main>`.

- [ ] **Step 2: Manual smoke (optional)**

`pnpm --filter web dev` — confirm:

- `/`, `/sales/:id`, `/purchases` show nav; unknown path has no nav
- Identify still works via page strip; header status updates after Save
- Resize desktop ↔ mobile while menu closed/open (disclosure should not leave stale open state awkwardly)

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add apps/web/src/features/nav apps/web/src/app/CustomerLayout.tsx apps/web/src/app/router.tsx apps/web/src/app/router.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add global customer navigation shell

EOF
)"
```

Also include the design/plan docs in a docs commit **only when the user asks to commit**.

---

## Self-review (plan vs spec)

| Spec requirement                                  | Task |
| ------------------------------------------------- | ---- |
| Layout route shell; 404 outside                   | 2    |
| Brand + Flash Sales + My Purchases labels         | 1    |
| Compact read-only IdentityStatus; strip unchanged | 1    |
| Section-active Flash Sales on `/` + `/sales/:id`  | 1, 2 |
| Mobile hamburger; close on navigate               | 1    |
| Stable testids §6                                 | 1, 2 |
| No new identity state; match IdentityStrip copy   | 1    |
| Page-owned `<main>` landmarks preserved           | 2, 3 |
| No #128/#129/#130 / Escape requirement            | all  |
| Full web green                                    | 3    |

No TBDs. Code snippets are illustrative. Observable contracts (`aria-current`, testids, identity copy, shell vs 404) are the source of truth.
