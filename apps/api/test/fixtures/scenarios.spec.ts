import { ACTIVE_STOCK_1, ACTIVE_STOCK_10, ENDED, SOLD_OUT, UPCOMING } from '../fixtures/scenarios';

describe('flash-sale scenario fixtures', () => {
  it('defines ACTIVE_STOCK_10 as active inventory for concurrency', () => {
    expect(ACTIVE_STOCK_10.name).toBe('ACTIVE_STOCK_10');
    expect(ACTIVE_STOCK_10.remainingStock).toBe(10);
    expect(ACTIVE_STOCK_10.totalStock).toBe(10);
    expect(ACTIVE_STOCK_10.startsAt.getTime()).toBeLessThan(ACTIVE_STOCK_10.endsAt.getTime());
  });

  it('defines ACTIVE_STOCK_1 for sold-out transition (not pre-exhausted)', () => {
    expect(ACTIVE_STOCK_1.remainingStock).toBe(1);
    expect(ACTIVE_STOCK_1.totalStock).toBe(1);
    expect(SOLD_OUT.remainingStock).toBe(0);
    expect(SOLD_OUT.name).toBe('SOLD_OUT');
  });

  it('defines UPCOMING and ENDED windows relative to scenario NOW', () => {
    const now = new Date('2026-07-29T12:00:00.000Z').getTime();
    expect(UPCOMING.startsAt.getTime()).toBeGreaterThan(now);
    expect(ENDED.endsAt.getTime()).toBeLessThan(now);
  });
});
