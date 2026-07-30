import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { flashSaleCacheKey } from '../../../src/redis/redis-keys';
import { createFlashSale } from '../../factories';
import { E2E_PREFIX } from '../../fixtures/ids';
import { defaultSeedStatePath } from './paths';
import { getE2EScenarios } from './scenarios';

export type SeedState = {
  products: {
    activeStock10Name: string;
    activeStock1Name: string;
    endedName: string;
    soldOutName: string;
    upcomingName: string;
  };
  sales: {
    activeStock10Id: string;
    activeStock1Id: string;
    endedId: string;
    soldOutId: string;
    upcomingId: string;
  };
};

export async function resetE2EOwned(prisma: PrismaClient): Promise<void> {
  // Ownership is E2E-owned sales (and their purchases/products), not userId prefixes.
  await prisma.purchase.deleteMany({
    where: { flashSaleId: { startsWith: E2E_PREFIX.sale } },
  });
  await prisma.flashSale.deleteMany({
    where: { id: { startsWith: E2E_PREFIX.sale } },
  });
  await prisma.product.deleteMany({
    where: { id: { startsWith: E2E_PREFIX.product } },
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

async function clearE2ERedisKeys(redisUrl: string, saleIds: string[]): Promise<void> {
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    for (const saleId of saleIds) {
      await redis.del(flashSaleCacheKey(saleId));
      await scanDelete(redis, `my-purchase:v1:${saleId}:*`);
    }
  } finally {
    redis.disconnect();
  }
}

export async function seedE2E(options?: {
  databaseUrl?: string;
  redisUrl?: string;
  statePath?: string;
}): Promise<SeedState> {
  const databaseUrl =
    options?.databaseUrl ??
    process.env.DATABASE_URL ??
    'postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale';
  const redisUrl = options?.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
  const statePath = options?.statePath ?? defaultSeedStatePath();

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await resetE2EOwned(prisma);

    const scenarios = getE2EScenarios();
    const planted: string[] = [];
    for (const entry of Object.values(scenarios)) {
      await createFlashSale(prisma, {
        id: entry.saleId,
        productId: entry.productId,
        endsAt: entry.scenario.endsAt,
        productName: entry.productName,
        remainingStock: entry.scenario.remainingStock,
        startsAt: entry.scenario.startsAt,
        totalStock: entry.scenario.totalStock,
      });
      planted.push(entry.saleId);
    }

    await clearE2ERedisKeys(redisUrl, planted);

    const state: SeedState = {
      products: {
        activeStock10Name: scenarios.activeStock10.productName,
        activeStock1Name: scenarios.activeStock1.productName,
        endedName: scenarios.ended.productName,
        soldOutName: scenarios.soldOut.productName,
        upcomingName: scenarios.upcoming.productName,
      },
      sales: {
        activeStock10Id: scenarios.activeStock10.saleId,
        activeStock1Id: scenarios.activeStock1.saleId,
        endedId: scenarios.ended.saleId,
        soldOutId: scenarios.soldOut.saleId,
        upcomingId: scenarios.upcoming.saleId,
      },
    };

    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    return state;
  } finally {
    await prisma.$disconnect();
  }
}
