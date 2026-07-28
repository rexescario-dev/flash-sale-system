import {
  type FlashSaleId,
  Purchase,
  PurchaseConflictError,
  type PurchaseId,
  type UserId,
} from '@flash-sale/domain';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../src/prisma/prisma.service';
import { PrismaPurchaseRepository } from '../../src/purchase/prisma-purchase.repository';

describe('PrismaPurchaseRepository integration (#18)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaPurchaseRepository(prisma);

  beforeAll(async () => {
    // PrismaService skips eager connect when NODE_ENV=test; connect explicitly for integration.
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedFlashSale(suffix: string): Promise<FlashSaleId> {
    const productId = `product-purchase-repo-${suffix}`;
    const flashSaleId = `sale-purchase-repo-${suffix}`;
    const now = new Date('2026-07-28T12:00:00.000Z');

    await prisma.product.create({
      data: {
        id: productId,
        name: 'Purchase Repository Integration Product',
        updatedAt: now,
      },
    });

    await prisma.flashSale.create({
      data: {
        id: flashSaleId,
        productId,
        endsAt: new Date('2026-07-28T14:00:00.000Z'),
        remainingStock: 4,
        startsAt: new Date('2026-07-28T10:00:00.000Z'),
        totalStock: 9,
        updatedAt: now,
      },
    });

    return flashSaleId as FlashSaleId;
  }

  async function cleanupFlashSale(suffix: string): Promise<void> {
    const productId = `product-purchase-repo-${suffix}`;
    const flashSaleId = `sale-purchase-repo-${suffix}`;

    await prisma.purchase.deleteMany({ where: { flashSaleId } });
    await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }

  it('saves and loads a Purchase by FlashSale and user from PostgreSQL', async () => {
    const suffix = randomUUID();
    const purchaseId = `purchase-repo-${suffix}` as PurchaseId;
    const userId = `user-repo-${suffix}` as UserId;
    const purchasedAt = new Date('2026-07-28T11:00:00.000Z');

    try {
      const flashSaleId = await seedFlashSale(suffix);

      await repo.save(
        Purchase.create({
          flashSaleId,
          id: purchaseId,
          userId,
          purchasedAt,
        }),
      );

      const purchase = await repo.findByFlashSaleAndUser(flashSaleId, userId);

      expect(purchase).not.toBeNull();
      expect(purchase!.getId()).toBe(purchaseId);
      expect(purchase!.getFlashSaleId()).toBe(flashSaleId);
      expect(purchase!.getUserId()).toBe(userId);
      expect(purchase!.getPurchasedAt().toISOString()).toBe(purchasedAt.toISOString());
    } finally {
      await cleanupFlashSale(suffix);
    }
  });

  it('returns null for a missing FlashSale and user pair', async () => {
    await expect(
      repo.findByFlashSaleAndUser(
        `sale-missing-${randomUUID()}` as FlashSaleId,
        `user-missing-${randomUUID()}` as UserId,
      ),
    ).resolves.toBeNull();
  });

  it('maps duplicate FlashSale and user purchases to PurchaseConflictError', async () => {
    const suffix = randomUUID();
    const userId = `user-repo-${suffix}` as UserId;

    try {
      const flashSaleId = await seedFlashSale(suffix);

      await repo.save(
        Purchase.create({
          flashSaleId,
          id: `purchase-first-${suffix}` as PurchaseId,
          userId,
          purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
        }),
      );

      const duplicate = Purchase.create({
        flashSaleId,
        id: `purchase-duplicate-${suffix}` as PurchaseId,
        userId,
        purchasedAt: new Date('2026-07-28T11:01:00.000Z'),
      });

      try {
        await repo.save(duplicate);
        throw new Error('Expected duplicate Purchase save to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(PurchaseConflictError);
        expect(error).toMatchObject({
          code: 'PURCHASE_CONFLICT',
          name: 'PurchaseConflictError',
        });
      }
    } finally {
      await cleanupFlashSale(suffix);
    }
  });
});
