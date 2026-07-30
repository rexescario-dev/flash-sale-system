import type { ReactNode } from 'react';

import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/ui/PageHeader';
import { FlashSaleCard } from '../features/catalog/components/FlashSaleCard';
import { IdentityStrip } from '../features/identity/components/IdentityStrip';
import { useFlashSales } from '../hooks/useFlashSales';

export function CatalogPage() {
  const catalogQuery = useFlashSales();

  let body: ReactNode;
  if (catalogQuery.isPending) {
    body = <p data-testid="catalog-loading">Loading catalog…</p>;
  } else if (catalogQuery.isError) {
    body = (
      <ErrorState
        data-testid="catalog-error"
        message={catalogQuery.error.message}
        onRetry={() => {
          void catalogQuery.refetch();
        }}
        title="Could not load catalog"
      />
    );
  } else if ((catalogQuery.data ?? []).length === 0) {
    body = <p data-testid="catalog-empty">No flash sales are available right now.</p>;
  } else {
    body = (
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalogQuery.data!.map((sale) => (
          <li key={sale.id}>
            <FlashSaleCard sale={sale} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-testid="catalog-page">
      <IdentityStrip />
      <PageHeader
        description="Browse open and upcoming sales. Select a sale to view details."
        eyebrow="Flash Sale System"
        title="Flash sales"
      />
      {body}
    </main>
  );
}
