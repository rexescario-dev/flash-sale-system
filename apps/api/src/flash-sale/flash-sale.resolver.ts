import { FlashSaleNotFoundError } from '@flash-sale/domain';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { requireId } from '../graphql/id-validation';
import { FlashSaleQueryCache } from './flash-sale-query.cache';
import { FlashSaleStatusGql } from './graphql/flash-sale-status.enum';
import { FlashSaleObjectType } from './graphql/flash-sale.object-type';

@Resolver()
export class FlashSaleResolver {
  constructor(private readonly flashSaleQueryCache: FlashSaleQueryCache) {}

  @Query(() => FlashSaleObjectType, { name: 'flashSale' })
  async flashSale(@Args('id', { type: () => ID }) id: string): Promise<FlashSaleObjectType> {
    const flashSaleId = requireId(id);
    const snapshot = await this.flashSaleQueryCache.getById(flashSaleId);
    if (snapshot === null) {
      throw new FlashSaleNotFoundError();
    }

    return {
      id: snapshot.id,
      endsAt: new Date(snapshot.endsAt),
      remainingStock: snapshot.remainingStock,
      startsAt: new Date(snapshot.startsAt),
      status: snapshot.status as FlashSaleStatusGql,
      totalStock: snapshot.totalStock,
    };
  }
}
