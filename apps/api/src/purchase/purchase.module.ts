import { PURCHASE_FLOW, PURCHASE_REPOSITORY } from '@flash-sale/domain';
import { Module } from '@nestjs/common';

import { FlashSaleModule } from '../flash-sale/flash-sale.module';
import { PrismaPurchaseRepository } from './prisma-purchase.repository';
import { PurchaseFlowService } from './purchase-flow.service';

@Module({
  exports: [PURCHASE_FLOW, PURCHASE_REPOSITORY],
  imports: [FlashSaleModule],
  providers: [
    PrismaPurchaseRepository,
    PurchaseFlowService,
    {
      provide: PURCHASE_FLOW,
      useExisting: PurchaseFlowService,
    },
    {
      provide: PURCHASE_REPOSITORY,
      useExisting: PrismaPurchaseRepository,
    },
  ],
})
export class PurchaseModule {}
