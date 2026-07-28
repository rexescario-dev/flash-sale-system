import {
  FLASH_SALE_REPOSITORY,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
  PURCHASE_FLOW,
  PURCHASE_REPOSITORY,
  type PurchaseFlow,
  type PurchaseRepository,
} from '@flash-sale/domain';
import { Inject } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CLOCK, type Clock } from '../graphql/clock';
import { requireFlashSaleId, requireUserId } from '../graphql/id-validation';
import { createPurchaseId } from '../graphql/purchase-id';
import { messageForPurchaseOutcome } from '../graphql/purchase-outcome-message';
import { MyPurchaseResultObjectType } from './graphql/my-purchase-result.object-type';
import { PurchaseItemResultObjectType } from './graphql/purchase-item-result.object-type';
import { toPurchaseOutcomeGql } from './graphql/purchase-outcome.mapper';

@Resolver()
export class PurchaseResolver {
  constructor(
    @Inject(FLASH_SALE_REPOSITORY)
    private readonly flashSaleRepository: FlashSaleRepository,
    @Inject(PURCHASE_REPOSITORY)
    private readonly purchaseRepository: PurchaseRepository,
    @Inject(PURCHASE_FLOW)
    private readonly purchaseFlow: PurchaseFlow,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  @Query(() => MyPurchaseResultObjectType, { name: 'myPurchase' })
  async myPurchase(
    @Args('flashSaleId', { type: () => ID }) flashSaleIdRaw: string,
    @Args('userId', { type: () => ID }) userIdRaw: string,
  ): Promise<MyPurchaseResultObjectType> {
    const flashSaleId = requireFlashSaleId(flashSaleIdRaw);
    const userId = requireUserId(userIdRaw);

    const flashSale = await this.flashSaleRepository.findById(flashSaleId);
    if (flashSale === null) {
      throw new FlashSaleNotFoundError();
    }

    const purchase = await this.purchaseRepository.findByFlashSaleAndUser(flashSaleId, userId);
    if (purchase === null) {
      return {
        purchaseId: null,
        purchased: false,
        purchasedAt: null,
      };
    }

    return {
      purchaseId: purchase.getId(),
      purchased: true,
      purchasedAt: purchase.getPurchasedAt(),
    };
  }

  @Mutation(() => PurchaseItemResultObjectType, { name: 'purchaseItem' })
  async purchaseItem(
    @Args('flashSaleId', { type: () => ID }) flashSaleIdRaw: string,
    @Args('userId', { type: () => ID }) userIdRaw: string,
  ): Promise<PurchaseItemResultObjectType> {
    const flashSaleId = requireFlashSaleId(flashSaleIdRaw);
    const userId = requireUserId(userIdRaw);
    const purchaseId = createPurchaseId();

    const outcome = await this.purchaseFlow.execute({
      flashSaleId,
      purchaseId,
      userId,
      nowUtc: this.clock.nowUtc(),
    });

    return {
      purchaseId: outcome === 'SUCCESS' ? purchaseId : null,
      message: messageForPurchaseOutcome(outcome),
      status: toPurchaseOutcomeGql(outcome),
    };
  }
}
