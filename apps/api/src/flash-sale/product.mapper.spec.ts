import type { Product as PrismaProduct } from '@prisma/client';

import { ProductMapper } from './product.mapper';

describe('ProductMapper', () => {
  const baseRow = {
    id: 'p1',
    createdAt: new Date('2026-07-28T12:00:00.000Z'),
    name: 'N',
    updatedAt: new Date('2026-07-28T12:00:00.000Z'),
  };

  it('maps Prisma description "foo" → domain "foo"', () => {
    const product = ProductMapper.toDomain({
      ...baseRow,
      description: 'foo',
    } as PrismaProduct);
    expect(product.getDescription()).toBe('foo');
  });

  it('maps Prisma description null → domain undefined', () => {
    const product = ProductMapper.toDomain({
      ...baseRow,
      description: null,
    } as PrismaProduct);
    expect(product.getDescription()).toBeUndefined();
  });
});
