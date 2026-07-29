import { activeStock1, activeStock10, ended, soldOut, upcoming } from './scenarios';

describe('flash-sale scenario fixtures', () => {
  const now = new Date('2026-07-29T12:00:00.000Z');

  it('defines ACTIVE_STOCK_10 as active inventory for concurrency', () => {
    const scenario = activeStock10(now);
    expect(scenario.name).toBe('ACTIVE_STOCK_10');
    expect(scenario.remainingStock).toBe(10);
    expect(scenario.totalStock).toBe(10);
    expect(scenario.startsAt.getTime()).toBeLessThan(now.getTime());
    expect(scenario.endsAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it('defines ACTIVE_STOCK_1 for sold-out transition (not pre-exhausted)', () => {
    expect(activeStock1(now).remainingStock).toBe(1);
    expect(activeStock1(now).totalStock).toBe(1);
    expect(soldOut(now).remainingStock).toBe(0);
    expect(soldOut(now).name).toBe('SOLD_OUT');
  });

  it('defines UPCOMING and ENDED windows relative to provided now', () => {
    expect(upcoming(now).startsAt.getTime()).toBeGreaterThan(now.getTime());
    expect(ended(now).endsAt.getTime()).toBeLessThan(now.getTime());
  });
});
