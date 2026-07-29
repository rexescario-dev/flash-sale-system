import { PURCHASE_FLOW, PURCHASE_REPOSITORY } from '@flash-sale/domain';
import { Module } from '@nestjs/common';

import { FlashSaleModule } from '../flash-sale/flash-sale.module';
import { MyPurchaseQueryCache } from './my-purchase-query.cache';
import { PrismaPurchaseRepository } from './prisma-purchase.repository';
import { PurchaseFlowService } from './purchase-flow.service';
import { PurchaseItemRateLimiter } from './purchase-item.rate-limiter';
import { PurchaseResolver } from './purchase.resolver';

@Module({
  exports: [PURCHASE_FLOW, PURCHASE_REPOSITORY],
  imports: [FlashSaleModule],
  providers: [
    MyPurchaseQueryCache,
    PrismaPurchaseRepository,
    PurchaseFlowService,
    PurchaseItemRateLimiter,
    PurchaseResolver,
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
