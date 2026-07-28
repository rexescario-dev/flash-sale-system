import { FLASH_SALE_REPOSITORY, FLASH_SALE_RESERVATION } from '@flash-sale/domain';
import { Module } from '@nestjs/common';

import { PrismaFlashSaleRepository } from './prisma-flash-sale.repository';
import { PrismaFlashSaleReservation } from './prisma-flash-sale.reservation';

@Module({
  exports: [FLASH_SALE_REPOSITORY, FLASH_SALE_RESERVATION],
  providers: [
    PrismaFlashSaleRepository,
    PrismaFlashSaleReservation,
    {
      provide: FLASH_SALE_REPOSITORY,
      useExisting: PrismaFlashSaleRepository,
    },
    {
      provide: FLASH_SALE_RESERVATION,
      useExisting: PrismaFlashSaleReservation,
    },
  ],
})
export class FlashSaleModule {}
