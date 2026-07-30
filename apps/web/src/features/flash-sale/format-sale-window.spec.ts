import { describe, expect, it } from 'vitest';

import { formatSaleWindow } from './format-sale-window';

describe('formatSaleWindow', () => {
  it('same local calendar day → Today + time range', () => {
    const start = new Date(2026, 6, 30, 9, 0, 0).toISOString();
    const end = new Date(2026, 6, 30, 11, 0, 0).toISOString();
    const r = formatSaleWindow(start, end);
    expect(r.heading).toBe('Today');
    expect(r.range).toMatch(/9:00\s*AM/i);
    expect(r.range).toMatch(/11:00\s*AM/i);
  });

  it('different local calendar days → dated range (no Today)', () => {
    const start = new Date(2026, 6, 30, 9, 0, 0).toISOString();
    const end = new Date(2026, 6, 31, 11, 0, 0).toISOString();
    const r = formatSaleWindow(start, end);
    expect(r.heading).toBeNull();
    expect(r.range).toMatch(/Jul/i);
    expect(r.range).not.toMatch(/^Today/i);
  });
});
