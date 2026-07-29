import {
  type FlashSale,
  type FlashSaleId,
  type FlashSaleRepository,
  type FlashSaleWithProduct,
} from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { FlashSaleMapper } from './flash-sale.mapper';
import { ProductMapper } from './product.mapper';

@Injectable()
export class PrismaFlashSaleRepository implements FlashSaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForCatalog(): Promise<FlashSaleWithProduct[]> {
    // #121 intentionally loads the full catalog; pagination/filtering is out of
    // scope for this issue and deferred to later catalog work.
    const rows = await this.prisma.flashSale.findMany({
      include: { product: true },
      orderBy: { startsAt: 'asc' },
    });

    return rows.map((row) => ({
      flashSale: FlashSaleMapper.toDomain(row),
      product: ProductMapper.toDomain(row.product),
    }));
  }

  async findById(id: FlashSaleId): Promise<FlashSale | null> {
    const row = await this.prisma.flashSale.findUnique({
      where: { id },
    });

    if (row === null) {
      return null;
    }

    return FlashSaleMapper.toDomain(row);
  }

  async findByIdWithProduct(id: FlashSaleId): Promise<FlashSaleWithProduct | null> {
    const row = await this.prisma.flashSale.findUnique({
      include: { product: true },
      where: { id },
    });

    if (row === null) {
      return null;
    }

    return {
      flashSale: FlashSaleMapper.toDomain(row),
      product: ProductMapper.toDomain(row.product),
    };
  }
}
