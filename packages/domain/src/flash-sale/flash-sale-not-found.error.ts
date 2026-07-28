export class FlashSaleNotFoundError extends Error {
  readonly code = 'FLASH_SALE_NOT_FOUND' as const;

  constructor(message = 'Flash sale was not found') {
    super(message);
    this.name = 'FlashSaleNotFoundError';
  }
}
