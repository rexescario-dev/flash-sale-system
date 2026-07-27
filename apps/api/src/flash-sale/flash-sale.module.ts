import { FLASH_SALE_REPOSITORY } from '@flash-sale/domain';
import { Module } from '@nestjs/common';

import { PrismaFlashSaleRepository } from './prisma-flash-sale.repository';

@Module({
  exports: [FLASH_SALE_REPOSITORY],
  providers: [
    PrismaFlashSaleRepository,
    {
      provide: FLASH_SALE_REPOSITORY,
      useExisting: PrismaFlashSaleRepository,
    },
  ],
})
export class FlashSaleModule {}
