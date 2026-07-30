import type { ReactNode } from 'react';

import type { PurchaseItemResult } from '../../graphql/types';

export type PurchaseSurfaceProps = {
  alreadyPurchased?: boolean;
  buyDisabled: boolean;
  buyPending: boolean;
  countdownSummary?: { label: string; text: string } | null;
  helper?: ReactNode;
  onBuy: () => void;
  purchaseError?: { message: string; onRetry: () => void } | null;
  purchaseOutcome?: null | PurchaseItemResult;
  remainingSummary?: { remaining: number; total: number };
};
