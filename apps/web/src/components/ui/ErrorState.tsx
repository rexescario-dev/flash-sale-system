import type { HTMLAttributes } from 'react';

import { Button } from './Button';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  message: string;
  onRetry: () => void;
  title: string;
};

export function ErrorState({ className, message, onRetry, title, ...rest }: Props) {
  const retryTestId =
    typeof rest['data-testid'] === 'string' && rest['data-testid'].endsWith('-error')
      ? rest['data-testid'].replace(/-error$/, '-retry')
      : undefined;
  return (
    <div
      className={['rounded-md bg-white/70 p-4', className].filter(Boolean).join(' ')}
      role="alert"
      {...rest}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      <Button className="mt-3" data-testid={retryTestId} onClick={onRetry} type="button">
        Try again
      </Button>
    </div>
  );
}
