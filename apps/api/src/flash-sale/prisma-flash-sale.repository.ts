import { type FlashSale, type FlashSaleId, type FlashSaleRepository } from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { FlashSaleMapper } from './flash-sale.mapper';

@Injectable()
export class PrismaFlashSaleRepository implements FlashSaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: FlashSaleId): Promise<FlashSale | null> {
    const row = await this.prisma.flashSale.findUnique({
      where: { id },
    });

    if (row === null) {
      return null;
    }

    return FlashSaleMapper.toDomain(row);
  }
}
