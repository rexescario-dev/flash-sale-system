import {
  type FlashSaleId,
  FlashSaleNotFoundError,
  Purchase,
  type PurchaseId,
  type UserId,
} from '@flash-sale/domain';
import { randomUUID } from 'node:crypto';

import { PrismaFlashSaleRepository } from '../../src/flash-sale/prisma-flash-sale.repository';
import { PrismaFlashSaleReservation } from '../../src/flash-sale/prisma-flash-sale.reservation';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PrismaPurchaseRepository } from '../../src/purchase/prisma-purchase.repository';
import { PurchaseFlowService } from '../../src/purchase/purchase-flow.service';

describe('PurchaseFlowService integration (#20)', () => {
  const prisma = new PrismaService();
  const flashSaleRepository = new PrismaFlashSaleRepository(prisma);
  const reservation = new PrismaFlashSaleReservation(prisma);
  const purchaseRepository = new PrismaPurchaseRepository(prisma);
  const flow = new PurchaseFlowService(
    flashSaleRepository,
    reservation,
    purchaseRepository,
    prisma,
  );

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedSale(options: {
    endsAt: Date;
    remainingStock: number;
    startsAt: Date;
    suffix: string;
    totalStock: number;
  }): Promise<FlashSaleId> {
    const productId = `product-purchase-flow-${options.suffix}`;
    const flashSaleId = `sale-purchase-flow-${options.suffix}`;
    const now = new Date('2026-07-28T12:00:00.000Z');

    await prisma.product.create({
      data: {
        id: productId,
        name: 'Purchase Flow Integration Product',
        updatedAt: now,
      },
    });

    await prisma.flashSale.create({
      data: {
        id: flashSaleId,
        productId,
        endsAt: options.endsAt,
        remainingStock: options.remainingStock,
        startsAt: options.startsAt,
        totalStock: options.totalStock,
        updatedAt: now,
      },
    });

    return flashSaleId as FlashSaleId;
  }

  async function cleanup(suffix: string): Promise<void> {
    const productId = `product-purchase-flow-${suffix}`;
    const flashSaleId = `sale-purchase-flow-${suffix}`;
    await prisma.purchase.deleteMany({ where: { flashSaleId } });
    await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }

  async function remainingStock(flashSaleId: FlashSaleId): Promise<number> {
    const row = await prisma.flashSale.findUniqueOrThrow({ where: { id: flashSaleId } });
    return row.remainingStock;
  }

  async function purchaseCount(flashSaleId: FlashSaleId): Promise<number> {
    return prisma.purchase.count({ where: { flashSaleId } });
  }

  it('commits SUCCESS with decremented stock and a purchase row', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');

    try {
      const flashSaleId = await seedSale({
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 3,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        suffix,
        totalStock: 3,
      });

      const outcome = await flow.execute({
        flashSaleId,
        purchaseId: `purchase-${suffix}` as PurchaseId,
        userId: `user-${suffix}` as UserId,
        nowUtc,
      });

      expect(outcome).toBe('SUCCESS');
      expect(await remainingStock(flashSaleId)).toBe(2);
      expect(await purchaseCount(flashSaleId)).toBe(1);
    } finally {
      await cleanup(suffix);
    }
  });

  it('returns ALREADY_PURCHASED and restores stock after conflict rollback', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    const userId = `user-${suffix}` as UserId;
    const existingPurchaseId = `purchase-existing-${suffix}` as PurchaseId;
    const attemptPurchaseId = `purchase-dup-${suffix}` as PurchaseId;

    try {
      const flashSaleId = await seedSale({
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 1,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        suffix,
        totalStock: 1,
      });

      // Pre-seed an existing purchase (do not use PurchaseFlow for fixture setup).
      await purchaseRepository.save(
        Purchase.create({
          flashSaleId,
          id: existingPurchaseId,
          userId,
          purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
        }),
      );
      expect(await remainingStock(flashSaleId)).toBe(1);
      expect(await purchaseCount(flashSaleId)).toBe(1);

      // ACTIVE + stock available → tryReserve decrements → unique conflict → rollback.
      const outcome = await flow.execute({
        flashSaleId,
        purchaseId: attemptPurchaseId,
        userId,
        nowUtc,
      });

      expect(outcome).toBe('ALREADY_PURCHASED');
      expect(await remainingStock(flashSaleId)).toBe(1);
      expect(await purchaseCount(flashSaleId)).toBe(1);
      expect(await prisma.purchase.findUnique({ where: { id: attemptPurchaseId } })).toBeNull();
      expect(
        await prisma.purchase.findUnique({ where: { id: existingPurchaseId } }),
      ).not.toBeNull();
    } finally {
      await cleanup(suffix);
    }
  });

  it('returns SALE_NOT_STARTED with no mutation', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T09:00:00.000Z');

    try {
      const flashSaleId = await seedSale({
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 2,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        suffix,
        totalStock: 2,
      });

      await expect(
        flow.execute({
          flashSaleId,
          purchaseId: `purchase-${suffix}` as PurchaseId,
          userId: `user-${suffix}` as UserId,
          nowUtc,
        }),
      ).resolves.toBe('SALE_NOT_STARTED');
      expect(await remainingStock(flashSaleId)).toBe(2);
      expect(await purchaseCount(flashSaleId)).toBe(0);
    } finally {
      await cleanup(suffix);
    }
  });

  it('returns SALE_ENDED with no mutation', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T15:00:00.000Z');

    try {
      const flashSaleId = await seedSale({
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 2,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        suffix,
        totalStock: 2,
      });

      await expect(
        flow.execute({
          flashSaleId,
          purchaseId: `purchase-${suffix}` as PurchaseId,
          userId: `user-${suffix}` as UserId,
          nowUtc,
        }),
      ).resolves.toBe('SALE_ENDED');
      expect(await remainingStock(flashSaleId)).toBe(2);
      expect(await purchaseCount(flashSaleId)).toBe(0);
    } finally {
      await cleanup(suffix);
    }
  });

  it('returns SOLD_OUT when inventory is exhausted before the flow begins', async () => {
    const suffix = randomUUID();
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');

    try {
      const flashSaleId = await seedSale({
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 1,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        suffix,
        totalStock: 1,
      });

      // Exhaust inventory before execute — proves pre-check SOLD_OUT (no txn purchase path).
      // In-txn ACTIVE→tryReserve(false) is unit-covered; concurrent reservation races are #19.
      await expect(reservation.tryReserve(flashSaleId, nowUtc)).resolves.toBe(true);
      expect(await remainingStock(flashSaleId)).toBe(0);

      await expect(
        flow.execute({
          flashSaleId,
          purchaseId: `purchase-${suffix}` as PurchaseId,
          userId: `user-${suffix}` as UserId,
          nowUtc,
        }),
      ).resolves.toBe('SOLD_OUT');
      expect(await purchaseCount(flashSaleId)).toBe(0);
      expect(await remainingStock(flashSaleId)).toBe(0);
    } finally {
      await cleanup(suffix);
    }
  });

  it('throws FlashSaleNotFoundError for an unknown flash sale id', async () => {
    await expect(
      flow.execute({
        flashSaleId: `sale-missing-${randomUUID()}` as FlashSaleId,
        purchaseId: `purchase-missing-${randomUUID()}` as PurchaseId,
        userId: `user-missing-${randomUUID()}` as UserId,
        nowUtc: new Date('2026-07-28T12:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(FlashSaleNotFoundError);
  });
});
