import {
  type FlashSaleId,
  type PersistenceContext,
  type Purchase,
  PurchaseConflictError,
  type PurchaseRepository,
  type UserId,
} from '@flash-sale/domain';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { resolvePrismaClient } from '../prisma/prisma-persistence-context';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseMapper } from './purchase.mapper';

function isCompositePurchaseUniqueTarget(target: unknown): boolean {
  if (!Array.isArray(target)) {
    return false;
  }

  const names = target.filter((value): value is string => typeof value === 'string');
  if (names.length !== target.length) {
    return false;
  }

  const set = new Set(names);
  if (set.size !== 2) {
    return false;
  }

  // Exact set equality, order-independent.
  // Prisma 6 on this project emits SQL column names in P2002 meta.target
  // (verified against PostgreSQL); also accept Prisma field names.
  const prismaFields = set.has('flashSaleId') && set.has('userId');
  const sqlColumns = set.has('flash_sale_id') && set.has('user_id');
  return prismaFields || sqlColumns;
}

@Injectable()
export class PrismaPurchaseRepository implements PurchaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByFlashSaleAndUser(flashSaleId: FlashSaleId, userId: UserId): Promise<null | Purchase> {
    const row = await this.prisma.purchase.findUnique({
      where: { flashSaleId_userId: { flashSaleId, userId } },
    });

    if (row === null) {
      return null;
    }

    return PurchaseMapper.toDomain(row);
  }

  async save(purchase: Purchase, ctx?: PersistenceContext): Promise<void> {
    const db =
      ctx === undefined ? resolvePrismaClient(this.prisma) : resolvePrismaClient(this.prisma, ctx);

    try {
      await db.purchase.create({
        data: PurchaseMapper.toPersistence(purchase),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        isCompositePurchaseUniqueTarget(error.meta?.target)
      ) {
        throw new PurchaseConflictError();
      }

      throw error;
    }
  }
}
