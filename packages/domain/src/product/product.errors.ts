export type ProductValidationErrorCode = 'EMPTY_DESCRIPTION' | 'EMPTY_ID' | 'EMPTY_NAME';

export class ProductValidationError extends Error {
  readonly code: ProductValidationErrorCode;

  constructor(code: ProductValidationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ProductValidationError';
  }
}
