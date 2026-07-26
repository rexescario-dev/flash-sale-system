export type PurchaseValidationErrorCode =
  'EMPTY_FLASH_SALE_ID' | 'EMPTY_ID' | 'EMPTY_USER_ID' | 'INVALID_PURCHASED_AT';

export class PurchaseValidationError extends Error {
  readonly code: PurchaseValidationErrorCode;

  constructor(code: PurchaseValidationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PurchaseValidationError';
  }
}
