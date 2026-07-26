import type { FlashSaleId, PurchaseId, UserId } from '../ids.js';

import { PurchaseValidationError, type PurchaseValidationErrorCode } from './purchase.errors.js';
import { Purchase } from './purchase.js';

const asFlashSaleId = (value: string): FlashSaleId => value as FlashSaleId;
const asPurchaseId = (value: string): PurchaseId => value as PurchaseId;
const asUserId = (value: string): UserId => value as UserId;

const id = asPurchaseId('purchase-1');
const flashSaleId = asFlashSaleId('sale-1');
const userId = asUserId('user-1');
const purchasedAt = new Date('2026-07-27T00:00:00.000Z');

function expectValidationError(action: () => unknown, code: PurchaseValidationErrorCode): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(PurchaseValidationError);
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected PurchaseValidationError with code ${code}`);
}

describe('Purchase.create', () => {
  it('creates a purchase and exposes all fields through getters while preserving ids', () => {
    const paddedId = asPurchaseId('  purchase-1  ');
    const paddedFlashSaleId = asFlashSaleId('  sale-1  ');
    const paddedUserId = asUserId('  user-1  ');
    const purchase = Purchase.create({
      flashSaleId: paddedFlashSaleId,
      id: paddedId,
      userId: paddedUserId,
      purchasedAt,
    });

    expect(purchase.getId()).toBe('  purchase-1  ');
    expect(purchase.getFlashSaleId()).toBe('  sale-1  ');
    expect(purchase.getUserId()).toBe('  user-1  ');
    expect(purchase.getPurchasedAt().getTime()).toBe(purchasedAt.getTime());
  });

  it('isolates purchasedAt from getter mutation', () => {
    const purchase = Purchase.create({ flashSaleId, id, userId, purchasedAt });
    const originalTimestamp = purchasedAt.getTime();

    purchase.getPurchasedAt().setTime(0);

    expect(purchase.getPurchasedAt().getTime()).toBe(originalTimestamp);
  });

  it('isolates purchasedAt from input mutation after create', () => {
    const input = new Date('2026-07-27T00:00:00.000Z');
    const originalTimestamp = input.getTime();
    const purchase = Purchase.create({
      flashSaleId,
      id,
      userId,
      purchasedAt: input,
    });

    input.setTime(0);

    expect(purchase.getPurchasedAt().getTime()).toBe(originalTimestamp);
  });

  it('accepts a future purchasedAt when the Date is valid', () => {
    const future = new Date('2099-01-01T00:00:00.000Z');
    const purchase = Purchase.create({
      flashSaleId,
      id,
      userId,
      purchasedAt: future,
    });

    expect(purchase.getPurchasedAt().getTime()).toBe(future.getTime());
  });

  it('rejects empty id', () => {
    expectValidationError(
      () => Purchase.create({ flashSaleId, id: asPurchaseId(''), userId, purchasedAt }),
      'EMPTY_ID',
    );
  });

  it('rejects whitespace-only id', () => {
    expectValidationError(
      () => Purchase.create({ flashSaleId, id: asPurchaseId('   '), userId, purchasedAt }),
      'EMPTY_ID',
    );
  });

  it('rejects empty flashSaleId', () => {
    expectValidationError(
      () => Purchase.create({ flashSaleId: asFlashSaleId(''), id, userId, purchasedAt }),
      'EMPTY_FLASH_SALE_ID',
    );
  });

  it('rejects whitespace-only flashSaleId', () => {
    expectValidationError(
      () => Purchase.create({ flashSaleId: asFlashSaleId('   '), id, userId, purchasedAt }),
      'EMPTY_FLASH_SALE_ID',
    );
  });

  it('rejects empty userId', () => {
    expectValidationError(
      () => Purchase.create({ flashSaleId, id, userId: asUserId(''), purchasedAt }),
      'EMPTY_USER_ID',
    );
  });

  it('rejects whitespace-only userId', () => {
    expectValidationError(
      () => Purchase.create({ flashSaleId, id, userId: asUserId('   '), purchasedAt }),
      'EMPTY_USER_ID',
    );
  });

  it('rejects invalid purchasedAt', () => {
    expectValidationError(
      () =>
        Purchase.create({
          flashSaleId,
          id,
          userId,
          purchasedAt: new Date('not-a-date'),
        }),
      'INVALID_PURCHASED_AT',
    );
  });
});
