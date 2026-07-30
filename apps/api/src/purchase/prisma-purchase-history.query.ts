import {
  type FlashSaleId,
  type ProductId,
  type PurchaseHistoryQuery,
  type PurchaseHistoryReadModel,
  type PurchaseId,
  type UserId,
} from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaPurchaseHistoryQuery implements PurchaseHistoryQuery {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: UserId): Promise<PurchaseHistoryReadModel[]> {
    const rows = await this.prisma.purchase.findMany({
      include: { flashSale: { include: { product: true } } },
      orderBy: { purchasedAt: 'desc' },
      where: { userId },
    });

    return rows.map((row) => ({
      flashSaleId: row.flashSale.id as FlashSaleId,
      id: row.id as PurchaseId,
      product: {
        id: row.flashSale.product.id as ProductId,
        description: row.flashSale.product.description,
        name: row.flashSale.product.name,
      },
      purchasedAt: row.purchasedAt,
    }));
  }
}
