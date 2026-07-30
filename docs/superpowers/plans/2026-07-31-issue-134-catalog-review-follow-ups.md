# #134 Catalog Review Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close remaining #122 catalog code-review follow-ups on post-#133 `main`: deterministic retry gate, stock text on CatalogPage success, explicit whitespace-only description omission, CSS AC documented + narrow guard.

**Architecture:** Test-and-docs-only changes in `apps/web` (plus a short GitHub #134 comment). No production CSS. No shared retry helper. No Purchases retry edits. No #128.

**Tech Stack:** Vitest, Testing Library, MSW, React Query, Tailwind v4 (already on main).

**Base:** `main` @ `aaada40+` (Tailwind v4 migration merged). Working tree must stay clean relative to issue work only.

**Commits:** User has requested commits. Commit each completed task as a logical unit using the repo’s conventional commit style. Do not push until the PR step.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-134-catalog-review-follow-ups-design.md`

---

## File map

| File                                                                              | Responsibility                                                                                |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/web/src/pages/CatalogPage.retry.test.tsx`                                   | Replace `setTimeout(250)` with deferred/release gate; assert mid-retry error + no success yet |
| `apps/web/src/pages/CatalogPage.test.tsx`                                         | Assert `2 / 5 remaining` on success path                                                      |
| `apps/web/src/features/catalog/components/FlashSaleCard.test.tsx`                 | Distinct whitespace-only description omission test                                            |
| `apps/web/src/styles.catalog-guard.test.ts`                                       | Narrow CSS regression guard (`h1`/`button` element selectors; no `catalog*.css`)              |
| `docs/superpowers/specs/2026-07-31-issue-134-catalog-review-follow-ups-design.md` | Already written; keep in sync if wording drifts                                               |
| GitHub issue #134                                                                 | Comment documenting CSS AC satisfied by the Tailwind v4 migration                             |

**Expected unchanged:** `FlashSaleCard.tsx` (expected to remain unchanged), `styles.css`, `PurchasesPage.retry.test.tsx`, vendor (gone). Discover before editing production code.

---

### Task 1: Deterministic CatalogPage retry gate

**Files:**

- Modify: `apps/web/src/pages/CatalogPage.retry.test.tsx`
- Test: same file

- [ ] **Step 1: Replace the delayed second MSW response with a deferred/release gate**

Behavioral change only (do not require a whole-file rewrite):

1. Keep the first `FlashSales` response as a GraphQL error.
2. Replace the `setTimeout(250)` delay on the second response with a deferred Promise gate that the test holds, then explicitly releases.
3. After click retry, while the second response is still held:
   - error UI remains visible (`catalog-error` / retry control)
   - success UI is **not** yet rendered
   - Do **not** assert loading absence — React Query may briefly surface pending during refetch
4. Release the gate; assert success UI appears.

Do **not** require an `attempts` / request-count assertion. The contract is hold → no success yet → release → success. Request counting is optional diagnostic only and must not be a required expectation.

Pattern reference: deferred resolve in `FlashSalePage.test.tsx` (“never shows SUCCESS before the backend returns”). Adapt that pattern to this test’s existing structure.

- [ ] **Step 2: Run the retry test**

Run: `pnpm --filter web exec vitest run src/pages/CatalogPage.retry.test.tsx`

Expected: PASS

---

### Task 2: CatalogPage success-path stock text

**Files:**

- Modify: `apps/web/src/pages/CatalogPage.test.tsx`
- Test: same file

- [ ] **Step 1: Add stock assertion to the success-path test**

In `it('shows initial loading then the catalog grid', ...)`, after cards/links are asserted, add the user-visible stock contract string.

Current fixtures render both cards with `2 / 5 remaining`. Assert that exact string (UI contract from `FlashSaleCard`: `{remaining} / {total} remaining`):

```tsx
expect(screen.getAllByText('2 / 5 remaining')).toHaveLength(2);
```

- [ ] **Step 2: Run CatalogPage tests**

Run: `pnpm --filter web exec vitest run src/pages/CatalogPage.test.tsx`

Expected: PASS

---

### Task 3: Whitespace-only description unit test

**Files:**

- Modify: `apps/web/src/features/catalog/components/FlashSaleCard.test.tsx`
- Production: `FlashSaleCard.tsx` (expected to remain unchanged)

- [ ] **Step 1: Add a distinct whitespace-only test**

Keep existing `null` / `""` / non-empty tests unchanged. Add a separate case so the enhancement is intentional:

```tsx
it('omits description when whitespace-only', () => {
  renderCard(sale({ product: { id: 'p1', description: '   ', name: 'X' } }));
  expect(screen.queryByTestId('catalog-card-description')).not.toBeInTheDocument();
});
```

Place it after the empty-string test so it stays visually separate from the locked `null`/`""` cases.

If production code does not already omit whitespace-only descriptions, discover and fix the minimal change needed — but prefer leaving `FlashSaleCard.tsx` unchanged if behavior already matches.

- [ ] **Step 2: Run FlashSaleCard tests**

Run: `pnpm --filter web exec vitest run src/features/catalog/components/FlashSaleCard.test.tsx`

Expected: PASS (including the new whitespace case)

---

### Task 4: Narrow CSS regression guard

**Files:**

- Create: `apps/web/src/styles.catalog-guard.test.ts`

- [ ] **Step 1: Write the guard test**

Create a narrow vitest guard (not a general CSS linter) that fails if:

1. `apps/web/src/styles.css` contains **element selectors** targeting `h1` or `button`, while ignoring occurrences inside class names or comments.
2. Any file matching `apps/web/src/**/catalog*.css` exists.

Implementation freedom: choose the simplest detection approach that meets those behaviors. For the catalog CSS file check, a recursive directory walk under `apps/web/src` is sufficient — do not prescribe a particular Node API.

- [ ] **Step 2: Run the guard test**

Run: `pnpm --filter web exec vitest run src/styles.catalog-guard.test.ts`

Expected: PASS

- [ ] **Step 3: Sanity-check detection without leaving a planted failure**

Confirm (mentally or via a temporary local edit that is reverted) that a rule like `h1 { color: red; }` would fail the guard. Do not leave a planted failure in the tree.

---

### Task 5: Issue documentation + full web suite

**Files:**

- GitHub issue #134 (comment)
- Spec already at `docs/superpowers/specs/2026-07-31-issue-134-catalog-review-follow-ups-design.md`

- [ ] **Step 1: Comment on #134**

```bash
gh issue comment 134 --body "$(cat <<'EOF'
## CSS AC disposition (post-#133)

Original CSS review item is **closed by the Tailwind v4 migration**. That migration removed the vendor bridge, leaving only global `:root`/`body` styles; no catalog-local CSS changes are required. The empty vendor `.sm:px-6` stub is N/A (vendor deleted).

Catalog continues to rely on Tailwind utility classes. A narrow vitest guard covers reintroduction of global `h1`/`button` element selectors in `styles.css` and any `apps/web/src/**/catalog*.css` files.

Remaining #134 work: deterministic CatalogPage retry gate, CatalogPage stock text assertion, FlashSaleCard whitespace-only description test.
EOF
)"
```

- [ ] **Step 2: Run full web suite**

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

Expected: all green.

---

## Self-review checklist

1. **Spec coverage:** Retry gate ✓ · CSS docs+guard ✓ · vendor N/A noted ✓ · stock text ✓ · trim enhancement + whitespace test ✓
2. **Placeholders:** None intentional; commits deferred globally (no per-task commit steps).
3. **Out of scope held:** No Purchases retry helper, no #128, no production CSS edits.
4. **Retry assertions:** Mid-retry checks error + absence of success UI; does **not** assert loading absence; does **not** require request-count assertions.
5. **Stock string:** Exact contract `2 / 5 remaining`.
6. **Whitespace test:** Distinct `it(...)` from null/`""`.
7. **Production behavior:** Unchanged except the documented whitespace-only description omission (already present or minimal fix if discovered missing).
