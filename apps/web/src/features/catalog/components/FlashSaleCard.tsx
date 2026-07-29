import { Link } from 'react-router-dom';

import type { CatalogFlashSale } from '../../../graphql/types';

import { SaleStatusBadge } from './SaleStatusBadge';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

type Props = {
  sale: CatalogFlashSale;
};

export function FlashSaleCard({ sale }: Props) {
  const description = sale.product.description?.trim() ? sale.product.description : null;

  return (
    <Link
      className="block rounded-lg border border-emerald-900/15 bg-white/70 p-4 shadow-sm transition hover:border-emerald-700/40 hover:bg-white"
      data-testid="catalog-card"
      to={`/sales/${sale.id}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-emerald-950">{sale.product.name}</h2>
        <SaleStatusBadge status={sale.status} />
      </div>

      {description ? (
        <p className="mb-3 text-sm text-emerald-900/70" data-testid="catalog-card-description">
          {description}
        </p>
      ) : null}

      <p className="text-base font-semibold text-emerald-950">
        {sale.remainingStock} / {sale.totalStock} remaining
      </p>

      <p className="mt-2 text-xs text-emerald-900/60">
        {formatWhen(sale.startsAt)} – {formatWhen(sale.endsAt)}
      </p>
    </Link>
  );
}
