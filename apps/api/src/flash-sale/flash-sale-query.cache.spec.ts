import {
  FlashSale,
  type FlashSaleId,
  type FlashSaleRepository,
  type ProductId,
} from '@flash-sale/domain';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnv } from '../config/env.validation';
import type { Clock } from '../graphql/clock';
import type { RedisClientPort } from '../redis/redis-client.port';

import { REDIS_CACHE_DEGRADED, REDIS_CACHE_INVALIDATION_FAILED } from '../redis/redis-events';
import { flashSaleCacheKey } from '../redis/redis-keys';
import { FlashSaleQueryCache } from './flash-sale-query.cache';

describe('FlashSaleQueryCache', () => {
  const saleId = 'sale-1' as FlashSaleId;
  const cacheKey = flashSaleCacheKey(saleId);
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const ttlSeconds = 5;

  const flashSale = FlashSale.reconstitute({
    id: saleId,
    productId: 'product-1' as ProductId,
    endsAt: new Date('2026-07-28T14:00:00.000Z'),
    remainingStock: 3,
    startsAt: new Date('2026-07-28T10:00:00.000Z'),
    totalStock: 5,
  });

  const expectedSnapshot = {
    id: 'sale-1',
    endsAt: '2026-07-28T14:00:00.000Z',
    remainingStock: 3,
    startsAt: '2026-07-28T10:00:00.000Z',
    status: 'ACTIVE' as const,
    totalStock: 5,
  };

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function createCache(deps: {
    clock?: Clock;
    flashSales?: Partial<FlashSaleRepository>;
    redis?: Partial<RedisClientPort>;
  }) {
    const clock: Clock = deps.clock ?? { nowUtc: () => nowUtc };
    const config = {
      get: jest.fn().mockReturnValue(ttlSeconds),
    } as unknown as ConfigService<AppEnv, true>;
    const flashSales = {
      findById: jest.fn().mockResolvedValue(flashSale),
      ...deps.flashSales,
    } as unknown as FlashSaleRepository;
    const redis = {
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      incrWithExpiryOnFirst: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      ...deps.redis,
    } as unknown as RedisClientPort;

    return {
      cache: new FlashSaleQueryCache(clock, config, flashSales, redis),
      clock,
      flashSales,
      redis,
    };
  }

  it('miss → loads via repository, maps snapshot, set with TTL', async () => {
    const { cache, flashSales, redis } = createCache({});

    const result = await cache.getById(saleId);

    expect(result).toEqual(expectedSnapshot);
    expect(flashSales.findById).toHaveBeenCalledWith(saleId);
    expect(redis.set).toHaveBeenCalledWith(cacheKey, JSON.stringify(expectedSnapshot), ttlSeconds);
  });

  it('hit → returns snapshot as-is; repository, clock, and getStatus not called', async () => {
    const staleSnapshot = {
      id: 'sale-1',
      endsAt: '2026-07-28T14:00:00.000Z',
      remainingStock: 1,
      startsAt: '2026-07-28T10:00:00.000Z',
      status: 'SOLD_OUT' as const,
      totalStock: 5,
    };
    const nowUtcSpy = jest.fn(() => nowUtc);
    const getStatusSpy = jest.spyOn(FlashSale.prototype, 'getStatus');
    const { cache, flashSales, redis } = createCache({
      clock: { nowUtc: nowUtcSpy },
      redis: { get: jest.fn().mockResolvedValue(JSON.stringify(staleSnapshot)) },
    });

    const result = await cache.getById(saleId);

    expect(result).toEqual(staleSnapshot);
    expect(flashSales.findById).not.toHaveBeenCalled();
    expect(nowUtcSpy).not.toHaveBeenCalled();
    expect(getStatusSpy).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();

    getStatusSpy.mockRestore();
  });

  it('Redis get throws → redis_cache_degraded reason redis_error → Postgres', async () => {
    const { cache, flashSales, redis } = createCache({
      redis: { get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) },
    });

    const result = await cache.getById(saleId);

    expect(result).toEqual(expectedSnapshot);
    expect(flashSales.findById).toHaveBeenCalledWith(saleId);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REDIS_CACHE_DEGRADED,
        op: 'get',
        reason: 'redis_error',
      }),
    );
    expect(redis.set).toHaveBeenCalled();
  });

  it('malformed cached JSON → invalid_payload → Postgres and overwrite', async () => {
    const { cache, flashSales, redis } = createCache({
      redis: { get: jest.fn().mockResolvedValue('{not-json') },
    });

    const result = await cache.getById(saleId);

    expect(result).toEqual(expectedSnapshot);
    expect(flashSales.findById).toHaveBeenCalledWith(saleId);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REDIS_CACHE_DEGRADED,
        op: 'get',
        reason: 'invalid_payload',
      }),
    );
    expect(redis.set).toHaveBeenCalledWith(cacheKey, JSON.stringify(expectedSnapshot), ttlSeconds);
  });

  it('Redis set throws after miss → still return Postgres result + degraded', async () => {
    const { cache, flashSales } = createCache({
      redis: { set: jest.fn().mockRejectedValue(new Error('WRITE_FAIL')) },
    });

    const result = await cache.getById(saleId);

    expect(result).toEqual(expectedSnapshot);
    expect(flashSales.findById).toHaveBeenCalledWith(saleId);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REDIS_CACHE_DEGRADED,
        op: 'set',
        reason: 'redis_error',
      }),
    );
  });

  it('invalidate delete failure → redis_cache_invalidation_failed and never throws', async () => {
    const { cache, redis } = createCache({
      redis: { delete: jest.fn().mockRejectedValue(new Error('DEL_FAIL')) },
    });

    await expect(cache.invalidate(saleId)).resolves.toBeUndefined();
    expect(redis.delete).toHaveBeenCalledWith(cacheKey);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REDIS_CACHE_INVALIDATION_FAILED,
        key: cacheKey,
      }),
    );
  });
});
