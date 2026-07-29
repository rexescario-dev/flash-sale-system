import type { PrismaClient } from '@prisma/client';

export type CreateProductInput = {
  id: string;
  name?: string;
};

export async function createProduct(
  prisma: PrismaClient,
  input: CreateProductInput,
): Promise<{ id: string }> {
  return prisma.product.create({
    data: {
      id: input.id,
      name: input.name ?? `Product ${input.id}`,
    },
    select: { id: true },
  });
}
