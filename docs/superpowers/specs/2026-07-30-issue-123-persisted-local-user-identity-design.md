# Issue #123 — Persisted Local User Identity UX (Design Spec)

**Status:** Approved
**Date:** 2026-07-30
**Issue:** [#123](https://github.com/rexescario-dev/flash-sale-system/issues/123)
**Parent epic:** [#120](https://github.com/rexescario-dev/flash-sale-system/issues/120) (EPIC-10 — Milestone 10)
**Repository:** `rexescario-dev/flash-sale-system`
**Upstream:** Catalog home (`/`) via [#122](https://github.com/rexescario-dev/flash-sale-system/issues/122) / [PR #135](https://github.com/rexescario-dev/flash-sale-system/pull/135) on `main` (`a014e4e`); sale page + GraphQL purchase from EPIC-05
**Not** AuthN/AuthZ — local opaque `userId` persistence and UX only

## 1. Goal

Let customers enter a user identifier once, persist it locally, and reuse it across Catalog and Sale pages — **without** authentication — so purchase eligibility and mutations always use a deliberate, committed identity.

## 2. Scope / Non-goals

### In scope

- App-wide committed identity via `IdentityProvider` + `localStorage`
- Shared `IdentityStrip` on Catalog (`/`) and Sale (`/sales/:flashSaleId`)
- Explicit Identify / Save / Change / Cancel flow (draft local to the strip)
- Wire `FlashSalePage` / `PurchasePanel` / `myPurchase` / `purchaseItem` to committed identity only
- Remove sale-page local `userId` typing + identity debounce
- Vitest coverage: storage, provider, strip, catalog persistence, sale GraphQL gating + exact id on purchase
- Stable `data-testid`s for strip interactions

### Non-goals

See **§10 Out of scope**.

## 3. Locked decisions

| Decision      | Choice                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Surface       | Option 2 — app-wide provider + strip on Catalog **and** Sale; no nav/shell (#127)               |
| Commit model  | Explicit confirm — draft local; Identify/Save commits                                           |
| Validation    | Non-empty / non-whitespace only (`trim().length > 0` for validity check)                        |
| Normalization | **None** after validation — store, GraphQL, and query keys use the exact committed string       |
| API field     | Remains GraphQL `userId` (opaque string). UI may label the field **Email** as presentation only |
| Architecture  | Approach A — Context provider + `identityStorage` module + shared `IdentityStrip`               |
| Debounce      | Not used for identity; explicit commit already gates GraphQL                                    |

## 4. Architecture

```text
App root
├── QueryClientProvider
├── BrowserRouter
└── IdentityProvider                 ← hydrate from identityStorage once on mount
      ├── CatalogPage
      │     └── IdentityStrip
      └── FlashSalePage
            ├── IdentityStrip
            └── PurchasePanel / hooks ← committed userId only
```

### Separation of responsibilities

```text
IdentityProvider
    ├── owns committed identity
    ├── initializes from storage once on mount
    ├── exposes setIdentity() / clearIdentity()
    └── persists via identityStorage

identityStorage
    ├── get()
    ├── set(userId)
    └── clear()

IdentityStrip
    ├── owns isEditing + draft (per mount)
    ├── validates non-empty for UI enablement
    └── commits via context

PurchasePanel / FlashSalePage
    └── consume committed identity only
```

### Architectural principles

> **IdentityProvider** reads storage **exactly once** during provider initialization (initial mount). Subsequent updates flow only through `setIdentity()` and `clearIdentity()`. Subsequent storage changes outside the provider (other tabs, manual edits, `storage` events) are **ignored** — no storage event listeners.

> `identityStorage` is an implementation detail of `IdentityProvider`. No page, hook, or component accesses `localStorage` directly.

> `IdentityProvider.setIdentity()` is the authoritative guard against invalid commits. The strip may disable Save and show UI errors, but cannot bypass provider validation.

> GraphQL hooks derive their variables only from the committed `userId` from `useUserIdentity()`. They never observe the draft value.

> `userId === null` means Guest: no persisted identity, no `myPurchase` query, Buy requires committing an identity first.

> The provider stores, GraphQL sends, React Query keys, and tests all use the **exact** committed string. No trimming, normalization, or case conversion occurs after validation.

## 5. Component / module responsibilities

| Unit                                     | Responsibility                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `identityStorage`                        | `get(): string \| null`, `set(userId: string)`, `clear()` over key `flash-sale.userId`. Corrupt/missing/unavailable reads ⇒ `null`. Any `localStorage` read/write/clear exception must not propagate; see §6 |
| `IdentityProvider` + `useUserIdentity()` | Committed `userId: string \| null`; one-shot hydrate; `setIdentity` / `clearIdentity`                                                                                                                        |
| `IdentityStrip`                          | Draft + Identify/Change/Save/Cancel; “Shopping as Guest” / “Shopping as {userId}”; no GraphQL                                                                                                                |
| `CatalogPage`                            | Mount strip; no purchase GraphQL                                                                                                                                                                             |
| `FlashSalePage`                          | Mount strip; orchestrate sale + committed identity → hooks/mutation                                                                                                                                          |
| `PurchasePanel`                          | Buy CTA, already-purchased, optional Guest hint only — **no** identity editing                                                                                                                               |

Suggested paths (align with existing web layout):

- `apps/web/src/features/identity/identity-storage.ts`
- `apps/web/src/features/identity/IdentityProvider.tsx` (exports `IdentityProvider` + `useUserIdentity`)
- `apps/web/src/features/identity/components/IdentityStrip.tsx`
- Wire provider in `apps/web/src/main.tsx` (inside existing providers, wrapping `App`)
- Update `apps/web/src/test/render.tsx` to wrap with `IdentityProvider` for tests

## 6. Provider API

```ts
type UserIdentityContextValue = {
  userId: string | null;
  /**
   * Validates non-whitespace.
   * Returns `false` if invalid (state/storage unchanged).
   * Returns `true` if committed (including same-value no-op — see below).
   */
  setIdentity(userId: string): boolean;
  clearIdentity(): void;
};
```

### Behavior

- **`setIdentity(raw)`**
  1. If `!isNonWhitespaceId(raw)` (or equivalent `raw.trim().length === 0`), return `false` and leave state/storage unchanged.
  2. If `raw` is already the exact committed `userId`, return `true` as a **no-op** (do not re-write storage, do not force a React state update that would churn dependents).
  3. Persist **exact** `raw` via `identityStorage.set(raw)`. Persistence failure must not throw; keep the new in-memory committed identity for the session.
  4. Set committed `userId` to `raw`.
  5. Return `true`.
- **`clearIdentity()`** — attempt `identityStorage.clear()` (swallow persistence errors) + set `userId` to `null`. Strip UI in #123 does **not** expose a Clear control; API exists for tests and future use.
- **Hydration** — during provider initialization, `userId = identityStorage.get()` (already `null` if missing/corrupt/unavailable). No later re-read; no `storage` listeners.

## 7. IdentityStrip UX

### Placement

Top of `CatalogPage` and `FlashSalePage` main content. Same component, page-local mount — **not** a layout shell / global header.

### Modes

| Mode                 | When                               | UI                                                           |
| -------------------- | ---------------------------------- | ------------------------------------------------------------ |
| Display (guest)      | `userId === null` and not editing  | “Shopping as Guest” · **Identify**                           |
| Display (identified) | committed `userId` and not editing | “Shopping as {exact userId}” · **Change**                    |
| Editing              | Identify/Change pressed            | Label **Email** · text input (draft) · **Save** · **Cancel** |

### Flow

```text
Guest → Identify → editing (draft empty)
Identified → Change → editing (draft prefilled with committed userId)
editing → Save → setIdentity(draft)
          → true: exit editing; clear transient validation; display Shopping as …
          → false: stay editing; show inline validation messaging (implementation-defined copy)
editing → Cancel → discard draft; clear transient validation; restore prior display mode
```

### Local editing rules

- Each mounted `IdentityStrip` owns its own `isEditing` and `draft` state. Editing is **not** shared across routes — only committed identity is.
- **Not editing:** always reflects the latest committed `userId`.
- **Editing:** preserve the local draft until Save or Cancel (do not overwrite draft if committed identity changes elsewhere).
- After successful Save, do **not** independently reset draft; the next Change initializes draft from the current committed identity.
- Save disabled when draft is empty/whitespace (`trim().length === 0`). Disable is the primary UX guard; provider remains authoritative.
- Inline validation messaging is **implementation-defined** (present when Save somehow fires on invalid draft / `setIdentity` returns `false`; not a dedicated design requirement beyond that).
- Cancel never mutates provider/storage.
- No Clear-to-Guest control in the strip for #123.

### Focus (a11y polish)

- Enter editing → focus the email input.
- Successful Save or Cancel → exit editing; return focus to Identify/Change (or otherwise exit editing cleanly).

### Sync commit

`setIdentity` is synchronous (context + `localStorage`). No loading/pending UI for identity commit.

### Stable test ids

| `data-testid`          | Role                        |
| ---------------------- | --------------------------- |
| `identity-strip`       | Root strip region           |
| `identity-status`      | “Shopping as …” status text |
| `identity-identify`    | Identify control            |
| `identity-change`      | Change control              |
| `identity-email-input` | Draft email/userId input    |
| `identity-save`        | Save control                |
| `identity-cancel`      | Cancel control              |

### Styling

Light Tailwind utilities consistent with the catalog (emerald accents OK). **No** sale-page Tailwind redesign (#124). **No** shared nav chrome (#127).

## 8. Sale-page wiring

### Remove page-local identity typing

- Drop `FlashSalePage` `useState` for `userId` and `PurchasePanel` `userId` / `onUserIdChange` props.
- Remove identity debounce on the sale page (`useDebouncedValue` unused for identity; keep the hook module only if still referenced elsewhere).

### Committed identity → GraphQL

```text
const { userId } = useUserIdentity(); // string | null

useMyPurchase(flashSaleId, userId ?? '')
  // enabled whenever committed identity is non-null and non-whitespace
  // Guest/null/whitespace ⇒ disabled; no network

if (userId !== null && isNonWhitespaceId(userId)) {
  purchaseMutation.mutate({ flashSaleId, userId })
}
```

- `useMyPurchase` remains disabled whenever the committed identity is invalid or `null`. Passing `''` as a placeholder argument must never result in a network request.
- Buy button disabled when `!userIdValid`.
- Mutation trigger must also guard: never invoke `purchaseItem` when `userId` is `null` or whitespace-only (UI disable is not sufficient alone).

### PurchasePanel (narrowed)

- Eligibility / Buy button / already-purchased / optional Guest hint only.
- Must not know about editing identity.
- Guest hint copy: **Identify to buy.** (plain text; no button that opens identity — only the strip edits identity).

### Eligibility

Preserve EPIC-05 Buy rules; `userIdValid` now derives from committed identity:

- invalid / Guest ⇒ Buy disabled
- sale loading/error / `status !== ACTIVE` / initial `myPurchase` pending / `purchased === true` / mutation pending ⇒ Buy disabled

### Identity change while purchasing

> Changing identity does **not** cancel or rebind an in-flight purchase mutation. Each mutation belongs to the `userId` it was started with.

> Changing identity naturally results in a different TanStack Query key because `userId` is part of `['myPurchase', flashSaleId, userId]`. Previous identities remain cached until normal cache eviction; no manual removal is performed in #123.

Invalidation remains variable-scoped on mutation settlement (existing EPIC-05 behavior). No Redis / purchase-contract API changes.

## 9. Catalog wiring

- Mount the same `IdentityStrip` near the top of `CatalogPage`.
- Catalog does not call `myPurchase` / `purchaseItem`.
- Identify on `/` then open a sale: committed identity is already available via provider hydration / in-memory state (and survives full reload via `localStorage`).

## 10. Out of scope

- Real AuthN / OAuth / JWT / server sessions
- Email RFC validation, lowercasing, or trim-on-commit
- Implying private/authenticated purchase history
- #124 sale details / purchase Tailwind redesign
- #125 `myPurchases` API / #126 My Purchases page
- #127 global customer navigation / app shell / persistent header
- #128 shared Tailwind primitives extraction (beyond light reuse)
- #129 purchase cache invalidation product changes / Redis contract changes
- #133 official Tailwind packages / #134 catalog review polish (unless they block #123 — they do not)
- Playwright customer-journey expansion (#130) — Vitest only in this issue

## 11. Testing strategy

Vitest + Testing Library (+ MSW where GraphQL is involved). Playwright deferred to #130.

| Area               | Coverage                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identityStorage`  | set/get/clear; missing/corrupt/empty string ⇒ `null`                                                                                                                                                                    |
| `IdentityProvider` | one-shot hydrate; `setIdentity` success/reject; same-value no-op; throws outside provider; exact string preserved; `clearIdentity`; persistence failures do not crash UI; ignores external storage writes after hydrate |
| `IdentityStrip`    | Guest → Identify → Save; Change prefill; Cancel restores; Save disabled when blank; testids; focus optional                                                                                                             |
| Catalog            | strip present; Save then remount/navigate still shows committed identity                                                                                                                                                |
| Sale / GraphQL     | Guest ⇒ zero `myPurchase` calls; Save ⇒ `myPurchase` with exact id; Buy sends committed id; switch id ⇒ new query traffic **and** UI follows new identity; no User ID input in `PurchasePanel`                          |

Update existing `FlashSalePage` tests that typed into `#user-id` / `PurchasePanel` input to drive identity via the strip (or provider setup helpers).

## 12. Acceptance criteria mapping

| Criterion (issue #123)                                   | Design coverage                                  |
| -------------------------------------------------------- | ------------------------------------------------ |
| User ID not retyped on every sale visit                  | Persist + hydrate + strip on catalog and sale    |
| Survives refresh/navigation; can be switched             | `localStorage` + Change → Save                   |
| Eligibility/purchase still correct with selected ID      | §8 wiring; exact committed string                |
| Empty ID does not spam GraphQL                           | Guest disables `myPurchase`; draft never queried |
| No authentication system introduced                      | Explicit non-goal                                |
| Tests: enter, persist, switch, purchase uses selected ID | §11                                              |

## 13. Unblocks

- #124 Flash sale details / purchase UX redesign (needs stable identity API)
- #126 My Purchases UI (reuse same provider/store)

#127 remains responsible for real application chrome (nav, persistent header, layout shell), not identity state ownership.
