# #78 Database Health Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register a PostgreSQL `DatabaseHealthCheck` on the `#77` `HEALTH_CHECKS` seam so `GET /health/ready` reports `checks.database` as `up`/`down` without changing liveness, routes, or the controller.

**Architecture:** Injectable `DatabaseHealthCheck` in `apps/api/src/health/` probes via global `PrismaService` (`SELECT 1`). `HealthModule` registers it with `{ provide: HEALTH_CHECKS, useExisting: DatabaseHealthCheck, multi: true }`. Failures bubble; `HealthService` remains the sole normalizer to `down`.

**Tech Stack:** NestJS 11, Prisma Client (`$queryRaw`), existing Jest unit tests under `apps/api`, Symbol multi-provider injection (`HEALTH_CHECKS`).

**Base:** `main` at `#77` merge tip (`bc9fdde` / PR `#167` or later).

**Commits:** Commit in logical groups per task using `<type>: <MESSAGE>`. Create a PR when implementation and verification are complete.

**Spec:** `docs/superpowers/specs/2026-08-01-issue-78-database-health-check-design.md`

**Issue AC:**

- [ ] Health includes PostgreSQL connectivity

**Task order:** Worktree → `DatabaseHealthCheck` TDD → `HealthModule` registration → freeze/DoD verification.

**Worktree:** Prefer isolated worktree via `using-git-worktrees` (e.g. `.worktrees/78-database-health-check` on `feat/78-database-health-check`) before editing. If worktree creation is blocked, work on a feature branch in place.

---

## File map

| File                                                                         | Responsibility                                     |
| ---------------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/api/src/health/database.health-check.ts`                               | **Create** — `DatabaseHealthCheck` (`HealthCheck`) |
| `apps/api/src/health/database.health-check.spec.ts`                          | **Create** — unit tests (name / up / reject)       |
| `apps/api/src/health/health.module.ts`                                       | Register check + `HEALTH_CHECKS` multi binding     |
| `apps/api/src/health/health-check.port.ts`                                   | Unchanged — existing `#77` port                    |
| `apps/api/src/health/health.tokens.ts`                                       | Unchanged — `HEALTH_CHECKS`                        |
| `apps/api/src/health/health.service.ts`                                      | Unchanged — aggregation / throw → `down`           |
| `apps/api/src/health/health.controller.ts`                                   | Unchanged — HTTP mapping only                      |
| `apps/api/src/prisma/prisma.module.ts`                                       | Unchanged — sole `PrismaService` provider          |
| `docs/superpowers/specs/2026-08-01-issue-78-database-health-check-design.md` | Approved design                                    |
| `docs/superpowers/plans/2026-08-01-issue-78-database-health-check.md`        | This plan                                          |

**Frozen:** `GET /health` response `{ "status": "ok" }`; controller/routes; CI/`wait-on`/Playwright/`E2E_API_HEALTH_URL` defaults; GraphQL surface; Redis probe (#79); Terminus; logging/metrics (#75/#76/#80); EPIC-07 stress contracts/results; `#134` CSS AC; second `PrismaService` in `HealthModule`.

---

### Task 1: Create worktree / branch

**Files:** none yet

- [ ] **Step 1: Ensure `main` includes `#77` tip**

```bash
cd /home/rex/Project/test/app
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git log -1 --oneline
```

Expected: `bc9fdde…` or later tip that includes `#77` / PR `#167`.

- [ ] **Step 2: Create isolated worktree**

```bash
cd /home/rex/Project/test/app
git check-ignore -q .worktrees || echo 'FAIL: .worktrees not ignored'
git worktree add .worktrees/78-database-health-check -b feat/78-database-health-check main
cd .worktrees/78-database-health-check
```

Expected: new worktree on `feat/78-database-health-check`. If sandbox/permission blocks worktree creation, create the branch in place instead and continue from repo root.

- [ ] **Step 3: Confirm clean baseline**

```bash
git status
test -f apps/api/src/health/health-check.port.ts \
  && test -f apps/api/src/health/health.tokens.ts \
  && test -f apps/api/src/health/health.service.ts \
  && test -f apps/api/src/prisma/prisma.service.ts
pnpm --filter api test -- --testPathPattern=health --passWithNoTests
```

Expected: clean worktree; `#77` health seam + `PrismaService` present; existing health unit tests pass.

- [ ] **Step 4: Commit** — none (branch/worktree creation only).

---

### Task 2: `DatabaseHealthCheck` TDD

**Files:**

- Create: `apps/api/src/health/database.health-check.spec.ts`
- Create: `apps/api/src/health/database.health-check.ts`

Implements existing `#77` port (`HealthCheck` / `HealthCheckResult`). Probe is trivial read-only `SELECT 1`. The probe intentionally verifies only database connectivity. It must not query application tables or validate schema/data. MUST NOT catch/wrap/log/normalize failures.

- [ ] **Step 1: Write the failing unit tests**

Create `apps/api/src/health/database.health-check.spec.ts`:

```typescript
import type { PrismaService } from '../prisma/prisma.service';

import { DatabaseHealthCheck } from './database.health-check';

describe('DatabaseHealthCheck', () => {
  it('exposes registry name database', () => {
    const prisma = { $queryRaw: jest.fn() } as unknown as PrismaService;
    const check = new DatabaseHealthCheck(prisma);
    expect(check.name).toBe('database');
  });

  it('returns up when the probe query resolves', async () => {
    const queryRaw = jest.fn().mockResolvedValue(undefined);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const check = new DatabaseHealthCheck(prisma);

    await expect(check.check()).resolves.toEqual({ status: 'up' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects when the probe query rejects (no local down mapping)', async () => {
    const queryRaw = jest.fn().mockRejectedValue(new Error('db unreachable'));
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const check = new DatabaseHealthCheck(prisma);

    await expect(check.check()).rejects.toThrow('db unreachable');
  });
});
```

Do **not** assert the exact `$queryRaw` return-shape or SQL template literal contents. Assert: queried once, success → `up`, failure → throw.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter api test -- --testPathPattern=database.health-check.spec
```

Expected: FAIL — `DatabaseHealthCheck` module not found / cannot resolve.

- [ ] **Step 3: Implement `DatabaseHealthCheck`**

Create `apps/api/src/health/database.health-check.ts`:

```typescript
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { HealthCheck, HealthCheckResult } from './health-check.port';

@Injectable()
export class DatabaseHealthCheck implements HealthCheck {
  readonly name = 'database';

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'up' };
  }
}
```

Notes:

- Do **not** add `try/catch` that returns `{ status: 'down' }`.
- Do **not** log failures here.
- Let ESLint be the source of truth for member/key ordering; adjust only if lint complains.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter api test -- --testPathPattern=database.health-check.spec
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/health/database.health-check.ts \
  apps/api/src/health/database.health-check.spec.ts
git commit -m "$(cat <<'EOF'
feat: add DatabaseHealthCheck SELECT 1 probe

EOF
)"
```

---

### Task 3: Register via `HEALTH_CHECKS` in `HealthModule`

**Files:**

- Modify: `apps/api/src/health/health.module.ts`

`HealthModule` relies on the existing global `PrismaService` from `PrismaModule`. Do **not** add `PrismaService` to this module’s `providers`. Do **not** edit `health.controller.ts`, `health.service.ts`, or routes.

- [ ] **Step 1: Wire providers**

Replace `apps/api/src/health/health.module.ts` with:

```typescript
import { Module } from '@nestjs/common';

import { DatabaseHealthCheck } from './database.health-check';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HEALTH_CHECKS } from './health.tokens';

@Module({
  controllers: [HealthController],
  providers: [
    DatabaseHealthCheck,
    HealthService,
    {
      multi: true,
      provide: HEALTH_CHECKS,
      useExisting: DatabaseHealthCheck,
    },
  ],
})
export class HealthModule {}
```

If ESLint requires a different key/member order inside the provider object or `providers` array, adjust only for lint — keep `multi: true`, `provide: HEALTH_CHECKS`, and `useExisting: DatabaseHealthCheck`.

- [ ] **Step 2: Confirm existing health + new unit tests still pass**

Run the existing health-related Jest suite (or equivalent repository test command), e.g.:

```bash
pnpm --filter api test -- --testPathPattern=health
```

Expected: PASS — includes prior `#77` service/controller tests plus `DatabaseHealthCheck` tests. No Nest wiring test required.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/health/health.module.ts
git commit -m "$(cat <<'EOF'
feat: register DatabaseHealthCheck on HEALTH_CHECKS

EOF
)"
```

---

### Task 4: Freeze / DoD verification

**Files:** none required (verification only)

- [ ] **Step 1: Lint + typecheck API package**

```bash
pnpm --filter api lint
pnpm --filter api typecheck
```

Expected: PASS with no new errors.

- [ ] **Step 2: Re-run health unit suite**

Run the existing health-related Jest suite (or equivalent repository test command), e.g.:

```bash
pnpm --filter api test -- --testPathPattern=health
```

Expected: PASS.

- [ ] **Step 3: Diff freeze checklist**

```bash
git diff main -- apps/api/src/health/health.controller.ts \
  apps/api/src/health/health.service.ts \
  apps/api/src/health/health-check.port.ts \
  apps/api/src/health/health.tokens.ts \
  apps/api/src/prisma/prisma.module.ts \
  apps/api/src/prisma/prisma.service.ts
test ! -f apps/api/src/health/health.routes.ts || git diff main -- apps/api/src/health/health.routes.ts
git diff main -- package.json apps/api/package.json pnpm-lock.yaml
```

Expected: empty diff (or no unintended edits) for controller/service/port/tokens/Prisma. No `health.routes.ts` changes if that file exists. No `package.json` / lockfile dependency changes (guards against accidental Terminus). Only intentional changes under `database.health-check.*` and `health.module.ts` (plus docs/spec/plan if included in the branch).

Confirm manually:

- No Terminus dependency added (`package.json` / lockfile unchanged for deps)
- No Redis health check
- No logging/metrics (#75/#76/#80) changes
- No EPIC-07 stress result invention
- No `#134` CSS AC work
- `DatabaseHealthCheck` does not catch/normalize to `down`

- [ ] **Step 4: Commit docs if they are part of the branch**

If the design/plan files are included in the feature branch:

```bash
git add docs/superpowers/specs/2026-08-01-issue-78-database-health-check-design.md \
  docs/superpowers/plans/2026-08-01-issue-78-database-health-check.md
git commit -m "$(cat <<'EOF'
docs: add #78 database health check design and plan

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement                                                                  | Task                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------ |
| `DatabaseHealthCheck` implements `HealthCheck`, `name: "database"`                | Task 2                                           |
| Success `{ status: 'up' }` via `SELECT 1`                                         | Task 2                                           |
| Failures bubble; no local catch/normalize/log                                     | Task 2                                           |
| Register from `HealthModule` with `HEALTH_CHECKS` + `multi: true` + `useExisting` | Task 3                                           |
| No second `PrismaService` provider                                                | Task 3 + Task 4 freeze                           |
| No controller/route/`GET /health` changes                                         | Task 3 + Task 4 freeze                           |
| Concurrent aggregation inherited from `#77` (no new sequencing)                   | No code change — `HealthService` unchanged       |
| Unit tests: name / up / reject                                                    | Task 2                                           |
| No Nest wiring / integration test required                                        | Explicitly omitted                               |
| No Terminus / Redis / logging / stress / `#134`                                   | Task 4 freeze                                    |
| Extensibility pattern for future probes                                           | Documented in spec Follow-on; `#79` out of slice |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-issue-78-database-health-check.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
)
