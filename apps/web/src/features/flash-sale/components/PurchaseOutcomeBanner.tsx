import type { PurchaseItemResult, PurchaseOutcome } from '../../../graphql/types';

const OUTCOME_HEADING: Record<PurchaseOutcome, string> = {
  ALREADY_PURCHASED: 'Already purchased',
  SALE_ENDED: 'Sale ended',
  SALE_NOT_STARTED: 'Sale not started',
  SOLD_OUT: 'Sold out',
  SUCCESS: 'Purchase successful',
};

type Props = {
  result: PurchaseItemResult;
};

export function PurchaseOutcomeBanner({ result }: Props) {
  return (
    <div
      className="rounded-md border border-emerald-900/15 bg-white/70 p-4"
      data-testid="purchase-outcome"
      role="status"
    >
      <p className="font-semibold text-emerald-950" data-testid="purchase-outcome-status">
        {OUTCOME_HEADING[result.status]}
      </p>
      <p className="mt-1 text-sm text-emerald-900/80">{result.message}</p>
      {result.status === 'SUCCESS' && result.purchaseId ? (
        <p className="mt-2 text-xs text-emerald-900/60" data-testid="purchase-id">
          Purchase ID: {result.purchaseId}
        </p>
      ) : null}
    </div>
  );
}
