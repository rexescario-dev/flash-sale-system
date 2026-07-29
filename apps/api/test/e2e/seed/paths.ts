import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve repo-root `e2e/seed-state.json` independent of `process.cwd()`.
 * This file lives at `apps/api/test/e2e/seed/paths.ts` → five levels up = repo root.
 * Prefer `E2E_SEED_STATE_PATH` in CI when the layout differs.
 */
export function defaultSeedStatePath(): string {
  if (process.env.E2E_SEED_STATE_PATH) {
    return path.resolve(process.env.E2E_SEED_STATE_PATH);
  }
  const here =
    typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..', '..', '..', '..');
  return path.join(repoRoot, 'e2e', 'seed-state.json');
}
