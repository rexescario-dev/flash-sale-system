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

  it('findByIdWithProduct returns sale + product; null description → domain undefined', async () => {
    const suffix = randomUUID();
    const productId = `product-repo-wp-${suffix}`;
    const flashSaleId = `sale-repo-wp-${suffix}`;
    const now = new Date('2026-07-28T12:00:00.000Z');
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');

    try {
      await prisma.product.create({
        data: {
          id: productId,
          description: null,
          name: 'With Product',
          updatedAt: now,
        },
      });
      await prisma.flashSale.create({
        data: {
          id: flashSaleId,
          productId,
          endsAt,
          remainingStock: 2,
          startsAt,
          totalStock: 2,
          updatedAt: now,
        },
      });

      const loaded = await repo.findByIdWithProduct(flashSaleId as FlashSaleId);
      expect(loaded).not.toBeNull();
      expect(loaded!.flashSale.getId()).toBe(flashSaleId);
      expect(loaded!.product.getId()).toBe(productId);
      expect(loaded!.product.getName()).toBe('With Product');
      expect(loaded!.product.getDescription()).toBeUndefined();
    } finally {
      await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
  });

  it('findAllForCatalog orders by startsAt ASC and includes products', async () => {
    const suffix = randomUUID();
    const earlyId = `sale-repo-cat-early-${suffix}`;
    const lateId = `sale-repo-cat-late-${suffix}`;
    const productEarly = `product-repo-cat-early-${suffix}`;
    const productLate = `product-repo-cat-late-${suffix}`;
    const now = new Date('2026-07-28T12:00:00.000Z');

    try {
      await prisma.product.create({
        data: { id: productLate, name: 'Late', updatedAt: now },
      });
      await prisma.product.create({
        data: { id: productEarly, name: 'Early', updatedAt: now },
      });
      await prisma.flashSale.create({
        data: {
          id: lateId,
          productId: productLate,
          endsAt: new Date('2026-07-28T18:00:00.000Z'),
          remainingStock: 1,
          startsAt: new Date('2026-07-28T14:00:00.000Z'),
          totalStock: 1,
          updatedAt: now,
        },
      });
      await prisma.flashSale.create({
        data: {
          id: earlyId,
          productId: productEarly,
          endsAt: new Date('2026-07-28T12:00:00.000Z'),
          remainingStock: 1,
          startsAt: new Date('2026-07-28T10:00:00.000Z'),
          totalStock: 1,
          updatedAt: now,
        },
      });

      const catalog = await repo.findAllForCatalog();
      const ours = catalog.filter((row) => [earlyId, lateId].includes(row.flashSale.getId()));
      // Distinct startsAt values — do not assert order for equal timestamps (unspecified).
      expect(ours.map((row) => row.flashSale.getId())).toEqual([earlyId, lateId]);
      expect(ours[0]!.product.getName()).toBe('Early');
      expect(ours[1]!.product.getName()).toBe('Late');
    } finally {
      await prisma.flashSale.deleteMany({ where: { id: { in: [earlyId, lateId] } } });
      await prisma.product.deleteMany({ where: { id: { in: [productEarly, productLate] } } });
    }
  });
});
