import {
  type FlashSaleId,
  PURCHASE_REPOSITORY,
  type PurchaseRepository,
  type UserId,
} from '@flash-sale/domain';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnv } from '../config/env.validation';
import type { RedisClientPort } from '../redis/redis-client.port';

import { REDIS_CACHE_DEGRADED, REDIS_CACHE_INVALIDATION_FAILED } from '../redis/redis-events';
import { myPurchaseCacheKey } from '../redis/redis-keys';
import { REDIS_CLIENT } from '../redis/redis.tokens';
import { MyPurchaseResultObjectType } from './graphql/my-purchase-result.object-type';

export type MyPurchaseCacheEnvelope =
  | { found: false }
  | {
      found: true;
      purchase: { purchaseId: string; purchasedAt: string };
    };

function isValidEnvelope(value: unknown): value is MyPurchaseCacheEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.found === false) {
    return true;
  }
  if (record.found !== true) {
    return false;
  }
  const purchase = record.purchase;
  if (typeof purchase !== 'object' || purchase === null) {
    return false;
  }
  const purchaseRecord = purchase as Record<string, unknown>;
  return (
    typeof purchaseRecord.purchaseId === 'string' && typeof purchaseRecord.purchasedAt === 'string'
  );
}

function toResult(envelope: MyPurchaseCacheEnvelope): MyPurchaseResultObjectType {
  if (!envelope.found) {
    return {
      purchaseId: null,
      purchased: false,
      purchasedAt: null,
    };
  }

  return {
    purchaseId: envelope.purchase.purchaseId,
    purchased: true,
    purchasedAt: new Date(envelope.purchase.purchasedAt),
  };
}

@Injectable()
export class MyPurchaseQueryCache {
  private readonly logger = new Logger(MyPurchaseQueryCache.name);

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    @Inject(PURCHASE_REPOSITORY)
    private readonly purchases: PurchaseRepository,
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClientPort,
  ) {}

  async get(flashSaleId: FlashSaleId, userId: UserId): Promise<MyPurchaseResultObjectType> {
    const key = myPurchaseCacheKey(flashSaleId, userId);
    try {
      const raw = await this.redis.get(key);
      if (raw !== null) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (isValidEnvelope(parsed)) {
            return toResult(parsed);
          }
          this.logger.warn({
            err: 'invalid envelope shape',
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

    const purchase = await this.purchases.findByFlashSaleAndUser(flashSaleId, userId);
    if (purchase === null) {
      const envelope: MyPurchaseCacheEnvelope = { found: false };
      try {
        await this.redis.set(
          key,
          JSON.stringify(envelope),
          this.config.get('MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS', { infer: true }),
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
      return {
        purchaseId: null,
        purchased: false,
        purchasedAt: null,
      };
    }

    const envelope: MyPurchaseCacheEnvelope = {
      found: true,
      purchase: {
        purchaseId: purchase.getId(),
        purchasedAt: purchase.getPurchasedAt().toISOString(),
      },
    };
    try {
      await this.redis.set(
        key,
        JSON.stringify(envelope),
        this.config.get('MY_PURCHASE_CACHE_TTL_SECONDS', { infer: true }),
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

    return {
      purchaseId: purchase.getId(),
      purchased: true,
      purchasedAt: purchase.getPurchasedAt(),
    };
  }

  async invalidate(flashSaleId: FlashSaleId, userId: UserId): Promise<void> {
    const key = myPurchaseCacheKey(flashSaleId, userId);
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
