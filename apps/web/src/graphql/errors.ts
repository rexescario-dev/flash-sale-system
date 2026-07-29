import { ClientError } from 'graphql-request';

export type RequestErrorKind = 'GRAPHQL' | 'NETWORK' | 'UNKNOWN';

export class RequestError extends Error {
  readonly code?: string;
  readonly kind: RequestErrorKind;

  constructor(message: string, kind: RequestErrorKind, code?: string) {
    super(message);
    this.name = 'RequestError';
    this.kind = kind;
    this.code = code;
  }
}

const SAFE_GRAPHQL = "We couldn't complete your request. Please try again.";
const SAFE_NETWORK = "We couldn't reach the server. Please check your connection and try again.";
const SAFE_UNKNOWN = 'Something went wrong. Please try again.';

export function toRequestError(error: unknown): RequestError {
  if (error instanceof RequestError) {
    return error;
  }

  if (error instanceof ClientError) {
    return new RequestError(SAFE_GRAPHQL, 'GRAPHQL', readGraphqlCode(error));
  }

  if (isNetworkError(error)) {
    return new RequestError(SAFE_NETWORK, 'NETWORK');
  }

  return new RequestError(SAFE_UNKNOWN, 'UNKNOWN');
}

function readGraphqlCode(error: ClientError): string | undefined {
  const code = error.response.errors?.[0]?.extensions?.['code'];
  return typeof code === 'string' ? code : undefined;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return (
      error.name === 'AbortError' || error.name === 'NetworkError' || error.name === 'TimeoutError'
    );
  }
  return false;
}
