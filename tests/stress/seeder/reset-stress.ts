import type { PrismaClient } from '@prisma/client';

import Redis from 'ioredis';

import type { StressScenario } from './types';

import { flashSaleCacheKey } from '../../../apps/api/src/redis/redis-keys';

/** Scenario-scoped only — never broad `stress-sale-*` / `stress-product-*`. */
export function stressSalePrefix(scenario: StressScenario): string {
  return `stress-sale-${scenario}-`;
}

export function stressProductPrefix(scenario: StressScenario): string {
  return `stress-product-${scenario}-`;
}

export async function resetStressOwned(
  prisma: PrismaClient,
  options: { scenario: StressScenario },
): Promise<void> {
  const salePrefix = stressSalePrefix(options.scenario);
  const productPrefix = stressProductPrefix(options.scenario);

  await prisma.purchase.deleteMany({
    where: { flashSaleId: { startsWith: salePrefix } },
  });
  await prisma.flashSale.deleteMany({
    where: { id: { startsWith: salePrefix } },
  });
  await prisma.product.deleteMany({
    where: { id: { startsWith: productPrefix } },
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
