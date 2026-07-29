import type { FlashSale } from '../../../graphql/types';

type Props = {
  sale: FlashSale;
};

export function SaleStatusCard({ sale }: Props) {
  return (
    <section aria-label="Sale status">
      <p>
        Status: <strong data-testid="sale-status">{sale.status}</strong>
      </p>
      <p>
        Stock:{' '}
        <span data-testid="sale-stock">
          {sale.remainingStock} / {sale.totalStock}
        </span>
      </p>
      <p className="muted">
        Window: {sale.startsAt} → {sale.endsAt}
      </p>
    </section>
  );
}
