import type { ReactNode } from 'react';

import { FlashSaleCard } from '../features/catalog/components/FlashSaleCard';
import { useFlashSales } from '../hooks/useFlashSales';

export function CatalogPage() {
  const catalogQuery = useFlashSales();

  let body: ReactNode;
  if (catalogQuery.isPending) {
    body = <p data-testid="catalog-loading">Loading catalog…</p>;
  } else if (catalogQuery.isError) {
    body = (
      <div className="rounded-md bg-white/70 p-4" data-testid="catalog-error" role="alert">
        <p className="font-semibold">Could not load catalog</p>
        <p className="mt-1 text-sm">{catalogQuery.error.message}</p>
        <button
          className="mt-3 rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
          data-testid="catalog-retry"
          onClick={() => {
            void catalogQuery.refetch();
          }}
          type="button"
        >
          Try again
        </button>
      </div>
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
      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-700">
        Flash Sale System
      </p>
      <h1 className="mb-2 text-3xl font-semibold text-emerald-950 sm:text-4xl">Flash sales</h1>
      <p className="mb-8 max-w-2xl text-emerald-900/70">
        Browse open and upcoming sales. Select a sale to view details.
      </p>
      {body}
    </main>
  );
}
