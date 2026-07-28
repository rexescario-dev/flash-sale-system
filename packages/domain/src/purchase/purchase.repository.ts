import type { FlashSaleId, UserId } from '../ids.js';
import type { PersistenceContext } from '../persistence-context.js';
import type { Purchase } from './purchase.js';

/** Runtime Nest DI token for PurchaseRepository. Owned by @flash-sale/domain. */
export const PURCHASE_REPOSITORY = Symbol('PURCHASE_REPOSITORY');

export interface PurchaseRepository {
  findByFlashSaleAndUser(flashSaleId: FlashSaleId, userId: UserId): Promise<null | Purchase>;

  save(purchase: Purchase, ctx?: PersistenceContext): Promise<void>;
}
