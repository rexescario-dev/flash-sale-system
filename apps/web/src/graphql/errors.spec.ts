import { ClientError, type GraphQLResponse } from 'graphql-request';
import { describe, expect, it } from 'vitest';

import { RequestError, toRequestError } from './errors';

function makeClientError(partial: {
  data: unknown;
  errors: Array<{ extensions?: { code?: string }; message: string }>;
}): ClientError {
  const response = {
    body: '{}',
    data: partial.data,
    errors: partial.errors,
    headers: new Headers(),
    status: 200,
  } as unknown as GraphQLResponse;
  return new ClientError(response, { query: 'query { flashSale(id: "x") { id } }' });
}

describe('toRequestError', () => {
  it('maps GraphQL ClientError failures to safe GRAPHQL copy without leaking backend message', () => {
    const clientError = makeClientError({
      data: null,
      errors: [
        {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
          message: 'Purchase failed because transaction serialization failed at xid=42',
        },
      ],
    });

    const err = toRequestError(clientError);
    expect(err).toBeInstanceOf(RequestError);
    expect(err.kind).toBe('GRAPHQL');
    expect(err.code).toBe('INTERNAL_SERVER_ERROR');
    expect(err.message).toBe("We couldn't complete your request. Please try again.");
    expect(err.message).not.toContain('transaction serialization');
  });

  it('maps ClientError with both data and errors to safe GRAPHQL copy', () => {
    const clientError = makeClientError({
      data: { flashSale: null },
      errors: [
        {
          extensions: { code: 'NOT_FOUND' },
          message: 'FlashSale not found in warehouse rack B-12',
        },
      ],
    });

    const err = toRequestError(clientError);
    expect(err.kind).toBe('GRAPHQL');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).not.toContain('warehouse');
  });

  it('maps network/transport failures to safe NETWORK copy', () => {
    const err = toRequestError(new TypeError('Failed to fetch'));
    expect(err.kind).toBe('NETWORK');
    expect(err.message).toBe(
      "We couldn't reach the server. Please check your connection and try again.",
    );
  });
});
