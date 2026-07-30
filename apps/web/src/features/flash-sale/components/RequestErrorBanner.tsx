type Props = {
  message: string;
  onRetry?: () => void;
  title?: string;
};

export function RequestErrorBanner({ message, onRetry, title = 'Something went wrong' }: Props) {
  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 p-4"
      data-testid="request-error"
      role="alert"
    >
      <p className="font-semibold text-red-900">{title}</p>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {onRetry ? (
        <button
          className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
