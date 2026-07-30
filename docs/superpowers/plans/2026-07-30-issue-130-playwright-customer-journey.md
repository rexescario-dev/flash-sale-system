# Issue #130 — Playwright Customer-Journey Feature Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand real-stack Playwright coverage for the EPIC-10 customer journey: catalog-first smoke (browse → buy → My Purchases) plus independent regressions (deep-link, duplicate, sold-out transition, status gates, user switch), using roles/`data-testid` only.

**Architecture:** Extend the Playwright e2e seed matrix; keep page objects + thin specs (`CatalogPage`, `SalePage`, `PurchasesPage`, standalone `CustomerNav`). Prefer accessible roles; reuse existing testids; assert observable user-facing behavior after #129 invalidation/refetch (no stale-cache assumptions).

**Tech Stack:** Playwright (`@flash-sale/e2e`), existing API `e2e:seed` (Prisma + Redis key clear), React customer UI on real stack.

**Spec:** [docs/superpowers/specs/2026-07-30-issue-130-playwright-customer-journey-design.md](../specs/2026-07-30-issue-130-playwright-customer-journey-design.md) — **authoritative**. This plan operationalizes it and must not alter its contract.

**Baseline:** `origin/main` @ `6039811` (#129 via [PR #141](https://github.com/rexescario-dev/flash-sale-system/pull/141)).

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Out of scope:** #128 primitives; #133 Tailwind/Compose vendor COPY; #134 catalog follow-ups; renaming existing `data-testid`s to match issue wording; k6; MSW-as-E2E; AuthN; Redis/server cache changes.

**Hard invariants (locked):**

1. Smoke = catalog → ACTIVE(10) → identify → buy → **CustomerNav click** My Purchases → **this test’s** purchase visible (no `page.goto('/purchases')` fallback in smoke).
2. Seed matrix: ACTIVE(10), ACTIVE(1), SOLD_OUT, UPCOMING, ENDED with **stable, unique, human-readable** product names; specs never hard-code sale IDs — consume names via `SeedState.products`.
3. Pre-seeded SOLD_OUT **complements** ACTIVE(1) → SOLD_OUT transition; neither replaces the other.
4. Selectors: roles preferred when equally stable; reuse existing testids; add testid only if blocked; no class/CSS/hierarchy selectors.
5. Each regression independently runnable against freshly seeded state; `workers: 1`; unique `userId`s per test.
6. #129 posture: assert post-buy UI after invalidation/refetch; never assert Redis/cache keys or assume stale client caches.
7. Do not pull #128 / #133 / #134 unless a missing testid truly blocks (prefer role/existing id first).

**Implementation convention:**

> The design spec is authoritative for behavior. The **existing `e2e/` package** is authoritative for conventions (`SalePage`, `globalSetup`, smoke/regression projects). Code blocks below are **illustrative examples** of one acceptable approach — not mandatory implementations. Prefer behavior contracts over exact locators/snippets; fit project conventions as long as invariants hold.
>
> When extending existing tests or page objects, prefer extending over rewriting. Preserve existing coverage unless the design explicitly replaces it (e.g., the smoke journey moving from deep-link to catalog-first).

**Local stack note:** Compose `web`/`api` images may lag `main`; Dockerfile rebuild can fail on missing `vendor/` COPY (#133 — out of scope). Prefer host-built API/web against Compose Postgres/Redis when Compose images are stale. **Adjust ports to the active local stack** (examples below use `:3001` / `:5174`; Compose may serve `:3000` / `:5173`):

```bash
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5174 pnpm e2e:smoke
# or full: pnpm e2e
```

---

## File map

| Path | Responsibility |
| ---- | -------------- |
| `apps/api/test/e2e/seed/scenarios.ts` | Full status matrix + stable product names |
| `apps/api/test/e2e/seed/seed.ts` | `SeedState` (sale IDs + product names), plant, Redis clear |
| `e2e/tests/helpers/seed-state.ts` | Typed `loadSeedState()` — mirror API `SeedState` shape exactly until a shared type exists |
| `e2e/pages/customer-nav.ts` | Cross-page nav helper |
| `e2e/pages/catalog.page.ts` | Catalog page object |
| `e2e/pages/purchases.page.ts` | Purchases page object |
| `e2e/pages/sale.page.ts` | Extend sale detail helpers (no cross-page nav) |
| `e2e/tests/smoke/…` | Replace deep-link-only smoke with catalog-first journey |
| `e2e/tests/regression/…` | Deep-link; keep duplicate + sold-out; add status gates + user switch (new or extend existing, consistent with suite organization) |

---

## Task flow

```text
Task 1  →  Seed matrix + SeedState types
Task 2  →  Page objects (CustomerNav, Catalog, Purchases, Sale extensions)
Task 3  →  Catalog-first smoke
Task 4  →  Deep-link regression (+ keep duplicate / sold-out green)
Task 5  →  Status-gates regression
Task 6  →  User-switch regression
Task 7  →  Full e2e verification (smoke + regression)
```

---

## Design summary (approved)

| Concern | Decision |
| ------- | -------- |
| Smoke | Catalog-first happy path ending at My Purchases via nav click |
| Regression | Deep-link, duplicate, transition, status gates, user switch — independent |
| Selectors | Roles first; existing testids; no renames for issue wording |
| Seed | ACTIVE(10/1) + SOLD_OUT + UPCOMING + ENDED |
| Structure | Page objects + thin specs |
| #129 | Observable UI only |

**Product names:** Use **stable, unique, human-readable** names chosen at implementation time. Exact string literals are **not** part of the feature contract. Specs must consume them via `SeedState.products` (never hard-code names in specs).

---

### Task 1: Extend e2e seed matrix + `SeedState`

**Files:**

- Modify: `apps/api/test/e2e/seed/scenarios.ts`
- Modify: `apps/api/test/e2e/seed/seed.ts`
- Modify: `e2e/tests/helpers/seed-state.ts`

- [ ] **Step 1: Extend `getE2EScenarios` with full matrix + product names**

Import `soldOut`, `upcoming`, `ended` from `../../fixtures/scenarios`. Each entry includes a stable, unique, human-readable `productName` (implementation chooses the text).

Illustrative shape (names below are examples only — replace with whatever stable names you choose):

```ts
// apps/api/test/e2e/seed/scenarios.ts
import { e2eProductId, e2eSaleId } from '../../fixtures/ids';
import {
  activeStock1,
  activeStock10,
  ended,
  soldOut,
  upcoming,
} from '../../fixtures/scenarios';

export function getE2EScenarios(now: Date = new Date()) {
  return {
    activeStock1: {
      productId: e2eProductId('active-stock-1'),
      productName: /* stable unique human-readable name */,
      saleId: e2eSaleId('active-stock-1'),
      scenario: activeStock1(now),
    },
    activeStock10: {
      productId: e2eProductId('active-stock-10'),
      productName: /* stable unique human-readable name */,
      saleId: e2eSaleId('active-stock-10'),
      scenario: activeStock10(now),
    },
    ended: {
      productId: e2eProductId('ended'),
      productName: /* stable unique human-readable name */,
      saleId: e2eSaleId('ended'),
      scenario: ended(now),
    },
    soldOut: {
      productId: e2eProductId('sold-out'),
      productName: /* stable unique human-readable name */,
      saleId: e2eSaleId('sold-out'),
      scenario: soldOut(now),
    },
    upcoming: {
      productId: e2eProductId('upcoming'),
      productName: /* stable unique human-readable name */,
      saleId: e2eSaleId('upcoming'),
      scenario: upcoming(now),
    },
  } as const;
}
```

- [ ] **Step 2: Extend `SeedState` + planting to pass `productName`**

Update `createFlashSale` calls to pass `productName: entry.productName`. Expand written state so specs can read both sale IDs and product names:

```ts
export type SeedState = {
  products: {
    activeStock10Name: string;
    activeStock1Name: string;
    endedName: string;
    soldOutName: string;
    upcomingName: string;
  };
  sales: {
    activeStock10Id: string;
    activeStock1Id: string;
    endedId: string;
    soldOutId: string;
    upcomingId: string;
  };
};
```

Build `state` from `scenarios.*` after planting (use scenario `saleId` / `productName` values — do not hard-code sale IDs as string literals in the writer). Redis clear already loops planted ids — ensure all five sale ids are in `planted`.

- [ ] **Step 3: Mirror types in `e2e/tests/helpers/seed-state.ts`**

Mirror the API `SeedState` shape **exactly** until a shared type exists (intentional duplication — do not invent a cross-package shared type in #130 unless one already exists).

Keep `loadSeedState()` reading `e2e/seed-state.json` as today.

- [ ] **Step 4: Run seed CLI against local Postgres/Redis**

Run (stack must be reachable; uses root `.env` `DATABASE_URL` / `REDIS_URL`):

```bash
cd /home/rex/Project/test/app && pnpm --filter api e2e:seed
```

Expected: writes `e2e/seed-state.json` containing all five sale IDs and five product names; exit 0.

Spot-check GraphQL — **adjust port to the active local stack**:

```bash
curl -s http://127.0.0.1:3000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ flashSales { id status product { name } } }"}' | head -c 2000
```

Expected: catalog includes the five seeded E2E products with matching statuses (ACTIVE / ACTIVE / SOLD_OUT / UPCOMING / ENDED).

- [ ] **Step 5: Commit when requested**

```bash
git add apps/api/test/e2e/seed/scenarios.ts apps/api/test/e2e/seed/seed.ts e2e/tests/helpers/seed-state.ts
git commit -m "$(cat <<'EOF'
test(e2e): expand Playwright seed matrix for customer journey statuses

EOF
)"
```

---

### Task 2: Page objects

**Files:**

- Create: `e2e/pages/customer-nav.ts`
- Create: `e2e/pages/catalog.page.ts`
- Create: `e2e/pages/purchases.page.ts`
- Modify: `e2e/pages/sale.page.ts`

- [ ] **Step 1: Add `CustomerNav` helper**

Prefer role link when stable; fall back to existing testids only if needed.

```ts
// e2e/pages/customer-nav.ts
import type { Page } from '@playwright/test';

export class CustomerNav {
  constructor(private readonly page: Page) {}

  async openFlashSales(): Promise<void> {
    await this.page.getByRole('link', { name: 'Flash Sales' }).click();
  }

  async openPurchases(): Promise<void> {
    await this.page.getByRole('link', { name: 'My Purchases' }).click();
  }
}
```

If desktop layout hides links behind the mobile menu in the Playwright viewport, open via `getByTestId('nav-menu-button')` first — only if role links are not visible. Prefer fixing viewport/`devices['Desktop Chrome']` (already configured) over new testids.

- [ ] **Step 2: Add `CatalogPage`**

Intent API:

- `goto()` / `expectVisible()`
- `openSaleByProductName(name)` — **preferred** when the catalog exposes an accessible product name
- `openSaleById(id)` — fallback when name lookup is impractical; reuse the **simplest stable locator** supported by the existing `FlashSaleCard` (exact selector is an implementation detail for code review)
- `expectSaleStatus(productName, status)` — optional; encapsulate badge locators

```ts
// e2e/pages/catalog.page.ts — illustrative shape
import { expect, type Page } from '@playwright/test';

export class CatalogPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async expectVisible(): Promise<void> {
    await expect(this.page.getByTestId('catalog-page')).toBeVisible();
  }

  async openSaleByProductName(productName: string): Promise<void> {
    await this.page.getByRole('link', { name: new RegExp(productName) }).click();
  }

  async openSaleById(flashSaleId: string): Promise<void> {
    // Implement with the simplest stable FlashSaleCard locator (card is a Link).
    void flashSaleId;
    throw new Error('implement openSaleById');
  }

  async expectSaleStatus(productName: string, status: string): Promise<void> {
    const card = this.page.getByTestId('catalog-card').filter({ hasText: productName });
    await expect(card.getByTestId('sale-status-badge')).toHaveAttribute('data-status', status);
  }
}
```

Prefer `openSaleByProductName` in smoke; keep `openSaleById` available for fixtures.

- [ ] **Step 3: Add `PurchasesPage`**

High-level asserts only:

- `expectVisible()`
- `expectPurchaseVisible(productName)` — must identify **this test’s** purchase, not merely “list non-empty”
- `expectPurchaseNotVisible(productName)` / `expectEmptyState()` as needed

Internals may use `purchase-panel`; callers need not know that.

```ts
// e2e/pages/purchases.page.ts — illustrative shape
import { expect, type Page } from '@playwright/test';

export class PurchasesPage {
  constructor(private readonly page: Page) {}

  async expectVisible(): Promise<void> {
    await expect(this.page.getByTestId('purchases-page')).toBeVisible();
  }

  async expectPurchaseVisible(productName: string): Promise<void> {
    await expect(
      this.page.getByTestId('purchase-panel').filter({ hasText: productName }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async expectPurchaseNotVisible(productName: string): Promise<void> {
    await expect(
      this.page.getByTestId('purchase-panel').filter({ hasText: productName }),
    ).toHaveCount(0);
  }

  async expectEmptyState(): Promise<void> {
    await expect(this.page.getByTestId('purchases-empty')).toBeVisible();
  }
}
```

- [ ] **Step 4: Extend `SalePage` with intent helpers (stay on detail)**

Keep existing `enterUserId`, `buy`, `gotoSale`, `status`, `stock`, `alreadyPurchased`, outcome helpers, etc. Add thin wrappers used by specs (implement with existing locators):

```ts
async expectPurchaseSuccess(): Promise<void> {
  await expect(this.purchaseOutcomeStatus()).toHaveText('Purchase successful', {
    timeout: 15_000,
  });
}

async expectBuyDisabled(): Promise<void> {
  await expect(this.buyButton()).toBeDisabled();
}

async expectNotAlreadyPurchased(): Promise<void> {
  await expect(this.alreadyPurchased()).toHaveCount(0);
}

async expectDetailStatus(status: string): Promise<void> {
  await expect(this.status()).toHaveText(status);
}
```

Do **not** add `openPurchases` / catalog navigation to `SalePage`.

- [ ] **Step 5: Commit when requested**

```bash
git add e2e/pages/
git commit -m "$(cat <<'EOF'
test(e2e): add catalog, purchases, and nav page objects for #130

EOF
)"
```

---

### Task 3: Catalog-first smoke

**Files:**

- Modify: existing smoke spec under `e2e/tests/smoke/` (replace deep-link-only journey)

- [ ] **Step 1: Rewrite smoke as catalog → buy → My Purchases**

Behavior contract:

1. Open catalog → expect visible
2. Open ACTIVE(10) via product name from `SeedState.products`
3. Identify unique user → buy → expect purchase success
4. Wait for a **stable purchase-success indicator** to settle before navigating to My Purchases (existing success UI or equivalent — do not require a specific secondary element)
5. `nav.openPurchases()` (CustomerNav click — **no** `page.goto` fallback)
6. `purchases.expectPurchaseVisible(products.activeStock10Name)` for **this test’s** purchase

Illustrative sketch:

```ts
import { expect, test } from '@playwright/test';

import { CatalogPage } from '../../pages/catalog.page';
import { CustomerNav } from '../../pages/customer-nav';
import { PurchasesPage } from '../../pages/purchases.page';
import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test.describe('smoke', () => {
  test('catalog journey: browse, buy, and see purchase in My Purchases', async ({ page }) => {
    const { products } = loadSeedState();
    const catalog = new CatalogPage(page);
    const sale = new SalePage(page);
    const nav = new CustomerNav(page);
    const purchases = new PurchasesPage(page);

    await catalog.goto();
    await catalog.expectVisible();
    await catalog.openSaleByProductName(products.activeStock10Name);

    await expect(page.getByTestId('flash-sale-page')).toBeVisible();
    await sale.expectDetailStatus('ACTIVE');

    const userId = `e2e-user-smoke-${Date.now()}`;
    await sale.enterUserId(userId);
    await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
    await sale.buy();
    await sale.expectPurchaseSuccess();
    // Success settled — proceed to My Purchases via nav.

    await nav.openPurchases();
    await purchases.expectVisible();
    await purchases.expectPurchaseVisible(products.activeStock10Name);
  });
});
```

Remove the old deep-link-only smoke body (deep-link moves to Task 4).

- [ ] **Step 2: Run smoke against current stack**

**Adjust ports to the active local stack:**

```bash
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5174 pnpm e2e:smoke
```

Expected: **1 passed**. Failures should be locator/journey issues, not seed shape errors.

- [ ] **Step 3: Commit when requested**

```bash
git add e2e/tests/smoke/
git commit -m "$(cat <<'EOF'
test(e2e): make smoke cover catalog-to-purchases customer journey

EOF
)"
```

---

### Task 4: Deep-link regression; keep duplicate + sold-out green

**Files:**

- Add a regression spec for deep-link purchase (new or extend existing, consistent with current suite organization)
- Modify only if needed: existing duplicate and sold-out regression specs (`SeedState` field access for `activeStock10Id` / `activeStock1Id` should remain valid)

- [ ] **Step 1: Add deep-link purchase regression (former smoke path)**

Behavior: `sale.gotoSale(activeStock10Id)` → identify → buy → purchase success. Wait for a stable success indicator (same posture as smoke).

```ts
import { expect, test } from '@playwright/test';

import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test('deep-link: views seeded ACTIVE sale and completes a purchase', async ({ page }) => {
  const { sales } = loadSeedState();
  const sale = new SalePage(page);
  await sale.gotoSale(sales.activeStock10Id);

  await sale.expectDetailStatus('ACTIVE');
  await expect(sale.stock()).toContainText('/');

  const userId = `e2e-user-deeplink-${Date.now()}`;
  await sale.enterUserId(userId);
  await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
  await sale.buy();
  await sale.expectPurchaseSuccess();
});
```

- [ ] **Step 2: Ensure existing duplicate and sold-out regressions continue to pass with the expanded `SeedState`**

Do **not** rewrite duplicate/sold-out for structure alone. Behavior must remain unchanged. Touch them only if the expanded `SeedState` type requires a trivial import/type fix.

- [ ] **Step 3: Run deep-link + existing duplicate + sold-out regressions**

**Adjust ports to the active local stack.** Target the relevant regression files (paths depend on how you organized Task 4 Step 1):

```bash
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5174 \
  pnpm --filter @flash-sale/e2e exec playwright test --project=regression
```

Or run the specific deep-link / duplicate / sold-out files if preferred for a faster loop.

Expected: deep-link, duplicate, and sold-out all pass. Note: globalSetup re-seeds before the run; ACTIVE(1) transition still has exactly one unit.

- [ ] **Step 4: Commit when requested**

```bash
git add e2e/tests/regression/
git commit -m "$(cat <<'EOF'
test(e2e): add deep-link purchase regression alongside existing gates

EOF
)"
```

---

### Task 5: Status-gates regression

**Files:**

- Add a regression spec for status gates (new or extend existing, consistent with suite organization)

- [ ] **Step 1: Write independent status-gate tests**

Prefer **separate tests** (or clearly separated steps) per surface so failures are diagnosable. Verify the expected disabled state and status on the surface under test (catalog, detail, or both). Avoid bundling unrelated surface assertions into a single opaque expectation.

```ts
import { expect, test } from '@playwright/test';

import { CatalogPage } from '../../pages/catalog.page';
import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test.describe('status gates', () => {
  test('catalog shows SOLD_OUT, UPCOMING, and ENDED badges', async ({ page }) => {
    const { products } = loadSeedState();
    const catalog = new CatalogPage(page);
    await catalog.goto();
    await catalog.expectVisible();
    await catalog.expectSaleStatus(products.soldOutName, 'SOLD_OUT');
    await catalog.expectSaleStatus(products.upcomingName, 'UPCOMING');
    await catalog.expectSaleStatus(products.endedName, 'ENDED');
  });

  test('detail SOLD_OUT: status visible and Buy disabled', async ({ page }) => {
    const { sales } = loadSeedState();
    const sale = new SalePage(page);
    await sale.gotoSale(sales.soldOutId);
    await sale.expectDetailStatus('SOLD_OUT');
    await sale.enterUserId(`e2e-user-gate-soldout-${Date.now()}`);
    await sale.expectBuyDisabled();
  });

  test('detail UPCOMING: status visible and Buy disabled', async ({ page }) => {
    const { sales } = loadSeedState();
    const sale = new SalePage(page);
    await sale.gotoSale(sales.upcomingId);
    await sale.expectDetailStatus('UPCOMING');
    await sale.enterUserId(`e2e-user-gate-upcoming-${Date.now()}`);
    await sale.expectBuyDisabled();
  });

  test('detail ENDED: status visible and Buy disabled', async ({ page }) => {
    const { sales } = loadSeedState();
    const sale = new SalePage(page);
    await sale.gotoSale(sales.endedId);
    await sale.expectDetailStatus('ENDED');
    await sale.enterUserId(`e2e-user-gate-ended-${Date.now()}`);
    await sale.expectBuyDisabled();
  });
});
```

Identify before asserting Buy disabled so the gate is not confused with guest-disabled Buy.

- [ ] **Step 2: Run status-gates regression**

**Adjust ports to the active local stack:**

```bash
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5174 \
  pnpm --filter @flash-sale/e2e exec playwright test --project=regression
```

Expected: status-gate tests pass (alongside other regressions if running the full project).

- [ ] **Step 3: Commit when requested**

```bash
git add e2e/tests/regression/
git commit -m "$(cat <<'EOF'
test(e2e): cover pre-seeded sold-out, upcoming, and ended status gates

EOF
)"
```

---

### Task 6: User-switch regression

**Files:**

- Add a regression spec for user switch (new or extend existing, consistent with suite organization)

- [ ] **Step 1: Write user-switch scenario**

**Behavior contract:**

1. User A purchases ACTIVE(10)
2. Switch to User B
3. B is **not** already-purchased
4. B’s purchases page is **empty** before B buys (does not display A’s purchase)
5. B can purchase successfully
6. B’s purchases page shows B’s purchase

Optional A revisit is **not** required.

```ts
import { expect, test } from '@playwright/test';

import { CustomerNav } from '../../pages/customer-nav';
import { PurchasesPage } from '../../pages/purchases.page';
import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test('user switch: B is not treated as owning A purchase and may buy', async ({ page }) => {
  const { products, sales } = loadSeedState();
  const sale = new SalePage(page);
  const nav = new CustomerNav(page);
  const purchases = new PurchasesPage(page);
  const suffix = Date.now();
  const userA = `e2e-user-switch-a-${suffix}`;
  const userB = `e2e-user-switch-b-${suffix}`;

  await sale.gotoSale(sales.activeStock10Id);
  await sale.enterUserId(userA);
  await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
  await sale.buy();
  await sale.expectPurchaseSuccess();
  await expect(sale.alreadyPurchased()).toContainText('You have already purchased this item.', {
    timeout: 15_000,
  });

  await sale.enterUserId(userB);
  await sale.expectNotAlreadyPurchased();
  await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });

  await nav.openPurchases();
  await purchases.expectVisible();
  await purchases.expectEmptyState();
  // Or equivalent: no purchase panels for B yet.
  await purchases.expectPurchaseNotVisible(products.activeStock10Name);

  await sale.gotoSale(sales.activeStock10Id);
  await sale.enterUserId(userB);
  await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
  await sale.buy();
  await sale.expectPurchaseSuccess();

  await nav.openPurchases();
  await purchases.expectVisible();
  await purchases.expectPurchaseVisible(products.activeStock10Name);
});
```

- [ ] **Step 2: Run user-switch regression**

**Adjust ports to the active local stack:**

```bash
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5174 \
  pnpm --filter @flash-sale/e2e exec playwright test --project=regression
```

Expected: pass. If IdentityStrip “Change” flow races, reuse the wait pattern already in `SalePage.enterUserId`.

- [ ] **Step 3: Commit when requested**

```bash
git add e2e/tests/regression/
git commit -m "$(cat <<'EOF'
test(e2e): cover identity switch purchase isolation

EOF
)"
```

---

### Task 7: Full verification

**Files:** none new — run suite

- [ ] **Step 1: Run smoke**

**Adjust ports to the active local stack:**

```bash
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5174 pnpm e2e:smoke
```

Expected: all smoke tests pass (1 journey).

- [ ] **Step 2: Run full e2e (smoke + regression)**

```bash
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5174 pnpm e2e
```

Expected: all smoke + regression tests pass under `workers: 1` with shared seed + unique userIds.

- [ ] **Step 3: Spec acceptance checklist**

Confirm against the design spec §9:

- [ ] Catalog-first smoke with nav to My Purchases and **this test’s** purchase visible
- [ ] Deep-link, duplicate, sold-out transition, status gates, user switch (independent)
- [ ] Seed matrix IDs + stable, unique, human-readable product names (consumed via `SeedState`)
- [ ] Roles / existing testids only; no class selectors; no testid renames
- [ ] Real-stack; `e2e/` conventions
- [ ] No stale-cache assumptions (#129)
- [ ] Pre-seeded SOLD_OUT complements transition
- [ ] Deterministic under `workers: 1`
- [ ] Existing duplicate and sold-out regression behavior remains unchanged

- [ ] **Step 4: Commit when requested (docs if not already staged)**

Include design + plan docs only when user asks to commit:

```bash
git add docs/superpowers/specs/2026-07-30-issue-130-playwright-customer-journey-design.md \
  docs/superpowers/plans/2026-07-30-issue-130-playwright-customer-journey.md
git commit -m "$(cat <<'EOF'
docs: add #130 Playwright customer-journey design and plan

EOF
)"
```

---

## Spec coverage self-check

| Spec requirement | Task |
| ---------------- | ---- |
| Seed matrix ACTIVE(10/1)/SOLD_OUT/UPCOMING/ENDED + unique names | Task 1 |
| Page objects + CustomerNav; roles-first selectors | Task 2 |
| Catalog-first smoke via nav → this purchase visible | Task 3 |
| Deep-link regression | Task 4 |
| Keep duplicate + sold-out transition unchanged | Task 4 + Task 7 checklist |
| Status gates (diagnosable surfaces) | Task 5 |
| User switch (B empty before buy; B may buy; B sees own purchase) | Task 6 |
| #129 observable UI / no stale cache | Tasks 3–6 |
| Full acceptance / workers:1 | Task 7 |
| Out of scope #128/#133/#134 / no testid renames | Honored throughout |

## Placeholder / consistency scan

- No TBD/TODO steps; product name **literals** are intentionally not locked — choose stable unique names; consume via `SeedState.products`.
- `SeedState` duplicated in API seed + e2e helper by design until a shared type exists.
- `SalePage` never owns cross-page navigation; `CustomerNav` does.
- Smoke never uses `page.goto('/purchases')` fallback.
- Success settling asserts a stable success indicator, not a specific secondary element.
- Filenames are not prescribed; organize consistently with the existing suite.
