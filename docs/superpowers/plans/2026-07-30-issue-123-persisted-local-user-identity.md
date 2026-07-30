# Issue #123 — Persisted Local User Identity UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver [#123](https://github.com/rexescario-dev/flash-sale-system/issues/123) — app-wide persisted opaque `userId` (UI may say Email) with shared `IdentityStrip` on Catalog and Sale, driving `myPurchase` / `purchaseItem` from committed identity only (no AuthN).

**Architecture:** `identityStorage` + `IdentityProvider` / `useUserIdentity()` at app root; page-local `IdentityStrip` owns draft/editing; `FlashSalePage` / `PurchasePanel` consume committed `userId` only. Explicit Save commits; no identity debounce; exact-string invariant.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Vitest + Testing Library + MSW, existing Tailwind utilities on catalog/strip.

**Spec:** [docs/superpowers/specs/2026-07-30-issue-123-persisted-local-user-identity-design.md](../specs/2026-07-30-issue-123-persisted-local-user-identity-design.md) — **authoritative**.

**Baseline:** `origin/main` at catalog tip (`a014e4e` / PR #135). Work in an isolated git worktree from that tip.

**Commits:** Do not commit unless the user explicitly asks. Commit checkpoints below are **optional reference only**. When authorized: `<type>: <MESSAGE>` with **no** `Co-authored-by`.

**Existing behavior wins.** If the current code differs from example snippets in this plan, preserve existing project conventions while satisfying the design spec.

**Out of scope:** AuthN; email RFC validation/normalize; #124 sale Tailwind redesign; #125/#126 purchases; #127 nav/shell; #129 Redis/cache product changes; #133/#134; Playwright #130.

**Hard invariants (locked):**

1. Provider hydrates storage **exactly once** at init via the initial `useState(() => identityStorage.get())` (or equivalent lazy initializer) — **not** a mount `useEffect` re-read. No `storage` listeners; outside changes ignored.
2. Only `IdentityProvider` imports `identityStorage`; no direct `localStorage` in pages/components.
3. `setIdentity` is authoritative: `false` if whitespace-only; `true` if committed; same exact value → no-op `true` (observable: return `true`, `userId` unchanged; avoid unnecessary dependent churn).
4. Persistence exceptions never throw into UI; write failures still keep in-memory identity for the session.
5. GraphQL hooks derive their variables only from the committed identity. Guest/`null` ⇒ no `myPurchase` network; mutation guarded.
6. Exact committed string everywhere (no trim/lowercase after validation).
7. PurchasePanel has no identity input; Guest hint: “Identify to buy.”
8. Changing identity does not cancel in-flight mutations; old query keys left to normal eviction.

**Implementation convention:**

> The design spec is authoritative for behavior. The **existing codebase** is authoritative for conventions. Prefer minimal diffs. Reuse the existing non-whitespace ID helper if one already exists (today: `isNonWhitespaceId` under the web GraphQL id utilities); otherwise create a shared helper following existing validation/location conventions — do not invent a new validation module path solely for this plan. Update tests that typed `#user-id` / “User ID” to strip or seeded provider identity. Remove identity fake-timer/debounce usage once wiring is done.

---

## File map

| Path                                                               | Responsibility                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `apps/web/src/features/identity/identity-storage.ts`               | `get` / `set` / `clear`; key `flash-sale.userId`; swallow errors    |
| `apps/web/src/features/identity/identity-storage.spec.ts`          | Storage unit tests                                                  |
| `apps/web/src/features/identity/IdentityProvider.tsx`              | Provider + `useUserIdentity`                                        |
| `apps/web/src/features/identity/IdentityProvider.test.tsx`         | Hydrate / set / clear / same-value / invalid                        |
| `apps/web/src/features/identity/components/IdentityStrip.tsx`      | Draft UX + testids                                                  |
| `apps/web/src/features/identity/components/IdentityStrip.test.tsx` | Strip mode/flow tests                                               |
| `apps/web/src/main.tsx`                                            | Wrap `App` with `IdentityProvider`                                  |
| `apps/web/src/test/render.tsx`                                     | Wrap tests with `IdentityProvider`                                  |
| `apps/web/src/pages/CatalogPage.tsx`                               | Mount `IdentityStrip`                                               |
| `apps/web/src/pages/CatalogPage.test.tsx`                          | Strip present (+ persist across remount)                            |
| `apps/web/src/pages/FlashSalePage.tsx`                             | Strip + committed identity; drop local state/debounce               |
| `apps/web/src/features/flash-sale/components/PurchasePanel.tsx`    | Narrow API; Guest hint                                              |
| `apps/web/src/pages/FlashSalePage.test.tsx`                        | Rewrite identity interactions; drop debounce timers                 |
| `apps/web/src/hooks/useDebouncedValue.ts`                          | Remove **only if** no remaining imports in the web app after Task 6 |

---

## Task flow

```text
Task 1  →  identityStorage (TDD)
Task 2  →  IdentityProvider (TDD)
Task 3  →  IdentityStrip (TDD)
Task 4  →  Wire provider (main + test render)
Task 5  →  CatalogPage strip
Task 6  →  Sale page + PurchasePanel wiring
Task 7  →  FlashSalePage test rewrite
Task 8  →  Full verification
```

---

### Task 1: `identityStorage`

**Files:**

- Create: `apps/web/src/features/identity/identity-storage.ts`
- Create: `apps/web/src/features/identity/identity-storage.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { identityStorage } from './identity-storage';

describe('identityStorage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null when missing', () => {
    expect(identityStorage.get()).toBeNull();
  });

  it('round-trips exact string', () => {
    identityStorage.set(' user-123 ');
    expect(identityStorage.get()).toBe(' user-123 ');
  });

  it('clear returns to null', () => {
    identityStorage.set('a');
    identityStorage.clear();
    expect(identityStorage.get()).toBeNull();
  });

  it('returns null when value is empty string', () => {
    localStorage.setItem('flash-sale.userId', '');
    expect(identityStorage.get()).toBeNull();
  });

  it('returns null when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(identityStorage.get()).toBeNull();
  });

  it('set does not throw when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => identityStorage.set('x')).not.toThrow();
  });

  it('clear does not throw when removeItem throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => identityStorage.clear()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd apps/web && pnpm test -- src/features/identity/identity-storage.spec.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
const STORAGE_KEY = 'flash-sale.userId';

export const identityStorage = {
  get(): string | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === null || value === '' ? null : value;
    } catch {
      return null;
    }
  },
  set(userId: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, userId);
    } catch {
      // session continues via in-memory provider state
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/web && pnpm test -- src/features/identity/identity-storage.spec.ts
```

- [ ] **Step 5: Commit (optional — only if user asked)**

```bash
git add apps/web/src/features/identity/identity-storage.ts apps/web/src/features/identity/identity-storage.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): add local identity storage module

EOF
)"
```

---

### Task 2: `IdentityProvider` + `useUserIdentity`

**Files:**

- Create: `apps/web/src/features/identity/IdentityProvider.tsx`
- Create: `apps/web/src/features/identity/IdentityProvider.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IdentityProvider, useUserIdentity } from './IdentityProvider';
import { identityStorage } from './identity-storage';

function Probe() {
  const { userId, setIdentity, clearIdentity } = useUserIdentity();
  return (
    <div>
      <span data-testid="uid">{userId === null ? 'null' : userId}</span>
      <button
        type="button"
        onClick={() => {
          const ok = setIdentity(' user-123 ');
          document.body.dataset.lastOk = String(ok);
        }}
      >
        set
      </button>
      <button
        type="button"
        onClick={() => {
          const ok = setIdentity('   ');
          document.body.dataset.lastOk = String(ok);
        }}
      >
        set-blank
      </button>
      <button
        type="button"
        onClick={() => {
          const ok = setIdentity(' user-123 ');
          document.body.dataset.lastOk = String(ok);
        }}
      >
        set-same
      </button>
      <button type="button" onClick={() => clearIdentity()}>
        clear
      </button>
    </div>
  );
}

describe('IdentityProvider', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('throws outside IdentityProvider', () => {
    expect(() => render(<Probe />)).toThrow(/IdentityProvider/);
  });

  it('hydrates from storage once on init', () => {
    identityStorage.set('seeded');
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    expect(screen.getByTestId('uid')).toHaveTextContent('seeded');
  });

  it('setIdentity commits exact string and returns true', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByTestId('uid')).toHaveTextContent(' user-123 ');
    expect(identityStorage.get()).toBe(' user-123 ');
    expect(document.body.dataset.lastOk).toBe('true');
  });

  it('rejects whitespace and returns false', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'set-blank' }));
    expect(screen.getByTestId('uid')).toHaveTextContent('null');
    expect(identityStorage.get()).toBeNull();
    expect(document.body.dataset.lastOk).toBe('false');
  });

  it('same-value setIdentity returns true and leaves userId unchanged', async () => {
    const user = userEvent.setup();
    identityStorage.set(' user-123 ');
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    expect(screen.getByTestId('uid')).toHaveTextContent(' user-123 ');
    await user.click(screen.getByRole('button', { name: 'set-same' }));
    expect(document.body.dataset.lastOk).toBe('true');
    expect(screen.getByTestId('uid')).toHaveTextContent(' user-123 ');
  });

  it('ignores external localStorage mutations after hydrate (no listeners)', () => {
    identityStorage.set('seeded');
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    expect(screen.getByTestId('uid')).toHaveTextContent('seeded');
    localStorage.setItem('flash-sale.userId', 'mutated-outside');
    expect(screen.getByTestId('uid')).toHaveTextContent('seeded');
  });

  it('clearIdentity clears memory and storage', async () => {
    const user = userEvent.setup();
    identityStorage.set('x');
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'clear' }));
    expect(screen.getByTestId('uid')).toHaveTextContent('null');
    expect(identityStorage.get()).toBeNull();
  });

  it('keeps in-memory identity when persistence throws', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByTestId('uid')).toHaveTextContent(' user-123 ');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/web && pnpm test -- src/features/identity/IdentityProvider.test.tsx
```

- [ ] **Step 3: Implement**

Hydrate with a **lazy `useState` initializer** that calls `identityStorage.get()` once — this satisfies the one-shot hydrate invariant. Do **not** re-read storage in `useEffect`.

Reuse the existing non-whitespace helper from the codebase (currently used by sale/purchase hooks). Import from wherever that helper already lives; do not relocate it solely for #123.

`setIdentity` may depend on the current committed `userId`; memoization strategy is implementation-defined (do not over-optimize callback identity at the expense of correctness).

```tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// import existing non-whitespace ID helper from its current module
import { identityStorage } from './identity-storage';

type UserIdentityContextValue = {
  clearIdentity: () => void;
  setIdentity: (userId: string) => boolean;
  userId: string | null;
};

const UserIdentityContext = createContext<UserIdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  // One-shot hydrate — lazy initializer, not useEffect
  const [userId, setUserId] = useState<string | null>(() => identityStorage.get());

  const setIdentity = useCallback(
    (raw: string): boolean => {
      if (!isNonWhitespaceId(raw)) {
        return false;
      }
      if (userId === raw) {
        return true; // same-value: observe true + unchanged userId
      }
      identityStorage.set(raw);
      setUserId(raw);
      return true;
    },
    [userId],
  );

  const clearIdentity = useCallback(() => {
    identityStorage.clear();
    setUserId(null);
  }, []);

  const value = useMemo(
    () => ({ clearIdentity, setIdentity, userId }),
    [clearIdentity, setIdentity, userId],
  );

  return <UserIdentityContext.Provider value={value}>{children}</UserIdentityContext.Provider>;
}

export function useUserIdentity(): UserIdentityContextValue {
  const ctx = useContext(UserIdentityContext);
  if (!ctx) {
    throw new Error('useUserIdentity must be used within IdentityProvider');
  }
  return ctx;
}
```

For the persistence-failure test: spy `Storage.prototype.setItem` to throw; `identityStorage.set` swallows; provider still updates memory. Do **not** spy `identityStorage.set` to throw.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/web && pnpm test -- src/features/identity/IdentityProvider.test.tsx
```

- [ ] **Step 5: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat(web): add IdentityProvider for committed userId

EOF
)"
```

---

### Task 3: `IdentityStrip`

**Files:**

- Create: `apps/web/src/features/identity/components/IdentityStrip.tsx`
- Create: `apps/web/src/features/identity/components/IdentityStrip.test.tsx`

- [ ] **Step 1: Write failing tests**

Cover: Guest display → Identify → type → Save → status shows exact id; Change prefills; Cancel restores Guest; Save disabled for whitespace; testids present.

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { IdentityProvider } from '../IdentityProvider';
import { IdentityStrip } from './IdentityStrip';

function renderStrip() {
  return render(
    <IdentityProvider>
      <IdentityStrip />
    </IdentityProvider>,
  );
}

describe('IdentityStrip', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows Guest then commits via Identify/Save', async () => {
    const user = userEvent.setup();
    renderStrip();
    expect(screen.getByTestId('identity-status')).toHaveTextContent(/guest/i);
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'rex@example.com');
    await user.click(screen.getByTestId('identity-save'));
    expect(screen.getByTestId('identity-status')).toHaveTextContent('Shopping as rex@example.com');
    expect(screen.queryByTestId('identity-email-input')).not.toBeInTheDocument();
  });

  it('Change prefills and Cancel restores prior display', async () => {
    const user = userEvent.setup();
    renderStrip();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'a@b.c');
    await user.click(screen.getByTestId('identity-save'));
    await user.click(screen.getByTestId('identity-change'));
    expect(screen.getByTestId('identity-email-input')).toHaveValue('a@b.c');
    await user.clear(screen.getByTestId('identity-email-input'));
    await user.type(screen.getByTestId('identity-email-input'), 'other');
    await user.click(screen.getByTestId('identity-cancel'));
    expect(screen.getByTestId('identity-status')).toHaveTextContent('Shopping as a@b.c');
  });

  it('disables Save for whitespace-only draft', async () => {
    const user = userEvent.setup();
    renderStrip();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), '   ');
    expect(screen.getByTestId('identity-save')).toBeDisabled();
  });

  it('Change then Save same value stays identified without leaving editing broken', async () => {
    const user = userEvent.setup();
    renderStrip();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'same@id');
    await user.click(screen.getByTestId('identity-save'));
    await user.click(screen.getByTestId('identity-change'));
    await user.click(screen.getByTestId('identity-save'));
    expect(screen.getByTestId('identity-status')).toHaveTextContent('Shopping as same@id');
    expect(screen.queryByTestId('identity-email-input')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/web && pnpm test -- src/features/identity/components/IdentityStrip.test.tsx
```

- [ ] **Step 3: Implement strip**

Behavior must match §7 of the spec (adapt markup to existing project conventions; snippets below are illustrative):

- Display Guest / Identified with Identify / Change
- Editing: label **Email**, text input, Save, Cancel
- Local `isEditing` + `draft` per mount
- Entering editing focuses the input; after successful Save or Cancel, restore focus to Identify/Change (mechanism is an implementation detail)
- Required `data-testid`s from the spec
- Light Tailwind consistent with catalog (no sale-page redesign)
- Inline invalid messaging is implementation-defined when Save somehow runs on invalid draft

Illustrative structure (not prescriptive JSX):

```tsx
export function IdentityStrip() {
  const { userId, setIdentity } = useUserIdentity();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  // refs for focus restoration as needed

  // beginIdentify / beginChange / onCancel / onSave as in §7
  // onSave: if invalid → show implementation-defined message; if setIdentity(draft) → exit editing
  // display vs editing branches with the mandated testids
}
```

Ship a complete component that passes Task 3 tests — do not leave stubs.

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/web && pnpm test -- src/features/identity/components/IdentityStrip.test.tsx
```

- [ ] **Step 5: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat(web): add IdentityStrip for explicit local identity

EOF
)"
```

---

### Task 4: Wire `IdentityProvider` into app + test harness

**Files:**

- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/test/render.tsx`

- [ ] **Step 1: Update `main.tsx`**

Wrap `App` inside `BrowserRouter` (or outside — either is fine; prefer wrapping `App` so all routes share identity):

```tsx
import { IdentityProvider } from './features/identity/IdentityProvider';

// …
<QueryClientProvider client={queryClient}>
  <BrowserRouter>
    <IdentityProvider>
      <App />
    </IdentityProvider>
  </BrowserRouter>
</QueryClientProvider>;
```

- [ ] **Step 2: Update `test/render.tsx`**

```tsx
import { IdentityProvider } from '../features/identity/IdentityProvider';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Smoke**

```bash
cd apps/web && pnpm test -- src/App.test.tsx src/app/router.test.tsx
```

Expected: PASS (add IdentityProvider to any custom render helpers those files use if they do not go through `renderApp`).

- [ ] **Step 4: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat(web): mount IdentityProvider at app root

EOF
)"
```

---

### Task 5: Catalog mounts `IdentityStrip`

**Files:**

- Modify: `apps/web/src/pages/CatalogPage.tsx`
- Modify: `apps/web/src/pages/CatalogPage.test.tsx`

- [ ] **Step 1: Extend catalog tests**

Ensure catalog tests wrap `IdentityProvider` (or use shared render that already does).

Add cases:

1. Strip present with Guest status.
2. Identify → Save → remount → still shows committed identity (storage hydrate).

```tsx
it('persists identity across remount via strip', async () => {
  const user = userEvent.setup();
  const { unmount } = renderCatalog(); // must include IdentityProvider
  await user.click(screen.getByTestId('identity-identify'));
  await user.type(screen.getByTestId('identity-email-input'), 'persist-me');
  await user.click(screen.getByTestId('identity-save'));
  unmount();
  renderCatalog();
  expect(screen.getByTestId('identity-status')).toHaveTextContent('Shopping as persist-me');
});
```

Clear `localStorage` in `afterEach`.

- [ ] **Step 2: Run — expect FAIL** (strip missing)

```bash
cd apps/web && pnpm test -- src/pages/CatalogPage.test.tsx
```

- [ ] **Step 3: Mount strip in `CatalogPage`**

Near top of `<main>`, above eyebrow/title:

```tsx
import { IdentityStrip } from '../features/identity/components/IdentityStrip';

// …
<main …>
  <IdentityStrip />
  …
</main>
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat(web): show identity strip on catalog home

EOF
)"
```

---

### Task 6: Sale page + `PurchasePanel` wiring

**Files:**

- Modify: `apps/web/src/features/flash-sale/components/PurchasePanel.tsx`
- Modify: `apps/web/src/pages/FlashSalePage.tsx`
- Possibly remove: `apps/web/src/hooks/useDebouncedValue.ts` (only if unused)

- [ ] **Step 1: Narrow `PurchasePanel` (behavioral contract)**

- Remove `userId` and `onUserIdChange` props and the User ID input.
- Keep Buy button, already-purchased status, and buy pending label behavior.
- When Guest (`showGuestHint` or equivalent): show plain text **Identify to buy.** (no control that opens identity editing — only the strip edits identity).
- Preserve existing accessibility roles/testids for already-purchased / Buy where present; add `data-testid="identify-to-buy"` for the Guest hint.

Adapt prop names/markup to existing file style — do not wholesale rewrite unrelated panel chrome.

- [ ] **Step 2: Rewire `FlashSalePage` (behavioral contract)**

- Mount `IdentityStrip` at the top of the sale page main content.
- Drop page-local `userId` `useState` and identity debounce.
- `const { userId } = useUserIdentity()` → pass `userId ?? ''` into `useMyPurchase` (enabled only when committed identity is non-whitespace; Guest never networks).
- Buy eligibility uses committed `userIdValid`.
- `onBuy` / retry: early-return unless `userId` is non-null and non-whitespace; then `mutate({ flashSaleId, userId })` with the exact committed string.
- Pass Guest hint into `PurchasePanel` when `userId === null`.
- Keep existing sale loading/error/outcome banners and eligibility helper.

Illustrative shape (adapt to current file; do not paste blindly over unrelated markup):

```tsx
const { userId } = useUserIdentity();
const myPurchaseQuery = useMyPurchase(flashSaleId, userId ?? '');
const userIdValid = isNonWhitespaceId(userId ?? '');

function onBuy() {
  if (userId === null || !isNonWhitespaceId(userId)) return;
  purchaseMutation.mutate({ flashSaleId, userId });
}
```

- [ ] **Step 3: `useDebouncedValue` cleanup**

```bash
rg "useDebouncedValue" apps/web/src
```

Remove the hook file **only if** there are no remaining imports in the web app. If something else still imports it, leave it.

- [ ] **Step 4: Typecheck / temporary test expectation**

```bash
cd apps/web && pnpm typecheck
```

`FlashSalePage.test.tsx` will fail until Task 7 — that is expected.

- [ ] **Step 5: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
feat(web): drive sale purchase from committed identity

EOF
)"
```

---

### Task 7: Rewrite `FlashSalePage` tests

**Files:**

- Modify: `apps/web/src/pages/FlashSalePage.test.tsx`

- [ ] **Step 1: Add IdentityProvider + seed helper; remove fake timers**

```tsx
import { IdentityProvider } from '../features/identity/IdentityProvider';
import { identityStorage } from '../features/identity/identity-storage';

function renderSale(path: string, options: { userId?: string } = {}) {
  localStorage.clear();
  if (options.userId !== undefined) {
    identityStorage.set(options.userId);
  }
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<FlashSalePage />} path="/sales/:flashSaleId" />
          </Routes>
        </MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
  );
  return { queryClient, user };
}

async function identifyViaStrip(user: ReturnType<typeof userEvent.setup>, raw: string) {
  const identify = screen.queryByTestId('identity-identify');
  if (identify) {
    await user.click(identify);
  } else {
    await user.click(screen.getByTestId('identity-change'));
  }
  const input = screen.getByTestId('identity-email-input');
  await user.clear(input);
  await user.type(input, raw);
  await user.click(screen.getByTestId('identity-save'));
}
```

Keep `identifyViaStrip` **local to this test file** unless a second file needs it; only then extract to a shared test util.

Remove `beforeEach`/`afterEach` fake timers. Clear storage in `afterEach`.

- [ ] **Step 2: Replace identity assertions**

| Old                                 | New                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Guest / no type → no myPurchase     | `renderSale` without seed; assert `counters.myPurchase.size === 0`; assert `identify-to-buy` |
| Type whitespace + debounce          | Type whitespace in strip; Save disabled / no commit; size 0                                  |
| Type `' user-123 '` + advanceTimers | `identifyViaStrip(user, ' user-123 ')` or seed `userId: ' user-123 '`                        |
| `getByLabelText(/user id/i)`        | Strip / seed helpers only                                                                    |
| Debounce-named test                 | Rename to exact-id / myPurchase error behavior without debounce                              |

Seeded `renderSale(path, { userId: 'user-1' })` is preferred for non-UX tests (already purchased, outcomes, invalidation) to avoid repeating strip clicks.

Add one case: switch identity via Change → Save → new `myPurchase` variables receive traffic **and** the UI reflects the new identity’s purchase state. Explicitly: after the identity change, the **previous user’s cached `myPurchase` result must no longer determine `PurchasePanel` state** (already-purchased / Buy). Example: seed user A as purchased, switch to user B as not purchased → already-purchased disappears / Buy enables appropriately for B.

- [ ] **Step 3: Run**

```bash
cd apps/web && pnpm test -- src/pages/FlashSalePage.test.tsx
```

Expected: PASS (update assertion text as needed; preserve outcome/invalidation coverage).

- [ ] **Step 4: Commit (optional)**

```bash
git commit -m "$(cat <<'EOF'
test(web): align FlashSalePage tests with persisted identity

EOF
)"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run web suite**

```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm test
```

Expected: all green.

- [ ] **Step 2: Spec coverage checklist**

| Spec requirement                                                                                                                   | Task       |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Storage get/set/clear + swallowed errors                                                                                           | 1          |
| Provider hydrate / set / clear / same-value / throws outside provider / ignore post-hydrate storage mutate / session on write fail | 2          |
| Strip Guest/Identify/Change/Cancel/Save/same-value Save/testids                                                                    | 3          |
| Provider at root + test wrap                                                                                                       | 4          |
| Catalog strip + persist remount                                                                                                    | 5          |
| Sale wiring, no debounce, mutation guard, Guest hint                                                                               | 6          |
| Exact id on myPurchase/purchaseItem; Guest no spam; switch id — previous cached result must not drive PurchasePanel                | 7          |
| No AuthN / no #124/#127/#133 scope                                                                                                 | throughout |
| `identityStorage` empty string ⇒ null                                                                                              | 1          |

- [ ] **Step 3: Manual smoke (optional)**

```bash
pnpm --filter web dev
```

Confirm `/` strip → Save → open a sale → Shopping as … + Buy enabled for ACTIVE sale.

- [ ] **Step 4: Commit (optional — docs if not already tracked)**

Include spec + plan if creating the PR branch:

```bash
git add docs/superpowers/specs/2026-07-30-issue-123-persisted-local-user-identity-design.md \
  docs/superpowers/plans/2026-07-30-issue-123-persisted-local-user-identity.md
git commit -m "$(cat <<'EOF'
docs: add #123 local identity design and plan

EOF
)"
```

---

## Self-review (plan author)

1. **Spec coverage:** §§1–13 mapped to Tasks 1–8; out-of-scope respected. Editorial clarifications (storage write failures, same-value no-op, one-shot hydrate, implementation-defined inline errors, `setIdentity` true path) are in the approved spec and Tasks 1–2.
2. **Placeholders:** None remaining; Task 3/6 use behavioral contracts with illustrative snippets only.
3. **Types:** `userId: string | null`; `setIdentity(): boolean`; storage key `flash-sale.userId`; testids match spec.
4. **Commits:** optional only per user instruction.
5. **Convention note:** Existing behavior wins; reuse existing non-whitespace helper location; focus restoration is implementation-defined.
