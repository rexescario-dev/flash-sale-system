import type { FlashSaleId, ProductId } from '../ids.js';

import {
  FlashSaleValidationError,
  type FlashSaleValidationErrorCode,
} from './flash-sale.errors.js';
import { FlashSale } from './flash-sale.js';

const asFlashSaleId = (value: string): FlashSaleId => value as FlashSaleId;
const asProductId = (value: string): ProductId => value as ProductId;

const id = asFlashSaleId('sale-1');
const productId = asProductId('product-1');
const endsAt = new Date('2026-07-26T12:00:00.000Z');
const startsAt = new Date('2026-07-26T10:00:00.000Z');

function expectValidationError(action: () => unknown, code: FlashSaleValidationErrorCode): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(FlashSaleValidationError);
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected FlashSaleValidationError with code ${code}`);
}

describe('FlashSale.create', () => {
  it('creates a fully stocked sale', () => {
    const sale = FlashSale.create({
      id,
      productId,
      endsAt,
      startsAt,
      totalStock: 100,
    });

    expect(sale.getId()).toBe(id);
    expect(sale.getProductId()).toBe(productId);
    expect(sale.getStartsAt().getTime()).toBe(startsAt.getTime());
    expect(sale.getEndsAt().getTime()).toBe(endsAt.getTime());
    expect(sale.getTotalStock()).toBe(100);
    expect(sale.getRemainingStock()).toBe(100);
    expect(sale.getRemainingStock()).toBe(sale.getTotalStock());
  });

  it('preserves id whitespace without trimming valid ids', () => {
    const padded = asFlashSaleId('  sale-123  ');
    const sale = FlashSale.create({
      id: padded,
      productId,
      endsAt,
      startsAt,
      totalStock: 10,
    });

    expect(sale.getId()).toBe(padded);
  });

  it('returns defensive Date copies from getters', () => {
    const sale = FlashSale.create({
      id,
      productId,
      endsAt,
      startsAt,
      totalStock: 10,
    });

    const returnedEndsAt = sale.getEndsAt();
    returnedEndsAt.setTime(0);
    const returnedStartsAt = sale.getStartsAt();
    returnedStartsAt.setTime(0);

    expect(sale.getEndsAt().getTime()).toBe(endsAt.getTime());
    expect(sale.getEndsAt().getTime()).not.toBe(0);
    expect(sale.getStartsAt().getTime()).toBe(startsAt.getTime());
    expect(sale.getStartsAt().getTime()).not.toBe(0);
  });

  it('rejects empty id', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id: asFlashSaleId(''),
          productId,
          endsAt,
          startsAt,
          totalStock: 10,
        }),
      'EMPTY_ID',
    );
  });

  it('rejects whitespace-only id', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id: asFlashSaleId('   '),
          productId,
          endsAt,
          startsAt,
          totalStock: 10,
        }),
      'EMPTY_ID',
    );
  });

  it('rejects empty productId', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId: asProductId(''),
          endsAt,
          startsAt,
          totalStock: 10,
        }),
      'EMPTY_PRODUCT_ID',
    );
  });

  it('rejects whitespace-only productId', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId: asProductId('   '),
          endsAt,
          startsAt,
          totalStock: 10,
        }),
      'EMPTY_PRODUCT_ID',
    );
  });

  it('rejects startsAt equal to endsAt', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId,
          endsAt: startsAt,
          startsAt,
          totalStock: 10,
        }),
      'INVALID_SALE_WINDOW',
    );
  });

  it('rejects startsAt after endsAt', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId,
          endsAt: startsAt,
          startsAt: endsAt,
          totalStock: 10,
        }),
      'INVALID_SALE_WINDOW',
    );
  });

  it('rejects invalid Date instances as INVALID_SALE_WINDOW', () => {
    expectValidationError(
      () =>
        FlashSale.create({
          id,
          productId,
          endsAt,
          startsAt: new Date('invalid'),
          totalStock: 10,
        }),
      'INVALID_SALE_WINDOW',
    );
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid totalStock: %p',
    (totalStock) => {
      expectValidationError(
        () =>
          FlashSale.create({
            id,
            productId,
            endsAt,
            startsAt,
            totalStock,
          }),
        'INVALID_TOTAL_STOCK',
      );
    },
  );
});

describe('FlashSale.reconstitute', () => {
  it('restores partial stock', () => {
    const sale = FlashSale.reconstitute({
      id,
      productId,
      endsAt,
      remainingStock: 37,
      startsAt,
      totalStock: 100,
    });

    expect(sale.getTotalStock()).toBe(100);
    expect(sale.getRemainingStock()).toBe(37);
  });

  it('rejects empty id', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id: asFlashSaleId(''),
          productId,
          endsAt,
          remainingStock: 10,
          startsAt,
          totalStock: 10,
        }),
      'EMPTY_ID',
    );
  });

  it('rejects invalid sale window', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id,
          productId,
          endsAt: startsAt,
          remainingStock: 10,
          startsAt: endsAt,
          totalStock: 10,
        }),
      'INVALID_SALE_WINDOW',
    );
  });

  it('rejects invalid totalStock', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id,
          productId,
          endsAt,
          remainingStock: 0,
          startsAt,
          totalStock: 0,
        }),
      'INVALID_TOTAL_STOCK',
    );
  });

  it('rejects negative remainingStock', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id,
          productId,
          endsAt,
          remainingStock: -1,
          startsAt,
          totalStock: 100,
        }),
      'INVALID_REMAINING_STOCK',
    );
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-integer remainingStock: %p',
    (remainingStock) => {
      expectValidationError(
        () =>
          FlashSale.reconstitute({
            id,
            productId,
            endsAt,
            remainingStock,
            startsAt,
            totalStock: 100,
          }),
        'INVALID_REMAINING_STOCK',
      );
    },
  );

  it('rejects remainingStock greater than totalStock', () => {
    expectValidationError(
      () =>
        FlashSale.reconstitute({
          id,
          productId,
          endsAt,
          remainingStock: 11,
          startsAt,
          totalStock: 10,
        }),
      'REMAINING_STOCK_EXCEEDS_TOTAL',
    );
  });
});

describe('FlashSale.getStatus', () => {
  const beforeStart = new Date('2026-07-26T09:59:59.999Z');
  const atStart = new Date('2026-07-26T10:00:00.000Z');
  const during = new Date('2026-07-26T11:00:00.000Z');
  const atEnd = new Date('2026-07-26T12:00:00.000Z');
  const afterEnd = new Date('2026-07-26T12:00:00.001Z');

  function saleWithStock(remainingStock: number): FlashSale {
    if (remainingStock === 100) {
      return FlashSale.create({
        id,
        productId,
        endsAt,
        startsAt,
        totalStock: 100,
      });
    }

    return FlashSale.reconstitute({
      id,
      productId,
      endsAt,
      remainingStock,
      startsAt,
      totalStock: 100,
    });
  }

  it.each([
    {
      expected: 'UPCOMING',
      label: 'before start, stock > 0',
      now: beforeStart,
      remainingStock: 100,
    },
    {
      expected: 'UPCOMING',
      label: 'before start, stock === 0',
      now: beforeStart,
      remainingStock: 0,
    },
    {
      expected: 'ACTIVE',
      label: 'at start, stock > 0',
      now: atStart,
      remainingStock: 100,
    },
    {
      expected: 'SOLD_OUT',
      label: 'at start, stock === 0',
      now: atStart,
      remainingStock: 0,
    },
    {
      expected: 'ACTIVE',
      label: 'during window, stock > 0',
      now: during,
      remainingStock: 100,
    },
    {
      expected: 'SOLD_OUT',
      label: 'during window, stock === 0',
      now: during,
      remainingStock: 0,
    },
    {
      expected: 'ENDED',
      label: 'at end, stock > 0',
      now: atEnd,
      remainingStock: 100,
    },
    {
      expected: 'ENDED',
      label: 'at end, stock === 0',
      now: atEnd,
      remainingStock: 0,
    },
    {
      expected: 'ENDED',
      label: 'after end, stock > 0',
      now: afterEnd,
      remainingStock: 100,
    },
    {
      expected: 'ENDED',
      label: 'after end, stock === 0',
      now: afterEnd,
      remainingStock: 0,
    },
  ] as const)('$label → $expected', ({ expected, now, remainingStock }) => {
    const sale = saleWithStock(remainingStock);
    expect(sale.getStatus(now)).toBe(expected);
  });

  it('throws INVALID_NOW when Date#getTime() is NaN', () => {
    const sale = saleWithStock(100);
    expectValidationError(() => sale.getStatus(new Date('invalid')), 'INVALID_NOW');
  });

  it('compares absolute instants regardless of timezone offset', () => {
    const sale = saleWithStock(100);

    // 19:00+08:00 == 11:00Z, which is inside [10:00Z, 12:00Z)
    expect(sale.getStatus(new Date('2026-07-26T19:00:00+08:00'))).toBe('ACTIVE');
  });

  it('does not mutate remainingStock when resolving status', () => {
    const sale = saleWithStock(100);
    sale.getStatus(during);
    expect(sale.getRemainingStock()).toBe(100);
    sale.getStatus(afterEnd);
    expect(sale.getRemainingStock()).toBe(100);
  });
});
