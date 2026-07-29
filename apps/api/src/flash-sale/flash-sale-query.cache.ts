import {
  FLASH_SALE_REPOSITORY,
  type FlashSale,
  type FlashSaleId,
  type FlashSaleRepository,
  type Product,
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
import { FlashSaleStatusGql } from './graphql/flash-sale-status.enum';
import { toFlashSaleStatusGql } from './graphql/flash-sale-status.mapper';

export type FlashSaleCacheProductSnapshot = {
  id: string;
  description: null | string;
  name: string;
};

export type FlashSaleCacheSnapshot = {
  id: string;
  endsAt: string;
  product: FlashSaleCacheProductSnapshot;
  remainingStock: number;
  startsAt: string;
  status: 'ACTIVE' | 'ENDED' | 'SOLD_OUT' | 'UPCOMING';
  totalStock: number;
};

const FLASH_SALE_CACHE_STATUSES = new Set<string>(Object.values(FlashSaleStatusGql));

function isFlashSaleCacheStatus(value: unknown): value is FlashSaleCacheSnapshot['status'] {
  return typeof value === 'string' && FLASH_SALE_CACHE_STATUSES.has(value);
}

function toProductSnapshot(product: Product): FlashSaleCacheProductSnapshot {
  return {
    id: product.getId(),
    description: product.getDescription() ?? null,
    name: product.getName(),
  };
}

function toSnapshot(flashSale: FlashSale, product: Product, nowUtc: Date): FlashSaleCacheSnapshot {
  return {
    id: flashSale.getId(),
    endsAt: flashSale.getEndsAt().toISOString(),
    product: toProductSnapshot(product),
    remainingStock: flashSale.getRemainingStock(),
    startsAt: flashSale.getStartsAt().toISOString(),
    status: toFlashSaleStatusGql(flashSale.getStatus(nowUtc)),
    totalStock: flashSale.getTotalStock(),
  };
}

function isCompleteSnapshot(value: unknown): value is FlashSaleCacheSnapshot {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const snapshot = value as Partial<FlashSaleCacheSnapshot>;
  const product = snapshot.product;
  return (
    typeof snapshot.id === 'string' &&
    typeof snapshot.endsAt === 'string' &&
    typeof snapshot.startsAt === 'string' &&
    typeof snapshot.remainingStock === 'number' &&
    typeof snapshot.totalStock === 'number' &&
    isFlashSaleCacheStatus(snapshot.status) &&
    product !== null &&
    typeof product === 'object' &&
    typeof product.id === 'string' &&
    typeof product.name === 'string' &&
    (product.description === null || typeof product.description === 'string')
  );
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
          const parsed: unknown = JSON.parse(raw);
          if (isCompleteSnapshot(parsed)) {
            return parsed;
          }
          this.logger.warn({
            event: REDIS_CACHE_DEGRADED,
            key,
            op: 'get',
            reason: 'invalid_payload',
          });
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

    const loaded = await this.flashSales.findByIdWithProduct(id);
    if (loaded === null) {
      return null;
    }

    const snapshot = toSnapshot(loaded.flashSale, loaded.product, this.clock.nowUtc());
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
