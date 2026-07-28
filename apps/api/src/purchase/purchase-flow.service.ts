import {
  FLASH_SALE_REPOSITORY,
  FLASH_SALE_RESERVATION,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
  type FlashSaleReservation,
  Purchase,
  PURCHASE_REPOSITORY,
  PurchaseConflictError,
  type PurchaseFlow,
  type PurchaseFlowExecuteInput,
  type PurchaseOutcome,
  type PurchaseRepository,
} from '@flash-sale/domain';
import { Inject, Injectable } from '@nestjs/common';

import { createPrismaPersistenceContext } from '../prisma/prisma-persistence-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PurchaseFlowService implements PurchaseFlow {
  constructor(
    @Inject(FLASH_SALE_REPOSITORY)
    private readonly flashSaleRepository: FlashSaleRepository,
    @Inject(FLASH_SALE_RESERVATION)
    private readonly reservation: FlashSaleReservation,
    @Inject(PURCHASE_REPOSITORY)
    private readonly purchaseRepository: PurchaseRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: PurchaseFlowExecuteInput): Promise<PurchaseOutcome> {
    const flashSale = await this.flashSaleRepository.findById(input.flashSaleId);
    if (flashSale === null) {
      throw new FlashSaleNotFoundError();
    }

    const status = flashSale.getStatus(input.nowUtc);
    if (status === 'UPCOMING') {
      return 'SALE_NOT_STARTED';
    }
    if (status === 'ENDED') {
      return 'SALE_ENDED';
    }
    if (status === 'SOLD_OUT') {
      return 'SOLD_OUT';
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const ctx = createPrismaPersistenceContext(tx);

        const reserved = await this.reservation.tryReserve(input.flashSaleId, input.nowUtc, ctx);
        if (!reserved) {
          return 'SOLD_OUT';
        }

        const purchase = Purchase.create({
          flashSaleId: input.flashSaleId,
          id: input.purchaseId,
          userId: input.userId,
          purchasedAt: input.nowUtc,
        });

        await this.purchaseRepository.save(purchase, ctx);
        return 'SUCCESS';
      });
    } catch (error) {
      if (error instanceof PurchaseConflictError) {
        return 'ALREADY_PURCHASED';
      }
      throw error;
    }
  }
}
