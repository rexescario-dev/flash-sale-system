import type { Request } from 'express';

import {
  FLASH_SALE_REPOSITORY,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
  PURCHASE_FLOW,
  PURCHASE_HISTORY_QUERY,
  type PurchaseFlow,
  type PurchaseHistoryQuery,
  type PurchaseOutcome,
} from '@flash-sale/domain';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AppEnv } from '../config/env.validation';

import { FlashSaleQueryCache } from '../flash-sale/flash-sale-query.cache';
import { CLOCK, type Clock } from '../graphql/clock';
import { GraphqlBadUserInputError } from '../graphql/graphql-bad-user-input.error';
import { GraphqlRateLimitedError } from '../graphql/graphql-rate-limited.error';
import { requireFlashSaleId, requireUserId } from '../graphql/id-validation';
import { createPurchaseId } from '../graphql/purchase-id';
import { messageForPurchaseOutcome } from '../graphql/purchase-outcome-message';
import { AppLogger } from '../logging/app-logger';
import { LogEvent, type LogEventName } from '../logging/log-event';
import { resolveClientIp } from './client-ip';
import { MyPurchaseResultObjectType } from './graphql/my-purchase-result.object-type';
import { PurchaseHistoryItemObjectType } from './graphql/purchase-history-item.object-type';
import { PurchaseItemResultObjectType } from './graphql/purchase-item-result.object-type';
import { toPurchaseOutcomeGql } from './graphql/purchase-outcome.mapper';
import { MyPurchaseQueryCache } from './my-purchase-query.cache';
import { PurchaseItemRateLimiter } from './purchase-item.rate-limiter';

function outcomeEvent(outcome: PurchaseOutcome): LogEventName {
  switch (outcome) {
    case 'SUCCESS':
      return LogEvent.PURCHASE_COMPLETED;
    case 'ALREADY_PURCHASED':
      return LogEvent.PURCHASE_DUPLICATE;
    case 'SOLD_OUT':
      return LogEvent.PURCHASE_SOLD_OUT;
    case 'SALE_NOT_STARTED':
      return LogEvent.PURCHASE_SALE_NOT_STARTED;
    case 'SALE_ENDED':
      return LogEvent.PURCHASE_SALE_ENDED;
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

@Resolver()
export class PurchaseResolver {
  constructor(
    @Inject(FLASH_SALE_REPOSITORY)
    private readonly flashSaleRepository: FlashSaleRepository,
    @Inject(PURCHASE_FLOW)
    private readonly purchaseFlow: PurchaseFlow,
    @Inject(CLOCK)
    private readonly clock: Clock,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly flashSaleQueryCache: FlashSaleQueryCache,
    private readonly myPurchaseQueryCache: MyPurchaseQueryCache,
    private readonly rateLimiter: PurchaseItemRateLimiter,
    @Inject(PURCHASE_HISTORY_QUERY)
    private readonly purchaseHistoryQuery: PurchaseHistoryQuery,
    private readonly appLogger: AppLogger,
  ) {}

  @Query(() => MyPurchaseResultObjectType, { name: 'myPurchase' })
  async myPurchase(
    @Args('flashSaleId', { type: () => ID }) flashSaleIdRaw: string,
    @Args('userId', { type: () => ID }) userIdRaw: string,
  ): Promise<MyPurchaseResultObjectType> {
    const flashSaleId = requireFlashSaleId(flashSaleIdRaw);
    const userId = requireUserId(userIdRaw);
    const startedAt = Date.now();

    // HARD INVARIANT: uncached sale existence BEFORE purchase cache
    const flashSale = await this.flashSaleRepository.findById(flashSaleId);
    if (flashSale === null) {
      throw new FlashSaleNotFoundError();
    }

    const result = await this.myPurchaseQueryCache.get(flashSaleId, userId);
    this.appLogger.info(LogEvent.PURCHASE_QUERY_COMPLETED, {
      userId,
      durationMs: Date.now() - startedAt,
      resultCount: result.purchased ? 1 : 0,
    });
    return result;
  }

  @Query(() => [PurchaseHistoryItemObjectType], { name: 'myPurchases' })
  async myPurchases(
    @Args('userId', { type: () => ID }) userIdRaw: string,
  ): Promise<PurchaseHistoryItemObjectType[]> {
    const userId = requireUserId(userIdRaw);
    const startedAt = Date.now();
    const rows = await this.purchaseHistoryQuery.findByUser(userId);
    const mapped = rows.map((row) => ({
      id: row.id,
      flashSale: { id: row.flashSaleId },
      product: {
        id: row.product.id,
        description: row.product.description,
        name: row.product.name,
      },
      purchasedAt: row.purchasedAt,
    }));
    this.appLogger.info(LogEvent.PURCHASE_QUERY_COMPLETED, {
      userId,
      durationMs: Date.now() - startedAt,
      resultCount: rows.length,
    });
    return mapped;
  }

  @Mutation(() => PurchaseItemResultObjectType, { name: 'purchaseItem' })
  async purchaseItem(
    @Args('flashSaleId', { type: () => ID }) flashSaleIdRaw: string,
    @Args('userId', { type: () => ID }) userIdRaw: string,
    @Context('req') req: Request,
  ): Promise<PurchaseItemResultObjectType> {
    const flashSaleId = requireFlashSaleId(flashSaleIdRaw);
    const userId = requireUserId(userIdRaw);
    const startedAt = Date.now();

    this.appLogger.info(LogEvent.PURCHASE_ATTEMPTED, { flashSaleId, userId });

    try {
      const trustedProxy = this.config.get('TRUSTED_PROXY', { infer: true });
      const clientIp = resolveClientIp(req, trustedProxy);
      if ((await this.rateLimiter.consume(clientIp)) === 'limit') {
        this.appLogger.info(LogEvent.PURCHASE_RATE_LIMITED, {
          flashSaleId,
          userId,
          durationMs: Date.now() - startedAt,
        });
        throw new GraphqlRateLimitedError();
      }

      const purchaseId = createPurchaseId();
      const outcome = await this.purchaseFlow.execute({
        flashSaleId,
        purchaseId,
        userId,
        nowUtc: this.clock.nowUtc(),
      });

      if (outcome === 'SUCCESS') {
        await Promise.all([
          this.flashSaleQueryCache.invalidate(flashSaleId),
          this.myPurchaseQueryCache.invalidate(flashSaleId, userId),
        ]);
      }

      const durationMs = Date.now() - startedAt;
      this.appLogger.info(outcomeEvent(outcome), {
        flashSaleId,
        userId,
        durationMs,
        ...(outcome === 'SUCCESS' ? { purchaseId } : {}),
      });

      return {
        purchaseId: outcome === 'SUCCESS' ? purchaseId : null,
        message: messageForPurchaseOutcome(outcome),
        status: toPurchaseOutcomeGql(outcome),
      };
    } catch (err) {
      if (
        err instanceof GraphqlRateLimitedError ||
        err instanceof FlashSaleNotFoundError ||
        err instanceof GraphqlBadUserInputError
      ) {
        throw err;
      }
      this.appLogger.error(
        LogEvent.PURCHASE_FAILED,
        {
          flashSaleId,
          userId,
          durationMs: Date.now() - startedAt,
        },
        err,
      );
      throw err;
    }
  }
}
