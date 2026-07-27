import type { FlashSale as PrismaFlashSale } from '@prisma/client';

import { FlashSale, type FlashSaleId, type ProductId } from '@flash-sale/domain';

export class FlashSaleMapper {
  static toDomain(row: PrismaFlashSale): FlashSale {
    return FlashSale.reconstitute({
      id: row.id as FlashSaleId,
      productId: row.productId as ProductId,
      endsAt: row.endsAt,
      remainingStock: row.remainingStock,
      startsAt: row.startsAt,
      totalStock: row.totalStock,
    });
  }
}
