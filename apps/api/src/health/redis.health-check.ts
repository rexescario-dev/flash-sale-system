import { Inject, Injectable } from '@nestjs/common';

import type { RedisClientPort } from '../redis/redis-client.port';
import type { HealthCheck, HealthCheckResult } from './health-check.port';

import { REDIS_CLIENT } from '../redis/redis.tokens';

@Injectable()
export class RedisHealthCheck implements HealthCheck {
  readonly name = 'redis';

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClientPort,
  ) {}

  async check(): Promise<HealthCheckResult> {
    await this.redis.ping();
    return { status: 'up' };
  }
}
