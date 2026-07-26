import type { FlashSaleId, ProductId } from '../ids.js';

import { FlashSaleValidationError } from './flash-sale.errors.js';

export type FlashSaleCreateProps = {
  id: FlashSaleId;
  productId: ProductId;
  endsAt: Date;
  startsAt: Date;
  totalStock: number;
};

export type FlashSaleReconstituteProps = FlashSaleCreateProps & {
  remainingStock: number;
};

export class FlashSale {
  private constructor(
    private readonly id: FlashSaleId,
    private readonly productId: ProductId,
    private readonly endsAt: Date,
    private readonly remainingStock: number,
    private readonly startsAt: Date,
    private readonly totalStock: number,
  ) {}

  static create(props: FlashSaleCreateProps): FlashSale {
    const remainingStock = props.totalStock;
    FlashSale.assertValid({ ...props, remainingStock });
    return new FlashSale(
      props.id,
      props.productId,
      new Date(props.endsAt.getTime()),
      remainingStock,
      new Date(props.startsAt.getTime()),
      props.totalStock,
    );
  }

  static reconstitute(props: FlashSaleReconstituteProps): FlashSale {
    FlashSale.assertValid(props);
    return new FlashSale(
      props.id,
      props.productId,
      new Date(props.endsAt.getTime()),
      props.remainingStock,
      new Date(props.startsAt.getTime()),
      props.totalStock,
    );
  }

  private static assertValid(props: FlashSaleReconstituteProps): void {
    if (props.id.trim().length === 0) {
      throw new FlashSaleValidationError('EMPTY_ID', 'FlashSale id must be non-empty');
    }

    if (props.productId.trim().length === 0) {
      throw new FlashSaleValidationError(
        'EMPTY_PRODUCT_ID',
        'FlashSale productId must be non-empty',
      );
    }

    if (!(props.startsAt.getTime() < props.endsAt.getTime())) {
      throw new FlashSaleValidationError(
        'INVALID_SALE_WINDOW',
        'FlashSale startsAt must be before endsAt',
      );
    }

    if (!Number.isInteger(props.totalStock) || props.totalStock <= 0) {
      throw new FlashSaleValidationError(
        'INVALID_TOTAL_STOCK',
        'FlashSale totalStock must be a positive integer',
      );
    }

    if (!Number.isInteger(props.remainingStock) || props.remainingStock < 0) {
      throw new FlashSaleValidationError(
        'INVALID_REMAINING_STOCK',
        'FlashSale remainingStock must be a non-negative integer',
      );
    }

    if (props.remainingStock > props.totalStock) {
      throw new FlashSaleValidationError(
        'REMAINING_STOCK_EXCEEDS_TOTAL',
        'FlashSale remainingStock cannot exceed totalStock',
      );
    }
  }

  getEndsAt(): Date {
    return new Date(this.endsAt.getTime());
  }

  getId(): FlashSaleId {
    return this.id;
  }

  getProductId(): ProductId {
    return this.productId;
  }

  getRemainingStock(): number {
    return this.remainingStock;
  }

  getStartsAt(): Date {
    return new Date(this.startsAt.getTime());
  }

  getTotalStock(): number {
    return this.totalStock;
  }
}
