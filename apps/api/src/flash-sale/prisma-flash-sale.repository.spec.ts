import type { FlashSale as PrismaFlashSale } from '@prisma/client';

import { type FlashSaleId } from '@flash-sale/domain';

import type { PrismaService } from '../prisma/prisma.service';

import { PrismaFlashSaleRepository } from './prisma-flash-sale.repository';

describe('PrismaFlashSaleRepository', () => {
  const saleId = 'sale-1' as FlashSaleId;

  function buildRow(overrides: Partial<PrismaFlashSale> = {}): PrismaFlashSale {
    const now = new Date('2026-07-28T12:00:00.000Z');
    return {
      id: 'sale-1',
      productId: 'product-1',
      createdAt: now,
      endsAt: new Date('2026-07-28T14:00:00.000Z'),
      remainingStock: 3,
      startsAt: new Date('2026-07-28T10:00:00.000Z'),
      totalStock: 10,
      updatedAt: now,
      ...overrides,
    };
  }

  it('returns null when Prisma findUnique returns null', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = { flashSale: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaFlashSaleRepository(prisma);

    await expect(repo.findById(saleId)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: saleId } });
  });

  it('returns a FlashSale when a row exists', async () => {
    const findUnique = jest.fn().mockResolvedValue(buildRow());
    const prisma = { flashSale: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaFlashSaleRepository(prisma);

    const sale = await repo.findById(saleId);

    expect(sale).not.toBeNull();
    expect(sale!.getId()).toBe('sale-1');
    expect(sale!.getRemainingStock()).toBe(3);
    expect(sale!.getTotalStock()).toBe(10);
  });

  it('propagates FlashSaleValidationError when mapped state is invalid', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue(buildRow({ remainingStock: 11, totalStock: 10 }));
    const prisma = { flashSale: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaFlashSaleRepository(prisma);

    await expect(repo.findById(saleId)).rejects.toMatchObject({
      code: 'REMAINING_STOCK_EXCEEDS_TOTAL',
    });
  });
});
