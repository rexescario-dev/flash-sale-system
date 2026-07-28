import type { FlashSaleId } from '@flash-sale/domain';

import { randomUUID } from 'node:crypto';

import { PrismaFlashSaleReservation } from '../../src/flash-sale/prisma-flash-sale.reservation';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('PrismaFlashSaleReservation integration (#19)', () => {
  const prisma = new PrismaService();
  const reservation = new PrismaFlashSaleReservation(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedSale(overrides: {
    endsAt: Date;
    remainingStock: number;
    startsAt: Date;
    totalStock?: number;
    updatedAt?: Date;
  }): Promise<{ flashSaleId: string; productId: string }> {
    const suffix = randomUUID();
    const productId = `product-reserve-${suffix}`;
    const flashSaleId = `sale-reserve-${suffix}`;
    const now = overrides.updatedAt ?? new Date('2026-07-28T12:00:00.000Z');
    const totalStock = overrides.totalStock ?? Math.max(overrides.remainingStock, 1);

    await prisma.product.create({
      data: {
        id: productId,
        name: 'Reservation Integration Product',
        updatedAt: now,
      },
    });

    await prisma.flashSale.create({
      data: {
        id: flashSaleId,
        productId,
        endsAt: overrides.endsAt,
        remainingStock: overrides.remainingStock,
        startsAt: overrides.startsAt,
        totalStock,
        updatedAt: now,
      },
    });

    return { flashSaleId, productId };
  }

  async function cleanup(ids: { flashSaleId: string; productId: string }): Promise<void> {
    await prisma.flashSale.deleteMany({ where: { id: ids.flashSaleId } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
  }

  async function remainingStock(flashSaleId: string): Promise<number> {
    const row = await prisma.flashSale.findUniqueOrThrow({ where: { id: flashSaleId } });
    return row.remainingStock;
  }

  it('decrements stock and sets updated_at to nowUtc when active and remaining_stock > 0', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    const ids = await seedSale({ endsAt, remainingStock: 4, startsAt, totalStock: 9 });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        true,
      );

      // Fresh Prisma Client read after tryReserve — proves the DB column was written by raw SQL.
      // Do not infer updatedAt from the in-memory input or adapter return value.
      const row = await prisma.flashSale.findUniqueOrThrow({ where: { id: ids.flashSaleId } });
      expect(row.remainingStock).toBe(3);
      expect(row.updatedAt).toEqual(nowUtc);
    } finally {
      await cleanup(ids);
    }
  });

  it('reserves the last unit (stock 1 → 0)', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    const ids = await seedSale({ endsAt, remainingStock: 1, startsAt, totalStock: 1 });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        true,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(0);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false when stock is already 0 and leaves updated_at unchanged', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const initialUpdatedAt = new Date('2026-07-28T11:00:00.000Z');
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    const ids = await seedSale({
      endsAt,
      remainingStock: 0,
      startsAt,
      totalStock: 5,
      updatedAt: initialUpdatedAt,
    });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        false,
      );

      // Fresh read after failed tryReserve — SET updated_at must share the same WHERE guard.
      const row = await prisma.flashSale.findUniqueOrThrow({ where: { id: ids.flashSaleId } });
      expect(row.remainingStock).toBe(0);
      expect(row.updatedAt).toEqual(initialUpdatedAt);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false before starts_at', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date('2026-07-28T09:59:59.999Z');
    const ids = await seedSale({ endsAt, remainingStock: 5, startsAt });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        false,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(5);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns true at starts_at when stock > 0', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date(startsAt.getTime());
    const ids = await seedSale({ endsAt, remainingStock: 2, startsAt });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        true,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(1);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false at ends_at', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date(endsAt.getTime());
    const ids = await seedSale({ endsAt, remainingStock: 5, startsAt });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        false,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(5);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false after ends_at', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date('2026-07-28T14:00:00.001Z');
    const ids = await seedSale({ endsAt, remainingStock: 5, startsAt });

    try {
      await expect(reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc)).resolves.toBe(
        false,
      );
      expect(await remainingStock(ids.flashSaleId)).toBe(5);
    } finally {
      await cleanup(ids);
    }
  });

  it('returns false for a missing flash sale id', async () => {
    const missingId = `sale-missing-${randomUUID()}` as FlashSaleId;
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    await expect(reservation.tryReserve(missingId, nowUtc)).resolves.toBe(false);
  });

  it('does not oversell under concurrent tryReserve (N > S)', async () => {
    const startsAt = new Date('2026-07-28T10:00:00.000Z');
    const endsAt = new Date('2026-07-28T14:00:00.000Z');
    const nowUtc = new Date('2026-07-28T12:00:00.000Z');
    const stock = 10;
    const callers = 100;
    const ids = await seedSale({
      endsAt,
      remainingStock: stock,
      startsAt,
      totalStock: stock,
    });

    try {
      // Shares one PrismaFlashSaleReservation instance, but each $executeRaw is a separate
      // Prisma/PostgreSQL operation. The property under test is database-level atomicity of
      // the conditional UPDATE — not JavaScript-level serialization. Do not "optimize" this
      // into sequential awaits or add application-level locking.
      const results = await Promise.all(
        Array.from({ length: callers }, () =>
          reservation.tryReserve(ids.flashSaleId as FlashSaleId, nowUtc),
        ),
      );

      const successes = results.filter((value) => value === true).length;
      const failures = results.filter((value) => value === false).length;

      expect(successes).toBe(stock);
      expect(failures).toBe(callers - stock);
      expect(await remainingStock(ids.flashSaleId)).toBe(0);
    } finally {
      await cleanup(ids);
    }
  });
});
