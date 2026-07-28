import {
  type FlashSaleId,
  type FlashSaleReservation,
  FlashSaleValidationError,
} from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaFlashSaleReservation implements FlashSaleReservation {
  constructor(private readonly prisma: PrismaService) {}

  async tryReserve(flashSaleId: FlashSaleId, nowUtc: Date): Promise<boolean> {
    if (Number.isNaN(nowUtc.getTime())) {
      throw new FlashSaleValidationError('INVALID_NOW', 'FlashSale nowUtc must be a valid Date');
    }

    const affected = await this.prisma.$executeRaw`
      UPDATE flash_sales
      SET
        remaining_stock = remaining_stock - 1,
        updated_at = ${nowUtc}
      WHERE
        id = ${flashSaleId}
        AND starts_at <= ${nowUtc}
        AND ends_at > ${nowUtc}
        AND remaining_stock > 0
    `;

    return affected === 1;
  }
}
