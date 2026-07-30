import type { ReactNode } from 'react';

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
      <div className="rounded-md bg-white/70 p-4" data-testid="purchases-error" role="alert">
        <p className="font-semibold">Could not load purchases</p>
        <p className="mt-1 text-sm">{purchasesQuery.error.message}</p>
        <button
          className="mt-3 rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
          data-testid="purchases-retry"
          onClick={() => {
            void purchasesQuery.refetch();
          }}
          type="button"
        >
          Try again
        </button>
      </div>
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
      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-700">
        Flash Sale System
      </p>
      <h1 className="mb-2 text-3xl font-semibold text-emerald-950 sm:text-4xl">My purchases</h1>
      <p className="mb-8 max-w-2xl text-emerald-900/70">
        Purchase history for your current User ID. This demo is not authenticated private history.
      </p>
      {body}
    </main>
  );
}
