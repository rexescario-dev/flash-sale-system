import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { AppEnv } from '../config/env.validation';
import type { RedisClientPort } from './redis-client.port';

import { REDIS_CONNECTION_DEGRADED } from './redis-events';

const INCR_WITH_EXPIRY_ON_FIRST = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return n
`;

@Injectable()
export class IoredisRedisClientAdapter implements OnModuleDestroy, OnModuleInit, RedisClientPort {
  private client!: Redis;
  private readonly logger = new Logger(IoredisRedisClientAdapter.name);

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async get(key: string): Promise<null | string> {
    return this.client.get(key);
  }

  async incrWithExpiryOnFirst(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.client.eval(INCR_WITH_EXPIRY_ON_FIRST, 1, key, String(ttlSeconds));
    return Number(result);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get('REDIS_URL', { infer: true });
    this.client = new Redis(url, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', (err) => {
      this.logger.warn({
        err: err.message,
        event: REDIS_CONNECTION_DEGRADED,
      });
    });
    try {
      await this.client.connect();
    } catch (err) {
      this.logger.warn({
        err: String(err),
        event: REDIS_CONNECTION_DEGRADED,
      });
      // Do NOT rethrow — API must start; feature ops fail open while Redis is down.
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }
}
