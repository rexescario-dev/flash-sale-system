import { describe, expect, it } from 'vitest';

import { type BuyEligibilityInput, isBuyDisabled } from './buy-eligibility';

const base: BuyEligibilityInput = {
  flashSaleError: false,
  flashSaleLoading: false,
  flashSaleStatus: 'ACTIVE',
  mutationPending: false,
  myPurchaseInitialPending: false,
  purchased: false,
  userIdValid: true,
};

describe('isBuyDisabled', () => {
  it('enables Buy when ACTIVE, purchased false, and not pending', () => {
    expect(isBuyDisabled(base)).toBe(false);
  });

  it('disables when myPurchase is initially pending', () => {
    expect(isBuyDisabled({ ...base, myPurchaseInitialPending: true })).toBe(true);
  });

  it('does not disable for myPurchase error alone (purchased undefined, not pending)', () => {
    expect(
      isBuyDisabled({
        ...base,
        myPurchaseInitialPending: false,
        purchased: undefined,
      }),
    ).toBe(false);
  });

  it('disables when purchased is true', () => {
    expect(isBuyDisabled({ ...base, purchased: true })).toBe(true);
  });

  it('disables when flashSale is loading or errored', () => {
    expect(isBuyDisabled({ ...base, flashSaleLoading: true })).toBe(true);
    expect(isBuyDisabled({ ...base, flashSaleError: true })).toBe(true);
  });

  it('disables when status is not ACTIVE', () => {
    expect(isBuyDisabled({ ...base, flashSaleStatus: 'UPCOMING' })).toBe(true);
    expect(isBuyDisabled({ ...base, flashSaleStatus: 'SOLD_OUT' })).toBe(true);
    expect(isBuyDisabled({ ...base, flashSaleStatus: 'ENDED' })).toBe(true);
  });
});
