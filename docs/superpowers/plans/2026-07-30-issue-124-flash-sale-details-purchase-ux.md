# Issue #124 — Flash Sale Details & Purchase UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [#124](https://github.com/rexescario-dev/flash-sale-system/issues/124) — Tailwind product-first sale detail with mobile sticky Buy (B) + desktop sticky rail (C), live countdown, nested `product`, stable Buy Now + helper, reusing #123 identity.

**Architecture:** Thin feature slice under `features/flash-sale/`; `FlashSalePage` orchestrates data + derived UI + responsive composition; presentational `StockBar` / `SaleCountdown` / `PurchaseRail` / `StickyBuyBar`; single `useSaleCountdown` (1000 ms); API `status` + `isBuyDisabled` remain authoritative.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Vitest + Testing Library + MSW, existing Tailwind bridge in `apps/web`.

**Spec:** [docs/superpowers/specs/2026-07-30-issue-124-flash-sale-details-purchase-ux-design.md](../specs/2026-07-30-issue-124-flash-sale-details-purchase-ux-design.md) — **authoritative**.

**Baseline:** `origin/main` including #123 (`25ae5d2` / PR #136). Implement in an isolated git worktree from that tip.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Existing behavior wins.** If current code differs from snippets, preserve project conventions while satisfying the design spec.

**Out of scope:** AuthN; price/images; #125–#127; #128 primitives; #129 cache product work; #130 Playwright journeys; #133/#134.

**Hard invariants (locked):**

1. API `status` + `isBuyDisabled` gate Buy — **never** enable/disable from countdown math.
2. `useSaleCountdown(startsAt, endsAt, now?)` only — timestamps; **1000 ms** tick; zero-padded `HH:MM:SS` duration (hours may exceed 24); never negative. Interval effect deps: **`[now]` only** (not `startsAt`/`endsAt`).
3. Nested `product` required on client `FlashSale`; extend query only (API already supports).
4. Reuse `IdentityStrip` / `useUserIdentity`; no sale-page `userId` input.
5. Both purchase surfaces may mount; **exactly one** visually rendered (`hidden lg:block` / `lg:hidden`). Dual mount in the a11y tree is intentional — do not conditional-render to "fix" tests.
6. Buy label always **Buy Now** or **Buying…**; helper is a single concise line (`helper?: React.ReactNode`).
7. Purchase retry re-invokes `purchaseItem` with **current committed identity**.
8. Sale window uses **browser locale/timezone** (no UTC rendering).
9. Hide purchase outcome/error banners while mutation pending.
10. Loading skeleton approximates final layout blocks (title/badge, stock, countdown, description, window, rail).

**Implementation convention:** Spec is authoritative for behavior; codebase for conventions. Prefer minimal diffs. Update E2E page-object selectors only as needed for old `sale-status` / `sale-stock` markup — no new Playwright journeys.

---

## File map

| Path                                                                    | Responsibility                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/web/src/graphql/types.ts`                                         | Add required `product` on `FlashSale`                                      |
| `apps/web/src/graphql/operations/flashSale.ts`                          | Request nested `product`                                                   |
| `apps/web/src/hooks/useSaleCountdown.ts`                                | Countdown hook + pure derive/format                                        |
| `apps/web/src/hooks/useSaleCountdown.spec.ts`                           | Modes + boundary tests                                                     |
| `apps/web/src/features/flash-sale/format-sale-window.ts`                | Browser-local window formatter                                             |
| `apps/web/src/features/flash-sale/format-sale-window.spec.ts`           | Same-day / multi-day                                                       |
| `apps/web/src/features/flash-sale/buy-helper.ts`                        | Pure helper line derivation                                                |
| `apps/web/src/features/flash-sale/buy-helper.spec.ts`                   | Precedence tests                                                           |
| `apps/web/src/features/flash-sale/components/StockBar.tsx`              | Stock progress                                                             |
| `apps/web/src/features/flash-sale/components/StockBar.test.tsx`         | 0 / 1 / full fill                                                          |
| `apps/web/src/features/flash-sale/components/SaleCountdown.tsx`         | Presentational countdown                                                   |
| `apps/web/src/features/flash-sale/purchase-surface.ts`                  | Shared `PurchaseSurfaceProps` type                                         |
| `apps/web/src/features/flash-sale/components/PurchaseControls.tsx`      | Shared Buy + helper + purchased + banners                                  |
| `apps/web/src/features/flash-sale/components/PurchaseRail.tsx`          | Desktop surface                                                            |
| `apps/web/src/features/flash-sale/components/StickyBuyBar.tsx`          | Mobile sticky surface                                                      |
| `apps/web/src/features/flash-sale/components/PurchaseRail.test.tsx`     | Surface behavior (or StickyBuyBar test — one is enough if controls shared) |
| `apps/web/src/features/flash-sale/components/RequestErrorBanner.tsx`    | Tailwind restyle                                                           |
| `apps/web/src/features/flash-sale/components/PurchaseOutcomeBanner.tsx` | Tailwind restyle                                                           |
| `apps/web/src/pages/FlashSalePage.tsx`                                  | Orchestrator rebuild                                                       |
| `apps/web/src/pages/FlashSalePage.test.tsx`                             | Update fixtures + assertions                                               |
| `apps/web/src/features/flash-sale/components/SaleStatusCard.tsx`        | **Delete**                                                                 |
| `apps/web/src/features/flash-sale/components/PurchasePanel.tsx`         | **Delete** after migration                                                 |
| `e2e/pages/sale.page.ts`                                                | Point status/stock selectors at new testids                                |

---

## Task flow

```text
Task 1  →  FlashSale + product query + fixture helper
Task 2  →  useSaleCountdown (TDD)
Task 3  →  formatSaleWindow (TDD)
Task 4  →  buy-helper (TDD)
Task 5  →  StockBar (TDD)
Task 6  →  SaleCountdown + purchase surfaces
Task 7  →  Banner Tailwind + FlashSalePage rebuild
Task 8  →  Delete obsolete components; update page + e2e tests
Task 9  →  Full verification
```

---

### Task 1: Nested `product` on detail FlashSale

**Files:**

- Modify: `apps/web/src/graphql/types.ts`
- Modify: `apps/web/src/graphql/operations/flashSale.ts`
- Modify: `apps/web/src/pages/FlashSalePage.test.tsx` (`activeSale` helper — add product so later tasks compile)

- [ ] **Step 1: Widen `FlashSale`**

In `apps/web/src/graphql/types.ts`, change `FlashSale` to include required `product`:

```ts
export type FlashSale = {
  id: string;
  endsAt: string;
  product: Product;
  remainingStock: number;
  startsAt: string;
  status: FlashSaleStatus;
  totalStock: number;
};
```

(`Product` already exists in this file.)

- [ ] **Step 2: Extend the query**

In `apps/web/src/graphql/operations/flashSale.ts`:

```ts
const FLASH_SALE_QUERY = gql`
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
`;
```

- [ ] **Step 3: Update test fixture helper**

In `FlashSalePage.test.tsx`, extend `activeSale`:

```ts
function activeSale(id: string, overrides: Partial<FlashSale> = {}): FlashSale {
  return {
    id,
    endsAt: '2099-12-31T00:00:00.000Z',
    product: {
      description: 'A great widget',
      id: `product-${id}`,
      name: 'Aurora Headphones',
    },
    remainingStock: 5,
    startsAt: '2000-01-01T00:00:00.000Z',
    status: 'ACTIVE',
    totalStock: 10,
    ...overrides,
  };
}
```

Also fix any other `FlashSale` object literals in web tests that lack `product` (search `remainingStock` / `status: 'ACTIVE'`).

- [ ] **Step 4: Typecheck / existing tests still meaningful**

Run: `cd apps/web && npx tsc --noEmit` (or package script if present) and `npm test -- --run src/pages/FlashSalePage.test.tsx`

Expected: compile OK; page tests still pass against current UI (product unused yet).

- [ ] **Step 5: Commit (optional — only if user asked)**

```bash
git add apps/web/src/graphql/types.ts apps/web/src/graphql/operations/flashSale.ts apps/web/src/pages/FlashSalePage.test.tsx
git commit -m "feat(web): request nested product on flashSale detail query"
```

---

### Task 2: `useSaleCountdown`

**Files:**

- Create: `apps/web/src/hooks/useSaleCountdown.ts`
- Create: `apps/web/src/hooks/useSaleCountdown.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deriveSaleCountdown, formatCountdownText, useSaleCountdown } from './useSaleCountdown';

describe('formatCountdownText', () => {
  it('zero-pads HH:MM:SS', () => {
    expect(formatCountdownText(69_000)).toBe('00:01:09');
    expect(formatCountdownText(0)).toBe('00:00:00');
  });

  it('allows hours beyond 24 (duration, not clock wrap)', () => {
    // 27h 15m 8s
    expect(formatCountdownText((27 * 3600 + 15 * 60 + 8) * 1000)).toBe('27:15:08');
  });

  it('never returns negative components', () => {
    expect(formatCountdownText(-5_000)).toBe('00:00:00');
  });
});

describe('deriveSaleCountdown', () => {
  const starts = '2026-07-30T10:00:00.000Z';
  const ends = '2026-07-30T12:00:00.000Z';

  it('starts mode before startsAt', () => {
    const r = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T09:59:59.000Z'));
    expect(r.mode).toBe('starts');
    expect(r.label).toBe('Starts in');
    expect(r.text).toBe('00:00:01');
  });

  it('ends mode between startsAt and endsAt', () => {
    const r = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T11:00:00.000Z'));
    expect(r.mode).toBe('ends');
    expect(r.label).toBe('Ends in');
    expect(r.text).toBe('01:00:00');
  });

  it('boundary 00:00:00 at endsAt then none after', () => {
    const atEnd = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T12:00:00.000Z'));
    expect(atEnd.mode).toBe('none');
    expect(atEnd.text).toBe('00:00:00');

    const after = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T12:00:01.000Z'));
    expect(after.mode).toBe('none');
    expect(after.text).toBe('00:00:00');
  });

  it('boundary one second before end', () => {
    const r = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T11:59:59.000Z'));
    expect(r.mode).toBe('ends');
    expect(r.text).toBe('00:00:01');
  });

  it('startsAt === endsAt → none fallback at the endpoint', () => {
    const same = '2026-07-30T10:00:00.000Z';
    // When startMs === endMs, now >= start settles to none (not a positive ends window).
    expect(deriveSaleCountdown(same, same, Date.parse(same))).toEqual({
      label: '',
      mode: 'none',
      text: '00:00:00',
    });
  });

  it('invalid timestamps → none fallback', () => {
    expect(deriveSaleCountdown('not-a-date', ends, Date.now())).toEqual({
      label: '',
      mode: 'none',
      text: '00:00:00',
    });
  });
});

describe('useSaleCountdown', () => {
  it('uses injected now without inventing status', () => {
    const { result } = renderHook(() =>
      useSaleCountdown(
        '2026-07-30T10:00:00.000Z',
        '2026-07-30T12:00:00.000Z',
        Date.parse('2026-07-30T09:00:00.000Z'),
      ),
    );
    expect(result.current.mode).toBe('starts');
    expect(result.current.label).toBe('Starts in');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/web && npm test -- --run src/hooks/useSaleCountdown.spec.ts`

Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import { useEffect, useState } from 'react';

export type SaleCountdownMode = 'starts' | 'ends' | 'none';

export type SaleCountdownValue = {
  label: string;
  mode: SaleCountdownMode;
  text: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Always zero-padded HH:MM:SS duration (hours may exceed 24; do not wrap like clock time); clamps at zero. */
export function formatCountdownText(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function deriveSaleCountdown(
  startsAt: string,
  endsAt: string,
  nowMs: number,
): SaleCountdownValue {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { label: '', mode: 'none', text: '00:00:00' };
  }

  if (nowMs < startMs) {
    return {
      label: 'Starts in',
      mode: 'starts',
      text: formatCountdownText(startMs - nowMs),
    };
  }

  if (nowMs < endMs) {
    return {
      label: 'Ends in',
      mode: 'ends',
      text: formatCountdownText(endMs - nowMs),
    };
  }

  return { label: '', mode: 'none', text: '00:00:00' };
}

/**
 * Live countdown from timestamps only (not API status).
 * - Controlled mode: pass `now` → snapshot only, no interval.
 * - Live mode: omit `now` → 1000 ms interval.
 * Interval effect depends only on `now` (controlled vs live). Sale timestamp
 * changes recompute via `deriveSaleCountdown` on render — do **not** list
 * `startsAt`/`endsAt` in the effect deps (avoids tearing down the interval on
 * every flashSale refetch).
 */
export function useSaleCountdown(
  startsAt: string,
  endsAt: string,
  now?: number,
): SaleCountdownValue {
  const [nowMs, setNowMs] = useState(() => now ?? Date.now());

  useEffect(() => {
    if (now !== undefined) {
      setNowMs(now);
      return;
    }
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [now]);

  return deriveSaleCountdown(startsAt, endsAt, nowMs);
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/web && npm test -- --run src/hooks/useSaleCountdown.spec.ts`

- [ ] **Step 5: Commit (optional)**

```bash
git add apps/web/src/hooks/useSaleCountdown.ts apps/web/src/hooks/useSaleCountdown.spec.ts
git commit -m "feat(web): add sale countdown hook with zero-padded HH:MM:SS"
```

---

### Task 3: `formatSaleWindow`

**Files:**

- Create: `apps/web/src/features/flash-sale/format-sale-window.ts`
- Create: `apps/web/src/features/flash-sale/format-sale-window.spec.ts`

- [ ] **Step 1: Write failing tests**

Use fixed locales via `Intl` options; assert shape rather than brittle exact strings when timezone-dependent. Prefer constructing local `Date` parts:

```ts
import { describe, expect, it } from 'vitest';

import { formatSaleWindow } from './format-sale-window';

describe('formatSaleWindow', () => {
  it('same local calendar day → Today + time range', () => {
    // Pick ISO instants that fall on the same local day in the test environment.
    const start = new Date(2026, 6, 30, 9, 0, 0).toISOString();
    const end = new Date(2026, 6, 30, 11, 0, 0).toISOString();
    const r = formatSaleWindow(start, end);
    expect(r.heading).toBe('Today');
    expect(r.range).toMatch(/9:00\s*AM/i);
    expect(r.range).toMatch(/11:00\s*AM/i);
  });

  it('different local calendar days → dated range (no Today)', () => {
    const start = new Date(2026, 6, 30, 9, 0, 0).toISOString();
    const end = new Date(2026, 6, 31, 11, 0, 0).toISOString();
    const r = formatSaleWindow(start, end);
    expect(r.heading).toBeNull();
    expect(r.range).toMatch(/Jul/i);
    expect(r.range).not.toMatch(/^Today/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/web && npm test -- --run src/features/flash-sale/format-sale-window.spec.ts`

- [ ] **Step 3: Implement (browser locale/timezone — no UTC rendering)**

```ts
const timeOpts: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

const dateTimeOpts: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export type SaleWindowFormatted = {
  heading: string | null;
  range: string;
};

/** Format using the user's browser locale/timezone (no UTC rendering). */
export function formatSaleWindow(startsAt: string, endsAt: string): SaleWindowFormatted {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (sameLocalDay(start, end)) {
    const fmt = new Intl.DateTimeFormat(undefined, timeOpts);
    return {
      heading: 'Today',
      range: `${fmt.format(start)} – ${fmt.format(end)}`,
    };
  }

  const fmt = new Intl.DateTimeFormat(undefined, dateTimeOpts);
  return {
    heading: null,
    range: `${fmt.format(start)} – ${fmt.format(end)}`,
  };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit (optional)**

```bash
git add apps/web/src/features/flash-sale/format-sale-window.ts apps/web/src/features/flash-sale/format-sale-window.spec.ts
git commit -m "feat(web): format sale window in browser local timezone"
```

---

### Task 4: Buy helper derivation

**Files:**

- Create: `apps/web/src/features/flash-sale/buy-helper.ts`
- Create: `apps/web/src/features/flash-sale/buy-helper.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';

import type { SaleCountdownValue } from '../../hooks/useSaleCountdown';

import { getBuyHelper } from './buy-helper';

const ends: SaleCountdownValue = { label: 'Ends in', mode: 'ends', text: '01:00:00' };
const starts: SaleCountdownValue = { label: 'Starts in', mode: 'starts', text: '00:12:31' };

describe('getBuyHelper', () => {
  it('returns undefined when pending', () => {
    expect(
      getBuyHelper({
        alreadyPurchased: false,
        buyPending: true,
        countdown: starts,
        flashSaleLoading: false,
        flashSaleStatus: 'UPCOMING',
        myPurchaseInitialPending: false,
        userId: null,
      }),
    ).toBeUndefined();
  });

  it('guest → enter email line', () => {
    expect(
      getBuyHelper({
        alreadyPurchased: false,
        buyPending: false,
        countdown: ends,
        flashSaleLoading: false,
        flashSaleStatus: 'ACTIVE',
        myPurchaseInitialPending: false,
        userId: null,
      }),
    ).toBe('Enter your email to continue.');
  });

  it('UPCOMING uses starts-in countdown text', () => {
    expect(
      getBuyHelper({
        alreadyPurchased: false,
        buyPending: false,
        countdown: starts,
        flashSaleLoading: false,
        flashSaleStatus: 'UPCOMING',
        myPurchaseInitialPending: false,
        userId: 'a@b.com',
      }),
    ).toBe('Sale starts in 00:12:31.');
  });

  it('SOLD_OUT / ENDED messages', () => {
    const base = {
      alreadyPurchased: false,
      buyPending: false,
      countdown: ends,
      flashSaleLoading: false,
      myPurchaseInitialPending: false,
      userId: 'a@b.com',
    } as const;
    expect(getBuyHelper({ ...base, flashSaleStatus: 'SOLD_OUT' })).toBe('This sale is sold out.');
    expect(getBuyHelper({ ...base, flashSaleStatus: 'ENDED' })).toBe('This sale has ended.');
  });

  it('already purchased → undefined (positive status handled by surface)', () => {
    expect(
      getBuyHelper({
        alreadyPurchased: true,
        buyPending: false,
        countdown: ends,
        flashSaleLoading: false,
        flashSaleStatus: 'ACTIVE',
        myPurchaseInitialPending: false,
        userId: 'a@b.com',
      }),
    ).toBeUndefined();
  });

  it('ACTIVE identified → undefined', () => {
    expect(
      getBuyHelper({
        alreadyPurchased: false,
        buyPending: false,
        countdown: ends,
        flashSaleLoading: false,
        flashSaleStatus: 'ACTIVE',
        myPurchaseInitialPending: false,
        userId: 'a@b.com',
      }),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { ReactNode } from 'react';

import type { FlashSaleStatus } from '../../graphql/types';
import type { SaleCountdownValue } from '../../hooks/useSaleCountdown';

export type BuyHelperInput = {
  alreadyPurchased: boolean;
  buyPending: boolean;
  countdown: SaleCountdownValue;
  flashSaleLoading: boolean;
  flashSaleStatus: FlashSaleStatus | undefined;
  myPurchaseInitialPending: boolean;
  userId: string | null;
};

/** Single concise line for current UX; returns undefined when no helper. */
export function getBuyHelper(input: BuyHelperInput): ReactNode | undefined {
  if (input.buyPending) {
    return undefined;
  }
  if (input.userId === null) {
    return 'Enter your email to continue.';
  }
  if (input.flashSaleStatus === 'UPCOMING') {
    if (input.countdown.mode === 'starts') {
      return `Sale starts in ${input.countdown.text}.`;
    }
    return 'Sale has not started yet.';
  }
  if (input.flashSaleStatus === 'SOLD_OUT') {
    return 'This sale is sold out.';
  }
  if (input.flashSaleStatus === 'ENDED') {
    return 'This sale has ended.';
  }
  if (input.alreadyPurchased) {
    return undefined;
  }
  if (input.flashSaleLoading || input.myPurchaseInitialPending) {
    return 'Checking purchase status…';
  }
  return undefined;
}
```

- [ ] **Step 3: Run — expect PASS**

Run: `cd apps/web && npm test -- --run src/features/flash-sale/buy-helper.spec.ts`

- [ ] **Step 4: Commit (optional)**

```bash
git add apps/web/src/features/flash-sale/buy-helper.ts apps/web/src/features/flash-sale/buy-helper.spec.ts
git commit -m "feat(web): derive buy helper line from sale and identity state"
```

---

### Task 5: `StockBar`

**Files:**

- Create: `apps/web/src/features/flash-sale/components/StockBar.tsx`
- Create: `apps/web/src/features/flash-sale/components/StockBar.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StockBar } from './StockBar';

describe('StockBar', () => {
  it('renders 0 / total with 0% fill', () => {
    render(<StockBar remaining={0} total={10} />);
    expect(screen.getByTestId('stock-bar')).toHaveTextContent('0 / 10');
    expect(screen.getByTestId('stock-bar-fill')).toHaveStyle({ width: '0%' });
  });

  it('renders 1 / total', () => {
    render(<StockBar remaining={1} total={10} />);
    expect(screen.getByTestId('stock-bar-fill')).toHaveStyle({ width: '10%' });
  });

  it('renders full remaining', () => {
    render(<StockBar remaining={10} total={10} />);
    expect(screen.getByTestId('stock-bar-fill')).toHaveStyle({ width: '100%' });
  });
});
```

- [ ] **Step 2: Implement**

```tsx
type Props = {
  remaining: number;
  total: number;
};

export function StockBar({ remaining, total }: Props) {
  const pct = total <= 0 ? 0 : Math.min(100, Math.max(0, (remaining / total) * 100));

  return (
    <div data-testid="stock-bar">
      <div className="mb-1 h-2 overflow-hidden rounded bg-emerald-900/10">
        <div
          className="h-full bg-emerald-700 transition-[width]"
          data-testid="stock-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm font-semibold text-emerald-950">
        <span data-testid="sale-stock">
          {remaining} / {total}
        </span>{' '}
        remaining
      </p>
    </div>
  );
}
```

Keep `sale-stock` for E2E compatibility with `e2e/pages/sale.page.ts`.

- [ ] **Step 3: Run — expect PASS**

- [ ] **Step 4: Commit (optional)**

```bash
git add apps/web/src/features/flash-sale/components/StockBar.tsx apps/web/src/features/flash-sale/components/StockBar.test.tsx
git commit -m "feat(web): add StockBar with remaining/total fill"
```

---

### Task 6: Countdown UI + purchase surfaces

**Files:**

- Create: `apps/web/src/features/flash-sale/components/SaleCountdown.tsx`
- Create: `apps/web/src/features/flash-sale/purchase-surface.ts`
- Create: `apps/web/src/features/flash-sale/components/PurchaseControls.tsx`
- Create: `apps/web/src/features/flash-sale/components/PurchaseRail.tsx`
- Create: `apps/web/src/features/flash-sale/components/StickyBuyBar.tsx`
- Create: `apps/web/src/features/flash-sale/components/PurchaseControls.test.tsx`

- [ ] **Step 1: `SaleCountdown`**

```tsx
import type { SaleCountdownValue } from '../../../hooks/useSaleCountdown';

type Props = {
  countdown: SaleCountdownValue;
};

export function SaleCountdown({ countdown }: Props) {
  if (countdown.mode === 'none') {
    return null;
  }

  return (
    <div data-testid="sale-countdown">
      <p className="text-sm text-emerald-900/70">{countdown.label}</p>
      <p className="font-mono text-2xl font-semibold tracking-wide text-emerald-950">
        {countdown.text}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Shared props type**

```ts
import type { ReactNode } from 'react';

import type { PurchaseItemResult } from '../../graphql/types';

export type PurchaseSurfaceProps = {
  alreadyPurchased?: boolean;
  buyDisabled: boolean;
  buyPending: boolean;
  countdownSummary?: { label: string; text: string } | null;
  helper?: ReactNode;
  onBuy: () => void;
  purchaseError?: { message: string; onRetry: () => void } | null;
  purchaseOutcome?: PurchaseItemResult | null;
  remainingSummary?: { remaining: number; total: number };
};
```

- [ ] **Step 3: `PurchaseControls` + tests**

```tsx
import { IdentityStrip } from '../../identity/components/IdentityStrip';
import type { PurchaseSurfaceProps } from '../purchase-surface';

import { PurchaseOutcomeBanner } from './PurchaseOutcomeBanner';
import { RequestErrorBanner } from './RequestErrorBanner';

type Props = PurchaseSurfaceProps & {
  showSummaries: boolean;
};

export function PurchaseControls({
  alreadyPurchased,
  buyDisabled,
  buyPending,
  countdownSummary,
  helper,
  onBuy,
  purchaseError,
  purchaseOutcome,
  remainingSummary,
  showSummaries,
}: Props) {
  return (
    <div>
      <IdentityStrip />

      {showSummaries && remainingSummary ? (
        <p className="mt-4 text-sm text-emerald-950">
          {remainingSummary.remaining} / {remainingSummary.total} remaining
        </p>
      ) : null}

      {showSummaries && countdownSummary ? (
        <p className="mt-1 text-sm text-emerald-900/70">
          {countdownSummary.label} {countdownSummary.text}
        </p>
      ) : null}

      {alreadyPurchased ? (
        <div className="mt-4" data-testid="already-purchased" role="status">
          <p className="font-semibold text-emerald-950">Purchased</p>
          <p className="text-sm text-emerald-900/80">You have already purchased this item.</p>
        </div>
      ) : null}

      <button
        className="mt-4 w-full rounded bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={buyDisabled}
        onClick={onBuy}
        type="button"
      >
        {buyPending ? 'Buying…' : 'Buy Now'}
      </button>

      <div className="mt-2 min-h-[1.25rem]" data-testid="buy-helper">
        {!buyPending && helper ? <p className="text-sm text-amber-900/90">{helper}</p> : null}
      </div>

      {!buyPending && purchaseError ? (
        <div className="mt-3">
          <RequestErrorBanner
            message={purchaseError.message}
            onRetry={purchaseError.onRetry}
            title="Purchase request failed"
          />
        </div>
      ) : null}

      {!buyPending && purchaseOutcome ? (
        <div className="mt-3">
          <PurchaseOutcomeBanner result={purchaseOutcome} />
        </div>
      ) : null}
    </div>
  );
}
```

Test file (minimal):

> **Provider wrap:** `IdentityStrip` only needs `IdentityProvider` (see `IdentityStrip.test.tsx`). It does **not** require Router or QueryClient. Wrapping with `IdentityProvider` alone is correct and matches the existing strip tests. Prefer that over `renderApp` unless a test also needs routing/query.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IdentityProvider } from '../../identity/IdentityProvider';
import { PurchaseControls } from './PurchaseControls';

function wrap(ui: React.ReactElement) {
  // Mirrors IdentityStrip.test.tsx — IdentityProvider only (no router/query).
  return render(<IdentityProvider>{ui}</IdentityProvider>);
}

afterEach(() => {
  localStorage.clear();
});

describe('PurchaseControls', () => {
  it('keeps Buy Now label and shows helper when disabled', () => {
    wrap(
      <PurchaseControls
        buyDisabled
        buyPending={false}
        helper="Enter your email to continue."
        onBuy={() => undefined}
        showSummaries={false}
      />,
    );
    expect(screen.getByRole('button', { name: /^buy now$/i })).toBeDisabled();
    expect(screen.getByTestId('buy-helper')).toHaveTextContent(/enter your email/i);
  });

  it('shows Buying… and hides helper + banners while pending', () => {
    wrap(
      <PurchaseControls
        buyDisabled
        buyPending
        helper="should hide"
        onBuy={() => undefined}
        purchaseError={{ message: 'err', onRetry: () => undefined }}
        purchaseOutcome={{
          message: 'ok',
          purchaseId: 'p1',
          status: 'SUCCESS',
        }}
        showSummaries={false}
      />,
    );
    expect(screen.getByRole('button', { name: /buying/i })).toBeDisabled();
    expect(screen.getByTestId('buy-helper')).toBeEmptyDOMElement();
    expect(screen.queryByTestId('request-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('purchase-outcome')).not.toBeInTheDocument();
  });

  it('already purchased positive status', () => {
    wrap(
      <PurchaseControls
        alreadyPurchased
        buyDisabled
        buyPending={false}
        onBuy={() => undefined}
        showSummaries={false}
      />,
    );
    expect(screen.getByTestId('already-purchased')).toHaveTextContent(/purchased/i);
  });

  it('retry calls onRetry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    wrap(
      <PurchaseControls
        buyDisabled={false}
        buyPending={false}
        onBuy={() => undefined}
        purchaseError={{ message: 'fail', onRetry }}
        showSummaries={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Rail + Sticky**

> **Intentional dual mount:** Both `PurchaseRail` and `StickyBuyBar` stay mounted; visibility is CSS-only (`hidden lg:block` / `lg:hidden`). jsdom and some assistive tooling will still see **both** Buy buttons / IdentityStrips in the accessibility tree. That is **by design** (matches the spec). Do **not** "fix" this later with conditional `{isDesktop ? <Rail/> : <Sticky/>}` — that would violate the architecture. Tests must use `getAllByRole` / scope by `data-testid`, not assume a single Buy control.

```tsx
// PurchaseRail.tsx
import type { PurchaseSurfaceProps } from '../purchase-surface';

import { PurchaseControls } from './PurchaseControls';

export function PurchaseRail(props: PurchaseSurfaceProps) {
  return (
    <aside
      className="hidden rounded-xl border border-emerald-900/15 bg-white/70 p-6 shadow-sm lg:sticky lg:top-6 lg:block"
      data-testid="purchase-rail"
    >
      <PurchaseControls {...props} showSummaries />
    </aside>
  );
}
```

```tsx
// StickyBuyBar.tsx
import type { PurchaseSurfaceProps } from '../purchase-surface';

import { PurchaseControls } from './PurchaseControls';

export function StickyBuyBar(props: PurchaseSurfaceProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 border-t border-emerald-900/15 bg-[#f3f7f4]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      data-testid="sticky-buy-bar"
    >
      <PurchaseControls {...props} showSummaries={false} />
    </div>
  );
}
```

- [ ] **Step 5: Run PurchaseControls tests — expect PASS**

Run: `cd apps/web && npm test -- --run src/features/flash-sale/components/PurchaseControls.test.tsx`

- [ ] **Step 6: Commit (optional)**

```bash
git add apps/web/src/features/flash-sale/components/SaleCountdown.tsx \
  apps/web/src/features/flash-sale/purchase-surface.ts \
  apps/web/src/features/flash-sale/components/PurchaseControls.tsx \
  apps/web/src/features/flash-sale/components/PurchaseControls.test.tsx \
  apps/web/src/features/flash-sale/components/PurchaseRail.tsx \
  apps/web/src/features/flash-sale/components/StickyBuyBar.tsx
git commit -m "feat(web): add sale countdown and isomorphic purchase surfaces"
```

---

### Task 7: Banner Tailwind + `FlashSalePage` rebuild

**Files:**

- Modify: `apps/web/src/features/flash-sale/components/RequestErrorBanner.tsx`
- Modify: `apps/web/src/features/flash-sale/components/PurchaseOutcomeBanner.tsx`
- Modify: `apps/web/src/pages/FlashSalePage.tsx`

- [ ] **Step 1: Restyle banners (keep testids)**

`RequestErrorBanner.tsx`:

```tsx
type Props = {
  message: string;
  onRetry?: () => void;
  title?: string;
};

export function RequestErrorBanner({ message, onRetry, title = 'Something went wrong' }: Props) {
  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 p-4 text-red-950"
      data-testid="request-error"
      role="alert"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry ? (
        <button
          className="mt-3 rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
```

`PurchaseOutcomeBanner.tsx` — keep outcome map; wrap with Tailwind panel (`rounded-md border … bg-white/70 p-4`); preserve `purchase-outcome`, `purchase-outcome-status`, `purchase-id`.

- [ ] **Step 2: Rebuild `FlashSalePage`**

Replace implementation with orchestrator (preserve eligibility / mutation-for-current-user gating from current page):

```tsx
import { Link, useParams } from 'react-router-dom';

import { SaleStatusBadge } from '../features/catalog/components/SaleStatusBadge';
import { getBuyHelper } from '../features/flash-sale/buy-helper';
import { isBuyDisabled } from '../features/flash-sale/buy-eligibility';
import { PurchaseOutcomeBanner } from '../features/flash-sale/components/PurchaseOutcomeBanner';
import { PurchaseRail } from '../features/flash-sale/components/PurchaseRail';
import { RequestErrorBanner } from '../features/flash-sale/components/RequestErrorBanner';
import { SaleCountdown } from '../features/flash-sale/components/SaleCountdown';
import { StickyBuyBar } from '../features/flash-sale/components/StickyBuyBar';
import { StockBar } from '../features/flash-sale/components/StockBar';
import { formatSaleWindow } from '../features/flash-sale/format-sale-window';
import { useUserIdentity } from '../features/identity/IdentityProvider';
import { RequestError } from '../graphql/errors';
import { isNonWhitespaceId } from '../graphql/id';
import { useFlashSale } from '../hooks/useFlashSale';
import { useMyPurchase } from '../hooks/useMyPurchase';
import { usePurchaseItem } from '../hooks/usePurchaseItem';
import { useSaleCountdown } from '../hooks/useSaleCountdown';

export function FlashSalePage() {
  const { flashSaleId = '' } = useParams();
  const { userId } = useUserIdentity();

  const saleQuery = useFlashSale(flashSaleId);
  const myPurchaseQuery = useMyPurchase(flashSaleId, userId ?? '');
  const purchaseMutation = usePurchaseItem();

  const sale = saleQuery.data;
  const countdown = useSaleCountdown(sale?.startsAt ?? '', sale?.endsAt ?? '');

  const mutationForCurrentUser = purchaseMutation.variables?.userId === userId;
  const buyPending = purchaseMutation.isPending && mutationForCurrentUser;
  const myPurchaseInitialPending = myPurchaseQuery.isPending && !myPurchaseQuery.isError;
  const userIdValid = isNonWhitespaceId(userId ?? '');
  const alreadyPurchased = myPurchaseQuery.data?.purchased === true;

  const buyDisabled = isBuyDisabled({
    flashSaleError: saleQuery.isError,
    flashSaleLoading: saleQuery.isPending,
    flashSaleStatus: sale?.status,
    mutationPending: buyPending,
    myPurchaseInitialPending,
    purchased: myPurchaseQuery.data?.purchased,
    userIdValid,
  });

  const helper = getBuyHelper({
    alreadyPurchased,
    buyPending,
    countdown,
    flashSaleLoading: saleQuery.isPending,
    flashSaleStatus: sale?.status,
    myPurchaseInitialPending,
    userId,
  });

  const saleError =
    saleQuery.error instanceof RequestError
      ? saleQuery.error
      : saleQuery.error
        ? new RequestError(saleQuery.error.message, 'UNKNOWN')
        : undefined;

  const myPurchaseError =
    myPurchaseQuery.error instanceof RequestError
      ? myPurchaseQuery.error
      : myPurchaseQuery.error
        ? new RequestError(myPurchaseQuery.error.message, 'UNKNOWN')
        : undefined;

  const purchaseError =
    mutationForCurrentUser && purchaseMutation.error instanceof RequestError
      ? purchaseMutation.error
      : mutationForCurrentUser && purchaseMutation.error
        ? new RequestError(purchaseMutation.error.message, 'UNKNOWN')
        : undefined;

  function onBuy() {
    if (userId === null || !isNonWhitespaceId(userId)) {
      return;
    }
    purchaseMutation.mutate({ flashSaleId, userId });
  }

  function onRetryPurchase() {
    if (userId === null || !isNonWhitespaceId(userId)) {
      return;
    }
    purchaseMutation.reset();
    purchaseMutation.mutate({ flashSaleId, userId });
  }

  const windowFmt = sale ? formatSaleWindow(sale.startsAt, sale.endsAt) : null;
  const description = sale?.product.description?.trim() ? sale.product.description : null;

  const purchaseSurfaceProps = {
    alreadyPurchased,
    buyDisabled,
    buyPending,
    countdownSummary:
      countdown.mode === 'none' ? null : { label: countdown.label, text: countdown.text },
    helper,
    onBuy,
    purchaseError: purchaseError
      ? {
          message:
            purchaseError.kind === 'NETWORK'
              ? "We couldn't reach the server. Please check your connection and try again."
              : "We couldn't complete your purchase. Please try again.",
          onRetry: onRetryPurchase,
        }
      : null,
    purchaseOutcome:
      !buyPending && purchaseMutation.data && mutationForCurrentUser ? purchaseMutation.data : null,
    remainingSummary: sale ? { remaining: sale.remainingStock, total: sale.totalStock } : undefined,
  };

  return (
    <main
      className="mx-auto max-w-7xl px-4 py-10 pb-40 sm:px-6 lg:pb-10"
      data-testid="flash-sale-page"
    >
      <Link
        className="mb-6 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        data-testid="back-to-products"
        to="/"
      >
        ← Back to products
      </Link>

      {saleQuery.isPending ? (
        <div
          className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8"
          data-testid="sale-loading"
        >
          <div className="space-y-6">
            {/* title + badge row */}
            <div className="flex items-start justify-between gap-3">
              <div className="h-9 w-2/3 animate-pulse rounded bg-emerald-900/10" />
              <div className="h-6 w-16 animate-pulse rounded bg-emerald-900/10" />
            </div>
            {/* stock bar */}
            <div className="space-y-2">
              <div className="h-2 w-full animate-pulse rounded bg-emerald-900/10" />
              <div className="h-4 w-40 animate-pulse rounded bg-emerald-900/10" />
            </div>
            {/* countdown */}
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-emerald-900/10" />
              <div className="h-8 w-36 animate-pulse rounded bg-emerald-900/10" />
            </div>
            {/* description */}
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-emerald-900/10" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-emerald-900/10" />
            </div>
            {/* sale window */}
            <div className="h-4 w-48 animate-pulse rounded bg-emerald-900/10" />
          </div>
          {/* purchase rail placeholder (desktop) */}
          <div className="mt-8 hidden h-64 animate-pulse rounded-xl bg-emerald-900/10 lg:mt-0 lg:block" />
        </div>
      ) : null}

      {saleError ? (
        <RequestErrorBanner
          message={saleError.message}
          onRetry={() => {
            void saleQuery.refetch();
          }}
          title="Could not load sale"
        />
      ) : null}

      {myPurchaseError ? (
        <RequestErrorBanner
          message={myPurchaseError.message}
          onRetry={() => {
            void myPurchaseQuery.refetch();
          }}
          title="Could not check purchase status"
        />
      ) : null}

      {sale ? (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <section className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-3xl font-semibold text-emerald-950 sm:text-4xl">
                {sale.product.name}
              </h1>
              <SaleStatusBadge status={sale.status} />
            </div>

            {/* Keep a stable hook for status text assertions / e2e */}
            <p className="sr-only">
              Status: <span data-testid="sale-status">{sale.status}</span>
            </p>

            <StockBar remaining={sale.remainingStock} total={sale.totalStock} />
            <SaleCountdown countdown={countdown} />

            {description ? (
              <p className="text-emerald-900/70" data-testid="sale-description">
                {description}
              </p>
            ) : null}

            {windowFmt ? (
              <div data-testid="sale-window">
                {windowFmt.heading ? (
                  <p className="text-sm font-semibold text-emerald-950">{windowFmt.heading}</p>
                ) : null}
                <p className="text-sm text-emerald-900/70">{windowFmt.range}</p>
              </div>
            ) : null}
          </section>

          <PurchaseRail {...purchaseSurfaceProps} />
        </div>
      ) : null}

      <StickyBuyBar {...purchaseSurfaceProps} />
    </main>
  );
}
```

Notes for implementers:

- Do **not** import unused `PurchaseOutcomeBanner` at page level if only used inside controls (adjust imports).
- `sr-only` `sale-status` preserves existing tests/e2e that assert API status text without coupling to badge chrome; prefer keeping it until e2e is updated to `sale-status-badge` + `data-status`.
- Sticky bar mounts even during loading (Buy disabled via eligibility) — acceptable; alternatively render sticky only when `sale` exists — both OK if Buy stays disabled and one surface visibility rule holds.

- [ ] **Step 3: Smoke the page tests and fix compile**

Run: `cd apps/web && npm test -- --run src/pages/FlashSalePage.test.tsx`

Expect some assertion updates in Task 8 if Guest hint test still looks for `identify-to-buy`.

- [ ] **Step 4: Commit (optional)**

```bash
git add apps/web/src/pages/FlashSalePage.tsx \
  apps/web/src/features/flash-sale/components/RequestErrorBanner.tsx \
  apps/web/src/features/flash-sale/components/PurchaseOutcomeBanner.tsx
git commit -m "feat(web): rebuild flash sale page with product-first Tailwind UX"
```

---

### Task 8: Delete obsolete pieces + update tests / e2e selectors

**Files:**

- Delete: `apps/web/src/features/flash-sale/components/SaleStatusCard.tsx`
- Delete: `apps/web/src/features/flash-sale/components/PurchasePanel.tsx`
- Modify: `apps/web/src/pages/FlashSalePage.test.tsx`
- Modify: `e2e/pages/sale.page.ts` (selectors only)
- Grep for leftover imports of deleted modules

- [ ] **Step 1: Remove obsolete components**

Delete `SaleStatusCard.tsx` and `PurchasePanel.tsx`. Grep and remove imports.

- [ ] **Step 2: Update FlashSalePage tests**

Required assertion updates:

| Old               | New                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------- |
| `identify-to-buy` | `buy-helper` with `/enter your email/i` (or query within sticky/rail)                 |
| Product absence   | `findByText('Aurora Headphones')` / product name from fixture                         |
| Back link         | `getByTestId('back-to-products')`                                                     |
| No `#user-id`     | still assert no `/user id/i` label                                                    |
| Dual surfaces     | `purchase-rail` has `lg:block` / sticky has `lg:hidden` classes (or both in document) |

Keep identity / purchaseItem exact-id tests; Buy clicks still use role queries. Because **both surfaces stay mounted by design** (CSS visibility only — see Task 6 note), jsdom exposes two Buy buttons. Prefer:

```ts
const buttons = screen.getAllByRole('button', { name: /buy now/i });
await user.click(buttons[0]!);
```

or scope within `purchase-rail` / `sticky-buy-bar`. Do **not** switch the page to conditional rendering to make `getByRole` unique — that would violate the dual-mount architecture.

Add coverage:

- nested product name visible
- stock bar present
- no local user id field
- both `purchase-rail` and `sticky-buy-bar` present in the document (intentional)

- [ ] **Step 3: Update e2e page object selectively**

`e2e/pages/sale.page.ts`:

```ts
  status() {
    return this.page.getByTestId('sale-status');
  }

  stock() {
    return this.page.getByTestId('sale-stock');
  }
```

Keep as-is if Task 7 preserved those testids; otherwise switch `status()` to `getByTestId('sale-status-badge')`. **Do not** add new Playwright journey specs.

When Buy is ambiguous (two DOM buttons), scope:

```ts
buyButton() {
  return this.page.getByTestId('sticky-buy-bar').getByRole('button', { name: /Buy Now|Buying/ });
}
```

(or rail on desktop projects — prefer sticky for mobile-first e2e viewport, or `locator('[data-testid=purchase-rail]:visible, [data-testid=sticky-buy-bar]:visible')`).

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd apps/web && npm test -- --run src/pages/FlashSalePage.test.tsx src/features/flash-sale src/hooks/useSaleCountdown.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit (optional)**

```bash
git add -A apps/web/src/features/flash-sale apps/web/src/pages/FlashSalePage.test.tsx e2e/pages/sale.page.ts
git commit -m "test(web): align sale page tests with Tailwind purchase UX"
```

---

### Task 9: Full verification

- [ ] **Step 1: Web unit suite**

Run: `cd apps/web && npm test -- --run`

Expected: all PASS.

- [ ] **Step 2: Manual checklist (against running API if available)**

- Catalog `/` still shows IdentityStrip + cards
- Sale page: back link, product name, badge, stock bar, countdown, window
- Guest: Buy disabled + email helper
- Identify → Buy enabled when ACTIVE
- Desktop: rail visible; mobile width: sticky visible
- Pending: Buying…; no stacked banners
- Failure: retry re-purchases with same identity

- [ ] **Step 3: Spec AC self-check**

Walk §9 of the design spec; confirm each box.

- [ ] **Step 4: Commit design+plan only if user asks** — otherwise leave docs uncommitted or include in PR when requested.

---

## Self-review (plan vs spec)

| Spec requirement                                      | Task                           |
| ----------------------------------------------------- | ------------------------------ |
| Nested product query + required type                  | Task 1                         |
| Live countdown 1000 ms, HH:MM:SS, boundaries          | Task 2                         |
| Browser-local sale window                             | Task 3                         |
| Helper precedence; pending no helper                  | Task 4, 6                      |
| StockBar remaining/total + edges                      | Task 5                         |
| B sticky + C rail; isomorphic props; one visible      | Task 6–7                       |
| Authoritative API status / isBuyDisabled              | Task 7 (unchanged eligibility) |
| IdentityStrip reuse; no userId input                  | Task 6–7                       |
| Purchase feedback on surfaces; page-level load errors | Task 6–7                       |
| Skeleton loading CLS                                  | Task 7                         |
| Delete SaleStatusCard / PurchasePanel                 | Task 8                         |
| Vitest + MSW; e2e selector-only                       | Task 8–9                       |
| No #125–#130 / #133/#134                              | Honored throughout             |

**Placeholder scan:** No TBD steps; code included for each implementable unit.

**Type consistency:** `PurchaseSurfaceProps.helper?: ReactNode`; outcome is `PurchaseItemResult`; countdown `SaleCountdownValue` shared.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-30-issue-124-flash-sale-details-purchase-ux.md` (not committed).

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints

Which approach?
