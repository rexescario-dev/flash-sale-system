import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { waitForStack } from './readiness';

/**
 * Canonical E2E seed entrypoint. Playwright must invoke the API seeder via CLI only —
 * never import Prisma or apps/api/test modules from this package.
 */
export default async function globalSetup(): Promise<void> {
  await waitForStack();

  const repoRoot = path.join(__dirname, '..');
  execFileSync('pnpm', ['--filter', 'api', 'e2e:seed'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      E2E_SEED_STATE_PATH: path.join(repoRoot, 'e2e', 'seed-state.json'),
    },
    stdio: 'inherit',
  });
}
