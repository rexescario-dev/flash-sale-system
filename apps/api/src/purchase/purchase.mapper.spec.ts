import type { Purchase as PrismaPurchase } from '@prisma/client';

import {
  type FlashSaleId,
  Purchase,
  type PurchaseId,
  PurchaseValidationError,
  type UserId,
} from '@flash-sale/domain';

import { PurchaseMapper } from './purchase.mapper';

function buildRow(overrides: Partial<PrismaPurchase> = {}): PrismaPurchase {
  const now = new Date('2026-07-28T12:00:00.000Z');
  return {
    flashSaleId: 'sale-1',
    id: 'purchase-1',
    userId: 'user-1',
    createdAt: now,
    purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    updatedAt: now,
    ...overrides,
  };
}

describe('PurchaseMapper', () => {
  it('maps a valid Prisma row to Purchase via reconstitute', () => {
    const row = buildRow({
      flashSaleId: '  sale-padded  ',
      id: '  purchase-padded  ',
      userId: '  user-padded  ',
    });
    const purchase = PurchaseMapper.toDomain(row);

    expect(purchase.getId()).toBe('  purchase-padded  ');
    expect(purchase.getFlashSaleId()).toBe('  sale-padded  ');
    expect(purchase.getUserId()).toBe('  user-padded  ');
    expect(purchase.getPurchasedAt().toISOString()).toBe('2026-07-28T11:00:00.000Z');
  });

  it('maps a domain Purchase to Prisma create data', () => {
    const purchase = Purchase.create({
      flashSaleId: 'sale-1' as FlashSaleId,
      id: 'purchase-1' as PurchaseId,
      userId: 'user-1' as UserId,
      purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    });

    expect(PurchaseMapper.toPersistence(purchase)).toEqual({
      flashSaleId: 'sale-1',
      id: 'purchase-1',
      userId: 'user-1',
      purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    });
  });

  it('propagates PurchaseValidationError for invalid persisted state', () => {
    const row = buildRow({ id: '   ' });

    try {
      PurchaseMapper.toDomain(row);
      fail('Expected PurchaseValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseValidationError);
      expect((error as PurchaseValidationError).code).toBe('EMPTY_ID');
    }
  });
});
