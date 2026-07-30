import type { PurchaseSurfaceProps } from '../purchase-surface';

import { Button } from '../../../components/ui/Button';
import { IdentityStrip } from '../../identity/components/IdentityStrip';
import { PurchaseOutcomeBanner } from './PurchaseOutcomeBanner';
import { RequestErrorBanner } from './RequestErrorBanner';

type Props = PurchaseSurfaceProps & {
  showSummaries: boolean;
};

/**
 * Both `PurchaseRail` and `StickyBuyBar` render this and stay mounted at the
 * same time; visibility between them is CSS-only. Do not conditionally
 * render one vs. the other — dual presence in the a11y tree is intentional.
 */
export function PurchaseControls({
  alreadyPurchased,
  buyDisabled,
  buyPending,
  countdownSummary,
  helper,
  onBuy,
  purchaseError,
  purchaseOutcome,
  remainingSummary,
  showSummaries,
}: Props) {
  return (
    <div>
      <IdentityStrip />

      {showSummaries && remainingSummary ? (
        <p className="mt-4 text-sm text-emerald-950">
          {remainingSummary.remaining} / {remainingSummary.total} remaining
        </p>
      ) : null}

      {showSummaries && countdownSummary ? (
        <p className="mt-1 text-sm text-emerald-900/70">
          {countdownSummary.label} {countdownSummary.text}
        </p>
      ) : null}

      {alreadyPurchased ? (
        <div className="mt-4" data-testid="already-purchased" role="status">
          <p className="font-semibold text-emerald-950">Purchased</p>
          <p className="text-sm text-emerald-900/80">You have already purchased this item.</p>
        </div>
      ) : null}

      <Button
        className="mt-4 w-full px-4 py-2.5 disabled:cursor-not-allowed"
        disabled={buyDisabled}
        onClick={onBuy}
        variant="primary"
      >
        {buyPending ? 'Buying…' : 'Buy Now'}
      </Button>

      <div className="mt-2 min-h-[1.25rem]" data-testid="buy-helper">
        {!buyPending && helper ? <p className="text-sm text-amber-900/90">{helper}</p> : null}
      </div>

      {!buyPending && purchaseError ? (
        <div className="mt-3">
          <RequestErrorBanner
            message={purchaseError.message}
            onRetry={purchaseError.onRetry}
            title="Purchase request failed"
          />
        </div>
      ) : null}

      {!buyPending && purchaseOutcome ? (
        <div className="mt-3">
          <PurchaseOutcomeBanner result={purchaseOutcome} />
        </div>
      ) : null}
    </div>
  );
}
