# #72 Project Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four representative customer-UI screenshots under `docs/images/` and embed them in `README.md` inside `## Try the app` (catalog hero + stacked supporting gallery).

**Architecture:** Docs-only README-thin embed (Approach 1). Commit PNG release artifacts only; capture via manual browser or a temporary local helper that is deleted before finish — never checked in. No screenshot hub, generator, CI job, or Playwright fixture ownership. Do not restructure README IA beyond the reserved Try-the-app slot. Do not duplicate Playwright E2E, smoke, testing-strategy, Redis, concurrency, purchase sequence, scalability, fault tolerance, or technology trade-offs bodies.

**Tech Stack:** Markdown (`README.md`), PNG assets under `docs/images/`, existing Compose + seed workflow for capture.

**Base:** `main` @ `66178e1` (#73 via PR #157). Implementation working tree should stay limited to `README.md`, `docs/images/*.png`, plus this plan/spec under `docs/superpowers/`.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review.

**Spec:** `docs/superpowers/specs/2026-07-31-issue-72-project-screenshots-design.md`

---

## File map

| File                                                                       | Responsibility                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `docs/images/flash-sale-catalog.png`                                       | **Create** — catalog (`/`) hero                                           |
| `docs/images/flash-sale-detail.png`                                        | **Create** — ACTIVE sale detail                                           |
| `docs/images/flash-sale-success.png`                                       | **Create** — purchase success on sale detail                              |
| `docs/images/flash-sale-purchases.png`                                     | **Create** — My purchases                                                 |
| `README.md`                                                                | **Modify** — insert hero + `### Screenshots` inside `## Try the app` only |
| `docs/superpowers/specs/2026-07-31-issue-72-project-screenshots-design.md` | Already written; update only if implementation reveals an inconsistency   |
| `docs/superpowers/plans/2026-07-31-issue-72-project-screenshots.md`        | This plan                                                                 |

**Expected unchanged:** all `docs/*.md` hubs, `apps/**`, `packages/**`, `e2e/**`, Compose, CI workflows, package scripts. No temporary capture helpers remain in the tree.

---

### Task 1: Create `docs/images/` and capture four PNGs

**Files:**

- Create: `docs/images/flash-sale-catalog.png`
- Create: `docs/images/flash-sale-detail.png`
- Create: `docs/images/flash-sale-success.png`
- Create: `docs/images/flash-sale-purchases.png`

- [x] **Step 1: Ensure image directory exists**

From repository root (`/home/rex/Project/test/app`):

```bash
mkdir -p docs/images
test -d docs/images
```

Expected: directory exists (create if missing).

- [x] **Step 2: Bring up seeded local stack**

Follow README Try the app (do not invent a parallel workflow):

```bash
cp -n .env.example .env
docker compose up --build -d
curl -sf http://localhost:3000/health
pnpm install
pnpm --filter api e2e:seed
curl -sf -o /dev/null -w "%{http_code}\n" http://localhost:5173
```

Expected: health returns JSON with ok status; web returns `200`. If ports collide, resolve via [Local development — Troubleshooting](../local-development.md#troubleshooting) — do not change Compose defaults for this issue.

- [x] **Step 3: Capture screenshots (temporary helper OK; must not remain)**

Preferred capture path for agents: a **temporary** Playwright script under `/tmp` (or another path outside the repo), using the workspace’s Playwright package. Do **not** add files under `e2e/`, `apps/`, or `docs/` for capture. Delete the helper when done.

Use a stable desktop viewport (e.g. `1280x720`). Deterministic seeded data only — prefer seeded sale names such as **E2E Active Ten-Pack**. Avoid capturing timestamps, random IDs, machine usernames, or transient error toasts.

Example temporary capture script (write to `/tmp/capture-72-screenshots.mjs`, then run; adjust selectors if UI differs slightly — prefer `getByRole` / visible text / existing `data-testid` values):

```js
// /tmp/capture-72-screenshots.mjs — DO NOT commit; delete after use
import { chromium } from 'playwright';
import path from 'node:path';

const root = process.env.APP_ROOT || process.cwd();
const out = path.join(root, 'docs/images');
const base = 'http://localhost:5173';
const userId = 'reviewer-demo'; // stable, non-personal

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(base + '/');
await page.getByText('E2E Active Ten-Pack').first().waitFor({ timeout: 30000 });
await page.screenshot({ path: path.join(out, 'flash-sale-catalog.png'), fullPage: true });

// Set local identity if the strip requires it (adjust label/placeholder to match UI)
const identity = page.getByLabel(/user/i).or(page.getByPlaceholder(/user/i)).first();
if (await identity.count()) {
  await identity.fill(userId);
  const save = page.getByRole('button', { name: /save/i });
  if (await save.count()) await save.click();
}

await page.getByText('E2E Active Ten-Pack').first().click();
await page.waitForURL(/\/sales\//);
await page.getByRole('button', { name: /buy/i }).first().waitFor({ timeout: 30000 });
await page.screenshot({ path: path.join(out, 'flash-sale-detail.png'), fullPage: true });

await page.getByRole('button', { name: /buy/i }).first().click();
await page
  .getByText(/purchase successful/i)
  .first()
  .waitFor({ timeout: 30000 });
await page.screenshot({ path: path.join(out, 'flash-sale-success.png'), fullPage: true });

await page.goto(base + '/purchases');
await page
  .getByText(/E2E Active Ten-Pack|purchase/i)
  .first()
  .waitFor({ timeout: 30000 });
await page.screenshot({ path: path.join(out, 'flash-sale-purchases.png'), fullPage: true });

await browser.close();
console.log('Wrote four PNGs to', out);
```

Run from repo root (use the workspace Playwright install):

```bash
APP_ROOT="$PWD" node /tmp/capture-72-screenshots.mjs
# or, if imports need the package resolution:
# pnpm exec node /tmp/capture-72-screenshots.mjs
rm -f /tmp/capture-72-screenshots.mjs
```

Manual headed browser capture is equally acceptable if the temporary script fails — same four filenames and quality bar.

Success UI cue: sale detail shows **Purchase successful** (`PurchaseOutcomeBanner` / status text). Detail shot must be an **ACTIVE** seeded sale before purchase.

- [x] **Step 4: Quality gate the PNGs**

```bash
ls -la docs/images/flash-sale-*.png
file docs/images/flash-sale-*.png
python3 - <<'PY'
from pathlib import Path
limit = 1_500_000  # ~1.5 MiB sanity ceiling per file
for p in sorted(Path('docs/images').glob('flash-sale-*.png')):
    size = p.stat().st_size
    print(f'{p.name}: {size} bytes')
    assert size > 10_000, f'{p} too small'
    assert size < limit, f'{p} too large ({size}); re-capture with reasonable PNG size'
assert {p.name for p in Path('docs/images').glob('flash-sale-*.png')} == {
    'flash-sale-catalog.png',
    'flash-sale-detail.png',
    'flash-sale-success.png',
    'flash-sale-purchases.png',
}
print('PNG quality gate OK')
PY
# Ensure no capture helper leaked into the repo
test ! -e scripts/capture-screenshots.*
rg -n "capture-72|flash-sale-catalog" e2e apps scripts 2>/dev/null | head || true
find . -maxdepth 3 -name '*capture*72*' -o -name 'capture-screenshots*' 2>/dev/null | head
```

Expected: four valid PNGs; each between ~10 KiB and ~1.5 MiB; no capture helper files in the repository.

- [x] **Step 5: Do not commit yet**

Leave PNGs unstaged/uncommitted until the user explicitly asks to commit.

---

### Task 2: Embed hero + stacked gallery in `## Try the app`

**Files:**

- Modify: `README.md` (only inside `## Try the app`)

- [x] **Step 1: Insert images after onboarding content, before Quick Start separator**

In `README.md`, locate the end of `## Try the app` — after the local-development link and **before** the `---` that precedes `## Quick Start`.

Insert exactly this block (do not rewrite prerequisites, commands, What to try, endpoints, or the local-dev link):

```md
![Flash sale catalog](docs/images/flash-sale-catalog.png)

_Catalog — browse available flash sales._

### Screenshots

**Sale detail — choose an active sale**

![Sale detail](docs/images/flash-sale-detail.png)

**Purchase success — completed purchase**

![Purchase success](docs/images/flash-sale-success.png)

**My purchases — review purchase history**

![My purchases](docs/images/flash-sale-purchases.png)
```

Resulting local structure around the insert:

```md
Full local workflows, env details, and troubleshooting: [Local development](docs/local-development.md).

![Flash sale catalog](docs/images/flash-sale-catalog.png)

_Catalog — browse available flash sales._

### Screenshots

**Sale detail — choose an active sale**

![Sale detail](docs/images/flash-sale-detail.png)

**Purchase success — completed purchase**

![Purchase success](docs/images/flash-sale-success.png)

**My purchases — review purchase history**

![My purchases](docs/images/flash-sale-purchases.png)

---

## Quick Start
```

Constraints:

- No top-level `## Screenshots`
- No Documentation index row
- No HTML width attributes
- No edits to Overview / Features / Quick Start / Scripts / Workspace / E2E / API / Documentation

- [x] **Step 2: Format README**

```bash
pnpm exec prettier --write README.md
pnpm exec prettier --check README.md docs/superpowers/specs/2026-07-31-issue-72-project-screenshots-design.md docs/superpowers/plans/2026-07-31-issue-72-project-screenshots.md
```

Expected: Prettier clean on touched markdown.

- [x] **Step 3: Do not commit yet**

Leave README changes for review until the user explicitly asks to commit.

---

### Task 3: Spec verification checklist

**Files:**

- Verify only (no further product changes expected)

- [x] **Step 1: Run the docs verification checklist**

From repository root:

```bash
# 1–2 assets + relative paths
test -f docs/images/flash-sale-catalog.png
test -f docs/images/flash-sale-detail.png
test -f docs/images/flash-sale-success.png
test -f docs/images/flash-sale-purchases.png
rg -n 'docs/images/flash-sale-(catalog|detail|success|purchases)\.png' README.md

# 3 placement / no top-level Screenshots section
python3 - <<'PY'
from pathlib import Path
text = Path('README.md').read_text()
assert '## Try the app' in text
assert '### Screenshots' in text
assert '\n## Screenshots' not in text and not text.startswith('## Screenshots')
# hero + gallery sit before Quick Start
i_try = text.index('## Try the app')
i_shots = text.index('### Screenshots')
i_qs = text.index('## Quick Start')
assert i_try < i_shots < i_qs
print('placement OK')
PY

# 4 Documentation index unchanged (no screenshot row)
python3 - <<'PY'
from pathlib import Path
text = Path('README.md').read_text()
doc = text.split('## Documentation', 1)[1]
assert 'screenshot' not in doc.lower()
assert 'docs/images' not in doc
print('documentation index OK')
PY

# 5 onboarding substance still present
rg -n "pnpm --filter api e2e:seed|What to try|Local development" README.md

# 8–9 no helper leakage; diff scope
git status -sb
git status --porcelain | rg -v '^( |\?\?|M|A).*(README\.md|docs/images/|docs/superpowers/(specs|plans)/2026-07-31-issue-72)' || true
test ! -e /tmp/capture-72-screenshots.mjs

# 11 format
pnpm exec prettier --check README.md docs/superpowers/specs/2026-07-31-issue-72-project-screenshots-design.md docs/superpowers/plans/2026-07-31-issue-72-project-screenshots.md
```

Expected: all checks pass; dirty files limited to README, `docs/images/*.png`, and #72 plan/spec under `docs/superpowers/`.

- [x] **Step 2: Visual sanity (human or agent image read)**

Open or inspect the four PNGs and confirm:

1. Catalog shows seeded sales (e.g. E2E Active Ten-Pack).
2. Detail is an ACTIVE sale (not sold-out/upcoming narrative).
3. Success shows purchase-success messaging (e.g. “Purchase successful”).
4. Purchases shows at least one history row for the demo user.
5. No obvious personal/machine-specific chrome.

- [x] **Step 3: Stop — await explicit commit request**

Do **not** create a git commit, branch push, or PR until the user asks.

---

## Self-review (plan vs spec)

| Spec requirement                         | Plan task                         |
| ---------------------------------------- | --------------------------------- |
| Four PNGs under `docs/images/`           | Task 1                            |
| Create directory if missing              | Task 1 Step 1                     |
| Catalog → detail → success → purchases   | Task 1 Steps 3–4                  |
| Capture helper not checked in            | Task 1 Steps 3–4, Task 3 Step 1   |
| README edits only in Try the app         | Task 2                            |
| Hero + `### Screenshots` stacked figures | Task 2 Step 1                     |
| No top-level Screenshots / no doc row    | Task 2 constraints, Task 3 Step 1 |
| Relative `docs/images/` paths            | Task 2 Step 1, Task 3 Step 1      |
| No onboarding rewrite                    | Task 2 Step 1                     |
| Verification + format                    | Task 3                            |
| No commit until requested                | Header + Task 1/2/3 final steps   |

No TBD/TODO placeholders. Commit steps intentionally deferred per user rule.
