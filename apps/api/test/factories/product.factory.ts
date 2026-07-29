import type { PrismaClient } from '@prisma/client';

export type CreateProductInput = {
  id: string;
  description?: null | string;
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
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    select: { id: true },
  });
}
