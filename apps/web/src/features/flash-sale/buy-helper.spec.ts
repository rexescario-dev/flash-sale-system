import { describe, expect, it } from 'vitest';

import type { SaleCountdownValue } from '../../hooks/useSaleCountdown';

import { getBuyHelper } from './buy-helper';

const ends: SaleCountdownValue = { label: 'Ends in', mode: 'ends', text: '01:00:00' };
const starts: SaleCountdownValue = { label: 'Starts in', mode: 'starts', text: '00:12:31' };

describe('getBuyHelper', () => {
  it('returns undefined when pending', () => {
    expect(
      getBuyHelper({
        userId: null,
        alreadyPurchased: false,
        buyPending: true,
        countdown: starts,
        flashSaleLoading: false,
        flashSaleStatus: 'UPCOMING',
        myPurchaseInitialPending: false,
      }),
    ).toBeUndefined();
  });

  it('guest → enter email line', () => {
    expect(
      getBuyHelper({
        userId: null,
        alreadyPurchased: false,
        buyPending: false,
        countdown: ends,
        flashSaleLoading: false,
        flashSaleStatus: 'ACTIVE',
        myPurchaseInitialPending: false,
      }),
    ).toBe('Enter your email to continue.');
  });

  it('UPCOMING uses starts-in countdown text', () => {
    expect(
      getBuyHelper({
        userId: 'a@b.com',
        alreadyPurchased: false,
        buyPending: false,
        countdown: starts,
        flashSaleLoading: false,
        flashSaleStatus: 'UPCOMING',
        myPurchaseInitialPending: false,
      }),
    ).toBe('Sale starts in 00:12:31.');
  });

  it('SOLD_OUT / ENDED messages', () => {
    const base = {
      userId: 'a@b.com',
      alreadyPurchased: false,
      buyPending: false,
      countdown: ends,
      flashSaleLoading: false,
      myPurchaseInitialPending: false,
    } as const;
    expect(getBuyHelper({ ...base, flashSaleStatus: 'SOLD_OUT' })).toBe('This sale is sold out.');
    expect(getBuyHelper({ ...base, flashSaleStatus: 'ENDED' })).toBe('This sale has ended.');
  });

  it('already purchased → undefined (positive status handled by surface)', () => {
    expect(
      getBuyHelper({
        userId: 'a@b.com',
        alreadyPurchased: true,
        buyPending: false,
        countdown: ends,
        flashSaleLoading: false,
        flashSaleStatus: 'ACTIVE',
        myPurchaseInitialPending: false,
      }),
    ).toBeUndefined();
  });

  it('ACTIVE identified → undefined', () => {
    expect(
      getBuyHelper({
        userId: 'a@b.com',
        alreadyPurchased: false,
        buyPending: false,
        countdown: ends,
        flashSaleLoading: false,
        flashSaleStatus: 'ACTIVE',
        myPurchaseInitialPending: false,
      }),
    ).toBeUndefined();
  });
});
