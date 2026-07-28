export class GraphqlBadUserInputError extends Error {
  readonly code = 'BAD_USER_INPUT' as const;

  constructor(message = 'Invalid input') {
    super(message);
    this.name = 'GraphqlBadUserInputError';
  }
}
