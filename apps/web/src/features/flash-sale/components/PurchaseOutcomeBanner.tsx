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
    <div data-testid="purchase-outcome" role="status">
      <p>
        <strong data-testid="purchase-outcome-status">{OUTCOME_HEADING[result.status]}</strong>
      </p>
      <p>{result.message}</p>
      {result.status === 'SUCCESS' && result.purchaseId ? (
        <p data-testid="purchase-id">Purchase ID: {result.purchaseId}</p>
      ) : null}
    </div>
  );
}
