import type { Purchase as PrismaPurchase } from '@prisma/client';

import { type FlashSaleId, Purchase, type PurchaseId, type UserId } from '@flash-sale/domain';

export class PurchaseMapper {
  static toDomain(row: PrismaPurchase): Purchase {
    return Purchase.reconstitute({
      flashSaleId: row.flashSaleId as FlashSaleId,
      id: row.id as PurchaseId,
      userId: row.userId as UserId,
      purchasedAt: row.purchasedAt,
    });
  }

  static toPersistence(purchase: Purchase): {
    flashSaleId: string;
    id: string;
    userId: string;
    purchasedAt: Date;
  } {
    return {
      flashSaleId: purchase.getFlashSaleId(),
      id: purchase.getId(),
      userId: purchase.getUserId(),
      purchasedAt: purchase.getPurchasedAt(),
    };
  }
}
