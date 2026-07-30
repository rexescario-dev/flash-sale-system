import { e2eProductId, e2eSaleId } from '../../fixtures/ids';
import { activeStock1, activeStock10, ended, soldOut, upcoming } from '../../fixtures/scenarios';

/** Stable E2E-owned IDs; scenario clocks are built at seed time. */
export function getE2EScenarios(now: Date = new Date()) {
  return {
    activeStock1: {
      productId: e2eProductId('active-stock-1'),
      saleId: e2eSaleId('active-stock-1'),
      productName: 'E2E Active Last Unit',
      scenario: activeStock1(now),
    },
    activeStock10: {
      productId: e2eProductId('active-stock-10'),
      saleId: e2eSaleId('active-stock-10'),
      productName: 'E2E Active Ten-Pack',
      scenario: activeStock10(now),
    },
    ended: {
      productId: e2eProductId('ended'),
      saleId: e2eSaleId('ended'),
      productName: 'E2E Ended Flash Deal',
      scenario: ended(now),
    },
    soldOut: {
      productId: e2eProductId('sold-out'),
      saleId: e2eSaleId('sold-out'),
      productName: 'E2E Sold Out Widget',
      scenario: soldOut(now),
    },
    upcoming: {
      productId: e2eProductId('upcoming'),
      saleId: e2eSaleId('upcoming'),
      productName: 'E2E Upcoming Launch',
      scenario: upcoming(now),
    },
  } as const;
}
