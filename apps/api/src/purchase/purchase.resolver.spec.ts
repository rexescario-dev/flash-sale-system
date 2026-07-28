import {
  FlashSale,
  type FlashSaleId,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
  type ProductId,
  Purchase,
  type PurchaseFlow,
  type PurchaseId,
  type PurchaseRepository,
  type UserId,
} from '@flash-sale/domain';

import type { Clock } from '../graphql/clock';

import { PurchaseResolver } from './purchase.resolver';

describe('PurchaseResolver.myPurchase', () => {
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const clock: Clock = { nowUtc: () => nowUtc };

  const sale = FlashSale.reconstitute({
    id: 'sale-1' as FlashSaleId,
    productId: 'product-1' as ProductId,
    endsAt: new Date('2026-07-28T14:00:00.000Z'),
    remainingStock: 3,
    startsAt: new Date('2026-07-28T10:00:00.000Z'),
    totalStock: 5,
  });

  function build(
    flashSales: Partial<FlashSaleRepository>,
    purchases: Partial<PurchaseRepository>,
    flow: Partial<PurchaseFlow> = {},
  ) {
    return new PurchaseResolver(
      flashSales as FlashSaleRepository,
      purchases as PurchaseRepository,
      flow as PurchaseFlow,
      clock,
    );
  }

  it('throws FlashSaleNotFoundError when sale missing (before purchase lookup)', async () => {
    const flashSales = { findById: jest.fn().mockResolvedValue(null) };
    const purchases = { findByFlashSaleAndUser: jest.fn() };
    const resolver = build(flashSales, purchases);

    await expect(resolver.myPurchase('sale-1', 'user-1')).rejects.toBeInstanceOf(
      FlashSaleNotFoundError,
    );
    expect(purchases.findByFlashSaleAndUser).not.toHaveBeenCalled();
  });

  it('returns purchased false when sale exists and no purchase', async () => {
    const resolver = build(
      { findById: jest.fn().mockResolvedValue(sale) },
      { findByFlashSaleAndUser: jest.fn().mockResolvedValue(null) },
    );

    await expect(resolver.myPurchase('sale-1', 'user-1')).resolves.toEqual({
      purchaseId: null,
      purchased: false,
      purchasedAt: null,
    });
  });

  it('returns purchased true with ids when purchase exists', async () => {
    const purchasedAt = new Date('2026-07-28T11:00:00.000Z');
    const purchase = Purchase.create({
      flashSaleId: 'sale-1' as FlashSaleId,
      id: 'purchase-1' as PurchaseId,
      userId: 'user-1' as UserId,
      purchasedAt,
    });
    const resolver = build(
      { findById: jest.fn().mockResolvedValue(sale) },
      { findByFlashSaleAndUser: jest.fn().mockResolvedValue(purchase) },
    );

    await expect(resolver.myPurchase('sale-1', 'user-1')).resolves.toEqual({
      purchaseId: 'purchase-1',
      purchased: true,
      purchasedAt,
    });
  });

  it('rejects whitespace-only userId before ports', async () => {
    const findById = jest.fn();
    const findByFlashSaleAndUser = jest.fn();
    const resolver = build({ findById }, { findByFlashSaleAndUser });

    await expect(resolver.myPurchase('sale-1', '   ')).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(findById).not.toHaveBeenCalled();
    expect(findByFlashSaleAndUser).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only flashSaleId before ports', async () => {
    const findById = jest.fn();
    const findByFlashSaleAndUser = jest.fn();
    const resolver = build({ findById }, { findByFlashSaleAndUser });

    await expect(resolver.myPurchase('   ', 'user-1')).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(findById).not.toHaveBeenCalled();
    expect(findByFlashSaleAndUser).not.toHaveBeenCalled();
  });

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only flashSaleId %j before ports',
    async (raw) => {
      const findById = jest.fn();
      const findByFlashSaleAndUser = jest.fn();
      const resolver = build({ findById }, { findByFlashSaleAndUser });

      await expect(resolver.myPurchase(raw, 'user-1')).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(findById).not.toHaveBeenCalled();
      expect(findByFlashSaleAndUser).not.toHaveBeenCalled();
    },
  );

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only userId %j before ports',
    async (raw) => {
      const findById = jest.fn();
      const findByFlashSaleAndUser = jest.fn();
      const resolver = build({ findById }, { findByFlashSaleAndUser });

      await expect(resolver.myPurchase('sale-1', raw)).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(findById).not.toHaveBeenCalled();
      expect(findByFlashSaleAndUser).not.toHaveBeenCalled();
    },
  );
});

describe('PurchaseResolver.purchaseItem', () => {
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const clock: Clock = { nowUtc: () => nowUtc };

  function build(flow: Partial<PurchaseFlow>) {
    return new PurchaseResolver(
      { findById: jest.fn() } as unknown as FlashSaleRepository,
      { findByFlashSaleAndUser: jest.fn() } as unknown as PurchaseRepository,
      flow as PurchaseFlow,
      clock,
    );
  }

  it('validates ids before calling PurchaseFlow', async () => {
    const execute = jest.fn();
    const resolver = build({ execute });
    await expect(resolver.purchaseItem('sale-1', '   ')).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only flashSaleId %j before calling PurchaseFlow',
    async (raw) => {
      const execute = jest.fn();
      const resolver = build({ execute });

      await expect(resolver.purchaseItem(raw, 'user-1')).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only userId %j before calling PurchaseFlow',
    async (raw) => {
      const execute = jest.fn();
      const resolver = build({ execute });

      await expect(resolver.purchaseItem('sale-1', raw)).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('passes generated purchaseId and clock nowUtc into execute before returning', async () => {
    const execute = jest.fn().mockImplementation(async (input) => {
      expect(input.purchaseId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(input.nowUtc).toBe(nowUtc);
      return 'SUCCESS';
    });
    const resolver = build({ execute });
    const result = await resolver.purchaseItem('sale-1', 'user-1');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].purchaseId).toBe(result.purchaseId);
    expect(result).toEqual({
      purchaseId: expect.any(String),
      message: 'Purchase completed',
      status: 'SUCCESS',
    });
  });

  it('does not accept a client purchaseId argument (TypeScript / resolver arity)', () => {
    expect(PurchaseResolver.prototype.purchaseItem.length).toBe(2);
  });

  it.each([
    ['ALREADY_PURCHASED', 'User already purchased this flash sale'],
    ['SALE_NOT_STARTED', 'Flash sale has not started'],
    ['SALE_ENDED', 'Flash sale has ended'],
    ['SOLD_OUT', 'Flash sale is sold out'],
  ] as const)('maps %s with null purchaseId', async (outcome, message) => {
    const resolver = build({ execute: jest.fn().mockResolvedValue(outcome) });
    await expect(resolver.purchaseItem('sale-1', 'user-1')).resolves.toEqual({
      purchaseId: null,
      message,
      status: outcome,
    });
  });

  it('propagates FlashSaleNotFoundError', async () => {
    const resolver = build({
      execute: jest.fn().mockRejectedValue(new FlashSaleNotFoundError()),
    });
    await expect(resolver.purchaseItem('sale-1', 'user-1')).rejects.toBeInstanceOf(
      FlashSaleNotFoundError,
    );
  });
});
