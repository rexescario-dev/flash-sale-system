import type { HTMLAttributes, ReactNode } from 'react';

const BASE = 'rounded-lg border border-emerald-900/15 bg-white/70 p-4';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className, ...rest }: Props) {
  return (
    <div className={[BASE, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
