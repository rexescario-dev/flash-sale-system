# #77 Health Check Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing REST `/health` stub into frozen liveness plus `GET /health/ready` with an injectable `HEALTH_CHECKS` registry seam for #78/#79 — without implementing DB/Redis probes.

**Architecture:** Custom `HealthModule` (no Terminus). `HealthService` owns concurrent check aggregation and maps results to top-level `ok` / `error`. `HealthController` maps those to HTTP 200 / 503 only. Empty registry ⇒ ready after Nest bootstrap with `{ status: "ok", checks: {} }`.

**Tech Stack:** NestJS 11, existing Jest unit tests under `apps/api`, Symbol injection tokens (same pattern as `REDIS_CLIENT`).

**Base:** `main` at `#60` merge tip (`3532563` or later).

**Commits:** Commit in logical groups per task (or tight task clusters) using `<type>: <MESSAGE>`. Create a PR when implementation and verification are complete.

**Spec:** `docs/superpowers/specs/2026-08-01-issue-77-health-check-endpoint-design.md`

**Issue AC:**

- [ ] Health endpoint reports process liveness/readiness independently of GraphQL

**Task order:** Worktree → ports/token → service TDD (liveness + empty + aggregation + throw normalization) → controller TDD (200/503) → module wiring → thin docs → freeze/DoD verification.

**Worktree:** Prefer isolated worktree via `using-git-worktrees` (e.g. `.worktrees/77-health-check-endpoint` on `feat/77-health-check-endpoint`) before editing. If worktree creation is blocked, work on a feature branch in place.

---

## File map

| File                                                                         | Responsibility                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/api/src/health/health-check.port.ts`                                   | **Create** — `HealthCheckResult`, `HealthCheck` port |
| `apps/api/src/health/health.tokens.ts`                                       | **Create** — `HEALTH_CHECKS` Symbol token            |
| `apps/api/src/health/health.service.ts`                                      | Liveness + readiness aggregation                     |
| `apps/api/src/health/health.controller.ts`                                   | `GET /health`, `GET /health/ready` HTTP mapping      |
| `apps/api/src/health/health.module.ts`                                       | Wire controller/service; no Prisma/Redis             |
| `apps/api/src/health/health.service.spec.ts`                                 | Service unit tests                                   |
| `apps/api/src/health/health.controller.spec.ts`                              | **Create** — controller HTTP status/body tests       |
| `README.md`                                                                  | Thin mention of `/health/ready` under `## API`       |
| `docs/local-development.md`                                                  | Optional one-line readiness note beside API health   |
| `docs/superpowers/specs/2026-08-01-issue-77-health-check-endpoint-design.md` | Approved design                                      |
| `docs/superpowers/plans/2026-08-01-issue-77-health-check-endpoint.md`        | This plan                                            |

**Frozen:** `GET /health` response `{ "status": "ok" }`; CI/`wait-on`/Playwright/`E2E_API_HEALTH_URL` defaults; GraphQL surface; #78/#79 probe logic; Terminus; logging/metrics (#75/#76/#80); EPIC-07 stress contracts; `#134` CSS AC.

---

### Task 1: Create worktree / branch

**Files:** none yet

- [ ] **Step 1: Ensure `main` includes `#60` tip**

```bash
cd /home/rex/Project/test/app
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git log -1 --oneline
```

Expected: `3532563…` or later tip that includes `#60` / PR `#166`.

- [ ] **Step 2: Create isolated worktree**

```bash
cd /home/rex/Project/test/app
git check-ignore -q .worktrees || echo 'FAIL: .worktrees not ignored'
git worktree add .worktrees/77-health-check-endpoint -b feat/77-health-check-endpoint main
cd .worktrees/77-health-check-endpoint
```

Expected: new worktree on `feat/77-health-check-endpoint`. If sandbox/permission blocks worktree creation, create the branch in place instead and continue from repo root.

- [ ] **Step 3: Confirm clean baseline**

```bash
git status
test -f apps/api/src/health/health.controller.ts && test -f apps/api/src/health/health.service.ts
```

Expected: clean worktree; existing health stub present.

- [ ] **Step 4: Commit** — none (branch/worktree creation only).

---

### Task 2: Ports + `HEALTH_CHECKS` token

**Files:**

- Create: `apps/api/src/health/health-check.port.ts`
- Create: `apps/api/src/health/health.tokens.ts`

Ensure `health.tokens.ts` and `health-check.port.ts` are importable by future modules (`#78`/`#79`). No registry providers / `HealthCheck` implementations are registered in `#77`.

- [ ] **Step 1: Add port types**

Create `apps/api/src/health/health-check.port.ts`:

```typescript
export interface HealthCheckResult {
  status: string;
}

export interface HealthCheck {
  readonly name: string;
  check(): Promise<HealthCheckResult>;
}
```

- [ ] **Step 2: Add injection token**

Create `apps/api/src/health/health.tokens.ts`:

```typescript
export const HEALTH_CHECKS = Symbol('HEALTH_CHECKS');
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/health/health-check.port.ts apps/api/src/health/health.tokens.ts
git commit -m "$(cat <<'EOF'
feat: add health check port and HEALTH_CHECKS token

EOF
)"
```

---

### Task 3: HealthService — empty registry + liveness (TDD)

**Files:**

- Modify: `apps/api/src/health/health.service.ts`
- Modify: `apps/api/src/health/health.service.spec.ts`

- [ ] **Step 1: Write failing service tests for liveness + empty readiness**

Replace `apps/api/src/health/health.service.spec.ts` with:

```typescript
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns frozen liveness ok for REST', () => {
    const service = new HealthService();
    expect(service.getLiveness()).toEqual({ status: 'ok' });
  });

  it('returns ok readiness with empty checks when no checks registered', async () => {
    const service = new HealthService();
    await expect(service.getReadiness()).resolves.toEqual({
      checks: {},
      status: 'ok',
    });
  });

  it('returns ok readiness with empty checks when an empty array is injected', async () => {
    const service = new HealthService([]);
    await expect(service.getReadiness()).resolves.toEqual({
      checks: {},
      status: 'ok',
    });
  });
});
```

Constructor accepts an optional injected collection primarily to simplify unit testing (`new HealthService()` / `new HealthService([])` / `new HealthService([fakes])`). Production Nest DI uses `@Optional() @Inject(HEALTH_CHECKS)`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/rex/Project/test/app/.worktrees/77-health-check-endpoint
pnpm --filter api test -- src/health/health.service.spec.ts
```

Expected: FAIL — `getReadiness` missing and/or constructor signature mismatch.

- [ ] **Step 3: Implement minimal HealthService**

Replace `apps/api/src/health/health.service.ts` with:

```typescript
import { Inject, Injectable, Optional } from '@nestjs/common';

import type { HealthCheck } from './health-check.port';

import { HEALTH_CHECKS } from './health.tokens';

export type LivenessResponse = { status: 'ok' };
export type ReadinessResponse = {
  checks: Record<string, string>;
  status: 'error' | 'ok';
};

@Injectable()
export class HealthService {
  private readonly checks: HealthCheck[];

  constructor(
    @Optional()
    @Inject(HEALTH_CHECKS)
    checks?: HealthCheck[] | HealthCheck,
  ) {
    if (checks == null) {
      this.checks = [];
    } else {
      this.checks = Array.isArray(checks) ? checks : [checks];
    }
  }

  getLiveness(): LivenessResponse {
    return { status: 'ok' };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const settled = await Promise.all(
      this.checks.map(async (check) => {
        try {
          const result = await check.check();
          return { name: check.name, status: result.status };
        } catch {
          return { name: check.name, status: 'down' };
        }
      }),
    );

    const checks: Record<string, string> = {};
    for (const entry of settled) {
      checks[entry.name] = entry.status;
    }

    const status = settled.every((entry) => entry.status === 'up') ? 'ok' : 'error';
    return { checks, status };
  }
}
```

Notes:

- Each check is wrapped so every registered check contributes a result even if one throws.
- Empty registry ⇒ `every` on `[]` is `true` ⇒ `ok` + `checks: {}`.
- `@Optional()` + missing providers ⇒ `undefined` ⇒ treat as `[]`. Nest has no Angular-style `multi: true`; normalize a single injected instance (or an array) for unit tests and for #78's single `useExisting` registration. Multi-check aggregation is deferred to #79 design.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter api test -- src/health/health.service.spec.ts
```

Expected: PASS (all three tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/health/health.service.ts apps/api/src/health/health.service.spec.ts
git commit -m "$(cat <<'EOF'
feat: add readiness aggregation in HealthService

EOF
)"
```

---

### Task 4: HealthService — aggregation + throw normalization (TDD)

**Files:**

- Modify: `apps/api/src/health/health.service.spec.ts`
- Modify: `apps/api/src/health/health.service.ts` (only if tests reveal gaps)

- [ ] **Step 1: Append failing aggregation tests**

Add to `apps/api/src/health/health.service.spec.ts`:

```typescript
import type { HealthCheck } from './health-check.port';

function fakeCheck(name: string, impl: () => Promise<{ status: string }>): HealthCheck {
  return { name, check: impl };
}

describe('HealthService aggregation', () => {
  it('is ok when every registered check reports up', async () => {
    const service = new HealthService([
      fakeCheck('database', async () => ({ status: 'up' })),
      fakeCheck('redis', async () => ({ status: 'up' })),
    ]);

    await expect(service.getReadiness()).resolves.toEqual({
      checks: { database: 'up', redis: 'up' },
      status: 'ok',
    });
  });

  it('is error when one or more checks report a status other than up', async () => {
    const service = new HealthService([
      fakeCheck('database', async () => ({ status: 'up' })),
      fakeCheck('redis', async () => ({ status: 'down' })),
    ]);

    await expect(service.getReadiness()).resolves.toEqual({
      checks: { database: 'up', redis: 'down' },
      status: 'error',
    });
  });

  it('normalizes thrown checks to down and still aggregates siblings', async () => {
    const service = new HealthService([
      fakeCheck('database', async () => {
        throw new Error('boom');
      }),
      fakeCheck('redis', async () => ({ status: 'up' })),
    ]);

    await expect(service.getReadiness()).resolves.toEqual({
      checks: { database: 'down', redis: 'up' },
      status: 'error',
    });
  });

  it('normalizes rejected checks to down and still aggregates siblings', async () => {
    const service = new HealthService([
      fakeCheck('database', async () => Promise.reject(new Error('boom'))),
      fakeCheck('redis', async () => ({ status: 'up' })),
    ]);

    await expect(service.getReadiness()).resolves.toEqual({
      checks: { database: 'down', redis: 'up' },
      status: 'error',
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter api test -- src/health/health.service.spec.ts
```

Expected: PASS with Task 3 implementation. If any FAIL, adjust only the wrap/`catch` path in `getReadiness` — do not add Prisma/Redis.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/health/health.service.spec.ts apps/api/src/health/health.service.ts
git commit -m "$(cat <<'EOF'
test: cover health readiness aggregation and throw normalization

EOF
)"
```

---

### Task 5: HealthController — HTTP 200 / 503 (TDD)

**Files:**

- Create: `apps/api/src/health/health.controller.spec.ts`
- Modify: `apps/api/src/health/health.controller.ts`

- [ ] **Step 1: Write failing controller tests**

Create `apps/api/src/health/health.controller.spec.ts`:

```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

import { HealthController } from './health.controller';
import type { HealthService, ReadinessResponse } from './health.service';

describe('HealthController', () => {
  it('GET /health returns 200 body with frozen liveness', () => {
    const healthService = {
      getLiveness: () => ({ status: 'ok' as const }),
      getReadiness: jest.fn(),
    } satisfies Pick<HealthService, 'getLiveness' | 'getReadiness'>;

    const controller = new HealthController(healthService as HealthService);
    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns ok body when service reports ok', async () => {
    const body: ReadinessResponse = { checks: {}, status: 'ok' };
    const healthService = {
      getLiveness: jest.fn(),
      getReadiness: jest.fn().mockResolvedValue(body),
    } satisfies Pick<HealthService, 'getLiveness' | 'getReadiness'>;

    const controller = new HealthController(healthService as HealthService);
    await expect(controller.getReady()).resolves.toEqual(body);
  });

  it('GET /health/ready throws 503 with body when service reports error', async () => {
    const body: ReadinessResponse = {
      checks: { database: 'down' },
      status: 'error',
    };
    const healthService = {
      getLiveness: jest.fn(),
      getReadiness: jest.fn().mockResolvedValue(body),
    } satisfies Pick<HealthService, 'getLiveness' | 'getReadiness'>;

    const controller = new HealthController(healthService as HealthService);

    try {
      await controller.getReady();
      throw new Error('expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(httpError.getResponse()).toEqual(body);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter api test -- src/health/health.controller.spec.ts
```

Expected: FAIL — `getReady` missing.

- [ ] **Step 3: Implement controller**

Replace `apps/api/src/health/health.controller.ts` with:

```typescript
import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReady() {
    const body = await this.healthService.getReadiness();
    if (body.status !== 'ok') {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }
}
```

Controller treats any non-`ok` top-level status as not ready (503). Service owns status vocabulary.

- [ ] **Step 4: Run controller + service tests**

```bash
pnpm --filter api test -- src/health/health.controller.spec.ts src/health/health.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/health/health.controller.ts apps/api/src/health/health.controller.spec.ts
git commit -m "$(cat <<'EOF'
feat: expose GET /health/ready with 503 mapping

EOF
)"
```

---

### Task 6: Wire HealthModule (no Prisma/Redis)

**Files:**

- Modify: `apps/api/src/health/health.module.ts`

- [ ] **Step 1: Confirm module stays dependency-free**

`apps/api/src/health/health.module.ts` should remain:

```typescript
import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

Do not register any `HealthCheck` implementations in #77. `HealthService` `@Optional()` inject treats a missing `HEALTH_CHECKS` binding as an empty registry. Ensure `health.tokens.ts` and `health-check.port.ts` remain importable by future modules; do **not** add Prisma/Redis imports here.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter api typecheck
```

Expected: PASS.

- [ ] **Step 3: Lint health files**

```bash
pnpm --filter api lint
```

Expected: PASS (or only pre-existing unrelated warnings). Fix any new issues in `src/health/**`.

- [ ] **Step 4: Commit** — none if module unchanged; otherwise commit the module-only diff.

---

### Task 7: Thin documentation

**Files:**

- Modify: `README.md`
- Modify: `docs/local-development.md` (optional one-liner)

- [ ] **Step 1: Document `/health/ready` existence/purpose in README API section**

In `README.md` under `## API`, change the health bullets to:

```markdown
- GraphQL: [http://localhost:3000/graphql](http://localhost:3000/graphql)
- API liveness (REST): [http://localhost:3000/health](http://localhost:3000/health)
- API readiness (REST): [http://localhost:3000/health/ready](http://localhost:3000/health/ready)
```

Do **not** change `curl -sf http://localhost:3000/health` wait/verify commands elsewhere in README.

- [ ] **Step 2: Optional local-development note**

Beside the existing **API health** curl block in `docs/local-development.md`, add one short sentence after the curl example:

```markdown
Readiness (dependency checks land in later issues): `GET /health/ready` returns `{ "status": "ok", "checks": {} }` after Nest bootstrap when no checks are registered.
```

Do not rewrite operational/deployment docs. Do not change CI, Playwright, or `E2E_API_HEALTH_URL` defaults.

- [ ] **Step 3: Verify consumer freeze**

```bash
rg -n 'E2E_API_HEALTH_URL|/health' .github/workflows/ci.yml apps/e2e/readiness.ts scripts/verify-compose.sh
rg -n 'localhost:3000/health' README.md docs/local-development.md
```

Expected: existing consumers still point at `/health` (not `/health/ready`) for wait/verify; README API section mentions both.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/local-development.md
git commit -m "$(cat <<'EOF'
docs: document REST readiness endpoint

EOF
)"
```

---

### Task 8: Freeze / DoD verification

**Files:** none (verification only)

- [ ] **Step 1: Run full api unit tests + typecheck + lint**

```bash
pnpm --filter api test -- src/health
pnpm --filter api typecheck
pnpm --filter api lint
```

Expected: all PASS.

- [ ] **Step 2: Spec coverage checklist**

Confirm each locked requirement has a task:

| Spec requirement                                    | Task                       |
| --------------------------------------------------- | -------------------------- |
| Frozen `GET /health` `{ status: ok }`               | Tasks 3, 5                 |
| `GET /health/ready` `{ status, checks }`            | Tasks 3–5                  |
| Empty registry → 200 + `checks: {}`                 | Tasks 3, 5                 |
| `HEALTH_CHECKS` seam / port                         | Tasks 2–4, 6               |
| Concurrent wrap; throw → `down`; aggregate siblings | Task 4                     |
| Controller maps `error` → 503                       | Task 5                     |
| No Prisma/Redis in module                           | Task 6                     |
| Thin docs; no consumer URL changes                  | Task 7                     |
| REST-only; no Terminus; no logging/metrics          | Freeze (no tasks add them) |

- [ ] **Step 3: Diff freeze scan**

```bash
git diff --stat
git diff --name-only HEAD~5..HEAD 2>/dev/null || git diff --name-only
git diff --name-only | rg -n 'stress|e2e|graphql|prisma|redis|tailwind|ci\.yml|apps/api/src/graphql' && echo 'FAIL: unexpected paths' || echo 'OK: no unexpected frozen paths'
```

Expected: changes limited to `apps/api/src/health/**`, thin README / `docs/local-development.md`, and this plan/spec if included. No stress/e2e/CI/GraphQL/Prisma/Redis/CSS edits. Health remains REST-only (`apps/api/src/graphql` untouched).

- [ ] **Step 4: Commit design + plan if not already on the branch**

```bash
git add docs/superpowers/specs/2026-08-01-issue-77-health-check-endpoint-design.md \
  docs/superpowers/plans/2026-08-01-issue-77-health-check-endpoint.md
git status
# commit only if those files are staged/new on this branch
git commit -m "$(cat <<'EOF'
docs: add #77 health endpoint design and plan

EOF
)" || true
```

---

## Plan self-review

1. **Spec coverage:** Liveness freeze, readiness route/schema, registry seam, aggregation/`up` sentinel, throw→`down`, 200/503 mapping, thin docs, consumer freeze, #78/#79 deferral — all mapped to tasks.
2. **Placeholders:** None; concrete file paths, code, and commands included.
3. **Type consistency:** `HealthCheck` / `HealthCheckResult`, `HEALTH_CHECKS`, `ReadinessResponse.status: 'error' | 'ok'`, check map `Record<string, string>` used consistently across tasks.
