import type { FlashSaleId, PurchaseId, UserId } from '../ids.js';

import { PurchaseValidationError } from './purchase.errors.js';

export type PurchaseCreateProps = {
  flashSaleId: FlashSaleId;
  id: PurchaseId;
  userId: UserId;
  purchasedAt: Date;
};

export type PurchaseReconstituteProps = PurchaseCreateProps;

export class Purchase {
  private constructor(
    private readonly id: PurchaseId,
    private readonly flashSaleId: FlashSaleId,
    private readonly purchasedAt: Date,
    private readonly userId: UserId,
  ) {}

  static create(props: PurchaseCreateProps): Purchase {
    Purchase.assertValid(props);
    const timestamp = props.purchasedAt.getTime();
    return new Purchase(props.id, props.flashSaleId, new Date(timestamp), props.userId);
  }

  static reconstitute(props: PurchaseReconstituteProps): Purchase {
    Purchase.assertValid(props);
    const timestamp = props.purchasedAt.getTime();
    return new Purchase(props.id, props.flashSaleId, new Date(timestamp), props.userId);
  }

  private static assertValid(props: PurchaseCreateProps): void {
    if (props.id.trim().length === 0) {
      throw new PurchaseValidationError('EMPTY_ID', 'Purchase id must be non-empty');
    }

    if (props.flashSaleId.trim().length === 0) {
      throw new PurchaseValidationError(
        'EMPTY_FLASH_SALE_ID',
        'Purchase flashSaleId must be non-empty',
      );
    }

    if (props.userId.trim().length === 0) {
      throw new PurchaseValidationError('EMPTY_USER_ID', 'Purchase userId must be non-empty');
    }

    const timestamp = props.purchasedAt.getTime();
    if (Number.isNaN(timestamp)) {
      throw new PurchaseValidationError(
        'INVALID_PURCHASED_AT',
        'Purchase purchasedAt must be a valid Date',
      );
    }
  }

  getFlashSaleId(): FlashSaleId {
    return this.flashSaleId;
  }

  getId(): PurchaseId {
    return this.id;
  }

  getPurchasedAt(): Date {
    return new Date(this.purchasedAt.getTime());
  }

  getUserId(): UserId {
    return this.userId;
  }
}
