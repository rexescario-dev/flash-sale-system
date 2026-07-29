import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

import type { RedisClientPort } from '../../src/redis/redis-client.port';

import { validateEnv } from '../../src/config/env.validation';
import { RedisModule } from '../../src/redis/redis.module';
import { REDIS_CLIENT } from '../../src/redis/redis.tokens';

describe('RedisClient integration', () => {
  it('sets TTL on first incrWithExpiryOnFirst and keeps TTL on subsequent incr', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: validateEnv,
        }),
        RedisModule,
      ],
    }).compile();

    await moduleRef.init();

    const redis = moduleRef.get<RedisClientPort>(REDIS_CLIENT);
    const key = `test:incr-expiry:${randomUUID()}`;
    const inspector = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await inspector.connect();

      await expect(redis.incrWithExpiryOnFirst(key, 60)).resolves.toBe(1);

      const ttlAfterFirst = await inspector.ttl(key);
      expect(ttlAfterFirst).toBeGreaterThan(0);
      expect(ttlAfterFirst).toBeLessThanOrEqual(60);

      await expect(redis.incrWithExpiryOnFirst(key, 60)).resolves.toBe(2);

      const ttlAfterSecond = await inspector.ttl(key);
      expect(ttlAfterSecond).toBeGreaterThan(0);
      expect(ttlAfterSecond).toBeLessThanOrEqual(60);
    } finally {
      await inspector.del(key);
      await inspector.quit();
      await moduleRef.close();
    }
  });
});
