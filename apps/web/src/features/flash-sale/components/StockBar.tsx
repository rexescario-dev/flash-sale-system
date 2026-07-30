type Props = { remaining: number; total: number };

export function StockBar({ remaining, total }: Props) {
  const pct = total <= 0 ? 0 : Math.min(100, Math.max(0, (remaining / total) * 100));
  return (
    <div data-testid="stock-bar">
      <div className="mb-1 h-2 overflow-hidden rounded bg-emerald-900/10">
        <div
          className="h-full bg-emerald-700 transition-[width]"
          data-testid="stock-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm font-semibold text-emerald-950">
        <span data-testid="sale-stock">
          {remaining} / {total}
        </span>{' '}
        remaining
      </p>
    </div>
  );
}
