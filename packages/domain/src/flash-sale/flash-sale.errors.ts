export type FlashSaleValidationErrorCode =
  | 'EMPTY_ID'
  | 'EMPTY_PRODUCT_ID'
  | 'INVALID_NOW'
  | 'INVALID_REMAINING_STOCK'
  | 'INVALID_SALE_WINDOW'
  | 'INVALID_TOTAL_STOCK'
  | 'REMAINING_STOCK_EXCEEDS_TOTAL';

export class FlashSaleValidationError extends Error {
  readonly code: FlashSaleValidationErrorCode;

  constructor(code: FlashSaleValidationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'FlashSaleValidationError';
  }
}
