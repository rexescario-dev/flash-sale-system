import {
  type FlashSaleId,
  Purchase,
  type PurchaseId,
  type PurchaseRepository,
  type UserId,
} from '@flash-sale/domain';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnv } from '../config/env.validation';
import type { RedisClientPort } from '../redis/redis-client.port';

import { REDIS_CACHE_DEGRADED, REDIS_CACHE_INVALIDATION_FAILED } from '../redis/redis-events';
import { myPurchaseCacheKey } from '../redis/redis-keys';
import { MyPurchaseQueryCache } from './my-purchase-query.cache';

describe('MyPurchaseQueryCache', () => {
  const saleId = 'sale-1' as FlashSaleId;
  const userId = 'user-1' as UserId;
  const userB = 'user-2' as UserId;
  const cacheKey = myPurchaseCacheKey(saleId, userId);
  const positiveTtl = 5;
  const negativeTtl = 2;
  const purchasedAt = new Date('2026-07-28T11:00:00.000Z');

  const purchase = Purchase.create({
    flashSaleId: saleId,
    id: 'purchase-1' as PurchaseId,
    userId,
    purchasedAt,
  });

  const positiveEnvelope = {
    found: true as const,
    purchase: {
      purchaseId: 'purchase-1',
      purchasedAt: '2026-07-28T11:00:00.000Z',
    },
  };

  const negativeEnvelope = { found: false as const };

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function createCache(deps: {
    purchases?: Partial<PurchaseRepository>;
    redis?: Partial<RedisClientPort>;
  }) {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS') {
          return negativeTtl;
        }
        return positiveTtl;
      }),
    } as unknown as ConfigService<AppEnv, true>;
    const purchases = {
      findByFlashSaleAndUser: jest.fn().mockResolvedValue(purchase),
      ...deps.purchases,
    } as unknown as PurchaseRepository;
    const redis = {
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      incrWithExpiryOnFirst: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      ...deps.redis,
    } as unknown as RedisClientPort;

    return {
      cache: new MyPurchaseQueryCache(config, purchases, redis),
      purchases,
      redis,
    };
  }

  it('miss + Postgres null → purchased false and SET negative envelope with negative TTL', async () => {
    const { cache, purchases, redis } = createCache({
      purchases: { findByFlashSaleAndUser: jest.fn().mockResolvedValue(null) },
    });

    const result = await cache.get(saleId, userId);

    expect(result).toEqual({
      purchaseId: null,
      purchased: false,
      purchasedAt: null,
    });
    expect(purchases.findByFlashSaleAndUser).toHaveBeenCalledWith(saleId, userId);
    expect(redis.set).toHaveBeenCalledWith(cacheKey, JSON.stringify(negativeEnvelope), negativeTtl);
  });

  it('miss + Postgres hit → SET positive envelope with positive TTL and return purchased true', async () => {
    const { cache, purchases, redis } = createCache({});

    const result = await cache.get(saleId, userId);

    expect(result).toEqual({
      purchaseId: 'purchase-1',
      purchased: true,
      purchasedAt,
    });
    expect(purchases.findByFlashSaleAndUser).toHaveBeenCalledWith(saleId, userId);
    expect(redis.set).toHaveBeenCalledWith(cacheKey, JSON.stringify(positiveEnvelope), positiveTtl);
  });

  it('hit negative → repository not called', async () => {
    const { cache, purchases, redis } = createCache({
      redis: { get: jest.fn().mockResolvedValue(JSON.stringify(negativeEnvelope)) },
    });

    const result = await cache.get(saleId, userId);

    expect(result).toEqual({
      purchaseId: null,
      purchased: false,
      purchasedAt: null,
    });
    expect(purchases.findByFlashSaleAndUser).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('hit positive → repository not called', async () => {
    const { cache, purchases, redis } = createCache({
      redis: { get: jest.fn().mockResolvedValue(JSON.stringify(positiveEnvelope)) },
    });

    const result = await cache.get(saleId, userId);

    expect(result).toEqual({
      purchaseId: 'purchase-1',
      purchased: true,
      purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    });
    expect(purchases.findByFlashSaleAndUser).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('Redis get throws → redis_cache_degraded reason redis_error → Postgres', async () => {
    const { cache, purchases, redis } = createCache({
      redis: { get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) },
    });

    const result = await cache.get(saleId, userId);

    expect(result).toEqual({
      purchaseId: 'purchase-1',
      purchased: true,
      purchasedAt,
    });
    expect(purchases.findByFlashSaleAndUser).toHaveBeenCalledWith(saleId, userId);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REDIS_CACHE_DEGRADED,
        op: 'get',
        reason: 'redis_error',
      }),
    );
    expect(redis.set).toHaveBeenCalled();
  });

  it('malformed cached JSON → invalid_payload → Postgres', async () => {
    const { cache, purchases, redis } = createCache({
      redis: { get: jest.fn().mockResolvedValue('{not-json') },
    });

    const result = await cache.get(saleId, userId);

    expect(result).toEqual({
      purchaseId: 'purchase-1',
      purchased: true,
      purchasedAt,
    });
    expect(purchases.findByFlashSaleAndUser).toHaveBeenCalledWith(saleId, userId);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REDIS_CACHE_DEGRADED,
        op: 'get',
        reason: 'invalid_payload',
      }),
    );
    expect(redis.set).toHaveBeenCalledWith(cacheKey, JSON.stringify(positiveEnvelope), positiveTtl);
  });

  it('invalidate delete failure → redis_cache_invalidation_failed and never throws', async () => {
    const { cache, redis } = createCache({
      redis: { delete: jest.fn().mockRejectedValue(new Error('DEL_FAIL')) },
    });

    await expect(cache.invalidate(saleId, userId)).resolves.toBeUndefined();
    expect(redis.delete).toHaveBeenCalledWith(cacheKey);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REDIS_CACHE_INVALIDATION_FAILED,
        key: cacheKey,
      }),
    );
  });

  it('isolates cache keys by user: userA ≠ userB', () => {
    expect(myPurchaseCacheKey(saleId, userId)).not.toBe(myPurchaseCacheKey(saleId, userB));
  });
});
