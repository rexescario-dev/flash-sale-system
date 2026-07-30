import type { SaleCountdownValue } from '../../../hooks/useSaleCountdown';

type Props = {
  countdown: SaleCountdownValue;
};

export function SaleCountdown({ countdown }: Props) {
  if (countdown.mode === 'none') {
    return null;
  }

  return (
    <div data-testid="sale-countdown">
      <p className="text-sm text-emerald-900/70">{countdown.label}</p>
      <p className="font-mono text-2xl font-semibold tracking-wide text-emerald-950">
        {countdown.text}
      </p>
    </div>
  );
}
