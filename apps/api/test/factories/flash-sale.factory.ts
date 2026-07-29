import type { PrismaClient } from '@prisma/client';

import { createProduct } from './product.factory';

export type CreateFlashSaleInput = {
  id: string;
  productId?: string;
  endsAt: Date;
  productName?: string;
  remainingStock: number;
  startsAt: Date;
  totalStock: number;
};

export async function createFlashSale(
  prisma: PrismaClient,
  input: CreateFlashSaleInput,
): Promise<{ id: string; productId: string }> {
  const productId = input.productId ?? `product-for-${input.id}`;
  await createProduct(prisma, { id: productId, name: input.productName });
  await prisma.flashSale.create({
    data: {
      id: input.id,
      productId,
      endsAt: input.endsAt,
      remainingStock: input.remainingStock,
      startsAt: input.startsAt,
      totalStock: input.totalStock,
    },
  });
  return { id: input.id, productId };
}
