# EPIC-05 — React Frontend Implementation Plan (#33–#40)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [EPIC-05 #85](https://github.com/rexescario-dev/flash-sale-system/issues/85) by building a route-driven React flash-sale page over EPIC-03 GraphQL (`flashSale`, `myPurchase`, `purchaseItem`) with manual `userId`, backend-authoritative outcomes, and MSW-backed behavior tests.

**Architecture:** Thin page-centric feature slice. `FlashSalePage` orchestrates route `flashSaleId`, raw + debounced `userId`, and three TanStack Query hooks. `graphql-request` is the transport; operations live under `apps/web/src/graphql/`; UI never embeds GraphQL documents. Mutation `onSettled` invalidates from **mutation variables**. Buy CTA uses UX guards only; `purchaseItem` remains authoritative.

**Tech Stack:** React 19, Vite 6, TypeScript, `react-router-dom`, `graphql-request`, `@tanstack/react-query`, Vitest, Testing Library, MSW, pnpm + Turborepo.

**Spec:** [docs/superpowers/specs/2026-07-28-epic-05-react-frontend-design.md](../specs/2026-07-28-epic-05-react-frontend-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`. Author email must be `rex.escario.jr@gmail.com`.

**Out of scope:** AuthN/AuthZ; sale listing/discovery; `VITE_FLASH_SALE_ID`; GraphQL codegen; polling; Playwright/Cypress; shared codegen package; redesigning EPIC-03 API.

**Hard invariants (locked):**

1. Route: `/sales/:flashSaleId`; `/` landing; `*` not found. Do not trim/lowercase/manually decode/`transform` `useParams().flashSaleId` before GraphQL.
2. Manual raw `userId`; debounce delays only — **no trim/normalize** of IDs before send. Both `myPurchase` and `purchaseItem` receive the exact entered value (debounced vs raw timing differs; content identical).
3. Frontend never derives sale status from `startsAt` / `endsAt` / browser clock — render `flashSale.status` only.
4. `myPurchase` is UX optimization; `purchaseItem` outcome is authoritative.
5. Buy disabled when: invalid `userId` OR `flashSale` loading/error OR `status !== ACTIVE` OR **initial** `myPurchase` pending (`isPending && !isError`) OR `purchased === true` OR mutation pending.
6. `myPurchase` **request error** does **not** by itself disable Buy. Background `isFetching` refetch does **not** disable Buy.
7. Business outcomes ≠ GraphQL/network request errors (separate UI paths). Request errors use **safe** user-facing copy only — never auto-render raw GraphQL `error.message`. `PurchaseItemResult.message` from a successful business response **may** be shown.
8. Never claim `SUCCESS` until backend returns `SUCCESS`.
9. `onSettled` invalidates `['myPurchase', variables.flashSaleId, variables.userId]` and `['flashSale', variables.flashSaleId]` for **every** settlement.
10. Tests mock GraphQL at HTTP boundary via MSW — not `graphql-request` / TanStack Query internals.
11. Handwritten types/operations must be verified against the **merged EPIC-03 API** (object types + `#26` integration documents), not inferred only from the EPIC-05 design doc.

**Verification split (locked):**

```text
Vitest + Testing Library + MSW (HTTP GraphQL)
  ├── Routing: / , /sales/:id , *
  ├── flashSale: loading / success / error; Buy disabled until ACTIVE
  ├── debounce + strict ID: whitespace-only skips myPurchase; exact value sent
  ├── raw userId preserved on BOTH MyPurchase and PurchaseItem (e.g. " user-123 ")
  ├── exact route flashSaleId preserved on FlashSale / MyPurchase / PurchaseItem
  │     (including unusual chars; no trim/lowercase/manual decode)
  ├── myPurchase: initial pending disables Buy; purchased true disables;
  │     request error does NOT disable; background refetch does NOT disable
  ├── purchaseItem: pending; SUCCESS only after backend; all PurchaseOutcome UIs
  ├── request-error path + Try again: clears prior outcome + error; then SUCCESS
  ├── mutation-variable invalidation on SUCCESS **and** on request-error settlement
  ├── race: stale ACTIVE UI + mutation SOLD_OUT → outcome wins; no SUCCESS
  ├── status authority fixtures: API ACTIVE outside window; API ENDED inside window
  ├── MSW default unmatched op → GraphQL error code UNHANDLED_TEST_OPERATION
  │     (UI still shows safe generic message; one test proves unhandled fails loudly)
  └── Test QueryClient uses retry: false (production retry covered separately if needed)
```

---

## File map

| Path                                                                    | Responsibility                                                                                                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/package.json`                                                 | Add deps: `react-router-dom`, `graphql`, `graphql-request`, `@tanstack/react-query`; devDeps: `msw`, `@testing-library/user-event` |
| `apps/web/vite.config.ts`                                               | **Inspect then merge** only required test fields; preserve EPIC-01 config                                                          |
| `apps/web/src/main.tsx`                                                 | Wire `BrowserRouter` + `QueryClientProvider` + `App`                                                                               |
| `apps/web/src/App.tsx`                                                  | Host `AppRoutes`                                                                                                                   |
| `apps/web/src/app/router.tsx`                                           | Route definitions                                                                                                                  |
| `apps/web/src/app/query-client.ts`                                      | Shared `QueryClient` factory (retry policy)                                                                                        |
| `apps/web/src/pages/LandingPage.tsx`                                    | Minimal `/` landing                                                                                                                |
| `apps/web/src/pages/FlashSalePage.tsx`                                  | Page orchestration                                                                                                                 |
| `apps/web/src/pages/NotFoundPage.tsx`                                   | Catch-all 404                                                                                                                      |
| `apps/web/src/graphql/client.ts`                                        | `GraphQLClient` from `VITE_API_URL`                                                                                                |
| `apps/web/src/graphql/types.ts`                                         | Handwritten types verified against EPIC-03                                                                                         |
| `apps/web/src/graphql/errors.ts`                                        | Safe `RequestError` normalization (`kind` + safe message)                                                                          |
| `apps/web/src/graphql/errors.spec.ts`                                   | Unit tests for safe mapping / no raw GraphQL message leak                                                                          |
| `apps/web/src/graphql/id.ts`                                            | `isNonWhitespaceId` gate (no normalize for send)                                                                                   |
| `apps/web/src/graphql/operations/flashSale.ts`                          | Query + `fetchFlashSale`                                                                                                           |
| `apps/web/src/graphql/operations/myPurchase.ts`                         | Query + `fetchMyPurchase`                                                                                                          |
| `apps/web/src/graphql/operations/purchaseItem.ts`                       | Mutation + `mutatePurchaseItem`                                                                                                    |
| `apps/web/src/hooks/useDebouncedValue.ts`                               | Delay-only debounce                                                                                                                |
| `apps/web/src/hooks/useFlashSale.ts`                                    | Query hook                                                                                                                         |
| `apps/web/src/hooks/useMyPurchase.ts`                                   | Query hook (debounced id)                                                                                                          |
| `apps/web/src/hooks/usePurchaseItem.ts`                                 | Mutation hook + variable-scoped invalidation                                                                                       |
| `apps/web/src/features/flash-sale/components/SaleStatusCard.tsx`        | Status/stock display                                                                                                               |
| `apps/web/src/features/flash-sale/components/PurchasePanel.tsx`         | userId input + Buy CTA                                                                                                             |
| `apps/web/src/features/flash-sale/components/PurchaseOutcomeBanner.tsx` | Business outcome UI                                                                                                                |
| `apps/web/src/features/flash-sale/components/RequestErrorBanner.tsx`    | Recoverable request errors                                                                                                         |
| `apps/web/src/features/flash-sale/buy-eligibility.ts`                   | Pure Buy-disable predicate                                                                                                         |
| `apps/web/src/features/flash-sale/buy-eligibility.spec.ts`              | Eligibility unit tests                                                                                                             |
| `apps/web/src/test/msw/server.ts`                                       | MSW server                                                                                                                         |
| `apps/web/src/test/msw/handlers.ts`                                     | Default GraphQL handlers                                                                                                           |
| `apps/web/src/test/msw/graphql.ts`                                      | Body reader + URL helper                                                                                                           |
| `apps/web/src/test/render.tsx`                                          | `renderApp` with MemoryRouter + **test** QueryClient (`retry: false`)                                                              |
| `apps/web/src/test/query-client.ts`                                     | `createTestQueryClient()` — always `retry: false` for integration tests                                                            |
| `apps/web/src/test/setup.ts`                                            | jest-dom + MSW lifecycle                                                                                                           |
| `apps/web/src/pages/FlashSalePage.test.tsx`                             | Primary integration coverage                                                                                                       |
| `apps/web/src/app/router.test.tsx`                                      | Routing coverage                                                                                                                   |
| `apps/web/src/App.test.tsx`                                             | Landing smoke via router                                                                                                           |
| `docs/superpowers/specs/2026-07-28-epic-05-react-frontend-design.md`    | Spec                                                                                                                               |
| `docs/superpowers/plans/2026-07-28-epic-05-react-frontend.md`           | This plan                                                                                                                          |

**Untouched:** `apps/api/**`, `packages/domain/**`, Playwright, codegen.

---

## EPIC-03 contract snapshot (verify on branch before freezing types)

Inspect these sources on the implementation branch (must match merged main):

| Source                                                              | What to verify                                                                                           |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/api/src/flash-sale/graphql/flash-sale.object-type.ts`         | Fields: `id`, `status`, `remainingStock`, `totalStock`, `startsAt`, `endsAt` — no `productId` / `nowUtc` |
| `apps/api/src/flash-sale/graphql/flash-sale-status.enum.ts`         | `UPCOMING`, `ACTIVE`, `SOLD_OUT`, `ENDED`                                                                |
| `apps/api/src/purchase/graphql/my-purchase-result.object-type.ts`   | `purchased: Boolean!`; `purchaseId` / `purchasedAt` nullable                                             |
| `apps/api/src/purchase/graphql/purchase-item-result.object-type.ts` | `status`, `message`, nullable `purchaseId`                                                               |
| `apps/api/src/purchase/graphql/purchase-outcome.enum.ts`            | `SUCCESS`, `ALREADY_PURCHASED`, `SALE_NOT_STARTED`, `SALE_ENDED`, `SOLD_OUT`                             |
| `apps/api/src/flash-sale/flash-sale.resolver.ts`                    | `flashSale(id: ID!)`                                                                                     |
| `apps/api/src/purchase/purchase.resolver.ts`                        | `myPurchase(flashSaleId, userId)`; `purchaseItem(flashSaleId, userId)` — **no** client `purchaseId` arg  |
| `apps/api/test/graphql/graphql-api.integration.spec.ts`             | Exact operation documents / variables used in #26                                                        |

**Verified baseline (as of plan authoring against current tree):**

```graphql
query FlashSale($id: ID!) {
  flashSale(id: $id) {
    id
    status
    remainingStock
    totalStock
    startsAt
    endsAt
  }
}

query MyPurchase($flashSaleId: ID!, $userId: ID!) {
  myPurchase(flashSaleId: $flashSaleId, userId: $userId) {
    purchased
    purchaseId
    purchasedAt
  }
}

mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
  purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
    status
    message
    purchaseId
  }
}
```

DateTime scalars arrive as ISO strings over JSON. Re-verify before implementing Task 2 if the API has moved.

---

## Task 0: Branch + dependencies

**Files:**

- Modify: `apps/web/package.json`
- Modify: root lockfile via pnpm

- [ ] **Step 1: Confirm branch / working tree**

```bash
cd /home/rex/Project/test/app
git status --short
git status -sb
git rev-parse --short HEAD
git branch --list 'epic-05/*'
```

**Intended dirty files (allowed to keep; do not discard):**

- `docs/superpowers/specs/2026-07-28-epic-05-react-frontend-design.md`
- `docs/superpowers/plans/2026-07-28-epic-05-react-frontend.md`
- Optionally `.superpowers/**` brainstorm artifacts (gitignore if needed; do not commit unless asked)

**Unrelated dirty files (anything else modified/untracked that is not the above):**

- **STOP.** Do not stage, edit around, stash-drop, or continue implementation.
- Report the unrelated paths to the operator and wait for confirmation.

**Existing branch stop condition:**

- If `epic-05/react-frontend` (or the chosen EPIC-05 branch) **already exists**:
  - Inspect its tip commit / divergence from `main`.
  - If it contains **any** commits or working-tree state that is not clearly this EPIC-05 work → **STOP**.
  - **Do not modify, reset, rebase, force-checkout, or continue committing on that branch until the operator explicitly confirms reuse or provides another branch name.**
  - Agentic workers must treat “ask the operator” as a hard gate: end the turn with the question; do not proceed mid-plan.

**Fresh branch path (only when stop conditions are clear):**

- Ensure work starts from up-to-date `main` (fetch/ff-only as appropriate).
- Create a dedicated EPIC-05 branch only if it does not already exist.

Example (only if working tree is clean-or-only-intended-docs, and branch does not exist):

```bash
git checkout main
git pull --ff-only
git checkout -b epic-05/react-frontend
```

- [ ] **Step 2: Install runtime + test dependencies**

```bash
pnpm --filter web add react-router-dom graphql graphql-request @tanstack/react-query
pnpm --filter web add -D msw @testing-library/user-event
```

- [ ] **Step 3: Inspect installed `graphql-request` error shape**

After install, open the package’s `ClientError` (or equivalent) typings/source under `apps/web/node_modules/graphql-request` and note:

- how GraphQL `errors[]` are exposed
- how network/fetch failures are thrown (often plain `TypeError` / `DOMException`, not `ClientError`)

Use that shape in Task 2 `toRequestError` — do not invent fields.

- [ ] **Step 4: Optional commit (only if user asked)**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: add web GraphQL and router dependencies for EPIC-05

EOF
)"
```

---

## Task 1: Routing scaffolding (#33)

**Files:**

- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/pages/LandingPage.tsx`
- Create: `apps/web/src/pages/FlashSalePage.tsx` (shell)
- Create: `apps/web/src/pages/NotFoundPage.tsx`
- Create: `apps/web/src/app/router.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css` as needed

- [ ] **Step 1: Write failing router tests**

Create `apps/web/src/app/router.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from './router';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('renders landing guidance at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: /flash sale/i })).toBeInTheDocument();
    expect(screen.getByText(/\/sales\//i)).toBeInTheDocument();
  });

  it('renders flash sale page shell at /sales/:flashSaleId', () => {
    renderAt('/sales/sale-123');
    expect(screen.getByTestId('flash-sale-page')).toBeInTheDocument();
    expect(screen.getByText(/sale-123/)).toBeInTheDocument();
  });

  it('renders not found for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter web test -- src/app/router.test.tsx
```

Expected: FAIL (missing modules / exports).

- [ ] **Step 3: Implement pages + router**

`LandingPage.tsx` — instructions + example `/sales/<flashSaleId>` + optional demo link.  
`NotFoundPage.tsx` — heading “Not found” + link home.  
`FlashSalePage.tsx` shell:

```tsx
import { useParams } from 'react-router-dom';

export function FlashSalePage() {
  // useParams may type flashSaleId as string | undefined; default '' preserves the gate.
  // Pass the value to GraphQL later exactly as returned — no trim/lowercase/manual decode.
  const { flashSaleId = '' } = useParams();

  return (
    <main className="shell" data-testid="flash-sale-page">
      <p className="eyebrow">Flash Sale</p>
      <h1>Sale {flashSaleId}</h1>
      <p className="lede">Sale details load in a later step.</p>
    </main>
  );
}
```

`router.tsx`:

```tsx
import { Route, Routes } from 'react-router-dom';

import { FlashSalePage } from '../pages/FlashSalePage';
import { LandingPage } from '../pages/LandingPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<FlashSalePage />} path="/sales/:flashSaleId" />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}
```

Wire `App` → `AppRoutes`; `main.tsx` wraps `BrowserRouter` (QueryClient comes in Task 3).

Update `App.test.tsx` to render landing via `MemoryRouter`.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 5: Optional commit**

```bash
git add apps/web/src
git commit -m "$(cat <<'EOF'
feat: add flash sale routes and page shells

EOF
)"
```

---

## Task 2: Verify EPIC-03 contract + GraphQL foundation (#34)

**Files:**

- Create: `apps/web/src/graphql/client.ts`
- Create: `apps/web/src/graphql/types.ts`
- Create: `apps/web/src/graphql/errors.ts`
- Create: `apps/web/src/graphql/errors.spec.ts`
- Create: `apps/web/src/graphql/id.ts`
- Create: `apps/web/src/graphql/id.spec.ts`
- Create: `apps/web/src/graphql/operations/flashSale.ts`
- Create: `apps/web/src/graphql/operations/myPurchase.ts`
- Create: `apps/web/src/graphql/operations/purchaseItem.ts`

- [ ] **Step 1: Re-verify EPIC-03 contract on the branch**

```bash
# Read object types, enums, resolvers, and #26 documents listed in the contract snapshot above.
# Confirm operation names, args, fields, nullability, enums.
# Do not freeze types/documents until this matches.
```

If the live API differs from the snapshot, **update types/documents to the live API** and note the delta in the PR description. Do not invent fields from the EPIC-05 design alone.

- [ ] **Step 2: Write failing ID + error-normalization tests**

`id.spec.ts` — reject `''` / whitespace-only; accept `' user-123 '` without claiming trim.

`errors.spec.ts` — required behaviors:

```ts
import { describe, expect, it } from 'vitest';

import { RequestError, toRequestError } from './errors';

describe('toRequestError', () => {
  it('maps GraphQL ClientError-like failures to safe GRAPHQL copy without leaking backend message', () => {
    const backend = {
      response: {
        errors: [
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
            message: 'Purchase failed because transaction serialization failed at xid=42',
          },
        ],
      },
    };

    const err = toRequestError(backend);
    expect(err).toBeInstanceOf(RequestError);
    expect(err.kind).toBe('GRAPHQL');
    expect(err.code).toBe('INTERNAL_SERVER_ERROR');
    expect(err.message).toBe("We couldn't complete your request. Please try again.");
    expect(err.message).not.toContain('transaction serialization');
  });

  it('maps network/transport failures to safe NETWORK copy', () => {
    const err = toRequestError(new TypeError('Failed to fetch'));
    expect(err.kind).toBe('NETWORK');
    expect(err.message).toBe(
      "We couldn't reach the server. Please check your connection and try again.",
    );
  });
});
```

Adjust the ClientError fixture to match the **installed** `graphql-request` shape discovered in Task 0.

- [ ] **Step 3: Implement GraphQL foundation**

`id.ts`:

```ts
/** Gate only — never use to mutate/normalize values before send. */
export function isNonWhitespaceId(value: string): boolean {
  return !/^\s*$/.test(value);
}
```

`errors.ts` (contract — exact ClientError detection may use `instanceof ClientError` from `graphql-request` once installed):

```ts
export type RequestErrorKind = 'GRAPHQL' | 'NETWORK' | 'UNKNOWN';

export class RequestError extends Error {
  readonly code?: string;
  readonly kind: RequestErrorKind;

  constructor(message: string, kind: RequestErrorKind, code?: string) {
    super(message);
    this.name = 'RequestError';
    this.kind = kind;
    this.code = code;
  }
}

const SAFE_GRAPHQL = "We couldn't complete your request. Please try again.";
const SAFE_NETWORK = "We couldn't reach the server. Please check your connection and try again.";
const SAFE_UNKNOWN = 'Something went wrong. Please try again.';

export function toRequestError(error: unknown): RequestError {
  if (error instanceof RequestError) {
    return error;
  }

  // Prefer graphql-request ClientError detection from the installed package.
  // Extract extensions.code when present; NEVER put GraphQL errors[].message into UI copy.
  if (isGraphqlClientError(error)) {
    return new RequestError(SAFE_GRAPHQL, 'GRAPHQL', readGraphqlCode(error));
  }

  if (isNetworkError(error)) {
    return new RequestError(SAFE_NETWORK, 'NETWORK');
  }

  return new RequestError(SAFE_UNKNOWN, 'UNKNOWN');
}

function isGraphqlClientError(error: unknown): boolean {
  // Prefer `instanceof ClientError` from installed graphql-request once available.
  // Structural fallback only if needed for tests/fixtures:
  return Boolean(
    error &&
    typeof error === 'object' &&
    'response' in error &&
    Array.isArray((error as { response?: { errors?: unknown } }).response?.errors),
  );
}

function readGraphqlCode(error: unknown): string | undefined {
  const errors = (error as { response?: { errors?: Array<{ extensions?: { code?: string } }> } })
    .response?.errors;
  return errors?.[0]?.extensions?.code;
}

function isNetworkError(error: unknown): boolean {
  // Prefer known transport classes. Avoid brittle message-regex matching across browsers.
  // TypeError is the common fetch-failure class in browsers/jsdom.
  // DOMException (AbortError / NetworkError) when present also counts as transport.
  if (error instanceof TypeError) {
    return true;
  }
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return (
      error.name === 'AbortError' || error.name === 'NetworkError' || error.name === 'TimeoutError'
    );
  }
  return false;
}
```

**GraphQL ClientError tests (required after install):** treat installed `graphql-request` `ClientError` as authoritative. Cover at least:

1. Response with `errors[]` and **no `data`** (or `data: null`) → `kind: 'GRAPHQL'`, safe message, optional `extensions.code`.
2. Response with **both** `data` and `errors[]` if/when the installed client surfaces that as `ClientError` — still safe message; never leak `errors[].message`.

Do not rely solely on a hand-rolled structural check if `instanceof ClientError` is available from the installed package.

For purchase-specific UI, `RequestErrorBanner` may specialize copy (“couldn't complete your purchase”) while still using `RequestError.kind` — never raw backend GraphQL messages.

`types.ts` — freeze only after Step 1 verification (baseline):

```ts
export type FlashSaleStatus = 'UPCOMING' | 'ACTIVE' | 'SOLD_OUT' | 'ENDED';

export type PurchaseOutcome =
  'SUCCESS' | 'ALREADY_PURCHASED' | 'SALE_NOT_STARTED' | 'SALE_ENDED' | 'SOLD_OUT';

export type FlashSale = {
  endsAt: string;
  id: string;
  remainingStock: number;
  startsAt: string;
  status: FlashSaleStatus;
  totalStock: number;
};

export type MyPurchaseResult = {
  purchaseId: string | null;
  purchased: boolean;
  purchasedAt: string | null;
};

export type PurchaseItemResult = {
  message: string;
  purchaseId: string | null;
  status: PurchaseOutcome;
};
```

`client.ts`:

```ts
import { GraphQLClient } from 'graphql-request';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const graphqlClient = new GraphQLClient(`${apiUrl.replace(/\/$/, '')}/graphql`);
```

Operations: use the verified documents from the contract snapshot; wrap with `toRequestError` on catch. Pass IDs through unchanged.

- [ ] **Step 4: Run unit + typecheck**

```bash
pnpm --filter web test -- src/graphql
pnpm --filter web typecheck
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 5: Optional commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add GraphQL client, safe errors, and operation modules

EOF
)"
```

---

## Task 3: QueryClient + MSW + hooks + eligibility

**Files:**

- Create: `apps/web/src/app/query-client.ts`
- Create: `apps/web/src/test/msw/*`
- Create: `apps/web/src/test/render.tsx`
- Create: `apps/web/src/test/query-client.ts`
- Modify: `apps/web/src/test/setup.ts`
- Modify: `apps/web/src/main.tsx` (add `QueryClientProvider`)
- Modify: `apps/web/vite.config.ts` (**merge only**; preserve existing test config)
- Create: hooks + `buy-eligibility.ts` + specs

- [ ] **Step 1: Inspect `vite.config.ts` and merge carefully**

Read existing config. Add `test.env.VITE_API_URL` only if `import.meta.env.VITE_API_URL` is otherwise unset in Vitest. Do **not** replace unrelated `test` keys.

Default MSW handler strategy (**Option A**): HTTP is handled; unmatched GraphQL `operationName` returns a GraphQL error payload so tests fail loudly unless they `server.use` an override. Document this in `handlers.ts` comment. `server.listen({ onUnhandledRequest: 'error' })` still catches non-GraphQL URL mistakes.

Default unmatched-operation body (deterministic test-only code):

```ts
return HttpResponse.json({
  errors: [
    {
      extensions: { code: 'UNHANDLED_TEST_OPERATION' },
      message: `Unhandled GraphQL operation in test: ${body.operationName ?? 'unknown'}`,
    },
  ],
});
```

UI must still show the **safe** generic GraphQL message (not the raw `message` string). Add **one explicit test** that an unmatched operation results in a visible request-error / failed query assertion rather than silently succeeding.

`renderApp` **must** use `createTestQueryClient()` with **`retry: false`** for both queries and mutations (avoids debounce + RQ retry flakiness under MSW). Production `createQueryClient()` keeps its conservative network retry; cover that factory in a small unit test if desired — **not** inside page integration tests.

```ts
// apps/web/src/test/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });
}
```

- [ ] **Step 2: Implement QueryClient, MSW, hooks, eligibility**

`query-client.ts` (production):

```ts
import { QueryClient } from '@tanstack/react-query';

import { RequestError } from '../graphql/errors';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: {
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof RequestError && error.kind === 'GRAPHQL') {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}
```

Hooks:

- `useFlashSale(flashSaleId)` — enabled via `isNonWhitespaceId`
- `useMyPurchase(flashSaleId, debouncedUserId)` — same
- `usePurchaseItem()` — `mutate({ flashSaleId, userId })`; `onSettled` invalidates using **variables** only:

```ts
onSettled: (_data, _error, variables) => {
  if (!variables) return;
  void queryClient.invalidateQueries({
    queryKey: myPurchaseQueryKey(variables.flashSaleId, variables.userId),
  });
  void queryClient.invalidateQueries({
    queryKey: flashSaleQueryKey(variables.flashSaleId),
  });
},
```

`buy-eligibility.ts` — use semantic flag name:

```ts
export function isBuyDisabled(input: {
  flashSaleError: boolean;
  flashSaleLoading: boolean;
  flashSaleStatus: FlashSaleStatus | undefined;
  mutationPending: boolean;
  myPurchaseInitialPending: boolean; // isPending && !isError
  purchased: boolean | undefined;
  userIdValid: boolean;
}): boolean {
  if (!input.userIdValid) return true;
  if (input.flashSaleLoading || input.flashSaleError) return true;
  if (input.flashSaleStatus !== 'ACTIVE') return true;
  if (input.myPurchaseInitialPending) return true;
  if (input.purchased === true) return true;
  if (input.mutationPending) return true;
  return false;
}
```

Page wiring (later tasks) must compute:

```ts
const myPurchaseInitialPending = myPurchaseQuery.isPending && !myPurchaseQuery.isError;
```

**Do not** pass `isFetching` into the disable predicate.

Eligibility unit tests must cover:

- initial pending ⇒ disabled
- error with no data ⇒ **enabled** (other guards pass)
- `purchased: true` ⇒ disabled
- comment/test name clarifying refetch/`isFetching` is out of scope for the predicate (covered in page integration Task 5)

- [ ] **Step 3: Run tests**

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

- [ ] **Step 4: Optional commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add flash-sale query hooks and MSW test harness

EOF
)"
```

---

## Task 4: Display flash sale status (#35)

**Files:** SaleStatusCard, RequestErrorBanner, FlashSalePage, FlashSalePage.test.tsx

- [ ] **Step 1: Failing tests**

  - ACTIVE status/stock from API; loading; error + retry; Buy disabled until ACTIVE + other guards.
  - **Observable status-authority fixtures** (do not try to “prove absence” of clock code):
    - API returns `status: ACTIVE` with `startsAt`/`endsAt` clearly **outside** a naive “now inside window” reading → UI still renders **ACTIVE**.
    - API returns `status: ENDED` with timestamps that would look “inside the window” to a naive client clock → UI still renders **ENDED**.
  - Exact route `flashSaleId` sent to `FlashSale` query (use an id with unusual characters, e.g. `Sale_ABC-123` or encoded-looking segments as routed by React Router) — variables.id must match route param exactly.

- [ ] **Step 2: Implement** — `useFlashSale`; render `status` enum as-is (or 1:1 label map). Timestamps informational only.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter web test -- src/pages/FlashSalePage.test.tsx
```

- [ ] **Step 4: Optional commit** — `feat: display backend flash sale status on sale page`

---

## Task 5: User identifier + debounced `myPurchase` (#36)

**Files:** PurchasePanel, FlashSalePage, tests

- [ ] **Step 1: Failing tests**

1. Whitespace-only → no `MyPurchase` request.
2. Enter `" user-123 "` → after debounce, `MyPurchase` variables `userId === " user-123 "` (exact).
3. `purchased: true` → Buy disabled + already-purchased UI.
4. `myPurchase` GraphQL error → recoverable request-error UI; Buy **enabled** (sale ACTIVE, valid userId).
5. After successful `purchased: false`, force a background refetch (`isFetching` true with data) → Buy **remains enabled** (proves not using `isFetching`).

Use fake timers for debounce. Capture GraphQL variables from MSW.

- [ ] **Step 2: Implement**

```tsx
const [userId, setUserId] = useState('');
const debouncedUserId = useDebouncedValue(userId, 300);
const myPurchaseQuery = useMyPurchase(flashSaleId, debouncedUserId);
const myPurchaseInitialPending = myPurchaseQuery.isPending && !myPurchaseQuery.isError;
```

Pass `myPurchaseInitialPending` into `isBuyDisabled`. Show `RequestErrorBanner` on `myPurchaseQuery.isError` with retry → `refetch()`; do not disable Buy for that error alone.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Optional commit** — `feat: add user id input and debounced myPurchase pre-check`

---

## Task 6: Buy Now + variable invalidation + raw ID + race (#37)

**Files:** PurchasePanel, usePurchaseItem wiring, PurchaseOutcomeBanner (minimal), FlashSalePage.test.tsx

- [ ] **Step 1: Required failing tests**

**A. Exact IDs end-to-end (raw `userId` + route `flashSaleId`)**

```text
Route: /sales/Sale_ABC-123.%7Etest   (or another unusual but router-legal id)
Type userId = " user-123 "

After debounce:
  MyPurchase variables.flashSaleId === exact route param
  MyPurchase variables.userId === " user-123 "

Click Buy:
  PurchaseItem variables.flashSaleId === exact route param
  PurchaseItem variables.userId === " user-123 "

FlashSale query variables.id === exact route param
```

This protects the no-trim / no-lowercase / no-manual-decode invariant for **both** identifiers.

**B. Mutation-variable invalidation (required acceptance)**

```text
1. Load sale-123 + user-456 (myPurchase purchased:false completed).
2. Optionally prime an unrelated cached key (e.g. myPurchase sale-123/other-user) that must NOT refetch.
3a. purchaseItem SUCCESS (or other business outcome) settles
    → FlashSale(sale-123) count +1
    → MyPurchase(sale-123, user-456) count +1
    → MyPurchase(sale-123, other-user) does NOT increment
3b. SEPARATE case: purchaseItem settles with a GraphQL/network **request error**
    → same invalidation/refetch increments for sale-123 + user-456
    → proves onSettled runs for error settlements, not only business outcomes
```

Use request counters in the MSW handler keyed by `operationName` + variables.

**C. No premature SUCCESS**

Buy click → pending UI → before resolve, no SUCCESS copy; after `SUCCESS`, success UI.

**D. Stale ACTIVE → backend SOLD_OUT race (recommended → treat as required)**

```text
Initial flashSale: status=ACTIVE, remainingStock=1
myPurchase: purchased=false
Click Buy
Mutation returns status=SOLD_OUT
Expected:
  SOLD_OUT outcome rendered
  SUCCESS not rendered
  ACTIVE assumption does not override outcome
  flashSale (+ myPurchase) invalidated/refetched
```

- [ ] **Step 2: Implement mutation wiring**

```tsx
const purchaseMutation = usePurchaseItem();

function onBuy() {
  purchaseMutation.mutate({ flashSaleId, userId }); // raw userId
}
```

Outcome banner only from `purchaseMutation.data`.  
Request errors from `purchaseMutation.error` via `RequestErrorBanner` (safe copy).

- [ ] **Step 3: Full web verification for this slice**

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web lint
```

- [ ] **Step 4: Optional commit** — `feat: implement Buy Now purchaseItem flow`

---

## Task 7: Purchase result states (#38)

- [ ] Cover all five `PurchaseOutcome` values with distinct UI (headings/`role="status"`).
- [ ] Prefer showing `PurchaseItemResult.message` as business copy; keep stable outcome labels for tests.
- [ ] GraphQL/network mutation failure still uses request-error path — never mapped to outcomes.
- [ ] Optional commit — `feat: render purchaseItem business outcome states`

---

## Task 8: Sold-out and sale-ended UX (#39)

- [ ] `status` `SOLD_OUT` / `ENDED` / `UPCOMING` disable Buy with clear messaging (from API status field only).
- [ ] Mutation outcomes `SOLD_OUT` / `SALE_ENDED` still render when UI was stale ACTIVE (covered in Task 6 D; keep assertions here if split).
- [ ] Optional commit — `feat: handle sold-out and sale-ended UI states`

---

## Task 9: Loading / error recovery (#40)

**Locked mutation retry behavior:**

> Mutation request-error recovery must call `purchaseMutation.reset()` before retry **or** otherwise ensure a subsequent mutation clears previous error **and** previous business-outcome presentation. Prefer:

```ts
function onRetryPurchase() {
  purchaseMutation.reset(); // clears error + data from prior attempt
  purchaseMutation.mutate({ flashSaleId, userId });
}
```

When a new attempt starts (pending), the UI must **not** continue showing a stale prior `SUCCESS` / other outcome from `purchaseMutation.data`.

**Required tests:**

```text
Case 1 — error then success:
  purchaseItem → GraphQL/network request error
  → request-error banner visible
  click Try again (reset + mutate)
  → second PurchaseItem request sent
  → prior request-error cleared at start of retry (or immediately on reset)
  second request SUCCESS
  → request-error banner gone
  → SUCCESS outcome visible

Case 2 — stale outcome cleared on new attempt:
  First mutation SUCCESS → success outcome visible
  Trigger another purchase attempt (or reset+mutate path used by Try again after a later error)
  → when mutation becomes pending / after reset, previous SUCCESS outcome is not shown
  → only the latest settled result is rendered
```

Also harden:

| State                                    | Visible         | Buy                                 |
| ---------------------------------------- | --------------- | ----------------------------------- |
| `flashSale` loading                      | yes             | disabled                            |
| `flashSale` error + retry                | yes             | disabled                            |
| `myPurchase` initial pending             | yes             | disabled                            |
| `myPurchase` error + retry               | yes             | **not** disabled by this alone      |
| `myPurchase` background refetch          | optional subtle | **enabled** if other guards pass    |
| `purchaseItem` pending                   | yes             | disabled                            |
| `purchaseItem` request error + Try again | yes             | enabled after settle if guards pass |

- [ ] Full verification:

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web build
```

- [ ] Optional commit — `feat: harden loading and recoverable error states`

---

## Task 10: Final epic checklist

- [ ] Spec coverage audit against locked decisions (including safe errors, initial-pending semantics, variable-scoped invalidation, raw ID preservation, mutation retry).
- [ ] Optional local smoke against running API.
- [ ] Do not commit/push unless user asks.

---

## Self-review (plan author)

| Spec / review requirement                                                                      | Task          |
| ---------------------------------------------------------------------------------------------- | ------------- |
| Hard stop on unrelated dirty files / existing branch                                           | Task 0        |
| EPIC-03 schema verification before types                                                       | Task 2 Step 1 |
| Safe non-leaky `toRequestError`; ClientError authoritative; errors-only + data+errors fixtures | Task 2        |
| Network errors via TypeError/DOMException, not message regex                                   | Task 2        |
| Routes `/`, `/sales/:id`, `*`                                                                  | Task 1        |
| Exact route `flashSaleId` to GraphQL (unusual chars)                                           | Task 4, 6A    |
| Debounce delay-only / strict IDs                                                               | Task 3, 5, 6  |
| `myPurchase` initial pending vs refetch vs error                                               | Task 3, 5, 9  |
| Raw `userId` on MyPurchase **and** PurchaseItem                                                | Task 5, 6A    |
| Mutation-variable invalidation on SUCCESS **and** request error                                | Task 6B       |
| Stale ACTIVE → SOLD_OUT race                                                                   | Task 6D       |
| Status authority observable fixtures (ACTIVE/ENDED vs timestamps)                              | Task 4        |
| MSW `UNHANDLED_TEST_OPERATION` + loud failure test                                             | Task 3        |
| Test QueryClient `retry: false`                                                                | Task 3        |
| Business outcomes vs request errors                                                            | Task 6–9      |
| Mutation Try again / reset; clear stale outcome                                                | Task 9        |
| Preserve Vite config merge                                                                     | Task 3        |
| No Playwright / no codegen                                                                     | Out of scope  |

No intentional placeholders remain for required behaviors. `usePurchaseItem()` + `mutate({ flashSaleId, userId })` is the locked equivalent of `usePurchaseItem({ flashSaleId, userId })` for variable-scoped invalidation.
