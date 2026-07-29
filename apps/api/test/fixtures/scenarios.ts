export type FlashSaleScenario = {
  endsAt: Date;
  /** Test-only metadata; not persisted to Postgres. */
  name: string;
  remainingStock: number;
  startsAt: Date;
  totalStock: number;
};

const NOW = new Date('2026-07-29T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

/** Active sale with 10 units — concurrency #47. */
export const ACTIVE_STOCK_10: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() + 24 * HOUR),
  name: 'ACTIVE_STOCK_10',
  remainingStock: 10,
  startsAt: new Date(NOW.getTime() - HOUR),
  totalStock: 10,
};

/** Active sale with 1 unit — Playwright sold-out transition. */
export const ACTIVE_STOCK_1: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() + 24 * HOUR),
  name: 'ACTIVE_STOCK_1',
  remainingStock: 1,
  startsAt: new Date(NOW.getTime() - HOUR),
  totalStock: 1,
};

/** Pre-exhausted sale — do NOT use for transition tests. */
export const SOLD_OUT: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() + 24 * HOUR),
  name: 'SOLD_OUT',
  remainingStock: 0,
  startsAt: new Date(NOW.getTime() - HOUR),
  totalStock: 10,
};

export const UPCOMING: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() + 48 * HOUR),
  name: 'UPCOMING',
  remainingStock: 10,
  startsAt: new Date(NOW.getTime() + HOUR),
  totalStock: 10,
};

export const ENDED: FlashSaleScenario = {
  endsAt: new Date(NOW.getTime() - HOUR),
  name: 'ENDED',
  remainingStock: 5,
  startsAt: new Date(NOW.getTime() - 48 * HOUR),
  totalStock: 10,
};
