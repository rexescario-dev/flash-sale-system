import type { UserId } from '@flash-sale/domain';

import type { PrismaService } from '../prisma/prisma.service';

import { PrismaPurchaseHistoryQuery } from './prisma-purchase-history.query';

function buildRow(
  overrides: {
    flashSaleId?: string;
    id?: string;
    product?: {
      id?: string;
      description?: null | string;
      name?: string;
    };
    purchasedAt?: Date;
  } = {},
) {
  const purchasedAt = overrides.purchasedAt ?? new Date('2026-07-28T11:00:00.000Z');
  const productOverrides = overrides.product ?? {};
  return {
    flashSaleId: overrides.flashSaleId ?? 'sale-1',
    id: overrides.id ?? 'purchase-1',
    userId: 'user-1',
    createdAt: purchasedAt,
    flashSale: {
      id: overrides.flashSaleId ?? 'sale-1',
      productId: productOverrides.id ?? 'product-1',
      product: {
        id: productOverrides.id ?? 'product-1',
        description:
          'description' in productOverrides ? productOverrides.description! : 'A fine widget',
        name: productOverrides.name ?? 'Widget',
      },
    },
    purchasedAt,
    updatedAt: purchasedAt,
  };
}

describe('PrismaPurchaseHistoryQuery', () => {
  const userId = 'user-1' as UserId;

  it('calls findMany once with userId, purchasedAt desc, and flashSale.product include', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { purchase: { findMany } } as unknown as PrismaService;
    const query = new PrismaPurchaseHistoryQuery(prisma);

    await query.findByUser(userId);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      include: { flashSale: { include: { product: true } } },
      orderBy: { purchasedAt: 'desc' },
      where: { userId },
    });
  });

  it('returns [] when Prisma returns []', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { purchase: { findMany } } as unknown as PrismaService;
    const query = new PrismaPurchaseHistoryQuery(prisma);

    await expect(query.findByUser(userId)).resolves.toEqual([]);
  });

  it('maps nested flashSale.product into PurchaseHistoryReadModel', async () => {
    const purchasedAt = new Date('2026-07-28T11:00:00.000Z');
    const findMany = jest.fn().mockResolvedValue([
      buildRow({
        flashSaleId: 'sale-9',
        id: 'purchase-1',
        product: {
          id: 'product-9',
          description: 'shiny',
          name: 'Gadget',
        },
        purchasedAt,
      }),
    ]);
    const prisma = { purchase: { findMany } } as unknown as PrismaService;
    const query = new PrismaPurchaseHistoryQuery(prisma);

    await expect(query.findByUser(userId)).resolves.toEqual([
      {
        flashSaleId: 'sale-9',
        id: 'purchase-1',
        product: {
          id: 'product-9',
          description: 'shiny',
          name: 'Gadget',
        },
        purchasedAt,
      },
    ]);
  });

  it('maps null product description to null', async () => {
    const findMany = jest.fn().mockResolvedValue([
      buildRow({
        product: { description: null },
      }),
    ]);
    const prisma = { purchase: { findMany } } as unknown as PrismaService;
    const query = new PrismaPurchaseHistoryQuery(prisma);

    const rows = await query.findByUser(userId);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.product.description).toBeNull();
  });
});
