import {
  FlashSale,
  type FlashSaleId,
  FlashSaleNotFoundError,
  FlashSaleValidationError,
  PurchaseConflictError,
  type PurchaseId,
  type UserId,
} from '@flash-sale/domain';

import type { PrismaService } from '../prisma/prisma.service';

import { PurchaseFlowService } from './purchase-flow.service';

describe('PurchaseFlowService', () => {
  const flashSaleId = 'sale-1' as FlashSaleId;
  const userId = 'user-1' as UserId;
  const purchaseId = 'purchase-1' as PurchaseId;
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');

  function activeSale(remainingStock = 5): FlashSale {
    return FlashSale.reconstitute({
      id: flashSaleId,
      productId: 'product-1' as never,
      endsAt: new Date('2026-07-28T14:00:00.000Z'),
      remainingStock,
      startsAt: new Date('2026-07-28T10:00:00.000Z'),
      totalStock: 9,
    });
  }

  function buildService(
    overrides: {
      findById?: jest.Mock;
      save?: jest.Mock;
      transaction?: jest.Mock;
      tryReserve?: jest.Mock;
    } = {},
  ) {
    const flashSaleRepository = {
      findById: overrides.findById ?? jest.fn().mockResolvedValue(activeSale()),
    };
    const reservation = {
      tryReserve: overrides.tryReserve ?? jest.fn().mockResolvedValue(true),
    };
    const purchaseRepository = {
      findByFlashSaleAndUser: jest.fn(),
      save: overrides.save ?? jest.fn().mockResolvedValue(undefined),
    };
    const defaultTx = { transactionClient: true };
    const transaction =
      overrides.transaction ??
      jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(defaultTx));
    const prisma = { $transaction: transaction } as unknown as PrismaService;

    return {
      flashSaleRepository,
      purchaseRepository,
      reservation,
      service: new PurchaseFlowService(
        flashSaleRepository as never,
        reservation as never,
        purchaseRepository as never,
        prisma,
      ),
      transaction,
    };
  }

  const input = { flashSaleId, purchaseId, userId, nowUtc };

  it('throws FlashSaleNotFoundError when findById returns null', async () => {
    const findById = jest.fn().mockResolvedValue(null);
    const { service, transaction } = buildService({ findById });

    await expect(service.execute(input)).rejects.toBeInstanceOf(FlashSaleNotFoundError);
    expect(findById).toHaveBeenCalledWith(flashSaleId);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns SALE_NOT_STARTED for UPCOMING without opening a transaction', async () => {
    const sale = FlashSale.reconstitute({
      id: flashSaleId,
      productId: 'product-1' as never,
      endsAt: new Date('2026-07-28T14:00:00.000Z'),
      remainingStock: 5,
      startsAt: new Date('2026-07-28T13:00:00.000Z'),
      totalStock: 9,
    });
    const findById = jest.fn().mockResolvedValue(sale);
    const { service, transaction } = buildService({ findById });

    await expect(service.execute(input)).resolves.toBe('SALE_NOT_STARTED');
    expect(findById).toHaveBeenCalledWith(flashSaleId);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns SALE_ENDED for ENDED without opening a transaction', async () => {
    const sale = FlashSale.reconstitute({
      id: flashSaleId,
      productId: 'product-1' as never,
      endsAt: new Date('2026-07-28T11:00:00.000Z'),
      remainingStock: 5,
      startsAt: new Date('2026-07-28T10:00:00.000Z'),
      totalStock: 9,
    });
    const { service, transaction } = buildService({
      findById: jest.fn().mockResolvedValue(sale),
    });

    await expect(service.execute(input)).resolves.toBe('SALE_ENDED');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns SOLD_OUT from getStatus without opening a transaction', async () => {
    const { service, transaction } = buildService({
      findById: jest.fn().mockResolvedValue(activeSale(0)),
    });

    await expect(service.execute(input)).resolves.toBe('SOLD_OUT');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns SUCCESS when reserve and save succeed inside the transaction', async () => {
    const events: string[] = [];
    const tryReserve = jest.fn().mockImplementation(async (_id, passedNow) => {
      events.push('reserve');
      expect(passedNow).toBe(nowUtc);
      return true;
    });
    const save = jest.fn().mockImplementation(async (purchase) => {
      events.push('save');
      expect(purchase.getPurchasedAt().getTime()).toBe(nowUtc.getTime());
    });
    const { flashSaleRepository, service, transaction } = buildService({ save, tryReserve });

    await expect(service.execute(input)).resolves.toBe('SUCCESS');
    expect(flashSaleRepository.findById).toHaveBeenCalledWith(flashSaleId);
    expect(transaction).toHaveBeenCalled();
    expect(events).toEqual(['reserve', 'save']);
  });

  it('passes the same transaction PersistenceContext to reserve and save', async () => {
    let reserveCtx: unknown;
    let saveCtx: unknown;

    const tryReserve = jest.fn().mockImplementation(async (_id, _now, ctx) => {
      reserveCtx = ctx;
      return true;
    });
    const save = jest.fn().mockImplementation(async (_purchase, ctx) => {
      saveCtx = ctx;
    });
    const { service } = buildService({ save, tryReserve });

    await expect(service.execute(input)).resolves.toBe('SUCCESS');
    expect(reserveCtx).toBeDefined();
    expect(saveCtx).toBe(reserveCtx);
  });

  it('returns SOLD_OUT when tryReserve returns false inside the transaction', async () => {
    const save = jest.fn();
    const { service } = buildService({
      save,
      tryReserve: jest.fn().mockResolvedValue(false),
    });

    // tryReserve(false) → no PurchaseRepository.save (Purchase.create only after successful reserve).
    await expect(service.execute(input)).resolves.toBe('SOLD_OUT');
    expect(save).not.toHaveBeenCalled();
  });

  it('maps PurchaseConflictError escaping the transaction callback to ALREADY_PURCHASED', async () => {
    // Unit proves escape + outer mapping only. PostgreSQL integration proves DB rollback.
    let callbackError: unknown;
    const transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      try {
        return await fn({ transactionClient: true });
      } catch (error) {
        callbackError = error;
        throw error;
      }
    });
    const { service } = buildService({
      save: jest.fn().mockRejectedValue(new PurchaseConflictError()),
      transaction,
    });

    await expect(service.execute(input)).resolves.toBe('ALREADY_PURCHASED');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(callbackError).toBeInstanceOf(PurchaseConflictError);
  });

  it('propagates unexpected errors from the transaction', async () => {
    const { service } = buildService({
      save: jest.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(service.execute(input)).rejects.toThrow('db down');
  });

  it('propagates INVALID_NOW from getStatus', async () => {
    const { service, transaction } = buildService();

    await expect(service.execute({ ...input, nowUtc: new Date('invalid') })).rejects.toBeInstanceOf(
      FlashSaleValidationError,
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
