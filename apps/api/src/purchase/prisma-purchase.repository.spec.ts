import type { Purchase as PrismaPurchase } from '@prisma/client';

import { type FlashSaleId, Purchase, type PurchaseId, type UserId } from '@flash-sale/domain';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';

import { createPrismaPersistenceContext } from '../prisma/prisma-persistence-context';
import { PrismaPurchaseRepository } from './prisma-purchase.repository';

function buildRow(overrides: Partial<PrismaPurchase> = {}): PrismaPurchase {
  const now = new Date('2026-07-28T12:00:00.000Z');
  return {
    flashSaleId: 'sale-1',
    id: 'purchase-1',
    userId: 'user-1',
    createdAt: now,
    purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    updatedAt: now,
    ...overrides,
  };
}

function p2002(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    clientVersion: 'test',
    code: 'P2002',
    meta: { target },
  });
}

describe('PrismaPurchaseRepository', () => {
  const flashSaleId = 'sale-1' as FlashSaleId;
  const userId = 'user-1' as UserId;

  function buildPurchase(overrides: { id?: string } = {}): Purchase {
    return Purchase.create({
      flashSaleId,
      id: (overrides.id ?? 'purchase-1') as PurchaseId,
      userId,
      purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
    });
  }

  it('returns null when findUnique returns null', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = { purchase: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.findByFlashSaleAndUser(flashSaleId, userId)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({
      where: { flashSaleId_userId: { flashSaleId, userId } },
    });
  });

  it('returns a Purchase when a row exists', async () => {
    const findUnique = jest.fn().mockResolvedValue(buildRow());
    const prisma = { purchase: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    const purchase = await repo.findByFlashSaleAndUser(flashSaleId, userId);

    expect(purchase).not.toBeNull();
    expect(purchase!.getId()).toBe('purchase-1');
    expect(purchase!.getFlashSaleId()).toBe('sale-1');
    expect(purchase!.getUserId()).toBe('user-1');
  });

  it('saves a purchase via prisma create', async () => {
    const create = jest.fn().mockResolvedValue(buildRow());
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledWith({
      data: {
        flashSaleId: 'sale-1',
        id: 'purchase-1',
        userId: 'user-1',
        purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
      },
    });
  });

  it('maps P2002 composite target to PurchaseConflictError (canonical order)', async () => {
    const create = jest.fn().mockRejectedValue(p2002(['flashSaleId', 'userId']));
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).rejects.toMatchObject({
      code: 'PURCHASE_CONFLICT',
      name: 'PurchaseConflictError',
    });
  });

  it('maps P2002 composite target to PurchaseConflictError regardless of field order', async () => {
    const create = jest.fn().mockRejectedValue(p2002(['userId', 'flashSaleId']));
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).rejects.toMatchObject({
      code: 'PURCHASE_CONFLICT',
      name: 'PurchaseConflictError',
    });
  });

  it('maps P2002 SQL-column composite target to PurchaseConflictError (runtime shape)', async () => {
    // Prisma 6 / PostgreSQL emits mapped column names in meta.target.
    const create = jest.fn().mockRejectedValue(p2002(['user_id', 'flash_sale_id']));
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).rejects.toMatchObject({
      code: 'PURCHASE_CONFLICT',
      name: 'PurchaseConflictError',
    });
  });

  it('rethrows P2002 when target is only id', async () => {
    const error = p2002(['id']);
    const create = jest.fn().mockRejectedValue(error);
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).rejects.toBe(error);
  });

  it('rethrows P2002 when target is unknown/other', async () => {
    const error = p2002(['something_else']);
    const create = jest.fn().mockRejectedValue(error);
    const prisma = { purchase: { create } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.save(buildPurchase())).rejects.toBe(error);
  });

  it('propagates PurchaseValidationError when mapped state is invalid', async () => {
    const findUnique = jest.fn().mockResolvedValue(buildRow({ id: '   ' }));
    const prisma = { purchase: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);

    await expect(repo.findByFlashSaleAndUser(flashSaleId, userId)).rejects.toMatchObject({
      code: 'EMPTY_ID',
    });
  });

  it('save uses the transaction-bound client when PersistenceContext is provided', async () => {
    const rootCreate = jest.fn();
    const txCreate = jest.fn().mockResolvedValue({});
    const prisma = {
      purchase: { create: rootCreate, findUnique: jest.fn() },
    } as unknown as PrismaService;
    const repo = new PrismaPurchaseRepository(prisma);
    const ctx = createPrismaPersistenceContext({
      purchase: { create: txCreate },
    } as never);

    await repo.save(
      Purchase.create({
        flashSaleId: 'sale-1' as FlashSaleId,
        id: 'purchase-1' as PurchaseId,
        userId: 'user-1' as UserId,
        purchasedAt: new Date('2026-07-28T12:00:00.000Z'),
      }),
      ctx,
    );

    expect(txCreate).toHaveBeenCalled();
    expect(rootCreate).not.toHaveBeenCalled();
  });
});
