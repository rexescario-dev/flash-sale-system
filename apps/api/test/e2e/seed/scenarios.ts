import { e2eProductId, e2eSaleId } from '../../fixtures/ids';
import { activeStock1, activeStock10 } from '../../fixtures/scenarios';

/** Stable E2E-owned IDs; scenario clocks are built at seed time. */
export function getE2EScenarios(now: Date = new Date()) {
  return {
    activeStock1: {
      productId: e2eProductId('active-stock-1'),
      saleId: e2eSaleId('active-stock-1'),
      scenario: activeStock1(now),
    },
    activeStock10: {
      productId: e2eProductId('active-stock-10'),
      saleId: e2eSaleId('active-stock-10'),
      scenario: activeStock10(now),
    },
  } as const;
}
