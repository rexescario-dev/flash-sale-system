import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnv } from '../config/env.validation';
import type { RedisClientPort } from '../redis/redis-client.port';

import { REDIS_RATE_LIMIT_DEGRADED } from '../redis/redis-events';
import { purchaseItemRateLimitKey } from '../redis/redis-keys';
import { PurchaseItemRateLimiter } from './purchase-item.rate-limiter';

describe('PurchaseItemRateLimiter', () => {
  const max = 30;
  const windowSeconds = 60;

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function createLimiter(redisPartial: Partial<RedisClientPort> = {}) {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'RATE_LIMIT_PURCHASE_ITEM_MAX') return max;
        if (key === 'RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS') return windowSeconds;
        return undefined;
      }),
    } as unknown as ConfigService<AppEnv, true>;

    const redis = {
      delete: jest.fn(),
      get: jest.fn(),
      incrWithExpiryOnFirst: jest.fn().mockResolvedValue(1),
      set: jest.fn(),
      ...redisPartial,
    } as unknown as RedisClientPort;

    return {
      limiter: new PurchaseItemRateLimiter(config, redis),
      redis,
    };
  }

  it('under max → allow via incrWithExpiryOnFirst', async () => {
    const incrWithExpiryOnFirst = jest.fn().mockResolvedValue(max);
    const { limiter, redis } = createLimiter({ incrWithExpiryOnFirst });

    await expect(limiter.consume('203.0.113.10')).resolves.toBe('allow');
    expect(incrWithExpiryOnFirst).toHaveBeenCalledWith(
      purchaseItemRateLimitKey('203.0.113.10'),
      windowSeconds,
    );
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('at max+1 → limit', async () => {
    const { limiter } = createLimiter({
      incrWithExpiryOnFirst: jest.fn().mockResolvedValue(max + 1),
    });

    await expect(limiter.consume('203.0.113.10')).resolves.toBe('limit');
  });

  it('Redis throw → redis_rate_limit_degraded → allow', async () => {
    const { limiter } = createLimiter({
      incrWithExpiryOnFirst: jest.fn().mockRejectedValue(new Error('redis down')),
    });

    await expect(limiter.consume('203.0.113.10')).resolves.toBe('allow');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REDIS_RATE_LIMIT_DEGRADED,
        key: purchaseItemRateLimitKey('203.0.113.10'),
      }),
    );
  });

  it.each([
    ['203.0.113.10', purchaseItemRateLimitKey('203.0.113.10')],
    ['2001:db8::1', purchaseItemRateLimitKey('2001:db8::1')],
  ])('keys IP %s via purchaseItemRateLimitKey', async (ip, expectedKey) => {
    const incrWithExpiryOnFirst = jest.fn().mockResolvedValue(1);
    const { limiter } = createLimiter({ incrWithExpiryOnFirst });

    await limiter.consume(ip);

    expect(incrWithExpiryOnFirst).toHaveBeenCalledWith(expectedKey, windowSeconds);
    expect(expectedKey).toBe(`rate-limit:v1:purchaseItem:ip:${ip}`);
  });

  it('does not use get/set counting path', async () => {
    const { limiter, redis } = createLimiter({
      incrWithExpiryOnFirst: jest.fn().mockResolvedValue(1),
    });

    await limiter.consume('203.0.113.10');

    expect(redis.incrWithExpiryOnFirst).toHaveBeenCalledTimes(1);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });
});
