import {
  FLASH_SALE_REPOSITORY,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
  type Product,
} from '@flash-sale/domain';
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import type { Clock } from '../graphql/clock';

import { CLOCK } from '../graphql/clock';
import { requireId } from '../graphql/id-validation';
import { type FlashSaleCacheProductSnapshot, FlashSaleQueryCache } from './flash-sale-query.cache';
import { FlashSaleStatusGql } from './graphql/flash-sale-status.enum';
import { toFlashSaleStatusGql } from './graphql/flash-sale-status.mapper';
import { FlashSaleObjectType } from './graphql/flash-sale.object-type';

type ProductGql = {
  id: string;
  description: null | string;
  name: string;
};

function toProductGqlFromDomain(product: Product): ProductGql {
  return {
    id: product.getId(),
    description: product.getDescription() ?? null,
    name: product.getName(),
  };
}

function toProductGqlFromSnapshot(product: FlashSaleCacheProductSnapshot): ProductGql {
  return {
    id: product.id,
    description: product.description,
    name: product.name,
  };
}

@Resolver(() => FlashSaleObjectType)
export class FlashSaleResolver {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
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

    return {
      id: snapshot.id,
      endsAt: new Date(snapshot.endsAt),
      product: toProductGqlFromSnapshot(snapshot.product),
      remainingStock: snapshot.remainingStock,
      startsAt: new Date(snapshot.startsAt),
      status: snapshot.status as FlashSaleStatusGql,
      totalStock: snapshot.totalStock,
    };
  }

  @Query(() => [FlashSaleObjectType], { name: 'flashSales' })
  async flashSales(): Promise<FlashSaleObjectType[]> {
    const rows = await this.flashSaleRepository.findAllForCatalog();
    const nowUtc = this.clock.nowUtc();
    return rows.map(({ flashSale, product }) => ({
      id: flashSale.getId(),
      endsAt: flashSale.getEndsAt(),
      product: toProductGqlFromDomain(product),
      remainingStock: flashSale.getRemainingStock(),
      startsAt: flashSale.getStartsAt(),
      status: toFlashSaleStatusGql(flashSale.getStatus(nowUtc)),
      totalStock: flashSale.getTotalStock(),
    }));
  }
}
