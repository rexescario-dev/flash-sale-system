import type { PurchaseSurfaceProps } from '../purchase-surface';

import { PurchaseControls } from './PurchaseControls';

export function PurchaseRail(props: PurchaseSurfaceProps) {
  return (
    <aside
      className="hidden rounded-xl border border-emerald-900/15 bg-white/70 p-6 shadow-sm lg:sticky lg:top-6 lg:block"
      data-testid="purchase-rail"
    >
      <PurchaseControls {...props} showSummaries />
    </aside>
  );
}
