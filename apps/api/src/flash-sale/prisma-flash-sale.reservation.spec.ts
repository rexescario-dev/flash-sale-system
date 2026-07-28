import { type FlashSaleId, FlashSaleValidationError } from '@flash-sale/domain';

import type { PrismaService } from '../prisma/prisma.service';

import { createPrismaPersistenceContext } from '../prisma/prisma-persistence-context';
import { PrismaFlashSaleReservation } from './prisma-flash-sale.reservation';

describe('PrismaFlashSaleReservation', () => {
  const saleId = 'sale-1' as FlashSaleId;
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');

  it('returns true when $executeRaw affects exactly one row', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const prisma = { $executeRaw: executeRaw } as unknown as PrismaService;
    const reservation = new PrismaFlashSaleReservation(prisma);

    await expect(reservation.tryReserve(saleId, nowUtc)).resolves.toBe(true);
    expect(executeRaw).toHaveBeenCalled();
  });

  it('returns false when $executeRaw affects a non-one row count', async () => {
    const executeRaw = jest.fn().mockResolvedValue(0);
    const prisma = { $executeRaw: executeRaw } as unknown as PrismaService;
    const reservation = new PrismaFlashSaleReservation(prisma);

    await expect(reservation.tryReserve(saleId, nowUtc)).resolves.toBe(false);
    expect(executeRaw).toHaveBeenCalled();
  });

  it('throws INVALID_NOW and does not call $executeRaw for invalid nowUtc', async () => {
    const executeRaw = jest.fn();
    const prisma = { $executeRaw: executeRaw } as unknown as PrismaService;
    const reservation = new PrismaFlashSaleReservation(prisma);

    await expect(reservation.tryReserve(saleId, new Date('invalid'))).rejects.toMatchObject({
      code: 'INVALID_NOW',
      name: 'FlashSaleValidationError',
    });
    expect(executeRaw).not.toHaveBeenCalled();
    await expect(reservation.tryReserve(saleId, new Date('invalid'))).rejects.toBeInstanceOf(
      FlashSaleValidationError,
    );
  });

  it('uses the transaction-bound client when PersistenceContext is provided', async () => {
    const rootExecuteRaw = jest.fn();
    const txExecuteRaw = jest.fn().mockResolvedValue(1);
    const prisma = { $executeRaw: rootExecuteRaw } as unknown as PrismaService;
    const reservation = new PrismaFlashSaleReservation(prisma);
    const ctx = createPrismaPersistenceContext({
      $executeRaw: txExecuteRaw,
    } as never);

    await expect(reservation.tryReserve(saleId, nowUtc, ctx)).resolves.toBe(true);
    expect(txExecuteRaw).toHaveBeenCalled();
    expect(rootExecuteRaw).not.toHaveBeenCalled();
  });
});
