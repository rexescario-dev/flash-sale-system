import type { FlashSaleId, ProductId, PurchaseId, UserId } from '../ids.js';

/** Runtime Nest DI token for PurchaseHistoryQuery. Owned by @flash-sale/domain. */
export const PURCHASE_HISTORY_QUERY = Symbol('PURCHASE_HISTORY_QUERY');

/**
 * Read-composition transport at the port boundary only.
 * Not a domain entity; not a GraphQL type.
 */
export type PurchaseHistoryReadModel = {
  flashSaleId: FlashSaleId;
  id: PurchaseId;
  product: {
    id: ProductId;
    description: null | string;
    name: string;
  };
  purchasedAt: Date;
};

export interface PurchaseHistoryQuery {
  /** Adapter orders results by purchasedAt descending. */
  findByUser(userId: UserId): Promise<PurchaseHistoryReadModel[]>;
}
