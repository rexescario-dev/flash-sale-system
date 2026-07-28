import type { FlashSaleId, PurchaseId, UserId } from '../ids.js';
import type { PurchaseOutcome } from './purchase.outcome.js';

export type PurchaseFlowExecuteInput = {
  flashSaleId: FlashSaleId;
  purchaseId: PurchaseId;
  userId: UserId;
  nowUtc: Date;
};

/** Runtime Nest DI token for PurchaseFlow. Owned by @flash-sale/domain. */
export const PURCHASE_FLOW = Symbol('PURCHASE_FLOW');

export interface PurchaseFlow {
  execute(input: PurchaseFlowExecuteInput): Promise<PurchaseOutcome>;
}
