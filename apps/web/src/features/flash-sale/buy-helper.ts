import type { ReactNode } from 'react';

import type { FlashSaleStatus } from '../../graphql/types';
import type { SaleCountdownValue } from '../../hooks/useSaleCountdown';

export type BuyHelperInput = {
  userId: null | string;
  alreadyPurchased: boolean;
  buyPending: boolean;
  countdown: SaleCountdownValue;
  flashSaleLoading: boolean;
  flashSaleStatus: FlashSaleStatus | undefined;
  myPurchaseInitialPending: boolean;
};

/** Single concise line for current UX; returns undefined when no helper. */
export function getBuyHelper(input: BuyHelperInput): ReactNode | undefined {
  if (input.buyPending) return undefined;
  if (input.userId === null) return 'Enter your email to continue.';
  if (input.flashSaleStatus === 'UPCOMING') {
    if (input.countdown.mode === 'starts') {
      return `Sale starts in ${input.countdown.text}.`;
    }
    return 'Sale has not started yet.';
  }
  if (input.flashSaleStatus === 'SOLD_OUT') return 'This sale is sold out.';
  if (input.flashSaleStatus === 'ENDED') return 'This sale has ended.';
  if (input.alreadyPurchased) return undefined;
  if (input.flashSaleLoading || input.myPurchaseInitialPending) {
    return 'Checking purchase status…';
  }
  return undefined;
}
