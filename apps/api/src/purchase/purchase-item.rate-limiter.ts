import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnv } from '../config/env.validation';
import type { RedisClientPort } from '../redis/redis-client.port';

import { REDIS_RATE_LIMIT_DEGRADED } from '../redis/redis-events';
import { purchaseItemRateLimitKey } from '../redis/redis-keys';
import { REDIS_CLIENT } from '../redis/redis.tokens';

export type RateLimitDecision = 'allow' | 'limit';

@Injectable()
export class PurchaseItemRateLimiter {
  private readonly logger = new Logger(PurchaseItemRateLimiter.name);

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClientPort,
  ) {}

  async consume(ip: string): Promise<RateLimitDecision> {
    const key = purchaseItemRateLimitKey(ip);
    const max = this.config.get('RATE_LIMIT_PURCHASE_ITEM_MAX', { infer: true });
    const windowSeconds = this.config.get('RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS', {
      infer: true,
    });

    try {
      const count = await this.redis.incrWithExpiryOnFirst(key, windowSeconds);
      return count > max ? 'limit' : 'allow';
    } catch (err) {
      this.logger.warn({
        err: String(err),
        event: REDIS_RATE_LIMIT_DEGRADED,
        key,
      });
      return 'allow';
    }
  }
}
