import type { FlashSaleId } from '../ids.js';

/** Runtime Nest DI token for FlashSaleReservation. Owned by @flash-sale/domain. */
export const FLASH_SALE_RESERVATION = Symbol('FLASH_SALE_RESERVATION');

export interface FlashSaleReservation {
  tryReserve(flashSaleId: FlashSaleId, nowUtc: Date): Promise<boolean>;
}
