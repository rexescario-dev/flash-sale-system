import type { FlashSaleId } from '../ids.js';
import type { Product } from '../product/product.js';
import type { FlashSale } from './flash-sale.js';

/** Runtime Nest DI token for FlashSaleRepository. Owned by @flash-sale/domain. */
export const FLASH_SALE_REPOSITORY = Symbol('FLASH_SALE_REPOSITORY');

/**
 * Read-composition transport at the port boundary only.
 * Must not be added to or become part of the FlashSale domain entity.
 * Domain FlashSale keeps productId as the relationship.
 */
export type FlashSaleWithProduct = {
  flashSale: FlashSale;
  product: Product;
};

export interface FlashSaleRepository {
  findById(id: FlashSaleId): Promise<FlashSale | null>;
  /** Unfiltered catalog; adapter orders by startsAt ascending. */
  findAllForCatalog(): Promise<FlashSaleWithProduct[]>;
  findByIdWithProduct(id: FlashSaleId): Promise<FlashSaleWithProduct | null>;
}
