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
  function build(
    cache: Partial<FlashSaleQueryCache>,
    flashSales: Partial<FlashSaleRepository> = {},
    nowUtc = new Date('2026-07-28T12:00:00.000Z'),
  ) {
    return new FlashSaleResolver(
      { nowUtc: () => nowUtc },
      {
        findById: jest.fn(),
        findAllForCatalog: jest.fn(),
        findByIdWithProduct: jest.fn(),
        ...flashSales,
      } as FlashSaleRepository,
      cache as FlashSaleQueryCache,
    );
  }

  it('maps cached snapshot dates and product to GraphQL', async () => {
    const snapshot: FlashSaleCacheSnapshot = {
      id: 'sale-1',
      endsAt: '2026-07-28T14:00:00.000Z',
      product: {
        id: 'product-1',
        description: null,
        name: 'Widget',
      },
      remainingStock: 3,
      startsAt: '2026-07-28T10:00:00.000Z',
      status: 'ACTIVE',
      totalStock: 5,
    };
    const getById = jest.fn().mockResolvedValue(snapshot);
    const resolver = build({ getById });

    const result = await resolver.flashSale('sale-1');

    expect(getById).toHaveBeenCalledWith('sale-1');
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
      const resolver = build({ getById });

      await expect(resolver.flashSale(raw)).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(getById).not.toHaveBeenCalled();
    },
  );

  it('flashSales uses only findAllForCatalog and maps preloaded products', async () => {
    const findAllForCatalog = jest.fn().mockResolvedValue([
      {
        flashSale: FlashSale.reconstitute({
          id: 'sale-early' as FlashSaleId,
          productId: 'p1' as ProductId,
          endsAt: new Date('2026-07-28T14:00:00.000Z'),
          remainingStock: 1,
          startsAt: new Date('2026-07-28T10:00:00.000Z'),
          totalStock: 1,
        }),
        product: Product.create({ id: 'p1' as ProductId, name: 'A' }),
      },
      {
        flashSale: FlashSale.reconstitute({
          id: 'sale-late' as FlashSaleId,
          productId: 'p2' as ProductId,
          endsAt: new Date('2026-07-28T18:00:00.000Z'),
          remainingStock: 1,
          startsAt: new Date('2026-07-28T14:00:00.000Z'),
          totalStock: 1,
        }),
        product: Product.create({
          id: 'p2' as ProductId,
          description: 'Desc',
          name: 'B',
        }),
      },
    ]);
    const findById = jest.fn();
    const findByIdWithProduct = jest.fn();
    const resolver = build(
      { getById: jest.fn() },
      { findById, findAllForCatalog, findByIdWithProduct },
    );

    const result = await resolver.flashSales();

    expect(findAllForCatalog).toHaveBeenCalledTimes(1);
    expect(findById).not.toHaveBeenCalled();
    expect(findByIdWithProduct).not.toHaveBeenCalled();
    expect(result[0]!.product).toEqual({
      id: 'p1',
      description: null,
      name: 'A',
    });
    expect(result[1]!.product.description).toBe('Desc');
  });

  it('flashSales returns empty array when catalog is empty', async () => {
    const resolver = build(
      { getById: jest.fn() },
      {
        findById: jest.fn(),
        findAllForCatalog: jest.fn().mockResolvedValue([]),
        findByIdWithProduct: jest.fn(),
      },
    );
    await expect(resolver.flashSales()).resolves.toEqual([]);
  });
});
