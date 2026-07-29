export class GraphqlRateLimitedError extends Error {
  readonly code = 'RATE_LIMITED' as const;

  constructor(message = 'Rate limit exceeded') {
    super(message);
    this.name = 'GraphqlRateLimitedError';
  }
}
