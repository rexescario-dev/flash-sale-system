import type { FlashSaleStatus } from '../../../graphql/types';

const BADGE: Record<FlashSaleStatus, { className: string; label: string }> = {
  ACTIVE: {
    className: 'bg-green-100 text-green-800',
    label: 'Active',
  },
  ENDED: {
    className: 'bg-neutral-200 text-neutral-700',
    label: 'Ended',
  },
  SOLD_OUT: {
    className: 'bg-red-100 text-red-800',
    label: 'Sold Out',
  },
  UPCOMING: {
    className: 'bg-amber-100 text-amber-800',
    label: 'Upcoming',
  },
};

type Props = {
  status: FlashSaleStatus;
};

export function SaleStatusBadge({ status }: Props) {
  const { className, label } = BADGE[status];
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${className}`}
      data-status={status}
      data-testid="sale-status-badge"
    >
      {label}
    </span>
  );
}
