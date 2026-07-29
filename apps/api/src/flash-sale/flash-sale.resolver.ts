import {
  FLASH_SALE_REPOSITORY,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
} from '@flash-sale/domain';
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { requireId } from '../graphql/id-validation';
import { FlashSaleQueryCache } from './flash-sale-query.cache';
import { FlashSaleStatusGql } from './graphql/flash-sale-status.enum';
import { FlashSaleObjectType } from './graphql/flash-sale.object-type';

@Resolver(() => FlashSaleObjectType)
export class FlashSaleResolver {
  constructor(
    @Inject(FLASH_SALE_REPOSITORY)
    private readonly flashSaleRepository: FlashSaleRepository,
    private readonly flashSaleQueryCache: FlashSaleQueryCache,
  ) {}

  @Query(() => FlashSaleObjectType, { name: 'flashSale' })
  async flashSale(@Args('id', { type: () => ID }) id: string): Promise<FlashSaleObjectType> {
    const flashSaleId = requireId(id);
    const snapshot = await this.flashSaleQueryCache.getById(flashSaleId);
    if (snapshot === null) {
      throw new FlashSaleNotFoundError();
    }

    // Interim until Redis snapshots include product (#121 catalog PR): load product
    // via the join path without changing the sale-field cache ownership.
    const loaded = await this.flashSaleRepository.findByIdWithProduct(flashSaleId);
    if (loaded === null) {
      throw new FlashSaleNotFoundError();
    }

    return {
      id: snapshot.id,
      endsAt: new Date(snapshot.endsAt),
      product: {
        id: loaded.product.getId(),
        description: loaded.product.getDescription() ?? null,
        name: loaded.product.getName(),
      },
      remainingStock: snapshot.remainingStock,
      startsAt: new Date(snapshot.startsAt),
      status: snapshot.status as FlashSaleStatusGql,
      totalStock: snapshot.totalStock,
    };
  }
}
