type Props = {
  message: string;
  onRetry?: () => void;
  title?: string;
};

export function RequestErrorBanner({ message, onRetry, title = 'Something went wrong' }: Props) {
  return (
    <div data-testid="request-error" role="alert">
      <p>
        <strong>{title}</strong>
      </p>
      <p>{message}</p>
      {onRetry ? (
        <button onClick={onRetry} type="button">
          Try again
        </button>
      ) : null}
    </div>
  );
}
