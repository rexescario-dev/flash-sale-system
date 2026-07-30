import type { PurchaseSurfaceProps } from '../purchase-surface';

import { PurchaseControls } from './PurchaseControls';

export function StickyBuyBar(props: PurchaseSurfaceProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 border-t border-emerald-900/15 bg-[#f3f7f4]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      data-testid="sticky-buy-bar"
    >
      <PurchaseControls {...props} showSummaries={false} />
    </div>
  );
}
