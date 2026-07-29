# Issue #122 — Flash-Sale Catalog Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [#122](https://github.com/rexescario-dev/flash-sale-system/issues/122) — replace `/` instructional landing with a Tailwind catalog of `flashSales` (nested product, status badges, whole-card links) while leaving `/sales/:flashSaleId` unchanged.

**Architecture:** Thin feature slice in `apps/web`: `CatalogPage` + `useFlashSales` + `FlashSaleCard` + `SaleStatusBadge`. Consume #121 `flashSales` only (no product side-fetch, no client sort/filter/page, no local status derivation). Introduce Tailwind under `apps/web` for catalog consumers only.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, graphql-request, Vitest + Testing Library + MSW, Tailwind CSS (Vite plugin — no prior setup in repo).

**Spec:** [docs/superpowers/specs/2026-07-30-issue-122-flash-sale-catalog-home-design.md](../specs/2026-07-30-issue-122-flash-sale-catalog-home-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Baseline:** `origin/main` including #121 (`flashSales` + nested `product` via PRs #131/#132). Do not fold into EPIC-01 or #118.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Out of scope:** Detail Tailwind/#124; AuthN/`userId` (#123); nav (#127); shared primitives (#128); client filter/search/sort/page; status derivation; purchase/Redis; Playwright #130.

**Hard invariants (locked):**

1. State precedence: **initial loading** → error+retry → empty → grid. Refetches, including retry, do **not** replace success/error with the loading UI.
2. Status is API-owned; badges map `UPCOMING`/`ACTIVE`/`SOLD_OUT`/`ENDED` only.
3. Description: `null` / `""` omitted; non-empty rendered.
4. Whole card = `Link` to `/sales/:flashSaleId`; no nested controls.
5. Display API order; no client sort/filter/page.
6. `CatalogFlashSale` when detail `FlashSale` lacks `product` — do not break detail-page types.
7. Update only tests that asserted the old instructional landing; existing `/sales/:flashSaleId` behavior unchanged.
8. Tailwind must not silently regress detail-page styling (preflight is global — verify and isolate/disable if needed).

**Implementation convention (authoritative for _how_ to edit):**

> The design spec is authoritative for behavior. The **existing codebase** is authoritative for conventions. Inspect before replacing. Preserve existing configuration and tests unless #122 specifically requires changing them. Prefer minimal diffs over wholesale file rewrites.

---

## File map

| Path                                                                | Responsibility                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/web/package.json`                                             | Add Tailwind + `@tailwindcss/vite` (devDeps)           |
| `apps/web/vite.config.ts`                                           | Register `@tailwindcss/vite` plugin                    |
| `apps/web/src/styles.css`                                           | Keep existing detail CSS; add `@import "tailwindcss";` |
| `apps/web/src/graphql/types.ts`                                     | Add `Product` + `CatalogFlashSale`                     |
| `apps/web/src/graphql/operations/flashSales.ts`                     | `FlashSales` query + `fetchFlashSales`                 |
| `apps/web/src/hooks/useFlashSales.ts`                               | TanStack Query hook; key `['flashSales']`              |
| `apps/web/src/features/catalog/components/SaleStatusBadge.tsx`      | Status → label/color                                   |
| `apps/web/src/features/catalog/components/SaleStatusBadge.test.tsx` | Four badge mappings                                    |
| `apps/web/src/features/catalog/components/FlashSaleCard.tsx`        | Whole-card link + fields                               |
| `apps/web/src/features/catalog/components/FlashSaleCard.test.tsx`   | Description rules + href                               |
| `apps/web/src/pages/CatalogPage.tsx`                                | `/` page; state machine + grid                         |
| `apps/web/src/pages/CatalogPage.test.tsx`                           | Loading/empty/error+retry/success MSW                  |
| `apps/web/src/app/router.tsx`                                       | `/` → `CatalogPage`                                    |
| `apps/web/src/pages/LandingPage.tsx`                                | Delete (or leave unused — prefer delete)               |
| `apps/web/src/App.test.tsx`                                         | Assert catalog, not instructional landing              |
| `apps/web/src/app/router.test.tsx`                                  | Assert catalog at `/`; detail unchanged                |

---

## Task flow

```text
Task 1  →  Tailwind Vite setup (apps/web only)
Task 2  →  Types + flashSales GraphQL operation
Task 3  →  useFlashSales hook
Task 4  →  SaleStatusBadge (TDD)
Task 5  →  FlashSaleCard (TDD)
Task 6  →  CatalogPage + MSW states (TDD)
Task 7  →  Router + regress landing tests
Task 8  →  Full verification
```

---

### Task 1: Tailwind in `apps/web`

**Scope note:** Prefer official npm `tailwindcss` + `@tailwindcss/vite`. If registry access is blocked, a temporary local `file:vendor/tailwindcss*` bridge may unblock #122 catalog work only — treat that as **development infrastructure**, not a catalog acceptance criterion. Official package swap, lockfile regeneration, vendor removal, and real Tailwind v4 / preflight (including detail-page) validation are owned by **#133**, not #122.

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Install Tailwind (Vite plugin) from repo root**

Run (from `/home/rex/Project/test/app` or worktree root):

```bash
pnpm --filter web add -D tailwindcss @tailwindcss/vite
```

Expected: `apps/web/package.json` lists `tailwindcss` and `@tailwindcss/vite` under `devDependencies`.

- [ ] **Step 2: Register the Vite plugin (minimal edit)**

**Inspect** `apps/web/vite.config.ts` first. Add `tailwindcss()` to the existing `plugins` array and preserve **all** existing Vite/Vitest configuration (aliases, coverage, env, test setup, build, other plugins) unchanged.

Illustrative minimal change (do **not** rewrite unrelated keys):

```ts
import tailwindcss from '@tailwindcss/vite';
// ...existing imports...

export default defineConfig({
  plugins: [react(), tailwindcss()], // keep any other existing plugins
  // ...preserve server, test, build, resolve, etc. as-is...
});
```

- [ ] **Step 3: Import Tailwind without removing detail-page CSS**

Prepend to `apps/web/src/styles.css` (keep all existing rules below):

```css
@import 'tailwindcss';
```

Leave the existing `:root`, `.shell`, buttons, etc. intact. **Do not** intentionally edit detail-page CSS in #122.

- [ ] **Step 4: Detail-page / preflight regression check (hard)**

Tailwind v4 preflight is **global**. After enabling Tailwind:

1. Run existing detail-page tests (`FlashSalePage.test.tsx` and related):

```bash
pnpm --filter web exec vitest run src/pages/FlashSalePage.test.tsx src/app/router.test.tsx
pnpm --filter web typecheck
```

2. If visual/layout regressions appear (headings, buttons, inputs, links, lists), **do not accept a silent detail regression**. Decide the isolation approach **after** inspecting the installed Tailwind/`@tailwindcss/vite` docs and this app's CSS architecture — do not assume a Tailwind v3-style config pattern. Isolate or disable preflight using the mechanism supported by the installed version, keep catalog utilities functional, and document why the chosen approach was necessary.

Expected: existing detail tests PASS; no intentional detail CSS rewrite.

- [ ] **Step 5: Full web sanity (landing still instructional until Task 7)**

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 6: Optional commit** (only if user authorized)

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/vite.config.ts apps/web/src/styles.css pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(web): add Tailwind via Vite plugin for catalog UI

EOF
)"
```

---

### Task 2: Types + `FlashSales` operation

**Files:**

- Modify: `apps/web/src/graphql/types.ts`
- Create: `apps/web/src/graphql/operations/flashSales.ts`
- Create: `apps/web/src/graphql/operations/flashSales.spec.ts`

- [ ] **Step 1: Extend types — inspect and minimally edit**

Inspect `apps/web/src/graphql/types.ts`. Preserve **all** existing exports and the existing detail `FlashSale` shape byte-for-byte. **Add only**:

```ts
export type Product = {
  id: string;
  name: string;
  description: string | null;
};

/** Catalog row — nested product required. Do not weaken detail FlashSale for this. */
export type CatalogFlashSale = {
  id: string;
  endsAt: string;
  product: Product;
  remainingStock: number;
  startsAt: string;
  status: FlashSaleStatus;
  totalStock: number;
};
```

Insert after the existing `FlashSale` type (or at a nearby consistent location). Do **not** rewrite `PurchaseOutcome`, `MyPurchaseResult`, `PurchaseItemResult`, or detail `FlashSale`.

- [ ] **Step 2: Write failing operation smoke test**

Create `apps/web/src/graphql/operations/flashSales.spec.ts`:

```ts
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { graphqlUrl, readGraphqlBody } from '../../test/msw/graphql';
import { server } from '../../test/msw/server';
import { fetchFlashSales } from './flashSales';

afterEach(() => {
  server.resetHandlers();
});

describe('fetchFlashSales', () => {
  it('requests FlashSales and returns catalog rows with nested product', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('FlashSales');
        return HttpResponse.json({
          data: {
            flashSales: [
              {
                id: 'sale-1',
                status: 'ACTIVE',
                remainingStock: 3,
                totalStock: 10,
                startsAt: '2026-01-01T00:00:00.000Z',
                endsAt: '2026-01-02T00:00:00.000Z',
                product: { id: 'p1', name: 'Widget', description: 'Nice' },
              },
            ],
          },
        });
      }),
    );

    const rows = await fetchFlashSales();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.product.name).toBe('Widget');
    expect(rows[0]?.product.description).toBe('Nice');
  });
});
```

- [ ] **Step 3: Run test — expect FAIL (module missing)**

```bash
pnpm --filter web exec vitest run src/graphql/operations/flashSales.spec.ts
```

Expected: FAIL — cannot resolve `./flashSales` or `fetchFlashSales` undefined.

- [ ] **Step 4: Implement operation**

Create `apps/web/src/graphql/operations/flashSales.ts`:

```ts
import { gql } from 'graphql-request';

import type { CatalogFlashSale } from '../types';

import { graphqlClient } from '../client';
import { toRequestError } from '../errors';

const FLASH_SALES_QUERY = gql`
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
`;

type FlashSalesResponse = {
  flashSales: CatalogFlashSale[];
};

export async function fetchFlashSales(): Promise<CatalogFlashSale[]> {
  try {
    const data = await graphqlClient.request<FlashSalesResponse>(FLASH_SALES_QUERY);
    return data.flashSales;
  } catch (error) {
    throw toRequestError(error);
  }
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm --filter web exec vitest run src/graphql/operations/flashSales.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Optional commit**

```bash
git add apps/web/src/graphql/types.ts apps/web/src/graphql/operations/flashSales.ts apps/web/src/graphql/operations/flashSales.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): add FlashSales GraphQL operation and catalog types

EOF
)"
```

---

### Task 3: `useFlashSales` hook

**Files:**

- Create: `apps/web/src/hooks/useFlashSales.ts`

Mirror `useFlashSale` (`apps/web/src/hooks/useFlashSale.ts`).

- [ ] **Step 1: Implement hook**

Create `apps/web/src/hooks/useFlashSales.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { fetchFlashSales } from '../graphql/operations/flashSales';

export function flashSalesQueryKey() {
  return ['flashSales'] as const;
}

export function useFlashSales() {
  return useQuery({
    queryFn: fetchFlashSales,
    queryKey: flashSalesQueryKey(),
  });
}
```

No separate unit test required — covered by `CatalogPage` MSW tests in Task 6. Hook is thin enough that duplicating Query scaffolding here is low value.

- [ ] **Step 2: Optional commit**

```bash
git add apps/web/src/hooks/useFlashSales.ts
git commit -m "$(cat <<'EOF'
feat(web): add useFlashSales query hook

EOF
)"
```

---

### Task 4: `SaleStatusBadge` (TDD)

**Files:**

- Create: `apps/web/src/features/catalog/components/SaleStatusBadge.test.tsx`
- Create: `apps/web/src/features/catalog/components/SaleStatusBadge.tsx`

- [ ] **Step 1: Write failing badge tests**

Create `apps/web/src/features/catalog/components/SaleStatusBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FlashSaleStatus } from '../../../graphql/types';

import { SaleStatusBadge } from './SaleStatusBadge';

const cases: Array<{ status: FlashSaleStatus; label: string; toneHint: RegExp }> = [
  { status: 'UPCOMING', label: 'Upcoming', toneHint: /amber|yellow/i },
  { status: 'ACTIVE', label: 'Active', toneHint: /green|emerald/i },
  { status: 'SOLD_OUT', label: 'Sold Out', toneHint: /red|rose/i },
  { status: 'ENDED', label: 'Ended', toneHint: /neutral|gray|slate|zinc/i },
];

describe('SaleStatusBadge', () => {
  it.each(cases)(
    'maps $status → $label with intended color tone',
    ({ status, label, toneHint }) => {
      render(<SaleStatusBadge status={status} />);
      const badge = screen.getByTestId('sale-status-badge');
      expect(badge).toHaveTextContent(label);
      expect(badge).toHaveAttribute('data-status', status);
      // Spec requires color mapping; allow conventional Tailwind tones (exact class not locked).
      expect(badge.className).toMatch(toneHint);
    },
  );
});
```

Do **not** hard-lock exact classes like `bg-amber-100` unless the team later wants that as an explicit contract. Prefer semantic `data-status` + tone-family assertion.

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter web exec vitest run src/features/catalog/components/SaleStatusBadge.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement badge**

Create `apps/web/src/features/catalog/components/SaleStatusBadge.tsx`:

```tsx
import type { FlashSaleStatus } from '../../../graphql/types';

const BADGE: Record<FlashSaleStatus, { className: string; label: string }> = {
  ACTIVE: {
    className: 'bg-green-100 text-green-800',
    label: 'Active',
  },
  ENDED: {
    className: 'bg-neutral-200 text-neutral-700',
    label: 'Ended',
  },
  SOLD_OUT: {
    className: 'bg-red-100 text-red-800',
    label: 'Sold Out',
  },
  UPCOMING: {
    className: 'bg-amber-100 text-amber-800',
    label: 'Upcoming',
  },
};

type Props = {
  status: FlashSaleStatus;
};

export function SaleStatusBadge({ status }: Props) {
  const { className, label } = BADGE[status];
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${className}`}
      data-status={status}
      data-testid="sale-status-badge"
    >
      {label}
    </span>
  );
}
```

Exact color utility classes above are **suggested**, not locked — adjust to project Tailwind conventions as long as tone-family tests and labels pass.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter web exec vitest run src/features/catalog/components/SaleStatusBadge.test.tsx
```

Expected: PASS (4 cases).

- [ ] **Step 5: Optional commit**

```bash
git add apps/web/src/features/catalog/components/SaleStatusBadge.tsx apps/web/src/features/catalog/components/SaleStatusBadge.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add SaleStatusBadge for catalog status mapping

EOF
)"
```

---

### Task 5: `FlashSaleCard` (TDD)

**Files:**

- Create: `apps/web/src/features/catalog/components/FlashSaleCard.test.tsx`
- Create: `apps/web/src/features/catalog/components/FlashSaleCard.tsx`

- [ ] **Step 1: Write failing card tests**

Create `apps/web/src/features/catalog/components/FlashSaleCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { CatalogFlashSale } from '../../../graphql/types';

import { FlashSaleCard } from './FlashSaleCard';

function sale(overrides: Partial<CatalogFlashSale> = {}): CatalogFlashSale {
  return {
    id: 'sale-42',
    endsAt: '2026-06-02T12:00:00.000Z',
    product: { id: 'p1', name: 'Flash Widget', description: 'A great widget' },
    remainingStock: 4,
    startsAt: '2026-06-01T12:00:00.000Z',
    status: 'ACTIVE',
    totalStock: 20,
    ...overrides,
  };
}

function renderCard(row: CatalogFlashSale) {
  return render(
    <MemoryRouter>
      <FlashSaleCard sale={row} />
    </MemoryRouter>,
  );
}

describe('FlashSaleCard', () => {
  it('links the whole card to /sales/:flashSaleId and shows name + stock', () => {
    renderCard(sale());
    const link = screen.getByRole('link', { name: /flash widget/i });
    expect(link).toHaveAttribute('href', '/sales/sale-42');
    expect(screen.getByTestId('catalog-card')).toBe(link);
    expect(link.querySelector('button, input, select, textarea, [role="button"]')).toBeNull();
    expect(screen.getByText('4 / 20 remaining')).toBeInTheDocument();
    expect(screen.getByText('A great widget')).toBeInTheDocument();
    expect(screen.getByTestId('sale-status-badge')).toHaveTextContent('Active');
  });

  it('omits description when null', () => {
    renderCard(sale({ product: { id: 'p1', name: 'X', description: null } }));
    expect(screen.queryByTestId('catalog-card-description')).not.toBeInTheDocument();
  });

  it('omits description when empty string', () => {
    renderCard(sale({ product: { id: 'p1', name: 'X', description: '' } }));
    expect(screen.queryByTestId('catalog-card-description')).not.toBeInTheDocument();
  });

  it('renders non-empty description', () => {
    renderCard(sale({ product: { id: 'p1', name: 'X', description: 'Shown' } }));
    expect(screen.getByTestId('catalog-card-description')).toHaveTextContent('Shown');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter web exec vitest run src/features/catalog/components/FlashSaleCard.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement card**

Create `apps/web/src/features/catalog/components/FlashSaleCard.tsx`:

```tsx
import { Link } from 'react-router-dom';

import type { CatalogFlashSale } from '../../../graphql/types';

import { SaleStatusBadge } from './SaleStatusBadge';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

type Props = {
  sale: CatalogFlashSale;
};

export function FlashSaleCard({ sale }: Props) {
  const description = sale.product.description?.trim() ? sale.product.description : null;

  return (
    <Link
      className="block rounded-lg border border-emerald-900/15 bg-white/70 p-4 shadow-sm transition hover:border-emerald-700/40 hover:bg-white"
      data-testid="catalog-card"
      to={`/sales/${sale.id}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-emerald-950">{sale.product.name}</h2>
        <SaleStatusBadge status={sale.status} />
      </div>

      {description ? (
        <p className="mb-3 text-sm text-emerald-900/70" data-testid="catalog-card-description">
          {description}
        </p>
      ) : null}

      <p className="text-base font-semibold text-emerald-950">
        {sale.remainingStock} / {sale.totalStock} remaining
      </p>

      <p className="mt-2 text-xs text-emerald-900/60">
        {formatWhen(sale.startsAt)} – {formatWhen(sale.endsAt)}
      </p>
    </Link>
  );
}
```

Notes:

- Accessible name comes from product heading text inside the link.
- Optional `data-sale-id={sale.id}` is allowed by spec but not required.
- Stock copy is part of the UI contract: `"4 / 20 remaining"` (exact).

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter web exec vitest run src/features/catalog/components/FlashSaleCard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Optional commit**

```bash
git add apps/web/src/features/catalog/components/FlashSaleCard.tsx apps/web/src/features/catalog/components/FlashSaleCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FlashSaleCard with whole-card catalog navigation

EOF
)"
```

---

### Task 6: `CatalogPage` + MSW state machine (TDD)

**Files:**

- Create: `apps/web/src/pages/CatalogPage.test.tsx`
- Create: `apps/web/src/pages/CatalogPage.tsx`

**State implementation rule** (must match spec — map hard invariants to TanStack Query flags):

```ts
// Do NOT use isFetching to render the initial loading UI.
if (catalogQuery.isPending) {
  // initial loading only
} else if (catalogQuery.isError) {
  // error + retry (remains visible while refetch is in flight)
} else if ((catalogQuery.data ?? []).length === 0) {
  // empty
} else {
  // grid
}
```

Prefer branching on `isPending` → `isError` → `data` length. You may use early returns or mutually exclusive JSX; the audit contract is the flag mapping above.

- [ ] **Step 1: Write failing page tests**

Create `apps/web/src/pages/CatalogPage.test.tsx`:

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { CatalogFlashSale } from '../graphql/types';

import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { CatalogPage } from './CatalogPage';

function catalogSale(overrides: Partial<CatalogFlashSale> = {}): CatalogFlashSale {
  return {
    id: 'sale-1',
    endsAt: '2026-06-02T00:00:00.000Z',
    product: { id: 'p1', name: 'Alpha', description: 'Desc' },
    remainingStock: 2,
    startsAt: '2026-06-01T00:00:00.000Z',
    status: 'ACTIVE',
    totalStock: 5,
    ...overrides,
  };
}

function renderCatalog() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user };
}

function installFlashSales(
  impl:
    | CatalogFlashSale[]
    | ((
        attempt: number,
      ) => Response | { data?: { flashSales: CatalogFlashSale[] }; errors?: unknown[] }),
) {
  let attempts = 0;
  server.use(
    http.post(graphqlUrl(), async ({ request }) => {
      const body = await readGraphqlBody(request);
      expect(body.operationName).toBe('FlashSales');
      attempts += 1;
      if (typeof impl === 'function') {
        const result = impl(attempts);
        if (result instanceof Response) {
          return result;
        }
        return HttpResponse.json(result);
      }
      return HttpResponse.json({ data: { flashSales: impl } });
    }),
  );
  return () => attempts;
}

describe('CatalogPage', () => {
  it('shows initial loading then the catalog grid', async () => {
    installFlashSales([
      catalogSale({ id: 'sale-a', product: { id: 'p-a', name: 'Alpha', description: null } }),
      catalogSale({
        id: 'sale-b',
        product: { id: 'p-b', name: 'Beta', description: 'B' },
        status: 'UPCOMING',
      }),
    ]);

    renderCatalog();
    expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();

    expect(await screen.findByTestId('catalog-page')).toBeInTheDocument();
    const cards = await screen.findAllByTestId('catalog-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByRole('link', { name: /alpha/i })).toHaveAttribute('href', '/sales/sale-a');
    expect(screen.getByRole('link', { name: /beta/i })).toHaveAttribute('href', '/sales/sale-b');
  });

  it('shows empty state when flashSales is []', async () => {
    installFlashSales([]);
    renderCatalog();
    expect(await screen.findByTestId('catalog-empty')).toBeInTheDocument();
    expect(screen.queryAllByTestId('catalog-card')).toHaveLength(0);
  });

  it('keeps error UI visible during retry and then shows the grid', async () => {
    let attempts = 0;
    let releaseSecond!: () => void;
    const secondResponseGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('FlashSales');
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({
            errors: [{ message: 'boom', extensions: { code: 'INTERNAL' } }],
          });
        }
        await secondResponseGate;
        return HttpResponse.json({ data: { flashSales: [catalogSale()] } });
      }),
    );

    const { user } = renderCatalog();
    expect(await screen.findByTestId('catalog-error')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('catalog-retry'));

    // Gate still closed — assert error + retry remain (hard invariant).
    expect(screen.getByTestId('catalog-error')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-retry')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();

    releaseSecond();

    expect(await screen.findByRole('link', { name: /alpha/i })).toHaveAttribute(
      'href',
      '/sales/sale-1',
    );
    expect(attempts).toBeGreaterThanOrEqual(2);
  });
});
```

If GraphQL error MSW shape needs adjustment, **inspect** how `FlashSalePage.test.tsx` triggers GraphQL errors and match that convention rather than inventing a new error envelope. The **deferred gate** on the second response is required so the mid-retry assertions are deterministic.

If GraphQL error MSW shape needs adjustment, **inspect** how `FlashSalePage.test.tsx` triggers GraphQL errors and match that convention rather than inventing a new error envelope.

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter web exec vitest run src/pages/CatalogPage.test.tsx
```

Expected: FAIL — `CatalogPage` missing.

- [ ] **Step 3: Implement `CatalogPage`**

Create `apps/web/src/pages/CatalogPage.tsx`:

Keep error normalization in `fetchFlashSales` (`toRequestError`) — **do not** re-normalize in the page.

Illustrative implementation using explicit `isPending` / `isError` / `data` branching (early returns OK):

```tsx
import { FlashSaleCard } from '../features/catalog/components/FlashSaleCard';
import { useFlashSales } from '../hooks/useFlashSales';

export function CatalogPage() {
  const catalogQuery = useFlashSales();

  let body: React.ReactNode;
  if (catalogQuery.isPending) {
    body = <p data-testid="catalog-loading">Loading catalog…</p>;
  } else if (catalogQuery.isError) {
    body = (
      <div className="rounded-md bg-white/70 p-4" data-testid="catalog-error" role="alert">
        <p className="font-semibold">Could not load catalog</p>
        <p className="mt-1 text-sm">{catalogQuery.error.message}</p>
        <button
          className="mt-3 rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
          data-testid="catalog-retry"
          onClick={() => {
            void catalogQuery.refetch();
          }}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  } else if ((catalogQuery.data ?? []).length === 0) {
    body = <p data-testid="catalog-empty">No flash sales are available right now.</p>;
  } else {
    body = (
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalogQuery.data!.map((sale) => (
          <li key={sale.id}>
            <FlashSaleCard sale={sale} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-testid="catalog-page">
      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-700">
        Flash Sale System
      </p>
      <h1 className="mb-2 text-3xl font-semibold text-emerald-950 sm:text-4xl">Flash sales</h1>
      <p className="mb-8 max-w-2xl text-emerald-900/70">
        Browse open and upcoming sales. Select a sale to view details.
      </p>
      {body}
    </main>
  );
}
```

**Retry MSW note (implementation):** Prefer a `setTimeout`-based delay on the second response (or arm a hold flag _after_ the error is visible) instead of an unbound deferred Promise that can hang parallel initial fetches. Assertions after click must run while the delayed second response is still in flight.

**Critical:** Branch on `isPending` → `isError` → `data` length. Do **not** use `isFetching` to render the initial loading UI. Do **not** show loading when `isError` even if `isFetching`. Tailwind layout utilities are illustrative — follow existing visual language where practical.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter web exec vitest run src/pages/CatalogPage.test.tsx
```

Expected: PASS. If retry test flakes on “error remains during fetch”, assert immediately after click that `catalog-loading` is absent and wait for success with `findByRole`.

- [ ] **Step 5: Optional commit**

```bash
git add apps/web/src/pages/CatalogPage.tsx apps/web/src/pages/CatalogPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add CatalogPage with catalog query state machine

EOF
)"
```

---

### Task 7: Router + minimal landing-assertion updates

**Files:**

- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/App.test.tsx` (only `/` assertions)
- Modify: `apps/web/src/app/router.test.tsx` (only `/` assertions)
- Delete: `apps/web/src/pages/LandingPage.tsx` (after router no longer imports it)

**Hard rule:** Inspect existing tests. Keep existing detail-route and unknown-route coverage as-is. Update **only** assertions affected by replacing `LandingPage`. Do not delete or simplify the detail-route test.

- [ ] **Step 1: Update failing `/` expectations first (red)**

In `apps/web/src/app/router.test.tsx`:

1. Keep `renderAt`, detail-route test, and not-found test as they are.
2. Change only the `/` test: install a `FlashSales` MSW handler (empty catalog is enough), assert `catalog-page` + empty (or grid), and remove instructional-landing assertions (`Enter a flash sale URL` / `/sales/` guidance text).
3. Add MSW imports (`http`, `HttpResponse`, `graphqlUrl`, `readGraphqlBody`, `server`) **only if not already present**.

Illustrative **delta** for the `/` test only (not a full file replacement):

```tsx
it('renders catalog at /', async () => {
  server.use(
    http.post(graphqlUrl(), async ({ request }) => {
      const body = await readGraphqlBody(request);
      if (body.operationName === 'FlashSales') {
        return HttpResponse.json({ data: { flashSales: [] } });
      }
      return HttpResponse.json({
        errors: [{ message: `Unhandled ${body.operationName}` }],
      });
    }),
  );

  renderAt('/');
  expect(await screen.findByTestId('catalog-page')).toBeInTheDocument();
  expect(await screen.findByTestId('catalog-empty')).toBeInTheDocument();
  expect(screen.queryByText(/enter a flash sale url/i)).not.toBeInTheDocument();
});
```

In `apps/web/src/App.test.tsx`: keep the existing render harness; change the `/` assertion to catalog (`catalog-page` / heading). Add the same `FlashSales` MSW handler. Prefer renaming the test to `renders the catalog page at /`.

- [ ] **Step 2: Run — expect FAIL (still LandingPage)**

```bash
pnpm --filter web exec vitest run src/app/router.test.tsx src/App.test.tsx
```

Expected: FAIL — `catalog-page` not found / instructional landing still present. Detail + not-found tests should still pass until routing changes.

- [ ] **Step 3: Wire router; remove LandingPage**

Inspect `apps/web/src/app/router.tsx`. Minimal change: swap `LandingPage` → `CatalogPage` on `path="/"`. Preserve the `/sales/:flashSaleId` and `*` routes exactly.

```tsx
import { CatalogPage } from '../pages/CatalogPage';
/* remove LandingPage import */

<Route element={<CatalogPage />} path="/" />;
```

Delete `apps/web/src/pages/LandingPage.tsx` once nothing imports it.

- [ ] **Step 4: Run router/App tests — expect PASS**

```bash
pnpm --filter web exec vitest run src/app/router.test.tsx src/App.test.tsx
```

Expected: PASS. Confirm the **existing** detail-route assertions still run and pass (coverage not reduced vs pre-change).

- [ ] **Step 5: Optional commit**

```bash
git add apps/web/src/app/router.tsx apps/web/src/App.test.tsx apps/web/src/app/router.test.tsx
git add -u apps/web/src/pages/LandingPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): route / to CatalogPage replacing instructional landing

EOF
)"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run all web tests (including detail regression)**

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web lint
```

Expected: all PASS, including `FlashSalePage` / detail-route coverage.

- [ ] **Step 2: Grep guards (narrow)**

Landing removed:

```bash
rg -n "LandingPage|Enter a flash sale URL" apps/web/src || true
```

Expected: no matches in `apps/web/src`.

Detail route still present:

```bash
rg -n "flash-sale-page|/sales/:flashSaleId" apps/web/src
```

Catalog symbols present:

```bash
rg -n "catalog-page|FlashSales|CatalogFlashSale|SaleStatusBadge" apps/web/src
```

- [ ] **Step 3: Manual smoke (optional if API up)**

```bash
# with API serving flashSales
pnpm --filter web dev
# open / — catalog cards; click → /sales/:id
# verify detail page still looks/behaves as before (preflight check)
```

- [ ] **Step 4: Spec DoD checklist**

Confirm against [the #122 design spec](../specs/2026-07-30-issue-122-flash-sale-catalog-home-design.md) §12:

- `/` is catalog
- Discovery without known id
- Correct status labels + corresponding badge color tones
- Whole-card links; no nested interactive controls
- Initial loading / empty / error+retry (error+retry remain during refetch)
- Responsive 1/2/3 grid
- Description null/empty rules
- Detail route **behavior and styling** unchanged (preflight handled if needed)
- Existing tests continue passing
- No AuthN / nav / primitives / Redis / EPIC-01 / #118

---

## Spec coverage self-review

| Spec requirement                                                  | Task                            |
| ----------------------------------------------------------------- | ------------------------------- |
| Tailwind in `apps/web`, catalog-only + preflight regression guard | Task 1, 8                       |
| Inspect-before-replace (vite/types/tests)                         | Tasks 1, 2, 7                   |
| `FlashSales` op + nested product                                  | Task 2                          |
| `CatalogFlashSale` separate from detail `FlashSale`               | Task 2                          |
| `useFlashSales` / `['flashSales']`                                | Task 3                          |
| Badge mappings ×4                                                 | Task 4                          |
| Description null/`""`/non-empty                                   | Task 5                          |
| Whole-card link + href identity                                   | Task 5–6                        |
| State precedence + retry without loading flip                     | Task 6                          |
| Responsive 1/2/3 grid                                             | Task 6                          |
| API order; no client sort/filter/status derive                    | Tasks 2–6 (display as returned) |
| Router `/` → catalog; detail unchanged                            | Task 7                          |
| Vitest/MSW matrix + test ids                                      | Tasks 4–7                       |
| Out of scope respected                                            | All tasks                       |

**Placeholder scan:** none intentional.

**Type consistency:** `CatalogFlashSale` / `Product` / `FlashSaleStatus` / `fetchFlashSales` / `useFlashSales` / `flashSalesQueryKey` / test ids match across tasks.
