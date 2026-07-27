import type { FlashSale as PrismaFlashSale } from '@prisma/client';

import { FlashSaleValidationError } from '@flash-sale/domain';

import { FlashSaleMapper } from './flash-sale.mapper';

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

describe('FlashSaleMapper', () => {
  it('maps a valid Prisma row to FlashSale via reconstitute', () => {
    const row = buildRow({ id: '  sale-padded  ', productId: '  product-padded  ' });
    const sale = FlashSaleMapper.toDomain(row);

    expect(sale.getId()).toBe('  sale-padded  ');
    expect(sale.getProductId()).toBe('  product-padded  ');
    expect(sale.getEndsAt().toISOString()).toBe('2026-07-28T14:00:00.000Z');
    expect(sale.getRemainingStock()).toBe(3);
    expect(sale.getStartsAt().toISOString()).toBe('2026-07-28T10:00:00.000Z');
    expect(sale.getTotalStock()).toBe(10);
  });

  it('propagates FlashSaleValidationError for invalid persisted state', () => {
    const row = buildRow({ remainingStock: 11, totalStock: 10 });

    try {
      FlashSaleMapper.toDomain(row);
      fail('Expected FlashSaleValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(FlashSaleValidationError);
      expect((error as FlashSaleValidationError).code).toBe('REMAINING_STOCK_EXCEEDS_TOTAL');
    }
  });
});
