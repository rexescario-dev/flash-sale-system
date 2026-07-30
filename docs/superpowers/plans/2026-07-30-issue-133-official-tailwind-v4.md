# Issue #133 — Official Tailwind v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary `file:vendor/tailwindcss*` bridge with official Tailwind v4 packages, keep preflight enabled, and make Compose web builds succeed without any vendor directory.

**Architecture:** Single cohesive PR — swap npm deps, delete the bridge, regenerate the lockfile, trim legacy globals that conflict with preflight, and utility-ize callers (primarily `NotFoundPage`). Do not disable preflight. Do not invent scoped prose wrappers unless verification surfaces a real need.

**Tech Stack:** Vite 6, `@tailwindcss/vite`, `tailwindcss` v4, pnpm workspace, Docker Compose, Playwright smoke

**Spec:** `docs/superpowers/specs/2026-07-30-issue-133-official-tailwind-v4-design.md`

**Do not invent commits** beyond the logical groups requested at finish time.

---

## File map

| File                                  | Responsibility                                                   |
| ------------------------------------- | ---------------------------------------------------------------- |
| `apps/web/package.json`               | Official `tailwindcss` + `@tailwindcss/vite` (no `file:` bridge) |
| `pnpm-lock.yaml`                      | Registry resolutions only for Tailwind                           |
| `apps/web/vendor/**`                  | Delete entirely                                                  |
| `apps/web/vite.config.ts`             | Keep `tailwindcss()` from `@tailwindcss/vite` (already present)  |
| `apps/web/src/styles.css`             | `@import 'tailwindcss'`; intentional app globals only            |
| `apps/web/src/pages/NotFoundPage.tsx` | Utilities instead of bridge-era helpers                          |
| `Dockerfile`                          | No vendor-specific change expected after package swap            |

Out of scope: #128 primitives, #134 catalog follow-ups, UX redesign.

---

## Design locks

| Concern         | Decision                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Packages        | Official Tailwind v4 (`tailwindcss`, `@tailwindcss/vite`) — current compatible v4 release                     |
| Preflight       | **Enabled**. Fixes via utilities or narrowly scoped CSS only                                                  |
| Bridge          | Delete `apps/web/vendor/**`; no `file:` Tailwind deps; no remaining `vendor/tailwindcss*` refs in code/config |
| Docker          | Existing build flow works without vendor; `docker compose build web` is the acceptance check                  |
| Helpers         | Remove unused presentation helpers after migration; keep only if still legitimately referenced                |
| Scoped wrappers | Fallback only if a real regression needs them                                                                 |

---

### Task 1: Swap bridge packages for official Tailwind v4

**Files:**

- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml` (via pnpm)
- Delete: `apps/web/vendor/**` (entire tree)
- Verify unchanged intent: `apps/web/vite.config.ts` still imports `tailwindcss` from `@tailwindcss/vite` and calls `tailwindcss()`

- [ ] **Step 1: Remove bridge deps and install official packages**

From repo root (`/home/rex/Project/test/app`):

```bash
pnpm --filter web remove tailwindcss @tailwindcss/vite
pnpm --filter web add -D tailwindcss @tailwindcss/vite
```

Expected: `apps/web/package.json` lists both under `devDependencies` with registry versions (not `file:vendor/...`).

- [ ] **Step 2: Delete the vendor bridge tree**

```bash
rm -rf apps/web/vendor
```

Expected: `apps/web/vendor` no longer exists.

- [ ] **Step 3: Confirm lockfile and package.json have no bridge refs**

```bash
rg -n 'file:vendor/tailwind|vendor/tailwindcss' apps/web/package.json pnpm-lock.yaml
test ! -e apps/web/vendor
```

Expected: no matches; `test` succeeds.

- [ ] **Step 4: Confirm Vite config still registers the plugin**

Verify `vite.config.ts` continues to register `tailwindcss()` from `@tailwindcss/vite`. No unrelated Vite/Vitest configuration changes are expected.

- [ ] **Step 5: Smoke the install**

```bash
pnpm install
node -e "import('@tailwindcss/vite').then((m) => console.log(typeof m.default))"
```

Expected: `pnpm install` succeeds; printed value is `function` (real plugin export, not the deleted no-op bridge).

---

### Task 2: Adopt preflight — trim globals and utility-ize NotFound

**Files:**

- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/pages/NotFoundPage.tsx`
- Test: `apps/web/src/app/router.test.tsx` (existing NotFound coverage — keep green)

- [ ] **Step 1: Inventory callers of legacy helpers**

```bash
rg -n '\b(shell|eyebrow|lede|muted)\b' apps/web/src --glob '*.{tsx,ts,css}'
```

Expected before edits: `styles.css` definitions plus `NotFoundPage.tsx` using `shell` / `lede`. If other real callers appear, convert them too (or keep a helper only if still legitimately used).

- [ ] **Step 2: Rewrite `NotFoundPage` with utilities**

Convert `NotFoundPage` from bridge-era helper classes to Tailwind utilities while preserving its layout and navigation behavior. The exact utility classes may vary.

Do not introduce a `.product-detail` / `.prose` wrapper.

- [ ] **Step 3: Trim `styles.css` for preflight**

Keep `@import 'tailwindcss';` and intentional app chrome. Remove or narrow legacy global element styling that conflicts with preflight. Remove unused presentation helpers after Step 2. Never disable preflight.

Target shape (one acceptable end state): `@import 'tailwindcss';` plus intentional app globals such as `:root` color/background/font and `body` layout chrome. Another minimal global rule may be retained if it is intentionally app-wide.

Remove or narrow (unless a remaining caller still needs them after conversion):

- global element rules that conflict with preflight (for example `h1`, `button`, `input`, `label`, `section`, `[role='alert']`, `[role='status']`)
- redundant resets already covered by preflight (for example bare `* { box-sizing }` / `body { margin: 0 }` when preflight provides them)
- unused helpers such as `.shell`, `.eyebrow`, `.lede`, `.muted`

- [ ] **Step 4: Confirm helpers are gone when unused**

```bash
rg -n '\.(shell|eyebrow|lede|muted)\b|className="[^"]*\b(shell|lede|eyebrow|muted)\b' apps/web/src
```

Expected: no remaining definitions or className usages (unless you intentionally kept a still-used helper).

- [ ] **Step 5: Run focused router/NotFound test**

```bash
pnpm --filter web test -- src/app/router.test.tsx
```

Expected: PASS, including `renders not found for unknown routes`.

- [ ] **Step 6: Run CustomerNav unit tests**

```bash
pnpm --filter web test -- src/features/nav/CustomerNav.test.tsx
```

Expected: PASS (responsive classNames still present; real Tailwind will generate the utilities at build time).

---

### Task 3: Web verification suite + Tailwind-generated CSS check

**Files:** none new (verification only; fix regressions in-place with utilities or narrowly scoped CSS)

- [ ] **Step 1: Full web gates**

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web build
```

Expected: all PASS / clean build. `apps/web/dist/assets/*.css` is produced.

- [ ] **Step 2: Confirm production CSS is Tailwind-generated, not the bridge stylesheet**

```bash
rg -n '#122 catalog utility bridge|tailwindcss-local-bridge' apps/web/dist || true
rg -n 'file:vendor/tailwind|vendor/tailwindcss' apps/web/package.json pnpm-lock.yaml apps/web/vite.config.ts || true
test ! -e apps/web/vendor
# optional signal that preflight/utilities were emitted (exact rule text may vary by Tailwind v4 release):
rg -n 'box-sizing' apps/web/dist/assets/*.css || true
```

Expected:

- Built CSS reflects Tailwind-generated preflight rather than the handwritten bridge
- No bridge comment / bridge plugin name in `dist`
- No `file:vendor` / `vendor/tailwindcss` refs in package/lock/vite config
- `apps/web/vendor` absent

- [ ] **Step 3: Repo-wide leftover reference scan**

```bash
rg -n 'vendor/tailwindcss|file:vendor/tailwind' --glob '!docs/**' --glob '!.worktrees/**'
```

Expected: no matches outside historical docs/worktrees. If a non-doc reference remains, remove it.

---

### Task 4: Behavioral smoke (host) + Compose web build

**Files:** none (runtime verification). Rebuild host web preview if using alt-ports.

- [ ] **Step 1: Manual behavioral checklist (host preview or Compose web)**

With API + web reachable (Compose `:3000`/`:5173`, or host alt-ports `:3001`/`:5174`):

1. `/` — catalog layout intact under preflight
2. `/sales/:flashSaleId` — detail + purchase controls usable
3. `/purchases` — history page intact
4. Unknown route — NotFound heading + home link
5. Desktop width — CustomerNav section links visible without opening Menu
6. Narrow width — Menu toggles; links reachable
7. Identity strip — identify / change / save controls usable

If a regression appears: fix with utilities or narrowly scoped CSS. **Do not** disable preflight. **Do not** reintroduce the vendor bridge.

- [ ] **Step 2: Playwright smoke**

Host alt-ports example (adjust if Compose ports are the target):

```bash
PORT=3001 VITE_API_URL=http://127.0.0.1:3001 pnpm --filter web build
# start preview if needed: from apps/web → pnpm exec vite preview --host 127.0.0.1 --port 5174
E2E_API_HEALTH_URL=http://127.0.0.1:3001/health E2E_BASE_URL=http://127.0.0.1:5174 pnpm e2e:smoke
```

Expected: smoke project PASS (catalog → buy → My Purchases).

Note: prefer `pnpm exec vite preview --host … --port …` (no extra `--` before flags).

- [ ] **Step 3: Compose web build without vendor**

```bash
test ! -e apps/web/vendor
docker compose build web
```

Expected: build succeeds. Failure with `ENOENT` … `vendor/tailwindcss-vite` means `file:` deps or lockfile still point at the bridge — fix package.json/lockfile, do not add a vendor `COPY` workaround.

---

### Task 5: Final acceptance sweep

- [ ] **Step 1: Re-check success criteria**

- [ ] No `file:` Tailwind dependencies remain
- [ ] Official `tailwindcss` and `@tailwindcss/vite` installed; lockfile regenerated
- [ ] Vendor bridge files removed
- [ ] No code or configuration references `apps/web/vendor/tailwindcss*`
- [ ] Web builds using the official Tailwind Vite plugin; `@import "tailwindcss"` resolves
- [ ] Preflight enabled; styling fixes used utilities or narrowly scoped CSS only
- [ ] CustomerNav and customer pages have no unintended regressions
- [ ] Web test/typecheck/lint/build pass; e2e smoke pass; `docker compose build web` succeeds without vendor

- [ ] **Step 2: Stop — commit / PR only when explicitly requested**

Suggested commit grouping when asked (do not run until requested):

1. Spec + plan docs (if not already committed)
2. `chore(web): replace Tailwind vendor bridge with official v4 packages`
3. CSS/regression fixes (if intentionally split for review)

---

## Self-review (plan vs spec)

| Spec requirement                                        | Plan coverage                        |
| ------------------------------------------------------- | ------------------------------------ |
| Official v4 packages, current compatible release        | Task 1                               |
| Delete vendor; regenerate lockfile                      | Task 1                               |
| No vendor-specific Docker handling; `compose build web` | Task 4 Step 3                        |
| Preflight on; utilities or narrowly scoped CSS          | Task 2 + Task 4 Step 1               |
| NotFound / unused helpers                               | Task 2                               |
| Preserve CustomerNav + customer flows                   | Task 2 Step 6, Task 4                |
| No #128/#134 expansion                                  | File map / out of scope              |
| Web test/typecheck/lint/build                           | Task 3                               |
| E2e smoke                                               | Task 4 Step 2                        |
| Tailwind-generated production CSS                       | Task 3 Step 2                        |
| No `vendor/tailwindcss*` refs                           | Task 1 Step 3, Task 3 Step 3, Task 5 |
| Remove bridge references                                | Task 1, Task 3                       |
