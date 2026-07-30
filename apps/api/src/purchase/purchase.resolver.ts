import type { Request } from 'express';

import {
  FLASH_SALE_REPOSITORY,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
  PURCHASE_FLOW,
  PURCHASE_HISTORY_QUERY,
  type PurchaseFlow,
  type PurchaseHistoryQuery,
} from '@flash-sale/domain';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AppEnv } from '../config/env.validation';

import { FlashSaleQueryCache } from '../flash-sale/flash-sale-query.cache';
import { CLOCK, type Clock } from '../graphql/clock';
import { GraphqlRateLimitedError } from '../graphql/graphql-rate-limited.error';
import { requireFlashSaleId, requireUserId } from '../graphql/id-validation';
import { createPurchaseId } from '../graphql/purchase-id';
import { messageForPurchaseOutcome } from '../graphql/purchase-outcome-message';
import { resolveClientIp } from './client-ip';
import { MyPurchaseResultObjectType } from './graphql/my-purchase-result.object-type';
import { PurchaseHistoryItemObjectType } from './graphql/purchase-history-item.object-type';
import { PurchaseItemResultObjectType } from './graphql/purchase-item-result.object-type';
import { toPurchaseOutcomeGql } from './graphql/purchase-outcome.mapper';
import { MyPurchaseQueryCache } from './my-purchase-query.cache';
import { PurchaseItemRateLimiter } from './purchase-item.rate-limiter';

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
  ) {}

  @Query(() => MyPurchaseResultObjectType, { name: 'myPurchase' })
  async myPurchase(
    @Args('flashSaleId', { type: () => ID }) flashSaleIdRaw: string,
    @Args('userId', { type: () => ID }) userIdRaw: string,
  ): Promise<MyPurchaseResultObjectType> {
    const flashSaleId = requireFlashSaleId(flashSaleIdRaw);
    const userId = requireUserId(userIdRaw);

    // HARD INVARIANT: uncached sale existence BEFORE purchase cache
    const flashSale = await this.flashSaleRepository.findById(flashSaleId);
    if (flashSale === null) {
      throw new FlashSaleNotFoundError();
    }

    return this.myPurchaseQueryCache.get(flashSaleId, userId);
  }

  @Query(() => [PurchaseHistoryItemObjectType], { name: 'myPurchases' })
  async myPurchases(
    @Args('userId', { type: () => ID }) userIdRaw: string,
  ): Promise<PurchaseHistoryItemObjectType[]> {
    const userId = requireUserId(userIdRaw);
    const rows = await this.purchaseHistoryQuery.findByUser(userId);
    return rows.map((row) => ({
      id: row.id,
      flashSale: { id: row.flashSaleId },
      product: {
        id: row.product.id,
        description: row.product.description,
        name: row.product.name,
      },
      purchasedAt: row.purchasedAt,
    }));
  }

  @Mutation(() => PurchaseItemResultObjectType, { name: 'purchaseItem' })
  async purchaseItem(
    @Args('flashSaleId', { type: () => ID }) flashSaleIdRaw: string,
    @Args('userId', { type: () => ID }) userIdRaw: string,
    @Context('req') req: Request,
  ): Promise<PurchaseItemResultObjectType> {
    const flashSaleId = requireFlashSaleId(flashSaleIdRaw);
    const userId = requireUserId(userIdRaw);

    const trustedProxy = this.config.get('TRUSTED_PROXY', { infer: true });
    const clientIp = resolveClientIp(req, trustedProxy);
    if ((await this.rateLimiter.consume(clientIp)) === 'limit') {
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

    return {
      purchaseId: outcome === 'SUCCESS' ? purchaseId : null,
      message: messageForPurchaseOutcome(outcome),
      status: toPurchaseOutcomeGql(outcome),
    };
  }
}
