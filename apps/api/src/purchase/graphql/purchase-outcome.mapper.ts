import type { PurchaseOutcome } from '@flash-sale/domain';

import { PurchaseOutcomeGql } from './purchase-outcome.enum';

const OUTCOME_MAP: Record<PurchaseOutcome, PurchaseOutcomeGql> = {
  ALREADY_PURCHASED: PurchaseOutcomeGql.ALREADY_PURCHASED,
  SALE_ENDED: PurchaseOutcomeGql.SALE_ENDED,
  SALE_NOT_STARTED: PurchaseOutcomeGql.SALE_NOT_STARTED,
  SOLD_OUT: PurchaseOutcomeGql.SOLD_OUT,
  SUCCESS: PurchaseOutcomeGql.SUCCESS,
};

export function toPurchaseOutcomeGql(outcome: PurchaseOutcome): PurchaseOutcomeGql {
  return OUTCOME_MAP[outcome];
}
