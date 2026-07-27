import type { FlashSaleId } from '@flash-sale/domain';

import { randomUUID } from 'node:crypto';

import { PrismaFlashSaleRepository } from '../../src/flash-sale/prisma-flash-sale.repository';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('PrismaFlashSaleRepository integration (#17)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaFlashSaleRepository(prisma);

  beforeAll(async () => {
    // PrismaService skips eager connect when NODE_ENV=test; connect explicitly for integration.
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('loads an existing FlashSale from PostgreSQL', async () => {
    const suffix = randomUUID();
    const productId = `product-repo-${suffix}`;
    const flashSaleId = `sale-repo-${suffix}`;
    const now = new Date('2026-07-28T12:00:00.000Z');
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');

    try {
      await prisma.product.create({
        data: {
          id: productId,
          name: 'Repo Integration Product',
          updatedAt: now,
        },
      });

      await prisma.flashSale.create({
        data: {
          id: flashSaleId,
          productId,
          endsAt,
          remainingStock: 4,
          startsAt,
          totalStock: 9,
          updatedAt: now,
        },
      });

      const sale = await repo.findById(flashSaleId as FlashSaleId);

      expect(sale).not.toBeNull();
      expect(sale!.getId()).toBe(flashSaleId);
      expect(sale!.getProductId()).toBe(productId);
      expect(sale!.getEndsAt().toISOString()).toBe(endsAt.toISOString());
      expect(sale!.getRemainingStock()).toBe(4);
      expect(sale!.getStartsAt().toISOString()).toBe(startsAt.toISOString());
      expect(sale!.getTotalStock()).toBe(9);
    } finally {
      await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
  });

  it('returns null for a missing FlashSale id', async () => {
    const missingId = `sale-missing-${randomUUID()}` as FlashSaleId;
    await expect(repo.findById(missingId)).resolves.toBeNull();
  });
});
