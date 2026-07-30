import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';

const VARIANT: Record<'primary' | 'secondary', string> = {
  primary:
    'rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50',
  secondary: 'rounded px-3 py-1.5 text-sm font-semibold text-emerald-800',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { children, className, type = 'button', variant = 'primary', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[VARIANT[variant], className].filter(Boolean).join(' ')}
      type={type}
      {...rest}
    >
      {children}
    </button>
  );
});
