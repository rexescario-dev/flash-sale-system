import { useEffect, useState } from 'react';

export type SaleCountdownMode = 'ends' | 'none' | 'starts';

export type SaleCountdownValue = {
  label: string;
  mode: SaleCountdownMode;
  text: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Always zero-padded HH:MM:SS duration (hours may exceed 24); clamps at zero. */
export function formatCountdownText(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function deriveSaleCountdown(
  startsAt: string,
  endsAt: string,
  nowMs: number,
): SaleCountdownValue {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { label: '', mode: 'none', text: '00:00:00' };
  }
  if (nowMs < startMs) {
    return {
      label: 'Starts in',
      mode: 'starts',
      text: formatCountdownText(startMs - nowMs),
    };
  }
  if (nowMs < endMs) {
    return {
      label: 'Ends in',
      mode: 'ends',
      text: formatCountdownText(endMs - nowMs),
    };
  }
  return { label: '', mode: 'none', text: '00:00:00' };
}

export function useSaleCountdown(
  startsAt: string,
  endsAt: string,
  now?: number,
): SaleCountdownValue {
  const [nowMs, setNowMs] = useState(() => now ?? Date.now());

  useEffect(() => {
    if (now !== undefined) {
      setNowMs(now);
      return;
    }
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [now]);

  return deriveSaleCountdown(startsAt, endsAt, nowMs);
}
