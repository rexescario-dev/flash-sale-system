import type { Product as PrismaProduct } from '@prisma/client';

import { Product, type ProductId } from '@flash-sale/domain';

export class ProductMapper {
  static toDomain(row: PrismaProduct): Product {
    return Product.create({
      id: row.id as ProductId,
      name: row.name,
      ...(row.description != null ? { description: row.description } : {}),
    });
  }
}
