import {
  FLASH_SALE_REPOSITORY,
  type FlashSale,
  type FlashSaleId,
  type FlashSaleRepository,
} from '@flash-sale/domain';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnv } from '../config/env.validation';
import type { Clock } from '../graphql/clock';
import type { RedisClientPort } from '../redis/redis-client.port';

import { CLOCK } from '../graphql/clock';
import { REDIS_CACHE_DEGRADED, REDIS_CACHE_INVALIDATION_FAILED } from '../redis/redis-events';
import { flashSaleCacheKey } from '../redis/redis-keys';
import { REDIS_CLIENT } from '../redis/redis.tokens';
import { toFlashSaleStatusGql } from './graphql/flash-sale-status.mapper';

export type FlashSaleCacheSnapshot = {
  id: string;
  endsAt: string;
  remainingStock: number;
  startsAt: string;
  status: 'ACTIVE' | 'ENDED' | 'SOLD_OUT' | 'UPCOMING';
  totalStock: number;
};

function toSnapshot(entity: FlashSale, nowUtc: Date): FlashSaleCacheSnapshot {
  return {
    id: entity.getId(),
    endsAt: entity.getEndsAt().toISOString(),
    remainingStock: entity.getRemainingStock(),
    startsAt: entity.getStartsAt().toISOString(),
    status: toFlashSaleStatusGql(entity.getStatus(nowUtc)),
    totalStock: entity.getTotalStock(),
  };
}

@Injectable()
export class FlashSaleQueryCache {
  private readonly logger = new Logger(FlashSaleQueryCache.name);

  constructor(
    @Inject(CLOCK)
    private readonly clock: Clock,
    private readonly config: ConfigService<AppEnv, true>,
    @Inject(FLASH_SALE_REPOSITORY)
    private readonly flashSales: FlashSaleRepository,
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClientPort,
  ) {}

  async getById(id: FlashSaleId): Promise<FlashSaleCacheSnapshot | null> {
    const key = flashSaleCacheKey(id);
    try {
      const raw = await this.redis.get(key);
      if (raw !== null) {
        try {
          return JSON.parse(raw) as FlashSaleCacheSnapshot;
        } catch (err) {
          this.logger.warn({
            err: String(err),
            event: REDIS_CACHE_DEGRADED,
            key,
            op: 'get',
            reason: 'invalid_payload',
          });
        }
      }
    } catch (err) {
      this.logger.warn({
        err: String(err),
        event: REDIS_CACHE_DEGRADED,
        key,
        op: 'get',
        reason: 'redis_error',
      });
    }

    const entity = await this.flashSales.findById(id);
    if (entity === null) {
      return null;
    }

    const snapshot = toSnapshot(entity, this.clock.nowUtc());
    try {
      await this.redis.set(
        key,
        JSON.stringify(snapshot),
        this.config.get('FLASH_SALE_CACHE_TTL_SECONDS', { infer: true }),
      );
    } catch (err) {
      this.logger.warn({
        err: String(err),
        event: REDIS_CACHE_DEGRADED,
        key,
        op: 'set',
        reason: 'redis_error',
      });
    }
    return snapshot;
  }

  async invalidate(flashSaleId: FlashSaleId): Promise<void> {
    const key = flashSaleCacheKey(flashSaleId);
    try {
      await this.redis.delete(key);
    } catch (err) {
      this.logger.warn({
        err: String(err),
        event: REDIS_CACHE_INVALIDATION_FAILED,
        key,
      });
    }
  }
}
