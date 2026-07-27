import type { FlashSaleId } from '../ids.js';
import type { FlashSale } from './flash-sale.js';

/** Runtime Nest DI token for FlashSaleRepository. Owned by @flash-sale/domain. */
export const FLASH_SALE_REPOSITORY = Symbol('FLASH_SALE_REPOSITORY');

export interface FlashSaleRepository {
  findById(id: FlashSaleId): Promise<FlashSale | null>;
}
