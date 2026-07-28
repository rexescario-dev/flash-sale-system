import {
  FLASH_SALE_REPOSITORY,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
} from '@flash-sale/domain';
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { CLOCK, type Clock } from '../graphql/clock';
import { requireId } from '../graphql/id-validation';
import { toFlashSaleStatusGql } from './graphql/flash-sale-status.mapper';
import { FlashSaleObjectType } from './graphql/flash-sale.object-type';

@Resolver()
export class FlashSaleResolver {
  constructor(
    @Inject(FLASH_SALE_REPOSITORY)
    private readonly flashSaleRepository: FlashSaleRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  @Query(() => FlashSaleObjectType, { name: 'flashSale' })
  async flashSale(@Args('id', { type: () => ID }) id: string): Promise<FlashSaleObjectType> {
    const flashSaleId = requireId(id);
    const flashSale = await this.flashSaleRepository.findById(flashSaleId);
    if (flashSale === null) {
      throw new FlashSaleNotFoundError();
    }

    const status = toFlashSaleStatusGql(flashSale.getStatus(this.clock.nowUtc()));

    return {
      id: flashSale.getId(),
      endsAt: flashSale.getEndsAt(),
      remainingStock: flashSale.getRemainingStock(),
      startsAt: flashSale.getStartsAt(),
      status,
      totalStock: flashSale.getTotalStock(),
    };
  }
}
