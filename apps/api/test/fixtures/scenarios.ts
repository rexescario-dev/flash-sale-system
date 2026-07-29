export type FlashSaleScenario = {
  endsAt: Date;
  /** Test-only metadata; not persisted to Postgres. */
  name: string;
  remainingStock: number;
  startsAt: Date;
  totalStock: number;
};

const HOUR = 60 * 60 * 1000;

/** Active sale with 10 units — concurrency #47. */
export function activeStock10(now: Date = new Date()): FlashSaleScenario {
  return {
    endsAt: new Date(now.getTime() + 24 * HOUR),
    name: 'ACTIVE_STOCK_10',
    remainingStock: 10,
    startsAt: new Date(now.getTime() - HOUR),
    totalStock: 10,
  };
}

/** Active sale with 1 unit — Playwright sold-out transition. */
export function activeStock1(now: Date = new Date()): FlashSaleScenario {
  return {
    endsAt: new Date(now.getTime() + 24 * HOUR),
    name: 'ACTIVE_STOCK_1',
    remainingStock: 1,
    startsAt: new Date(now.getTime() - HOUR),
    totalStock: 1,
  };
}

/** Pre-exhausted sale — do NOT use for transition tests. */
export function soldOut(now: Date = new Date()): FlashSaleScenario {
  return {
    endsAt: new Date(now.getTime() + 24 * HOUR),
    name: 'SOLD_OUT',
    remainingStock: 0,
    startsAt: new Date(now.getTime() - HOUR),
    totalStock: 10,
  };
}

export function upcoming(now: Date = new Date()): FlashSaleScenario {
  return {
    endsAt: new Date(now.getTime() + 48 * HOUR),
    name: 'UPCOMING',
    remainingStock: 10,
    startsAt: new Date(now.getTime() + HOUR),
    totalStock: 10,
  };
}

export function ended(now: Date = new Date()): FlashSaleScenario {
  return {
    endsAt: new Date(now.getTime() - HOUR),
    name: 'ENDED',
    remainingStock: 5,
    startsAt: new Date(now.getTime() - 48 * HOUR),
    totalStock: 10,
  };
}

/** @deprecated Prefer activeStock10() so windows track wall clock. */
export const ACTIVE_STOCK_10: FlashSaleScenario = activeStock10();
/** @deprecated Prefer activeStock1(). */
export const ACTIVE_STOCK_1: FlashSaleScenario = activeStock1();
/** @deprecated Prefer soldOut(). */
export const SOLD_OUT: FlashSaleScenario = soldOut();
/** @deprecated Prefer upcoming(). */
export const UPCOMING: FlashSaleScenario = upcoming();
/** @deprecated Prefer ended(). */
export const ENDED: FlashSaleScenario = ended();
