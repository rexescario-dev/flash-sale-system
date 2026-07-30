# #128 Shared Tailwind UI Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract four presentation-only Tailwind primitives (`Button`, `Card`, `PageHeader`, `ErrorState`) under `apps/web/src/components/ui/` and migrate justified call sites without a visual redesign or design-system expansion.

**Architecture:** Direct extract + migrate. Shared layer is domain-agnostic. Feature widgets stay in `features/*`. Page-load errors use `ErrorState`; transactional flash-sale errors keep `RequestErrorBanner` (may reuse `Button`).

**Tech Stack:** React 19, Vite, Tailwind v4, Vitest, Testing Library.

**Base:** `main` @ `ebde480+`. Work in an isolated git worktree.

**Commits:** Commit each completed task as a logical unit (conventional commits). Push + PR at the end.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-128-shared-tailwind-ui-primitives-design.md`

---

## File map

| File                                                                  | Responsibility                  |
| --------------------------------------------------------------------- | ------------------------------- |
| `apps/web/src/components/ui/Button.tsx`                               | primary/secondary button        |
| `apps/web/src/components/ui/Button.test.tsx`                          | smoke tests                     |
| `apps/web/src/components/ui/Card.tsx`                                 | surface shell `div`             |
| `apps/web/src/components/ui/Card.test.tsx`                            | smoke tests                     |
| `apps/web/src/components/ui/PageHeader.tsx`                           | eyebrow/title/description       |
| `apps/web/src/components/ui/PageHeader.test.tsx`                      | smoke tests                     |
| `apps/web/src/components/ui/ErrorState.tsx`                           | page-load error + retry         |
| `apps/web/src/components/ui/ErrorState.test.tsx`                      | smoke + retry click             |
| `apps/web/src/pages/CatalogPage.tsx`                                  | migrate header + error          |
| `apps/web/src/pages/PurchasesPage.tsx`                                | migrate header + error          |
| `apps/web/src/features/catalog/components/FlashSaleCard.tsx`          | Link wraps Card                 |
| `apps/web/src/features/purchases/components/PurchaseHistoryPanel.tsx` | article wraps Card              |
| `apps/web/src/features/identity/components/IdentityStrip.tsx`         | Button for Identify/Save/Cancel |
| `apps/web/src/features/flash-sale/components/PurchaseControls.tsx`    | Button for Buy                  |
| `apps/web/src/features/flash-sale/components/RequestErrorBanner.tsx`  | optional Button reuse           |
| Design + this plan under `docs/superpowers/`                          | committed with branch           |

**Expected unchanged visually:** appearance preserved except unavoidable class dedup (e.g. retry button `py-2` → shared `py-1.5`).

---

### Task 1: Docs (design + plan) on feature branch

**Files:**

- Create: `docs/superpowers/specs/2026-07-31-issue-128-shared-tailwind-ui-primitives-design.md`
- Create: `docs/superpowers/plans/2026-07-31-issue-128-shared-tailwind-ui-primitives.md`

- [ ] **Step 1: Ensure worktree/branch exists**

```bash
git worktree add .worktrees/128-shared-ui-primitives -b feat/128-shared-tailwind-ui-primitives origin/main
cd .worktrees/128-shared-ui-primitives
pnpm install
```

- [ ] **Step 2: Add design + plan files** (content already authored; copy into worktree if written on main checkout first)

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-31-issue-128-shared-tailwind-ui-primitives-design.md \
  docs/superpowers/plans/2026-07-31-issue-128-shared-tailwind-ui-primitives.md
git commit -m "$(cat <<'EOF'
docs: add #128 shared Tailwind UI primitives design and plan

EOF
)"
```

---

### Task 2: `Button` primitive (TDD)

**Files:**

- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/Button.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('renders primary variant and forwards click', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button data-testid="btn" onClick={onClick} type="button">
        Save
      </Button>,
    );
    const btn = screen.getByTestId('btn');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.className).toMatch(/bg-emerald-700/);
    await user.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders secondary variant', () => {
    render(
      <Button type="button" variant="secondary">
        Cancel
      </Button>,
    );
    expect(screen.getByRole('button', { name: /cancel/i }).className).toMatch(/text-emerald-800/);
    expect(screen.getByRole('button', { name: /cancel/i }).className).not.toMatch(/bg-emerald-700/);
  });

  it('honors disabled and merges className', () => {
    render(
      <Button className="w-full" disabled type="button">
        Buy Now
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /buy now/i });
    expect(btn).toBeDisabled();
    expect(btn.className).toMatch(/w-full/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm --filter web exec vitest run src/components/ui/Button.test.tsx`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const VARIANT: Record<'primary' | 'secondary', string> = {
  primary:
    'rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50',
  secondary: 'rounded px-3 py-1.5 text-sm font-semibold text-emerald-800',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
};

export function Button({
  children,
  className,
  variant = 'primary',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      className={[VARIANT[variant], className].filter(Boolean).join(' ')}
      type={type}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm --filter web exec vitest run src/components/ui/Button.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Button.tsx apps/web/src/components/ui/Button.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add shared Button UI primitive

EOF
)"
```

---

### Task 3: `Card` primitive (TDD)

**Files:**

- Create: `apps/web/src/components/ui/Card.tsx`
- Create: `apps/web/src/components/ui/Card.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from './Card';

describe('Card', () => {
  it('renders a div surface and merges className', () => {
    render(
      <Card className="shadow-sm" data-testid="card">
        Hello
      </Card>,
    );
    const el = screen.getByTestId('card');
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveTextContent('Hello');
    expect(el.className).toMatch(/rounded-lg/);
    expect(el.className).toMatch(/border-emerald-900\/15/);
    expect(el.className).toMatch(/shadow-sm/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter web exec vitest run src/components/ui/Card.test.tsx`

- [ ] **Step 3: Implement**

```tsx
import type { HTMLAttributes, ReactNode } from 'react';

const BASE = 'rounded-lg border border-emerald-900/15 bg-white/70 p-4';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className, ...rest }: Props) {
  return (
    <div className={[BASE, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Card.tsx apps/web/src/components/ui/Card.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add shared Card UI primitive

EOF
)"
```

---

### Task 4: `PageHeader` primitive (TDD)

**Files:**

- Create: `apps/web/src/components/ui/PageHeader.tsx`
- Create: `apps/web/src/components/ui/PageHeader.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders eyebrow, title, and description', () => {
    render(
      <PageHeader
        description="Browse open and upcoming sales."
        eyebrow="Flash Sale System"
        title="Flash sales"
      />,
    );
    expect(screen.getByText('Flash Sale System')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Flash sales' })).toBeInTheDocument();
    expect(screen.getByText(/browse open/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** (match Catalog/Purchases typography)

```tsx
type Props = {
  description: string;
  eyebrow: string;
  title: string;
};

export function PageHeader({ description, eyebrow, title }: Props) {
  return (
    <>
      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-700">{eyebrow}</p>
      <h1 className="mb-2 text-3xl font-semibold text-emerald-950 sm:text-4xl">{title}</h1>
      <p className="mb-8 max-w-2xl text-emerald-900/70">{description}</p>
    </>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/PageHeader.tsx apps/web/src/components/ui/PageHeader.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add shared PageHeader UI primitive

EOF
)"
```

---

### Task 5: `ErrorState` primitive (TDD)

**Files:**

- Create: `apps/web/src/components/ui/ErrorState.tsx`
- Create: `apps/web/src/components/ui/ErrorState.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders neutral alert with title, message, and retry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorState
        data-testid="catalog-error"
        message="boom"
        onRetry={onRetry}
        title="Could not load catalog"
      />,
    );
    const root = screen.getByTestId('catalog-error');
    expect(root).toHaveAttribute('role', 'alert');
    expect(root.className).toMatch(/bg-white\/70/);
    expect(screen.getByText('Could not load catalog')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
import type { HTMLAttributes } from 'react';

import { Button } from './Button';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  message: string;
  onRetry: () => void;
  title: string;
};

export function ErrorState({ className, message, onRetry, title, ...rest }: Props) {
  return (
    <div
      className={['rounded-md bg-white/70 p-4', className].filter(Boolean).join(' ')}
      role="alert"
      {...rest}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      <Button className="mt-3" onClick={onRetry} type="button">
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/ErrorState.tsx apps/web/src/components/ui/ErrorState.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add shared ErrorState UI primitive

EOF
)"
```

---

### Task 6: Migrate CatalogPage + PurchasesPage

**Files:**

- Modify: `apps/web/src/pages/CatalogPage.tsx`
- Modify: `apps/web/src/pages/PurchasesPage.tsx`

- [ ] **Step 1: Replace duplicated header + error blocks**

Catalog example:

```tsx
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/ui/PageHeader';
// ...
} else if (catalogQuery.isError) {
  body = (
    <ErrorState
      data-testid="catalog-error"
      message={catalogQuery.error.message}
      onRetry={() => {
        void catalogQuery.refetch();
      }}
      title="Could not load catalog"
    />
  );
}
// in return, replace eyebrow/h1/lede with:
<PageHeader
  description="Browse open and upcoming sales. Select a sale to view details."
  eyebrow="Flash Sale System"
  title="Flash sales"
/>
```

Purchases: same pattern with purchases copy / `purchases-error` test id / guest+list unchanged.

- [ ] **Step 2: Run page tests**

```bash
pnpm --filter web exec vitest run src/pages/CatalogPage.test.tsx src/pages/CatalogPage.retry.test.tsx src/pages/PurchasesPage.test.tsx src/pages/PurchasesPage.retry.test.tsx
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/CatalogPage.tsx apps/web/src/pages/PurchasesPage.tsx
git commit -m "$(cat <<'EOF'
refactor(web): use PageHeader and ErrorState on catalog and purchases

EOF
)"
```

---

### Task 7: Migrate FlashSaleCard + PurchaseHistoryPanel to Card

**Files:**

- Modify: `apps/web/src/features/catalog/components/FlashSaleCard.tsx`
- Modify: `apps/web/src/features/purchases/components/PurchaseHistoryPanel.tsx`

- [ ] **Step 1: FlashSaleCard — Link wraps Card**

```tsx
<Link className="block" data-testid="catalog-card" to={`/sales/${sale.id}`}>
  <Card className="shadow-sm transition hover:border-emerald-700/40 hover:bg-white">
    {/* existing inner content unchanged */}
  </Card>
</Link>
```

Move former Link surface classes onto `Card` (+ keep `block` on Link). Preserve `data-testid="catalog-card"` on the Link (existing tests target the link).

- [ ] **Step 2: PurchaseHistoryPanel — article wraps Card**

```tsx
<article data-testid="purchase-panel">
  <Card>{/* existing inner content; drop duplicate surface classes from article */}</Card>
</article>
```

Keep `data-testid="purchase-panel"` on the outer article so tests remain stable.

- [ ] **Step 3: Run related tests**

```bash
pnpm --filter web exec vitest run \
  src/features/catalog/components/FlashSaleCard.test.tsx \
  src/features/purchases/components/PurchaseHistoryPanel.test.tsx \
  src/pages/CatalogPage.test.tsx \
  src/pages/PurchasesPage.test.tsx
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/catalog/components/FlashSaleCard.tsx \
  apps/web/src/features/purchases/components/PurchaseHistoryPanel.tsx
git commit -m "$(cat <<'EOF'
refactor(web): wrap catalog and purchase panels with shared Card

EOF
)"
```

---

### Task 8: Migrate IdentityStrip, PurchaseControls, RequestErrorBanner to Button

**Files:**

- Modify: `apps/web/src/features/identity/components/IdentityStrip.tsx`
- Modify: `apps/web/src/features/flash-sale/components/PurchaseControls.tsx`
- Modify: `apps/web/src/features/flash-sale/components/RequestErrorBanner.tsx`

- [ ] **Step 1: IdentityStrip**

- Identify + Save → `<Button data-testid=…>` primary
- Cancel → `<Button variant="secondary" data-testid="identity-cancel">`
- Change → leave as native `<button>` with underline link classes (do not force into secondary)

Preserve refs on Identify/Change/Save action buttons (`actionRef` on Identify/Change).

- [ ] **Step 2: PurchaseControls Buy**

```tsx
<Button
  className="mt-4 w-full px-4 py-2.5 disabled:cursor-not-allowed"
  disabled={buyDisabled}
  onClick={onBuy}
  type="button"
>
  {buyPending ? 'Buying…' : 'Buy Now'}
</Button>
```

Note: `className` may override padding via Tailwind merge-by-order; if both paddings apply, use only the Buy-specific padding classes in `className` and accept both utility strings as today (browser last-wins is fine for this codebase), or drop base padding conflict by keeping Buy classes after base in the join order (already the case).

- [ ] **Step 3: RequestErrorBanner retry**

```tsx
<Button className="mt-3" onClick={onRetry} type="button">
  Try again
</Button>
```

Do **not** convert banner container to `ErrorState`.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter web exec vitest run \
  src/features/identity/components/IdentityStrip.test.tsx \
  src/features/flash-sale/components/PurchaseControls.test.tsx \
  src/pages/FlashSalePage.test.tsx \
  src/app/router.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/identity/components/IdentityStrip.tsx \
  apps/web/src/features/flash-sale/components/PurchaseControls.tsx \
  apps/web/src/features/flash-sale/components/RequestErrorBanner.tsx
git commit -m "$(cat <<'EOF'
refactor(web): adopt shared Button in identity and flash-sale controls

EOF
)"
```

---

### Task 9: Full web verification + self-review

- [ ] **Step 1: Run full web suite**

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

Expected: all green.

- [ ] **Step 2: Self-review checklist**

- Exactly four shared primitives under `components/ui/`
- No Spinner/Skeleton/EmptyState/Badge/StockIndicator
- `RequestErrorBanner` still feature-local and red
- `SaleStatusBadge` / `StockBar` still feature-local
- Change identity action still link-styled (not forced to secondary)
- No CSS / styles.css changes
- `data-testid`s preserved for catalog-error, purchases-error, catalog-card, purchase-panel

- [ ] **Step 3: Fix any gaps found; commit only if needed**

---

### Task 10: PR

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(web): standardize shared Tailwind UI primitives (#128)" --body "$(cat <<'EOF'
## Summary
- Extract four presentation-only primitives under `apps/web/src/components/ui/` (`Button`, `Card`, `PageHeader`, `ErrorState`)
- Migrate catalog/purchases page chrome + load errors, card surfaces, and justified button call sites
- Keep flash-sale `RequestErrorBanner` and domain widgets feature-local (YAGNI)

## Test plan
- [x] `pnpm --filter web lint`
- [x] `pnpm --filter web typecheck`
- [x] `pnpm --filter web test`
- [x] `pnpm --filter web build`
- [ ] Spot-check catalog, sale, purchases, identity strip visually (no redesign expected)

## Notes
- Spec: `docs/superpowers/specs/2026-07-31-issue-128-shared-tailwind-ui-primitives-design.md`
- Plan: `docs/superpowers/plans/2026-07-31-issue-128-shared-tailwind-ui-primitives.md`
- Closes #128

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement                                   | Task                                        |
| -------------------------------------------------- | ------------------------------------------- |
| ≤4 primitives in `components/ui/`                  | 2–5                                         |
| ErrorState page-load only                          | 5–6                                         |
| RequestErrorBanner feature-local + optional Button | 8                                           |
| PageHeader no main/IdentityStrip                   | 4, 6                                        |
| Card div-only; Link/article outside                | 3, 7                                        |
| Button no fullWidth/size                           | 2, 8                                        |
| No visual redesign / no CSS reopen                 | all                                         |
| Light primitive tests + page regression            | 2–9                                         |
| Presentation-only principle                        | all migrations keep copy/callbacks in pages |

## No placeholders

All tasks include concrete code, commands, and commit messages.
