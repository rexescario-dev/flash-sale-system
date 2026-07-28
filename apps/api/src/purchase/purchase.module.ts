import { PURCHASE_REPOSITORY } from '@flash-sale/domain';
import { Module } from '@nestjs/common';

import { PrismaPurchaseRepository } from './prisma-purchase.repository';

@Module({
  exports: [PURCHASE_REPOSITORY],
  providers: [
    PrismaPurchaseRepository,
    {
      provide: PURCHASE_REPOSITORY,
      useExisting: PrismaPurchaseRepository,
    },
  ],
})
export class PurchaseModule {}
