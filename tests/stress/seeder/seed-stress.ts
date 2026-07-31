import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { statePath } from './paths';
import { clearStressRedisKeys, resetStressOwned } from './reset-stress';
import {
  isRunnableK6Scenario,
  RUNNABLE_K6_SCENARIOS,
  type StressScenario,
  type StressState,
} from './types';

export { isStressScenario } from './types';

const DEFAULT_STOCK = 1000;

export function buildRunId(now = new Date()): string {
  const iso = now.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}`;
}

export type SeedStressOptions = {
  databaseUrl?: string;
  redisUrl?: string;
  scenario?: StressScenario;
  stateFilePath?: string;
  stock?: number;
};

export async function seedStress(options: SeedStressOptions = {}): Promise<StressState> {
  const scenario = options.scenario ?? 'harness-smoke';
  const stock = options.stock ?? DEFAULT_STOCK;
  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error(`--stock must be a non-negative integer, got: ${String(options.stock)}`);
  }

  const databaseUrl =
    options.databaseUrl ??
    process.env.DATABASE_URL ??
    'postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale';
  const redisUrl = options.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
  const outPath = options.stateFilePath ?? statePath(scenario);

  const runId = buildRunId();
  const flashSaleId = `stress-sale-${scenario}-${runId}`;
  const productId = `stress-product-${scenario}-${runId}`;
  const userIdPrefix = `stress-user-${scenario}`;

  if (!isRunnableK6Scenario(scenario)) {
    process.stderr.write(
      `warning: scenario '${scenario}' can be seeded, but k6 run is not wired yet (runnable: ${RUNNABLE_K6_SCENARIOS.join(', ')}).\n`,
    );
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await resetStressOwned(prisma, { scenario });

    const now = new Date();
    const startsAt = new Date(now.getTime() - 60_000);
    const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.product.create({
        data: {
          id: productId,
          name: `Stress product ${scenario} ${runId}`,
        },
      }),
      prisma.flashSale.create({
        data: {
          id: flashSaleId,
          productId,
          endsAt,
          remainingStock: stock,
          startsAt,
          totalStock: stock,
        },
      }),
    ]);

    await clearStressRedisKeys(redisUrl, flashSaleId);

    const state: StressState = {
      fixedUserId: null,
      flashSaleId,
      productId,
      runId,
      scenario,
      stock,
      userIdPrefix,
    };

    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    return state;
  } finally {
    await prisma.$disconnect();
  }
}
