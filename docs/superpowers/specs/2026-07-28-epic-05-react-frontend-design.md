# EPIC-05 — React Frontend (Design Spec)

**Status:** Approved (pending commit)
**Date:** 2026-07-28
**Epic:** [EPIC-05 #85](https://github.com/rexescario-dev/flash-sale-system/issues/85)
**Child issues:** #33–#40
**Repository:** `rexescario-dev/flash-sale-system`
**Depends on:** EPIC-03 GraphQL API (#21–#26) merged to `main` at `79c5fe4`

## Goal

Build a simple React + TypeScript frontend that lets users:

- open a flash sale by URL
- view backend-authoritative sale status and stock
- enter a manual `userId`
- attempt purchase and see backend-authoritative outcomes

## Architectural principle

> The frontend is a thin client over EPIC-03 GraphQL contracts. UI state coordinates user interaction, while server state and purchase decisions remain backend-authoritative.

The page orchestrates three API operations (`flashSale`, `myPurchase`, `purchaseItem`) via dedicated data modules and TanStack Query hooks. Components do not embed GraphQL request logic.

## Locked decisions

| Area                           | Decision                                                                                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route identity                 | Use URL route parameter: `/sales/:flashSaleId`                                                                                                                                                                                     |
| User identity                  | Keep `userId` as manual page input                                                                                                                                                                                                 |
| Routing library                | Use `react-router-dom`                                                                                                                                                                                                             |
| Data stack                     | Use `graphql-request` + TanStack Query                                                                                                                                                                                             |
| Operation placement            | Keep GraphQL operations in dedicated modules, separate from components                                                                                                                                                             |
| Type strategy                  | Handwritten operation input/result types in `graphql/types.ts` (and/or colocated with operations); mirror EPIC-03 schema; no frontend reinterpretation of enums/outcomes; no GraphQL codegen in this epic                          |
| `myPurchase` timing            | Call `myPurchase` on valid `userId` entry with debounce                                                                                                                                                                            |
| Debounce semantics             | Debouncing delays execution only; it does **not** trim or normalize `userId`. The value sent is the exact user-entered value after the debounce interval                                                                           |
| Purchase authority             | `myPurchase` is UX optimization only; `purchaseItem` mutation outcome is authoritative                                                                                                                                             |
| `myPurchase` error             | GraphQL/network error on `myPurchase` is a recoverable request error; it does **not** by itself disable Buy                                                                                                                        |
| Post-mutation refresh          | `onSettled` invalidates both `myPurchase` and `flashSale` for every settlement (business outcomes, GraphQL errors, and network errors), keyed from **mutation variables**                                                          |
| Mutation retry                 | Call `mutation.reset()` before retry; clear prior request-error **and** prior business-outcome presentation when a new attempt starts                                                                                              |
| Sale status authority          | Frontend must **never** derive `UPCOMING` / `ACTIVE` / `ENDED` from `startsAt`, `endsAt`, or the browser clock; render `flashSale.status` only. Tests use observable fixtures (API ACTIVE outside window; API ENDED inside window) |
| Buy eligibility guards         | UX-only disables based on `flashSale.status`, `myPurchase`, and loading/pending flags; mutation outcomes remain authoritative if a race still submits                                                                              |
| `myPurchase` pending semantics | Only the **initial** `myPurchase` pending state (`isPending && !isError`) disables Buy. Background `isFetching` refetch does **not** disable Buy. Request error does **not** disable Buy                                           |
| Request-error UX               | GraphQL/network failures use **safe** user-facing copy only; never render raw GraphQL `error.message` automatically. `PurchaseItemResult.message` from a successful business response **may** be shown                             |
| ID validation behavior         | Strict mirror of EPIC-03: reject empty/whitespace-only IDs from triggering requests; no trim/normalize before sending                                                                                                              |
| Default route                  | `/` renders minimal landing page with instructions and example sale link                                                                                                                                                           |
| Testing                        | Vitest + Testing Library + MSW at GraphQL HTTP boundary; no Playwright in EPIC-05                                                                                                                                                  |

## Scope and boundaries

### In scope

- Routing surface for:
  - `/`
  - `/sales/:flashSaleId`
  - `*` (not found)
- Flash sale page flow:
  - fetch sale status/stock from `flashSale`
  - manual `userId` entry
  - debounced `myPurchase` pre-check
  - `purchaseItem` execution and outcome rendering
  - cache invalidation/refetch after mutation
- User-visible loading/error/success/outcome states from child issues #35, #37, #38, #39, #40
- Component/integration tests that validate behavior through rendered UI and GraphQL HTTP mocks

### Out of scope

- Authentication/authorization
- Sale discovery/listing/search
- Build-time default `flashSaleId` coupling (`VITE_FLASH_SALE_ID`)
- Polling-based live updates
- GraphQL Code Generator and shared codegen package
- Browser E2E suite (Playwright/Cypress)

## Recommended implementation approach

Adopt a **thin page-centric feature slice**:

- Route provides `flashSaleId`.
- `FlashSalePage` owns orchestration of route param, raw `userId` input state, debounced derivation, and query/mutation hooks.
- Presentational sections render sale details, purchase eligibility, and outcomes.

This aligns with EPIC-05 scope, minimizes abstractions, and keeps race/invalidation behavior explicit in one place.

## Data flow

```text
/sales/:flashSaleId
        │
        ▼
   FlashSalePage
   ├─ flashSaleId (route param, as-is)
   ├─ userId (raw local input state)
   ├─ debouncedUserId (delay only; no trim/normalize)
   ├─ useFlashSale(flashSaleId)
   ├─ useMyPurchase(flashSaleId, debouncedUserId)
   └─ usePurchaseItem({ flashSaleId, userId })
          └─ onSettled(variables) =>
                invalidate ['myPurchase', variables.flashSaleId, variables.userId]
                invalidate ['flashSale', variables.flashSaleId]
        │
        ▼
 Presentational sections
 ├─ sale status/stock
 ├─ user purchase status
 └─ buy CTA + purchase outcome / request error
```

## API contract mapping (EPIC-03)

### Query: `flashSale(id)`

- Input source: route param `flashSaleId`
- Purpose: show authoritative `status`, `remainingStock`, window timestamps
- UX rule: frontend does not compute time-based status locally
- Acceptance: the frontend must not derive `UPCOMING`, `ACTIVE`, or `ENDED` from `startsAt`, `endsAt`, or the browser clock; it renders the `status` returned by `flashSale`

### Query: `myPurchase(flashSaleId, userId)`

- Input source: route param + **debounced** raw `userId`
- Trigger: after debounce interval, when both IDs pass non-empty/non-whitespace guard
- Purpose: proactively show already-purchased state and disable Buy
- Important: optimization only; must not be treated as final admission control

### Mutation: `purchaseItem(flashSaleId, userId)`

- Trigger: user clicks Buy (with eligibility guards satisfied)
- Result handling:
  - successful GraphQL response with `PurchaseOutcome` → domain-level outcome UI
  - GraphQL/network/transport failure → recoverable request error UI (not mapped to a business outcome)
- SUCCESS rule: the UI must never display `SUCCESS` based solely on Buy click or mutation initiation; `SUCCESS` is rendered only when the backend returns the `SUCCESS` outcome
- On settle: invalidate both `myPurchase` and `flashSale` using **mutation variables**

## Routing behavior

### `/`

Render a minimal landing page with:

- short instruction text
- example path format `/sales/<flashSaleId>`
- optional sample link for local manual testing

No sale discovery logic is introduced in this epic.

### `/sales/:flashSaleId`

Render `FlashSalePage` and orchestrate full flow.

### `*`

Render minimal not-found page.

## State and UI behavior

### Input and validity rules

- `flashSaleId`: consume route param as-is.
- `userId`: page maintains the **raw** input value.
- A debounced value is derived from the raw input.
- Debouncing delays execution only; it does **not** normalize the identifier.
- The value sent to `myPurchase` / `purchaseItem` is the exact entered value (after debounce for `myPurchase`).
- No silent trim/normalization before sending requests.
- If either ID is empty/whitespace-only, do not fire the request tied to that ID.

### Debounce semantics

```text
raw userId
    │ typing
    ▼
"u" → "us" → "user-123"
    │ debounce (delay only)
    ▼
"user-123"   ← exact value; no trim
    │
    ▼
myPurchase(flashSaleId, "user-123")
```

`useMyPurchase` receives the debounced value and is enabled only when both `flashSaleId` and the debounced `userId` are non-empty/non-whitespace.

### Buy button rules

Buy eligibility checks are **UX guards only**. The UI must always handle every backend mutation outcome as authoritative if a stale UI somehow still submits.

Disable Buy when **any** of the following is true:

- `userId` is empty/whitespace-only (invalid)
- `flashSale` is loading
- `flashSale` is in error (no confirmed sale)
- `flashSale.status !== ACTIVE` (`UPCOMING`, `SOLD_OUT`, or `ENDED`)
- current `myPurchase` is in **initial pending** (`isPending && !isError`) for the debounced `userId`
- `myPurchase.purchased === true`
- `purchaseItem` mutation is pending

Otherwise Buy may be enabled.

```text
flashSale loading / error → Buy disabled
flashSale.status = UPCOMING → Buy disabled
flashSale.status = SOLD_OUT → Buy disabled
flashSale.status = ENDED    → Buy disabled
flashSale.status = ACTIVE
  AND myPurchase initial pending → Buy disabled
  AND myPurchase.purchased       → Buy disabled
  AND myPurchase request error   → Buy may remain enabled
  AND myPurchase background refetch (isFetching with data) → Buy stays enabled
  AND otherwise                  → Buy enabled (subject to valid userId + not mutating)
```

Rationale for disabling while `myPurchase` is initially pending: purchase eligibility is not yet known; allowing Buy creates avoidable races and confusing UX. Backend still protects correctness. Do **not** use `isFetching` alone as the Buy-disable signal.

### `myPurchase` request error

A `myPurchase` GraphQL/network error is rendered as a recoverable request error. It does **not** by itself disable Buy, because `myPurchase` is a UX optimization rather than admission control. The user may retry the pre-check or proceed with Buy if all other UX guards pass. The `purchaseItem` mutation remains authoritative.

```text
myPurchase
├── loading
│     └── Buy disabled
├── purchased: true
│     └── Buy disabled
├── purchased: false
│     └── Buy enabled (if other guards pass)
└── request error
      ├── show recoverable error
      └── Buy may remain enabled
            └── purchaseItem is authoritative
```

### Outcome vs request-error rendering

Distinguish two failure classes:

1. **Business outcomes** (successful GraphQL response with `PurchaseOutcome`):

   - `SUCCESS` → purchase successful
   - `ALREADY_PURCHASED` → already purchased
   - `SALE_NOT_STARTED` → sale has not started
   - `SALE_ENDED` → sale has ended
   - `SOLD_OUT` → sold out

2. **Request errors** (GraphQL/network/transport failure):

   - safe recoverable copy only (do **not** render raw GraphQL `error.message` automatically)
   - example purchase failure: “We couldn't complete your purchase. Please try again.”
   - example network failure: “We couldn't reach the server. Please check your connection and try again.”
   - do **not** map these to business outcomes

`PurchaseItemResult.message` from a **successful** GraphQL business response is trusted business copy and may be shown. GraphQL transport/`errors[].message` values are **not** automatically rendered to users.

Business outcomes returned by `purchaseItem` are rendered as domain-level purchase results. GraphQL/network failures are rendered as request errors.

Mutation business outcome takes precedence over speculative UI assumptions from `flashSale` / `myPurchase` guards.

## Proposed module layout

```text
apps/web/src/
  app/
    router.tsx
    query-client.ts
  pages/
    LandingPage.tsx
    FlashSalePage.tsx
    NotFoundPage.tsx
  graphql/
    client.ts
    errors.ts
    types.ts
    operations/
      flashSale.ts
      myPurchase.ts
      purchaseItem.ts
  hooks/
    useDebouncedValue.ts
    useFlashSale.ts
    useMyPurchase.ts
    usePurchaseItem.ts
  features/flash-sale/
    components/
      SaleStatusCard.tsx
      PurchasePanel.tsx
      PurchaseOutcomeBanner.tsx
```

Handwritten types in `graphql/types.ts` (and/or next to operations) must reflect the EPIC-03 GraphQL contract and must not introduce frontend-specific reinterpretations of API enums or outcomes.

Hook colocated under `features/flash-sale/hooks/` is an acceptable style alternative; keeping operation-aligned hooks under `hooks/` is also fine for EPIC-05.

## Query and mutation contracts

### Query keys

- `['flashSale', flashSaleId]`
- `['myPurchase', flashSaleId, userId]`

### Hook expectations

- `useFlashSale(flashSaleId)`:
  - enabled only when `flashSaleId` is present and not whitespace-only
- `useMyPurchase(flashSaleId, debouncedUserId)`:
  - enabled only when both IDs are non-empty/non-whitespace
  - receives the **debounced** raw `userId` (no trim)
- `usePurchaseItem({ flashSaleId, userId })` (or equivalent API that exposes mutation variables):
  - mutation variables carry the exact IDs used for the request
  - `onSettled` invalidates using those variables:

```ts
onSettled: (_data, _error, variables) => {
  queryClient.invalidateQueries({
    queryKey: ['myPurchase', variables.flashSaleId, variables.userId],
  });
  queryClient.invalidateQueries({
    queryKey: ['flashSale', variables.flashSaleId],
  });
};
```

`onSettled` runs for every mutation settlement, including:

- successful business outcomes
- unsuccessful business outcomes
- GraphQL errors
- network/transport errors

Invalidating when the request never reached the backend is harmless and keeps the rule uniform.

## Error handling and retry policy

- Surface loading and error states for:
  - initial sale fetch
  - `myPurchase` check
  - mutation submit
- Keep GraphQL/network errors user-readable but non-leaky
- Explicit user retry actions: yes (retry buttons / refetch)
- Automatic TanStack Query retries:
  - configure conservatively; do not blindly retry GraphQL application errors (e.g. `NOT_FOUND`, `BAD_USER_INPUT`)
  - network/transport failures may use limited automatic retry if desired
- Buy remains disabled until a valid `flashSale` response confirms `status === ACTIVE` (and other Buy rules pass)

## Testing strategy

Use **Vitest + Testing Library + MSW** with GraphQL mocked at HTTP boundary.

### Principles

- Test user-visible behavior, not hook internals by default.
- Use real React Query behavior in tests; do not mock TanStack Query internals.
- Mock GraphQL endpoint responses in MSW, not `graphql-request` internals.

### Coverage matrix (mapped to child issues)

| Issue | Behavior to prove                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| #33   | `/sales/:flashSaleId` page renders expected layout sections                                                       |
| #34   | GraphQL client/operations are separate from components and used through hooks                                     |
| #35   | Sale status/stock render from backend `status`; no frontend clock / `startsAt`/`endsAt` derivation                |
| #36   | Manual `userId` input controls eligibility and pre-check trigger; debounce does not trim                          |
| #37   | Buy triggers `purchaseItem`; UI never claims `SUCCESS` until backend returns `SUCCESS`                            |
| #38   | `SUCCESS` and `ALREADY_PURCHASED` business outcomes render clearly                                                |
| #39   | `SOLD_OUT` / `ENDED` status disables Buy; `SALE_ENDED` / `SOLD_OUT` mutation outcomes render clearly              |
| #40   | Loading and request-error states are visible and recoverable; business outcomes not conflated with request errors |

### Core integration scenarios

- Route rendering:
  - `/` shows landing guidance
  - `/sales/:flashSaleId` shows sale page
  - unknown route shows not found
- Sale query:
  - loading → Buy disabled
  - success with status/stock
  - error → Buy disabled + recovery
- User input + pre-check:
  - whitespace-only `userId` does not trigger `myPurchase`
  - valid `userId` triggers debounced `myPurchase` with exact value
  - `myPurchase` initial pending disables Buy
  - `myPurchase` background refetch after `purchased: false` does **not** disable Buy
  - `purchased: true` disables Buy and shows already-purchased UI
  - `myPurchase` request error shows recoverable error and does **not** by itself disable Buy
- Purchase mutation:
  - in-flight disabled/loading state
  - each backend business outcome mapped to correct UI
  - GraphQL/network failure mapped to request-error UI (not a business outcome)
  - post-settle invalidation/refetch of `myPurchase` and `flashSale` for that mutation’s variables

## Delivery outline by child issue

1. **#33**: routing scaffolding + page shells (`/`, `/sales/:flashSaleId`, `*`)
2. **#34**: GraphQL client + operation modules + base query client provider
3. **#35**: sale status fetch/render (backend `status` only)
4. **#36**: `userId` input, strict validity gating, debounce-without-normalize
5. **#37**: mutation submit flow; wait for backend before any success claim
6. **#38**: success/already-purchased business outcome UI
7. **#39**: sold-out/sale-ended status guards + mutation outcome messaging
8. **#40**: loading/request-error UX hardening and recoverability

## Risks and mitigations

- **Race conditions between pre-check and mutation**  
  Mitigation: disable Buy while `myPurchase` is loading; mutation outcome remains authoritative; refetch both queries on settle.

- **Stale sale stock/status in UI after purchase**  
  Mitigation: invalidate `flashSale` on every mutation settlement (including errors).

- **Conflating transport failures with business outcomes**  
  Mitigation: separate outcome banner vs request-error UI paths.

- **Accidental client-side status computation**  
  Mitigation: render `flashSale.status` only; tests assert no clock/`startsAt`/`endsAt` derivation.

- **Overcoupling tests to implementation details**  
  Mitigation: behavior-driven tests through route/page rendering with MSW HTTP mocks.

## Acceptance summary

EPIC-05 is complete when:

- Route-driven sale page works at `/sales/:flashSaleId`.
- Backend-authoritative states and outcomes are rendered correctly.
- `userId` is manual, strict, and unnormalized (debounce delays only).
- Buy eligibility follows the UX guard matrix; mutation outcomes remain authoritative.
- Business outcomes and request errors are rendered on distinct paths.
- Query/mutation orchestration invalidates from mutation variables on every settle.
- Test suite validates user-visible flows via Vitest + Testing Library + MSW.
