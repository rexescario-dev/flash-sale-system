import type { ReactNode } from 'react';

import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/ui/PageHeader';
import { IdentityStrip } from '../features/identity/components/IdentityStrip';
import { useUserIdentity } from '../features/identity/IdentityProvider';
import { PurchaseHistoryPanel } from '../features/purchases/components/PurchaseHistoryPanel';
import { isNonWhitespaceId } from '../graphql/id';
import { useMyPurchases } from '../hooks/useMyPurchases';

export function PurchasesPage() {
  const { userId } = useUserIdentity();
  const isGuest = !isNonWhitespaceId(userId ?? '');
  const purchasesQuery = useMyPurchases(userId ?? '');

  let body: ReactNode;
  if (isGuest) {
    body = (
      <div data-testid="purchases-guest">
        <p className="font-semibold text-emerald-950">No purchases to show yet</p>
        <p className="mt-1 text-sm text-emerald-900/70">
          Identify yourself using the banner above to view the purchase history associated with your
          User ID.
        </p>
      </div>
    );
  } else if (purchasesQuery.isPending) {
    body = <p data-testid="purchases-loading">Loading purchases…</p>;
  } else if (purchasesQuery.isError) {
    body = (
      <ErrorState
        data-testid="purchases-error"
        message={purchasesQuery.error.message}
        onRetry={() => {
          void purchasesQuery.refetch();
        }}
        title="Could not load purchases"
      />
    );
  } else if ((purchasesQuery.data ?? []).length === 0) {
    body = (
      <p data-testid="purchases-empty">Identified, but no purchases exist for this User ID.</p>
    );
  } else {
    body = (
      <ul className="flex flex-col gap-4">
        {purchasesQuery.data!.map((row) => (
          <li key={row.id}>
            <PurchaseHistoryPanel item={row} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-testid="purchases-page">
      <IdentityStrip />
      <PageHeader
        description="Purchase history for your current User ID. This demo is not authenticated private history."
        eyebrow="Flash Sale System"
        title="My purchases"
      />
      {body}
    </main>
  );
}
