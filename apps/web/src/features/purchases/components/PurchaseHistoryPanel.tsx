import { Link } from 'react-router-dom';

import type { PurchaseHistoryItem } from '../../../graphql/types';

import { formatPurchasedAt } from '../format-purchased-at';

type Props = {
  item: PurchaseHistoryItem;
};

export function PurchaseHistoryPanel({ item }: Props) {
  const description = item.product.description?.trim() ? item.product.description : null;

  return (
    <article
      className="rounded-lg border border-emerald-900/15 bg-white/70 p-4"
      data-testid="purchase-panel"
    >
      <h2 className="text-lg font-semibold text-emerald-950">{item.product.name}</h2>
      <p className="mt-1 text-sm text-emerald-900/70">
        <span className="font-medium text-emerald-950">Purchased:</span>{' '}
        {formatPurchasedAt(item.purchasedAt)}
      </p>
      {description ? (
        <p
          className="mt-2 line-clamp-3 text-sm text-emerald-900/70"
          data-testid="purchase-panel-description"
        >
          {description}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-emerald-900/50">{item.id}</p>
      <Link
        className="mt-3 inline-block text-sm font-semibold text-emerald-800 underline"
        data-testid="purchase-sale-link"
        to={`/sales/${item.flashSale.id}`}
      >
        View sale
      </Link>
    </article>
  );
}
