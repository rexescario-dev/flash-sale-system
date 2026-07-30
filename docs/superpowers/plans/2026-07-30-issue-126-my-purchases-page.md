# Issue #126 — My Purchases Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [#126](https://github.com/rexescario-dev/flash-sale-system/issues/126) — `/purchases` My Purchases page using committed local identity + #125 `myPurchases`, with Guest / Pending / Error / Empty / Success states and sale links.

**Architecture:** Thin Catalog-shaped page in `apps/web`: `PurchasesPage` orchestrates; `useMyPurchases` + `fetchMyPurchases` load history; `PurchaseHistoryPanel` presents one purchase. Reuse `IdentityProvider` / `IdentityStrip`. Soft stacked panels (layout C). No #127 nav, no #129 Redis, no GraphQL shape expansion.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, graphql-request, Vitest + Testing Library + MSW, existing Tailwind bridge in `apps/web`.

**Spec:** [docs/superpowers/specs/2026-07-30-issue-126-my-purchases-page-design.md](../specs/2026-07-30-issue-126-my-purchases-page-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Baseline:** `origin/main` at/after `200c682` (#125 via [PR #138](https://github.com/rexescario-dev/flash-sale-system/pull/138); #123/#124/#122 already on main).

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Out of scope:** AuthN privacy claims; history field expansion (status/window/qty/price); #127 nav; #129 cache invalidation; #128 primitives; #133/#134; Playwright #130.

**Hard invariants (locked):**

1. State precedence: **Guest → Pending → Error → Empty → Success**. Exactly one body state. Refetch/retry must **not** replace Error with Pending loading UI (mirror Catalog: use `isPending`, not `isFetching`, for Pending).
2. Guest (`!isNonWhitespaceId(userId ?? '')`) ⇒ **no GraphQL request at all**.
3. Query key scoped by exact committed `userId` (e.g. `['myPurchases', userId]`); variables use exact string (no trim).
4. Map GraphQL as returned: `id`, `purchasedAt`, `flashSale.id`, `product.*` — purchase id field is `id`.
5. Rows render in exactly the order returned by the GraphQL API; **no** client `.sort()`. Tests must not sort expected data independently.
6. Retry = `refetch()` on the existing query instance; do not invalidate unrelated queries; do not change identity.
7. Sale link = client router `Link` to `/sales/${flashSale.id}`.
8. `purchasedAt`: absolute local datetime; locale formatting implementation-defined; non-relative / no ticking.
9. Do not pull #127 / #129 / #128 / #133 / #134.

**Implementation convention (authoritative for _how_ to edit):**

> The design spec is authoritative for behavior. The **existing codebase** is authoritative for conventions. Inspect CatalogPage / FlashSaleCard / flashSales op patterns before coding. Prefer minimal diffs. Match CatalogPage control flow (`let body` vs early returns) unless doing so obscures the Guest → Pending → Error → Empty → Success precedence. Seed identity in tests via `identityStorage.set(...)` (same helper IdentityProvider uses) — never hard-code the storage key string.

---

## File map

| Path                                                                       | Responsibility                                                                          |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/web/src/graphql/types.ts`                                            | Add `PurchaseHistoryItem` (+ nested `flashSale: { id }`)                                |
| `apps/web/src/graphql/operations/myPurchases.ts`                           | `MyPurchases` query + `fetchMyPurchases`                                                |
| `apps/web/src/graphql/operations/myPurchases.spec.ts`                      | Op unit: shape + exact field names                                                      |
| `apps/web/src/hooks/useMyPurchases.ts`                                     | TanStack Query; enabled ↔ non-whitespace; key scoped by userId                          |
| `apps/web/src/features/purchases/components/PurchaseHistoryPanel.tsx`      | Soft panel presentational                                                               |
| `apps/web/src/features/purchases/components/PurchaseHistoryPanel.test.tsx` | Panel fields, Link href, description clamp visibility                                   |
| `apps/web/src/features/purchases/format-purchased-at.ts`                   | Absolute local datetime helper (**required** — keeps panel thin, isolates locale logic) |
| `apps/web/src/pages/PurchasesPage.tsx`                                     | `/purchases` orchestrator + state machine                                               |
| `apps/web/src/pages/PurchasesPage.test.tsx`                                | Guest / Pending / Empty / Success / identity switch                                     |
| `apps/web/src/pages/PurchasesPage.retry.test.tsx`                          | Error + retry persistence (Catalog pattern)                                             |
| `apps/web/src/app/router.tsx`                                              | Register `/purchases`                                                                   |
| `apps/web/src/app/router.test.tsx`                                         | Assert `/purchases` mounts page                                                         |

`features/purchases/` exists only to colocate the presentational component (and its formatter). It is **not** Approach 2 feature-slice architecture. Do **not** add list/empty/error child components.

---

## Task flow

When existing Catalog or Sale implementations differ from illustrative snippets below, follow the existing implementation pattern while preserving the locked behavioral invariants.

```text
Task 1  →  Types + myPurchases GraphQL operation (TDD)
Task 2  →  useMyPurchases hook
Task 3  →  PurchaseHistoryPanel (TDD)
Task 4  →  PurchasesPage states + MSW (TDD)
Task 5  →  Error + retry persistence (TDD)
Task 6  →  Router wiring + router test
Task 7  →  Full web verification
```

---

### Task 1: Types + `fetchMyPurchases`

**Files:**

- Modify: `apps/web/src/graphql/types.ts`
- Create: `apps/web/src/graphql/operations/myPurchases.ts`
- Create: `apps/web/src/graphql/operations/myPurchases.spec.ts`

- [ ] **Step 1: Write the failing op unit test**

```ts
// apps/web/src/graphql/operations/myPurchases.spec.ts
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { graphqlUrl, readGraphqlBody } from '../../test/msw/graphql';
import { server } from '../../test/msw/server';
import { fetchMyPurchases } from './myPurchases';

afterEach(() => {
  server.resetHandlers();
});

describe('fetchMyPurchases', () => {
  it('requests MyPurchases with exact userId and returns history items as returned', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('MyPurchases');
        expect(body.variables).toEqual({ userId: 'user-exact' });
        return HttpResponse.json({
          data: {
            myPurchases: [
              {
                id: 'pur-1',
                purchasedAt: '2026-07-29T07:14:00.000Z',
                flashSale: { id: 'sale-1' },
                product: { id: 'p1', description: 'Nice', name: 'Widget' },
              },
            ],
          },
        });
      }),
    );

    const rows = await fetchMyPurchases('user-exact');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('pur-1');
    expect(rows[0]?.flashSale.id).toBe('sale-1');
    expect(rows[0]?.product.name).toBe('Widget');
    expect(rows[0]?.product.description).toBe('Nice');
    expect('purchaseId' in (rows[0] as object)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- src/graphql/operations/myPurchases.spec.ts
```

Expected: FAIL (module / export missing).

- [ ] **Step 3: Add type + operation**

Append to `apps/web/src/graphql/types.ts`:

```ts
export type PurchaseHistoryItem = {
  id: string;
  purchasedAt: string;
  flashSale: { id: string };
  product: Product;
};
```

Create `apps/web/src/graphql/operations/myPurchases.ts` mirroring `flashSales.ts` / `myPurchase.ts`:

```ts
import { gql } from 'graphql-request';

import type { PurchaseHistoryItem } from '../types';

import { graphqlClient } from '../client';
import { toRequestError } from '../errors';

const MY_PURCHASES_QUERY = gql`
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
`;

type MyPurchasesResponse = {
  myPurchases: PurchaseHistoryItem[];
};

export async function fetchMyPurchases(userId: string): Promise<PurchaseHistoryItem[]> {
  try {
    const data = await graphqlClient.request<MyPurchasesResponse>(MY_PURCHASES_QUERY, {
      userId,
    });
    return data.myPurchases;
  } catch (error) {
    throw toRequestError(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- src/graphql/operations/myPurchases.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit (optional — only if user asks)**

```bash
git add apps/web/src/graphql/types.ts apps/web/src/graphql/operations/myPurchases.ts apps/web/src/graphql/operations/myPurchases.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): add myPurchases GraphQL operation for purchase history

EOF
)"
```

---

### Task 2: `useMyPurchases` hook

**Files:**

- Create: `apps/web/src/hooks/useMyPurchases.ts`

- [ ] **Step 1: Implement hook (mirror `useMyPurchase` / `useFlashSales`)**

```ts
import { useQuery } from '@tanstack/react-query';

import { isNonWhitespaceId } from '../graphql/id';
import { fetchMyPurchases } from '../graphql/operations/myPurchases';

export function myPurchasesQueryKey(userId: string) {
  return ['myPurchases', userId] as const;
}

export function useMyPurchases(userId: string) {
  return useQuery({
    enabled: isNonWhitespaceId(userId),
    queryFn: () => fetchMyPurchases(userId),
    queryKey: myPurchasesQueryKey(userId),
  });
}
```

Notes:

- Export `myPurchasesQueryKey` — sibling hooks (`flashSalesQueryKey`, `myPurchaseQueryKey`, `flashSaleQueryKey`) are exported the same way.
- Call site passes `userId ?? ''` so Guest disables the query without inventing a second code path.
- Do **not** trim `userId` inside `queryFn` or the key.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: PASS (or only unrelated pre-existing noise).

- [ ] **Step 3: Commit (optional — only if user asks)**

```bash
git add apps/web/src/hooks/useMyPurchases.ts
git commit -m "$(cat <<'EOF'
feat(web): add useMyPurchases query hook

EOF
)"
```

---

### Task 3: `PurchaseHistoryPanel` (TDD)

**Files:**

- Create: `apps/web/src/features/purchases/format-purchased-at.ts`
- Create: `apps/web/src/features/purchases/components/PurchaseHistoryPanel.tsx`
- Create: `apps/web/src/features/purchases/components/PurchaseHistoryPanel.test.tsx`

- [ ] **Step 1: Write failing panel tests**

```tsx
// apps/web/src/features/purchases/components/PurchaseHistoryPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { PurchaseHistoryItem } from '../../../graphql/types';

import { PurchaseHistoryPanel } from './PurchaseHistoryPanel';

function item(overrides: Partial<PurchaseHistoryItem> = {}): PurchaseHistoryItem {
  return {
    id: 'pur-1',
    purchasedAt: '2026-07-29T07:14:00.000Z',
    flashSale: { id: 'sale-42' },
    product: { id: 'p1', description: 'A long enough description for clamp', name: 'Aurora' },
    ...overrides,
  };
}

function renderPanel(row: PurchaseHistoryItem) {
  return render(
    <MemoryRouter>
      <PurchaseHistoryPanel item={row} />
    </MemoryRouter>,
  );
}

describe('PurchaseHistoryPanel', () => {
  it('shows product name, muted id, and View sale Link href', () => {
    renderPanel(item());
    expect(screen.getByTestId('purchase-panel')).toBeInTheDocument();
    expect(screen.getByText('Aurora')).toBeInTheDocument();
    expect(screen.getByText(/pur-1/)).toBeInTheDocument();
    expect(screen.getByTestId('purchase-sale-link')).toHaveAttribute('href', '/sales/sale-42');
  });

  it('omits null and whitespace-only descriptions; shows non-empty description', () => {
    const { rerender } = render(
      <MemoryRouter>
        <PurchaseHistoryPanel
          item={item({ product: { id: 'p1', description: null, name: 'X' } })}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('purchase-panel-description')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PurchaseHistoryPanel
          item={item({ product: { id: 'p1', description: '   ', name: 'X' } })}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('purchase-panel-description')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PurchaseHistoryPanel
          item={item({ product: { id: 'p1', description: 'Hello', name: 'X' } })}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('purchase-panel-description')).toHaveTextContent('Hello');
  });

  it('renders absolute local purchasedAt (implementation-defined; non-relative)', () => {
    renderPanel(item({ purchasedAt: '2026-07-29T07:14:00.000Z' }));
    const panel = screen.getByTestId('purchase-panel');
    expect(panel).toHaveTextContent(/Purchased/i);
    expect(panel).not.toHaveTextContent('2026-07-29T07:14:00.000Z');
    expect(panel).not.toHaveTextContent(/ago/i);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter web test -- src/features/purchases/components/PurchaseHistoryPanel.test.tsx
```

- [ ] **Step 3: Implement required formatter + panel**

`format-purchased-at.ts` is **required** (absolute local; stable; non-relative; isolates locale logic from the panel):

```ts
/** Absolute local datetime; locale formatting is implementation-defined. */
export function formatPurchasedAt(iso: string): string {
  return new Date(iso).toLocaleString();
}
```

`PurchaseHistoryPanel.tsx` (soft stacked panel chrome; emerald tokens like Catalog cards but **not** a grid card / whole-card link):

```tsx
import { Link } from 'react-router-dom';

import type { PurchaseHistoryItem } from '../../../graphql/types';

import { formatPurchasedAt } from '../format-purchased-at';

type Props = {
  item: PurchaseHistoryItem;
};

export function PurchaseHistoryPanel({ item }: Props) {
  const description = item.product.description?.trim() ? item.product.description : null;
```

(Whitespace-only descriptions must omit the description block — covered by the panel test above.)

Continue the component as:

```tsx
  return (
    <article
      className="rounded-lg border border-emerald-900/15 bg-white/70 p-4"
      data-testid="purchase-panel"
    >
      <h2 className="text-lg font-semibold text-emerald-950">{item.product.name}</h2>
      <p className="mt-1 text-sm text-emerald-900/70">
        <span className="font-medium text-emerald-950">Purchased:</span>{' '}
        {formatPurchasedAt(item.purchasedAt)}
      </p>
      {description ? (
        <p
          className="mt-2 line-clamp-3 text-sm text-emerald-900/70"
          data-testid="purchase-panel-description"
        >
          {description}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-emerald-900/50">{item.id}</p>
      <Link
        className="mt-3 inline-block text-sm font-semibold text-emerald-800 underline"
        data-testid="purchase-sale-link"
        to={`/sales/${item.flashSale.id}`}
      >
        View sale
      </Link>
    </article>
  );
}
```

- [ ] **Step 4: Run panel tests — expect PASS**

```bash
pnpm --filter web test -- src/features/purchases/components/PurchaseHistoryPanel.test.tsx
```

- [ ] **Step 5: Commit (optional — only if user asks)**

```bash
git add apps/web/src/features/purchases
git commit -m "$(cat <<'EOF'
feat(web): add PurchaseHistoryPanel for my purchases

EOF
)"
```

---

### Task 4: `PurchasesPage` state machine (TDD)

**Files:**

- Create: `apps/web/src/pages/PurchasesPage.tsx`
- Create: `apps/web/src/pages/PurchasesPage.test.tsx`

- [ ] **Step 1: Write failing page tests**

```tsx
// apps/web/src/pages/PurchasesPage.test.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { IdentityProvider } from '../features/identity/IdentityProvider';
import { identityStorage } from '../features/identity/identity-storage';
import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { PurchasesPage } from './PurchasesPage';

function renderPurchases() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <IdentityProvider>
        <MemoryRouter>
          <PurchasesPage />
        </MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('PurchasesPage', () => {
  it('shows Guest soft empty and issues no GraphQL request', async () => {
    let graphqlCalls = 0;
    server.use(
      http.post(graphqlUrl(), async () => {
        graphqlCalls += 1;
        return HttpResponse.json({
          errors: [{ message: 'should not be called' }],
        });
      }),
    );

    renderPurchases();
    expect(await screen.findByTestId('purchases-page')).toBeInTheDocument();
    expect(screen.getByTestId('purchases-guest')).toBeInTheDocument();
    expect(screen.getByTestId('identity-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('purchases-empty')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(graphqlCalls).toBe(0);
    });
  });

  it('shows Pending then Success panels in GraphQL API order', async () => {
    identityStorage.set('buyer-1');
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('MyPurchases');
        expect(body.variables).toEqual({ userId: 'buyer-1' });
        return HttpResponse.json({
          data: {
            myPurchases: [
              {
                id: 'pur-new',
                purchasedAt: '2026-07-29T12:00:00.000Z',
                flashSale: { id: 'sale-new' },
                product: { id: 'p-new', description: null, name: 'Newer' },
              },
              {
                id: 'pur-old',
                purchasedAt: '2026-07-28T12:00:00.000Z',
                flashSale: { id: 'sale-old' },
                product: { id: 'p-old', description: null, name: 'Older' },
              },
            ],
          },
        });
      }),
    );

    renderPurchases();
    expect(screen.getByTestId('purchases-loading')).toBeInTheDocument();

    const panels = await screen.findAllByTestId('purchase-panel');
    expect(panels).toHaveLength(2);
    // Do not sort — assert DOM order matches GraphQL response order.
    expect(panels[0]).toHaveTextContent('Newer');
    expect(panels[1]).toHaveTextContent('Older');
    expect(screen.getAllByTestId('purchase-sale-link')[0]).toHaveAttribute(
      'href',
      '/sales/sale-new',
    );
  });

  it('shows Empty when identified and myPurchases is []', async () => {
    identityStorage.set('buyer-empty');
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('MyPurchases');
        return HttpResponse.json({ data: { myPurchases: [] } });
      }),
    );

    renderPurchases();
    expect(await screen.findByTestId('purchases-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-guest')).not.toBeInTheDocument();
  });

  it('switches query to the new exact userId after Identify/Save', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        if (body.operationName === 'MyPurchases') {
          seen.push(String(body.variables?.userId));
          return HttpResponse.json({
            data: {
              myPurchases: [
                {
                  id: `pur-${body.variables?.userId}`,
                  purchasedAt: '2026-07-29T12:00:00.000Z',
                  flashSale: { id: 'sale-1' },
                  product: {
                    id: 'p1',
                    description: null,
                    name: `Item for ${body.variables?.userId}`,
                  },
                },
              ],
            },
          });
        }
        return HttpResponse.json({
          errors: [{ message: `Unhandled ${body.operationName}` }],
        });
      }),
    );

    renderPurchases();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'alice');
    await user.click(screen.getByTestId('identity-save'));
    expect(await screen.findByText('Item for alice')).toBeInTheDocument();

    await user.click(screen.getByTestId('identity-change'));
    await user.clear(screen.getByTestId('identity-email-input'));
    await user.type(screen.getByTestId('identity-email-input'), 'bob');
    await user.click(screen.getByTestId('identity-save'));
    expect(await screen.findByText('Item for bob')).toBeInTheDocument();
    expect(seen).toContain('alice');
    expect(seen).toContain('bob');
  });
});
```

Expect identity switch via IdentityStrip (Identify / Change / Save). Do **not** seed with a hard-coded `localStorage` key — use `identityStorage.set` when a committed id is needed before mount (same pattern as `FlashSalePage.test.tsx`).

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter web test -- src/pages/PurchasesPage.test.tsx
```

- [ ] **Step 3: Implement `PurchasesPage`**

Mirror `CatalogPage` shell + identity. Use the same control-flow style as Catalog (`let body: ReactNode` branches) unless an early-return rewrite would make Guest → Pending → Error → Empty → Success clearer — prefer matching Catalog.

State precedence:

```tsx
import type { ReactNode } from 'react';

import { PurchaseHistoryPanel } from '../features/purchases/components/PurchaseHistoryPanel';
import { IdentityStrip } from '../features/identity/components/IdentityStrip';
import { useUserIdentity } from '../features/identity/IdentityProvider';
import { isNonWhitespaceId } from '../graphql/id';
import { useMyPurchases } from '../hooks/useMyPurchases';

export function PurchasesPage() {
  const { userId } = useUserIdentity();
  const isGuest = !isNonWhitespaceId(userId ?? '');
  const purchasesQuery = useMyPurchases(userId ?? '');

  let body: ReactNode;
  if (isGuest) {
    body = (
      <div data-testid="purchases-guest">
        <p className="font-semibold text-emerald-950">No purchases to show yet</p>
        <p className="mt-1 text-sm text-emerald-900/70">
          Identify yourself using the banner above to view the purchase history associated with your
          User ID.
        </p>
      </div>
    );
  } else if (purchasesQuery.isPending) {
    body = <p data-testid="purchases-loading">Loading purchases…</p>;
  } else if (purchasesQuery.isError) {
    body = (
      <div className="rounded-md bg-white/70 p-4" data-testid="purchases-error" role="alert">
        <p className="font-semibold">Could not load purchases</p>
        <p className="mt-1 text-sm">{purchasesQuery.error.message}</p>
        <button
          className="mt-3 rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
          data-testid="purchases-retry"
          onClick={() => {
            void purchasesQuery.refetch();
          }}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  } else if ((purchasesQuery.data ?? []).length === 0) {
    body = (
      <p data-testid="purchases-empty">Identified, but no purchases exist for this User ID.</p>
    );
  } else {
    body = (
      <ul className="flex flex-col gap-4">
        {purchasesQuery.data!.map((row) => (
          <li key={row.id}>
            <PurchaseHistoryPanel item={row} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-testid="purchases-page">
      <IdentityStrip />
      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-700">
        Flash Sale System
      </p>
      <h1 className="mb-2 text-3xl font-semibold text-emerald-950 sm:text-4xl">My purchases</h1>
      <p className="mb-8 max-w-2xl text-emerald-900/70">
        Purchase history for your current User ID. This demo is not authenticated private history.
      </p>
      {body}
    </main>
  );
}
```

Copy may be tightened as long as it does **not** claim AuthN privacy. Do **not** `.sort()` the array.

- [ ] **Step 4: Run page tests — expect PASS**

```bash
pnpm --filter web test -- src/pages/PurchasesPage.test.tsx
```

- [ ] **Step 5: Commit (optional — only if user asks)**

```bash
git add apps/web/src/pages/PurchasesPage.tsx apps/web/src/pages/PurchasesPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add PurchasesPage with guest and history states

EOF
)"
```

---

### Task 5: Error + retry persistence

**Files:**

- Create: `apps/web/src/pages/PurchasesPage.retry.test.tsx`

- [ ] **Step 1: Write failing retry test (Catalog pattern)**

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { IdentityProvider } from '../features/identity/IdentityProvider';
import { identityStorage } from '../features/identity/identity-storage';
import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { PurchasesPage } from './PurchasesPage';

describe('PurchasesPage retry persistence', () => {
  it('keeps Error UI visible during retry then shows Success', async () => {
    identityStorage.set('buyer-retry');
    let attempts = 0;

    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('MyPurchases');
        attempts += 1;

        if (attempts === 1) {
          return HttpResponse.json({
            errors: [{ extensions: { code: 'INTERNAL' }, message: 'boom' }],
          });
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 80);
        });

        return HttpResponse.json({
          data: {
            myPurchases: [
              {
                id: 'pur-1',
                purchasedAt: '2026-07-29T12:00:00.000Z',
                flashSale: { id: 'sale-1' },
                product: { id: 'p1', description: null, name: 'Alpha' },
              },
            ],
          },
        });
      }),
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <IdentityProvider>
          <MemoryRouter>
            <PurchasesPage />
          </MemoryRouter>
        </IdentityProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('purchases-error')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-loading')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('purchases-retry'));

    expect(screen.getByTestId('purchases-error')).toBeInTheDocument();
    expect(screen.getByTestId('purchases-retry')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-loading')).not.toBeInTheDocument();

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(attempts).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run — expect PASS with Task 4 implementation** (if FAIL because Pending flashes, fix page to gate loading on `isPending` only, never `isFetching` / `isLoading` alone for body precedence)

```bash
pnpm --filter web test -- src/pages/PurchasesPage.retry.test.tsx
```

- [ ] **Step 3: Commit (optional — only if user asks)**

```bash
git add apps/web/src/pages/PurchasesPage.retry.test.tsx
git commit -m "$(cat <<'EOF'
test(web): cover purchases error retry without loading flash

EOF
)"
```

---

### Task 6: Router wiring

**Files:**

- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/router.test.tsx`

- [ ] **Step 1: Extend router test (failing first)**

Add to `router.test.tsx`:

```tsx
it('renders purchases page at /purchases', async () => {
  renderAt('/purchases');
  expect(await screen.findByTestId('purchases-page')).toBeInTheDocument();
});
```

Guest must not issue any GraphQL request, so no GraphQL mock is required for this router assertion.

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter web test -- src/app/router.test.tsx
```

- [ ] **Step 3: Register route**

In `apps/web/src/app/router.tsx`:

```tsx
import { Route, Routes } from 'react-router-dom';

import { CatalogPage } from '../pages/CatalogPage';
import { FlashSalePage } from '../pages/FlashSalePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PurchasesPage } from '../pages/PurchasesPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<CatalogPage />} path="/" />
      <Route element={<FlashSalePage />} path="/sales/:flashSaleId" />
      <Route element={<PurchasesPage />} path="/purchases" />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}
```

Unknown routes continue to resolve to `NotFoundPage`.

- [ ] **Step 4: Run router tests — expect PASS**

```bash
pnpm --filter web test -- src/app/router.test.tsx
```

- [ ] **Step 5: Commit (optional — only if user asks)**

```bash
git add apps/web/src/app/router.tsx apps/web/src/app/router.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): register /purchases route

EOF
)"
```

---

### Task 7: Full verification

- [ ] **Step 1: Run full web suite**

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web lint
```

Expected: all green.

- [ ] **Step 2: Spec compliance smoke checklist**

- [ ] `/purchases` reachable
- [ ] Guest ⇒ soft empty + **zero** GraphQL calls
- [ ] Pending / Error+retry / Empty / Success precedence
- [ ] Panels: name, Purchased absolute local, optional description, muted `id`, `Link` to `/sales/:id`
- [ ] GraphQL order preserved (no client sort)
- [ ] Identity switch uses new exact `userId`
- [ ] No #127 nav chrome; no Redis/#129 wiring

- [ ] **Step 3: Commit (optional — only if user asks)**

Do not commit until asked.

---

## Self-review (plan vs spec)

| Spec requirement                                                 | Task      |
| ---------------------------------------------------------------- | --------- |
| `/purchases` + router 404 unchanged                              | Task 6    |
| `myPurchases` op + `id` / `flashSale.id` / product / purchasedAt | Task 1    |
| Query key scoped by exact userId; enabled gate                   | Task 2    |
| Soft stacked panel layout C                                      | Task 3    |
| Guest soft empty; no GraphQL                                     | Task 4    |
| Pending / Empty / Success                                        | Task 4    |
| Error + refetch existing query; no Pending flash                 | Task 5    |
| Sale `Link`                                                      | Task 3–4  |
| GraphQL API order; tests don’t re-sort                           | Task 4    |
| Identity switch exact userId                                     | Task 4    |
| No #127/#129/#128                                                | All tasks |

**Placeholder scan:** none intentional.  
**Type consistency:** `PurchaseHistoryItem.id` throughout; no `purchaseId` on history type.
