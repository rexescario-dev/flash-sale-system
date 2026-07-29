import {
  FlashSale,
  type FlashSaleId,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
  Product,
  type ProductId,
} from '@flash-sale/domain';

import type { FlashSaleCacheSnapshot, FlashSaleQueryCache } from './flash-sale-query.cache';

import { FlashSaleResolver } from './flash-sale.resolver';

describe('FlashSaleResolver', () => {
  const product = Product.create({
    id: 'product-1' as ProductId,
    name: 'Widget',
  });
  const flashSale = FlashSale.reconstitute({
    id: 'sale-1' as FlashSaleId,
    productId: 'product-1' as ProductId,
    endsAt: new Date('2026-07-28T14:00:00.000Z'),
    remainingStock: 3,
    startsAt: new Date('2026-07-28T10:00:00.000Z'),
    totalStock: 5,
  });

  function build(
    cache: Partial<FlashSaleQueryCache>,
    flashSales: Partial<FlashSaleRepository> = {},
  ) {
    return new FlashSaleResolver(
      {
        findById: jest.fn(),
        findAllForCatalog: jest.fn(),
        findByIdWithProduct: jest.fn().mockResolvedValue({ flashSale, product }),
        ...flashSales,
      } as FlashSaleRepository,
      cache as FlashSaleQueryCache,
    );
  }

  it('maps cached snapshot dates and nested product to GraphQL', async () => {
    const snapshot: FlashSaleCacheSnapshot = {
      id: 'sale-1',
      endsAt: '2026-07-28T14:00:00.000Z',
      remainingStock: 3,
      startsAt: '2026-07-28T10:00:00.000Z',
      status: 'ACTIVE',
      totalStock: 5,
    };
    const getById = jest.fn().mockResolvedValue(snapshot);
    const findByIdWithProduct = jest.fn().mockResolvedValue({ flashSale, product });
    const resolver = build({ getById }, { findByIdWithProduct });

    const result = await resolver.flashSale('sale-1');

    expect(getById).toHaveBeenCalledWith('sale-1');
    expect(findByIdWithProduct).toHaveBeenCalledWith('sale-1');
    expect(result).toEqual({
      id: 'sale-1',
      endsAt: new Date('2026-07-28T14:00:00.000Z'),
      product: {
        id: 'product-1',
        description: null,
        name: 'Widget',
      },
      remainingStock: 3,
      startsAt: new Date('2026-07-28T10:00:00.000Z'),
      status: 'ACTIVE',
      totalStock: 5,
    });
    expect(result).not.toHaveProperty('productId');
  });

  it('throws FlashSaleNotFoundError when missing', async () => {
    const resolver = build({
      getById: jest.fn().mockResolvedValue(null),
    });
    await expect(resolver.flashSale('missing')).rejects.toBeInstanceOf(FlashSaleNotFoundError);
  });

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only id %j before cache',
    async (raw) => {
      const getById = jest.fn();
      const findByIdWithProduct = jest.fn();
      const resolver = build({ getById }, { findByIdWithProduct });

      await expect(resolver.flashSale(raw)).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(getById).not.toHaveBeenCalled();
      expect(findByIdWithProduct).not.toHaveBeenCalled();
    },
  );
});
