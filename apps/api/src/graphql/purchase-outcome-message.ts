import type { PurchaseOutcome } from '@flash-sale/domain';

const MESSAGES: Record<PurchaseOutcome, string> = {
  ALREADY_PURCHASED: 'User already purchased this flash sale',
  SALE_ENDED: 'Flash sale has ended',
  SALE_NOT_STARTED: 'Flash sale has not started',
  SOLD_OUT: 'Flash sale is sold out',
  SUCCESS: 'Purchase completed',
};

export function messageForPurchaseOutcome(outcome: PurchaseOutcome): string {
  return MESSAGES[outcome];
}
