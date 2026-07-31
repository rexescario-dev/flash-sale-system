# #53 Configure k6 Stress Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the EPIC-07 stress harness under `tests/stress/` so k6 can target the GraphQL `purchaseItem` API with privileged Prisma seed/state handoff, a dual-oracle verifier stub, intensity/limiter config, and reproducible `pnpm stress:*` wrappers.

**Architecture:** Dual-oracle harness (Approach 1). Official k6 binary executes JS under `tests/stress/k6/`; Node/Prisma seeder and verifier live beside it; root pnpm scripts orchestrate seed → run → verify. `#53` ships foundation + a minimal harness-smoke scenario that proves GraphQL targeting; full `#54`–`#57` scenario logic comes in later issues. No `@flash-sale/stress` package; k6 not vendored.

**Tech Stack:** k6 (external binary), JavaScript k6 scripts, Node + `tsx` + Prisma (`@prisma/client` via `apps/api`), ioredis for scoped key cleanup, root `package.json` scripts.

**Base:** `main` @ `bb7831b` (or later `origin/main` if still fast-forwardable). Working tree must stay limited to #53 harness files plus this plan and the approved epic design spec.

**Commits:** Do **not** commit until the user explicitly asks. Leave changes for review.

**Spec:** `docs/superpowers/specs/2026-07-31-epic-07-performance-stress-testing-design.md`

**Issue AC:**

- [x] k6 project lives under `tests/stress`
- [ ] Scripts can target the GraphQL API

---

## File map

| File                                                                             | Responsibility                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `tests/stress/README.md`                                                         | Install k6 + how to run wrappers; point at epic design / future `#60` hub |
| `tests/stress/k6/helpers/graphql.js`                                             | POST GraphQL; preserve transport vs body                                  |
| `tests/stress/k6/helpers/classify.js`                                            | Map response → business / unexpected buckets                              |
| `tests/stress/k6/helpers/metrics.js`                                             | Counters + handleSummary metadata skeleton                                |
| `tests/stress/k6/helpers/state.js`                                               | Load state JSON from `STRESS_STATE_FILE`                                  |
| `tests/stress/k6/helpers/profiles.js`                                            | `smoke` / `standard` / `full` → attempts + default VUs                    |
| `tests/stress/k6/config/correctness.env.example`                                 | API limiter env for correctness runs                                      |
| `tests/stress/k6/config/performance.env.example`                                 | API limiter env for performance runs                                      |
| `tests/stress/k6/scenarios/harness-smoke.js`                                     | Minimal shared-iterations purchase script proving GraphQL targeting       |
| `tests/stress/seeder/types.ts`                                                   | `StressState` type matching canonical schema                              |
| `tests/stress/seeder/paths.ts`                                                   | State / results path helpers                                              |
| `tests/stress/seeder/reset-stress.ts`                                            | Idempotent namespace delete                                               |
| `tests/stress/seeder/seed-stress.ts`                                             | Plant sale + write state                                                  |
| `tests/stress/seeder/cli.ts`                                                     | `stress:seed` entry                                                       |
| `tests/stress/verifier/verify-stress.ts`                                         | Prisma invariants + exit codes                                            |
| `tests/stress/verifier/cli.ts`                                                   | `stress:verify` entry                                                     |
| `scripts/stress-run.sh`                                                          | Resolve scenario → `k6 run` + env + summary path                          |
| `package.json`                                                                   | Add `stress:seed` / `stress:run` / `stress:verify` / `stress:test`        |
| `.gitignore`                                                                     | Ignore `tests/stress/.state/` and `tests/stress/results/`                 |
| `docs/superpowers/specs/2026-07-31-epic-07-performance-stress-testing-design.md` | Already approved; touch only if implementation reveals inconsistency      |
| `docs/superpowers/plans/2026-07-31-issue-53-configure-k6-stress-testing.md`      | This plan                                                                 |

**Expected unchanged:** `README.md` (root thin README — no #71), `docs/testing-strategy.md` (leave planned wording until `#60`/`#71`), `apps/**` production code, `e2e/**`, CI workflows, Playwright, Jest concurrency suites.

**Scenario stubs for later issues:** Do **not** implement full `purchase-load.js` / `oversell.js` / `duplicate-race.js` / `high-volume.js` logic in #53. `#53` uses `harness-smoke.js` only. Later issues add scenario files (or rename/extend) per the epic design.

---

### Task 1: Layout, gitignore, limiter config examples, README

**Files:**

- Create: `tests/stress/README.md`
- Create: `tests/stress/k6/config/correctness.env.example`
- Create: `tests/stress/k6/config/performance.env.example`
- Create: `tests/stress/.state/.gitkeep` (optional — prefer gitignore only)
- Modify: `.gitignore`

- [x] **Step 1: Ignore runtime artifacts**

Append to `.gitignore`:

```gitignore
# Stress harness runtime (EPIC-07)
tests/stress/.state/
tests/stress/results/
```

- [x] **Step 2: Write limiter config examples**

Create `tests/stress/k6/config/correctness.env.example`:

```bash
# Apply to the API process (not k6 --env). Copy/merge into the environment
# used when starting the API for correctness scenarios (#54–#56, harness-smoke).
RATE_LIMIT_PURCHASE_ITEM_MAX=100000
RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS=60
```

Create `tests/stress/k6/config/performance.env.example`:

```bash
# Apply to the API process for #57 high-volume (production-like defaults).
RATE_LIMIT_PURCHASE_ITEM_MAX=30
RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS=60
```

- [x] **Step 3: Write thin README**

Create `tests/stress/README.md` with this content (outer fence uses four backticks in the plan source):

````markdown
# Stress testing harness (EPIC-07)

Privileged Prisma seed → k6 GraphQL `purchaseItem` → Prisma verify.

## Prerequisites

- Docker Compose stack (or equivalent) with API + PostgreSQL + Redis
- Official [k6](https://k6.io) binary on `PATH` (`k6 version`)
- API started with the intended limiter profile — see `k6/config/*.env.example`
  (k6 env vars do **not** change API rate limits)

## Commands (repo root)

```bash
pnpm stress:seed -- --scenario harness-smoke --profile smoke
pnpm stress:run -- --scenario harness-smoke --profile smoke
pnpm stress:verify -- --scenario harness-smoke --profile smoke
# or:
pnpm stress:test -- --scenario harness-smoke --profile smoke
```

`stress:test` exits non-zero if k6 fails or the verifier reports invariant violations.

## Design

See [EPIC-07 design spec](../../docs/superpowers/specs/2026-07-31-epic-07-performance-stress-testing-design.md).
Results narrative hub lands with #60.
````

- [x] **Step 4: Verify ignore + files exist**

```bash
test -f tests/stress/k6/config/correctness.env.example
test -f tests/stress/k6/config/performance.env.example
test -f tests/stress/README.md
rg -n "tests/stress/\.state" .gitignore
```

Expected: all succeed; gitignore contains the stress paths.

---

### Task 2: Stress state types, paths, reset, seeder, seed CLI

**Files:**

- Create: `tests/stress/seeder/types.ts`
- Create: `tests/stress/seeder/paths.ts`
- Create: `tests/stress/seeder/reset-stress.ts`
- Create: `tests/stress/seeder/seed-stress.ts`
- Create: `tests/stress/seeder/cli.ts`

- [x] **Step 1: Types + paths**

`tests/stress/seeder/types.ts`:

```typescript
export type StressScenario =
  'harness-smoke' | 'purchase-load' | 'oversell' | 'duplicate-race' | 'high-volume';

export type StressState = {
  scenario: StressScenario;
  runId: string;
  flashSaleId: string;
  productId: string;
  stock: number;
  userIdPrefix: string;
  fixedUserId: string | null;
};
```

`tests/stress/seeder/paths.ts`:

```typescript
import path from 'node:path';

export function stressRoot(): string {
  return path.resolve(__dirname, '..');
}

export function statePath(scenario: string): string {
  return path.join(stressRoot(), '.state', `${scenario}.json`);
}

export function resultsDir(scenario: string, profile: string): string {
  return path.join(stressRoot(), 'results', `${scenario}-${profile}`);
}
```

- [x] **Step 2: Idempotent reset (stress namespace only)**

`tests/stress/seeder/reset-stress.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import { flashSaleCacheKey } from '../../../apps/api/src/redis/redis-keys';

const STRESS_SALE_PREFIX = 'stress-sale-';
const STRESS_PRODUCT_PREFIX = 'stress-product-';

export async function resetStressOwned(
  prisma: PrismaClient,
  options?: { flashSaleId?: string },
): Promise<void> {
  const saleFilter = options?.flashSaleId
    ? { flashSaleId: options.flashSaleId }
    : { flashSaleId: { startsWith: STRESS_SALE_PREFIX } };

  await prisma.purchase.deleteMany({ where: saleFilter });
  await prisma.flashSale.deleteMany({
    where: options?.flashSaleId
      ? { id: options.flashSaleId }
      : { id: { startsWith: STRESS_SALE_PREFIX } },
  });
  await prisma.product.deleteMany({
    where: options?.flashSaleId
      ? { id: { startsWith: STRESS_PRODUCT_PREFIX } } // narrowed in seed after known productId
      : { id: { startsWith: STRESS_PRODUCT_PREFIX } },
  });
}

async function scanDelete(redis: Redis, match: string): Promise<void> {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
}

/** Scoped cleanup only — never FLUSHALL. */
export async function clearStressRedisKeys(redisUrl: string, flashSaleId: string): Promise<void> {
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    await redis.del(flashSaleCacheKey(flashSaleId));
    await scanDelete(redis, `my-purchase:v1:${flashSaleId}:*`);
  } finally {
    redis.disconnect();
  }
}
```

**Hard requirement — scenario-scoped cleanup only:**

Reset/delete must target **only**:

- `stress-sale-${scenario}-*`
- `stress-product-${scenario}-*`
- purchases for those flash-sale ids

Do **not** use broad `stress-sale-*` / `stress-product-*` deletes. Different scenarios (and future parallel runs) must not interfere with each other. When a prior state file exists for the scenario, deleting that exact `flashSaleId` / `productId` first is fine; any prefix wipe after that must still be scenario-scoped.

- [x] **Step 3: Seed function**

`tests/stress/seeder/seed-stress.ts` — behavior:

1. Parse `scenario` + optional `stock` (defaults: `harness-smoke` → stock `1000`; later scenarios override in their issues).
2. Build `runId` (`YYYYMMDD-HHmmss` UTC).
3. Reset scenario-scoped stress rows (idempotent).
4. Create product + ACTIVE flash sale (`startsAt` past, `endsAt` far future, `remainingStock = totalStock = stock`).
5. Clear scoped Redis keys for that `flashSaleId`.
6. Write `StressState` to `.state/<scenario>.json` (mkdir recursive).
7. Return state.

Ids:

```text
flashSaleId = stress-sale-{scenario}-{runId}
productId   = stress-product-{scenario}-{runId}
userIdPrefix = stress-user-{scenario}
fixedUserId = null  // harness-smoke / #54 / #55; #56 sets later
```

Use `PrismaClient` with `DATABASE_URL` (default same as api local). Prefer direct `prisma.product.create` / `prisma.flashSale.create` in the seeder (thin, no required import of api test factories) to avoid tsx path coupling — factories are optional if import resolution is clean via `pnpm --filter api exec`.

- [x] **Step 4: Seed CLI**

`tests/stress/seeder/cli.ts`:

- Args: `--scenario <name>` (default `harness-smoke`), `--stock <n>` optional.
- Call `seedStress`, print state path + JSON summary.
- `process.exitCode = 1` on failure.

- [ ] **Step 5: Manual seed check (stack up)**

With Compose + migrated DB:

```bash
pnpm --filter api exec tsx ../../tests/stress/seeder/cli.ts --scenario harness-smoke
cat tests/stress/.state/harness-smoke.json
```

Expected: JSON matches `StressState` schema; sale visible in DB with `stress-sale-harness-smoke-*`.

Re-run the same command: still a single sale for that scenario namespace (idempotent reset), new `runId` ok.

---

### Task 3: k6 helpers + harness-smoke scenario

**Files:**

- Create: `tests/stress/k6/helpers/graphql.js`
- Create: `tests/stress/k6/helpers/classify.js`
- Create: `tests/stress/k6/helpers/metrics.js`
- Create: `tests/stress/k6/helpers/state.js`
- Create: `tests/stress/k6/helpers/profiles.js`
- Create: `tests/stress/k6/scenarios/harness-smoke.js`

- [x] **Step 1: helpers**

`graphql.js` — `PURCHASE_ITEM` mutation string; `graphqlRequest(url, { query, variables })` using k6 `http.post` with `Content-Type: application/json`. On network throw / non-2xx / JSON parse failure, return `{ transportError: true, status, body }` shape — do not invent business statuses.

`classify.js` — given parsed GraphQL body (HTTP 2xx):

- `errors[0].extensions.code === 'RATE_LIMITED'` → `RATE_LIMITED`
- other errors → `UNEXPECTED_ERROR`
- `data.purchaseItem.status` → `SUCCESS` | `SOLD_OUT` | `ALREADY_PURCHASED` | else unexpected
- If caller marked transport error → `UNEXPECTED_ERROR`

`metrics.js` — k6 `Counter`s: `purchase_success`, `purchase_sold_out`, `purchase_duplicate`, `purchase_rate_limited`, `purchase_unexpected`. Export `recordBucket(bucket)` and a `buildHandleSummary({ scenario, profile, limiterProfile, environment })` that writes metadata + counters into the summary object for `#58`.

`state.js` — `loadState()` reads `STRESS_STATE_FILE` via k6 `open()`; throws if missing.

`profiles.js`:

```javascript
export const PROFILES = {
  smoke: { attempts: 100, vus: 10 },
  standard: { attempts: 1000, vus: 50 },
  full: { attempts: 10000, vus: 100 },
};

export function resolveProfile(name) {
  const key = name || 'smoke';
  const p = PROFILES[key];
  if (!p) throw new Error(`Unknown profile: ${key}`);
  return { name: key, ...p };
}
```

- [x] **Step 2: harness-smoke scenario**

`harness-smoke.js`:

- `options` from profile: `scenarios.default.executor = 'shared-iterations'`, `vus`, `iterations = attempts` (cap harness-smoke default attempts at profile, but for #53 local proof prefer `smoke`).
- `setup()` loads state; returns `{ flashSaleId, userIdPrefix, stock }`.
- Default function: unique `userId = `${userIdPrefix}-${__ITER}-${__VU}``; call `purchaseItem`; classify; record metrics; `check` that transport did not fail for the smoke path.
- Thresholds for harness-smoke (comfortable stock): `purchase_unexpected` rate == 0; `purchase_rate_limited` == 0 when API uses correctness limiter.
- `handleSummary` writes JSON to `STRESS_SUMMARY_PATH` if set (absolute path under `results/harness-smoke-<profile>/k6-summary.json`).

Keep thresholds modest for #53 — full oversell/duplicate assertions belong to #55/#56.

- [ ] **Step 3: Dry-run k6 help**

```bash
k6 version
k6 run --help | head
```

Expected: k6 installed. If missing, document in README and stop run steps until installed (do not vendor k6).

---

### Task 4: Verifier + verify CLI

**Files:**

- Create: `tests/stress/verifier/verify-stress.ts`
- Create: `tests/stress/verifier/cli.ts`

- [x] **Step 1: Implement verifier**

Inputs: `scenario`, `profile`, paths to state + optional k6 summary.

Checks:

1. Load state; load flash sale from Prisma by `flashSaleId`.
2. `purchase_count = await prisma.purchase.count({ where: { flashSaleId } })`.
3. `purchase_count <= state.stock`.
4. `sale.remainingStock === state.stock - purchase_count`.
5. Duplicate detection: group by `userId` (or raw query) — any `userId` with count > 1 fails.
6. If k6 summary present and exposes successful-purchase counter: assert `purchase_count` equals that counter.
7. Write `results/<scenario>-<profile>/verifier.json` including metadata + pass/fail details.

Exit: `process.exit(1)` on failure; `0` on pass.

- [x] **Step 2: CLI**

Args: `--scenario`, `--profile` (default `smoke`). Resolve state + summary paths via `paths.ts`.

---

### Task 5: Wrappers + root package scripts

**Files:**

- Create: `scripts/stress-run.sh`
- Create: `scripts/stress-test.sh` (optional; or inline in package.json)
- Modify: `package.json`

- [x] **Step 1: `scripts/stress-run.sh`**

Bash script that:

1. Parses `--scenario` (default `harness-smoke`) and `--profile` (default `smoke`).
2. Requires `k6` on PATH.
3. Sets `STRESS_STATE_FILE` to absolute `tests/stress/.state/<scenario>.json`.
4. Sets `GRAPHQL_URL` default `http://localhost:3000/graphql`.
5. Creates `tests/stress/results/<scenario>-<profile>/`.
6. Sets `STRESS_SUMMARY_PATH` to that dir’s `k6-summary.json`.
7. Maps scenario → script path (`harness-smoke` → `tests/stress/k6/scenarios/harness-smoke.js`).
8. Passes `PROFILE=<profile>` and runs `k6 run "$script"`.
9. Propagates k6 exit code.

- [x] **Step 2: Root scripts**

In root `package.json` `scripts`:

```json
"stress:seed": "pnpm --filter api exec tsx ../../tests/stress/seeder/cli.ts",
"stress:run": "bash scripts/stress-run.sh",
"stress:verify": "pnpm --filter api exec tsx ../../tests/stress/verifier/cli.ts",
"stress:test": "bash scripts/stress-test.sh"
```

`scripts/stress-test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
# forward args to each stage; exit non-zero if any stage fails
pnpm stress:seed -- "$@"
pnpm stress:run -- "$@"
pnpm stress:verify -- "$@"
```

Ensure CLIs accept the same `--scenario` / `--profile` flags after `--`.

- [ ] **Step 3: End-to-end harness smoke (manual)**

Prerequisites: stack up; API with correctness limiter env; k6 installed; `pnpm install`.

```bash
pnpm stress:test -- --scenario harness-smoke --profile smoke
```

Expected:

- Seed writes `.state/harness-smoke.json`
- k6 completes shared-iterations against GraphQL
- Verifier writes `results/harness-smoke-smoke/verifier.json` and exits 0
- `echo $?` → `0`

Failure injection (optional): stop API, run `stress:run` → non-zero.

---

### Task 6: Format / lint hygiene + AC checklist

**Files:** touched TS/MD/JSON only as above.

- [x] **Step 1: Format**

```bash
pnpm exec prettier --write "tests/stress/**/*.{ts,md,js}" "scripts/stress-*.sh" package.json
```

(Prettier may skip `.sh` — that is fine.)

- [x] **Step 2: Typecheck seeder/verifier path**

Seeder/verifier are executed via `tsx` under api context. If `tsc` does not include `tests/stress`, do not expand api `tsconfig` unless needed — prefer keeping stress TS as tsx-only for #53. If eslint root picks up new JS, ensure no new errors.

```bash
pnpm --filter api exec tsx ../../tests/stress/seeder/cli.ts --help || true
```

- [x] **Step 3: AC verification**

```bash
test -d tests/stress/k6
test -f tests/stress/k6/scenarios/harness-smoke.js
rg -n "stress:seed|stress:run|stress:verify|stress:test" package.json
# With stack + correctness limiter + k6:
pnpm stress:test -- --scenario harness-smoke --profile smoke
```

Map to issue AC:

| AC                              | Evidence                                                         |
| ------------------------------- | ---------------------------------------------------------------- |
| k6 project under `tests/stress` | `tests/stress/k6/**` present                                     |
| Scripts can target GraphQL API  | `harness-smoke.js` + successful `stress:test` against `/graphql` |

- [x] **Step 4: Do not commit**

Leave the working tree for user review. Commit only when explicitly asked. Suggested message when asked:

```text
test: add k6 stress harness under tests/stress (#53)
```

---

## Self-review (plan author)

1. **Spec coverage (#53 slice):** layout, GraphQL helpers, profiles, limiter env examples, seeder + state schema, verifier stub, wrappers, exit codes, artifact dirs, harness GraphQL proof — covered. Full #54–#60 scenarios deferred by design.
2. **Placeholders:** None intentional; scenario-scoped reset tightening called out as implementation note in Task 2.
3. **Out of scope preserved:** no CI gate, no README hub rewrite, no invented results docs, no Dockerized k6, no stress workspace package.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-31-issue-53-configure-k6-stress-testing.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration (`subagent-driven-development`).
2. **Inline Execution** — Execute tasks in this session with `executing-plans`, batch execution with checkpoints.

Which approach?
