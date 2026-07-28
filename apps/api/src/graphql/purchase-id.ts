import { type PurchaseId } from '@flash-sale/domain';
import { randomUUID } from 'node:crypto';

/** API/application-edge PurchaseId generator (not an idempotency key; not external input). */
export function createPurchaseId(): PurchaseId {
  return randomUUID() as PurchaseId;
}
