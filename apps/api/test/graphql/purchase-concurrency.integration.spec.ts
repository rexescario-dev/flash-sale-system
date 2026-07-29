import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

import type { AppEnv } from '../../src/config/env.validation';
import type { RedisClientPort } from '../../src/redis/redis-client.port';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { flashSaleCacheKey, myPurchaseCacheKey } from '../../src/redis/redis-keys';
import { REDIS_CLIENT } from '../../src/redis/redis.tokens';
import { createFlashSale } from '../factories';
import { concurrencyProductId, concurrencySaleId, concurrencyUserId } from '../fixtures/ids';
import { activeStock10 } from '../fixtures/scenarios';
import { classifyPurchaseResponse, tally } from './purchase-outcome-classify';

const PURCHASE_ITEM = `
  mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
    purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
      status
      purchaseId
      message
    }
  }
`;

const RATE_LIMIT_KEY_PATTERN = 'rate-limit:v1:purchaseItem:ip:*';

async function clearPurchaseItemRateLimitKeys(inspector: Redis): Promise<void> {
  const keys = await inspector.keys(RATE_LIMIT_KEY_PATTERN);
  if (keys.length > 0) {
    await inspector.del(...keys);
  }
}

describe('purchase concurrency (#47/#48)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisClientPort;
  let inspector: Redis;
  let configGetSpy: jest.SpyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    inspector = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6380', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await inspector.connect();
    await clearPurchaseItemRateLimitKeys(inspector);

    // ConfigModule.forRoot() runs at AppModule import time, so process.env overrides
    // cannot rewrite validated rate-limit defaults. Patch ConfigService.get() instead
    // (same pattern as purchase-rate-limit.integration.spec.ts).
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleRef.get(ConfigService<AppEnv, true>);
    const originalGet = config.get.bind(config);
    configGetSpy = jest.spyOn(config, 'get').mockImplementation(((
      propertyPath: keyof AppEnv | string,
      options?: Parameters<ConfigService<AppEnv, true>['get']>[1],
    ) => {
      if (propertyPath === 'RATE_LIMIT_PURCHASE_ITEM_MAX') {
        // Headroom for #47 (100) + #48 (100) and leftover keys from other suites.
        return 10_000;
      }
      return originalGet(propertyPath as never, options as never);
    }) as ConfigService<AppEnv, true>['get']);

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    prisma = app.get(PrismaService);
    redis = app.get(REDIS_CLIENT);
    expect(config.get('RATE_LIMIT_PURCHASE_ITEM_MAX', { infer: true })).toBeGreaterThanOrEqual(100);
  });

  afterAll(async () => {
    await clearPurchaseItemRateLimitKeys(inspector);
    await inspector.quit();
    configGetSpy.mockRestore();
    await app.close();
  });

  async function postPurchase(flashSaleId: string, userId: string) {
    const baseUrl = await app.getUrl();
    const res = await fetch(`${baseUrl}/graphql`, {
      body: JSON.stringify({
        query: PURCHASE_ITEM,
        variables: { flashSaleId, userId },
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    return res.json();
  }

  async function clearScopedRedis(flashSaleId: string, userIds: string[]): Promise<void> {
    await redis.delete(flashSaleCacheKey(flashSaleId));
    for (const userId of userIds) {
      await redis.delete(myPurchaseCacheKey(flashSaleId, userId));
    }
  }

  async function cleanupSale(saleId: string, productId: string): Promise<void> {
    await prisma.purchase.deleteMany({ where: { flashSaleId: saleId } });
    await prisma.flashSale.deleteMany({ where: { id: saleId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }

  it('#47 stock=10 with 100 distinct users → 10 SUCCESS, 0 remaining', async () => {
    const suffix = randomUUID();
    const saleId = concurrencySaleId(`47-${suffix}`);
    const productId = concurrencyProductId(`47-${suffix}`);
    const userIds = Array.from({ length: 100 }, (_, i) => concurrencyUserId(`47-${suffix}-${i}`));

    try {
      await clearPurchaseItemRateLimitKeys(inspector);
      const { endsAt, remainingStock, startsAt, totalStock } = activeStock10();
      await createFlashSale(prisma, {
        id: saleId,
        productId,
        endsAt,
        remainingStock,
        startsAt,
        totalStock,
      });
      await clearScopedRedis(saleId, userIds);

      // Dispatch all requests before awaiting any response — do not serialize.
      const bodies = await Promise.all(userIds.map((userId) => postPurchase(saleId, userId)));
      const counts = tally(bodies.map(classifyPurchaseResponse));

      expect(counts.RATE_LIMITED).toBe(0);
      expect(counts.UNEXPECTED_ERROR).toBe(0);
      expect(counts.DUPLICATE).toBe(0);
      expect(counts.SUCCESS).toBe(10);
      expect(counts.SOLD_OUT).toBe(90);

      const sale = await prisma.flashSale.findUniqueOrThrow({ where: { id: saleId } });
      expect(sale.remainingStock).toBe(0);
      const purchases = await prisma.purchase.findMany({ where: { flashSaleId: saleId } });
      expect(purchases).toHaveLength(10);
      expect(new Set(purchases.map((p) => p.userId)).size).toBe(10);
    } finally {
      await cleanupSale(saleId, productId);
      await clearPurchaseItemRateLimitKeys(inspector);
    }
  }, 120_000);

  it('#48 N=100 same user → 1 SUCCESS, 99 DUPLICATE, one row', async () => {
    const N = 100;
    const suffix = randomUUID();
    const saleId = concurrencySaleId(`48-${suffix}`);
    const productId = concurrencyProductId(`48-${suffix}`);
    const userId = concurrencyUserId(`48-${suffix}`);

    try {
      await clearPurchaseItemRateLimitKeys(inspector);
      const { endsAt, startsAt } = activeStock10();
      await createFlashSale(prisma, {
        id: saleId,
        productId,
        endsAt,
        remainingStock: 10,
        startsAt,
        totalStock: 10,
      });
      await clearScopedRedis(saleId, [userId]);

      const before = await prisma.flashSale.findUniqueOrThrow({ where: { id: saleId } });
      // All N started concurrently — no per-request await until Promise.all settles.
      const bodies = await Promise.all(
        Array.from({ length: N }, () => postPurchase(saleId, userId)),
      );
      const counts = tally(bodies.map(classifyPurchaseResponse));

      expect(counts.SUCCESS).toBe(1);
      expect(counts.DUPLICATE).toBe(N - 1);
      expect(counts.RATE_LIMITED).toBe(0);
      expect(counts.UNEXPECTED_ERROR).toBe(0);

      const rowCount = await prisma.purchase.count({
        where: { flashSaleId: saleId, userId },
      });
      expect(rowCount).toBe(1);

      const after = await prisma.flashSale.findUniqueOrThrow({ where: { id: saleId } });
      expect(after.remainingStock).toBe(before.remainingStock - 1);
    } finally {
      await cleanupSale(saleId, productId);
      await clearPurchaseItemRateLimitKeys(inspector);
    }
  }, 120_000);
});
