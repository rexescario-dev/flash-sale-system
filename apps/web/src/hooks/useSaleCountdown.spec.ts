import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deriveSaleCountdown, formatCountdownText, useSaleCountdown } from './useSaleCountdown';

describe('formatCountdownText', () => {
  it('zero-pads HH:MM:SS', () => {
    expect(formatCountdownText(69_000)).toBe('00:01:09');
    expect(formatCountdownText(0)).toBe('00:00:00');
  });

  it('allows hours beyond 24 (duration, not clock wrap)', () => {
    // 27h 15m 8s
    expect(formatCountdownText((27 * 3600 + 15 * 60 + 8) * 1000)).toBe('27:15:08');
  });

  it('never returns negative components', () => {
    expect(formatCountdownText(-5_000)).toBe('00:00:00');
  });
});

describe('deriveSaleCountdown', () => {
  const starts = '2026-07-30T10:00:00.000Z';
  const ends = '2026-07-30T12:00:00.000Z';

  it('starts mode before startsAt', () => {
    const r = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T09:59:59.000Z'));
    expect(r.mode).toBe('starts');
    expect(r.label).toBe('Starts in');
    expect(r.text).toBe('00:00:01');
  });

  it('ends mode between startsAt and endsAt', () => {
    const r = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T11:00:00.000Z'));
    expect(r.mode).toBe('ends');
    expect(r.label).toBe('Ends in');
    expect(r.text).toBe('01:00:00');
  });

  it('boundary 00:00:00 at endsAt then none after', () => {
    const atEnd = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T12:00:00.000Z'));
    expect(atEnd.mode).toBe('none');
    expect(atEnd.text).toBe('00:00:00');

    const after = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T12:00:01.000Z'));
    expect(after.mode).toBe('none');
    expect(after.text).toBe('00:00:00');
  });

  it('boundary one second before end', () => {
    const r = deriveSaleCountdown(starts, ends, Date.parse('2026-07-30T11:59:59.000Z'));
    expect(r.mode).toBe('ends');
    expect(r.text).toBe('00:00:01');
  });

  it('startsAt === endsAt → none fallback at the endpoint', () => {
    const same = '2026-07-30T10:00:00.000Z';
    // When startMs === endMs, now >= start settles to none (not a positive ends window).
    expect(deriveSaleCountdown(same, same, Date.parse(same))).toEqual({
      label: '',
      mode: 'none',
      text: '00:00:00',
    });
  });

  it('invalid timestamps → none fallback', () => {
    expect(deriveSaleCountdown('not-a-date', ends, Date.now())).toEqual({
      label: '',
      mode: 'none',
      text: '00:00:00',
    });
  });
});

describe('useSaleCountdown', () => {
  it('uses injected now without inventing status', () => {
    const { result } = renderHook(() =>
      useSaleCountdown(
        '2026-07-30T10:00:00.000Z',
        '2026-07-30T12:00:00.000Z',
        Date.parse('2026-07-30T09:00:00.000Z'),
      ),
    );
    expect(result.current.mode).toBe('starts');
    expect(result.current.label).toBe('Starts in');
  });
});
