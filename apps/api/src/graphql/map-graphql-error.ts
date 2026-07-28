import { FlashSaleNotFoundError } from '@flash-sale/domain';
import { Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';

import { GraphqlBadUserInputError } from './graphql-bad-user-input.error';

const logger = new Logger('mapGraphqlError');

function logUnexpected(exception: unknown): void {
  logger.error(
    'Unexpected GraphQL error',
    exception instanceof Error ? exception.stack : String(exception),
  );
}

function internalServerError(): GraphQLError {
  return new GraphQLError('Internal server error', {
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  });
}

/** Maps exceptions to the public GraphQL error contract and logs unexpected errors. */
export function mapGraphqlError(exception: unknown): GraphQLError {
  if (exception instanceof FlashSaleNotFoundError) {
    return new GraphQLError(exception.message, {
      extensions: { code: 'NOT_FOUND' },
    });
  }

  if (exception instanceof GraphqlBadUserInputError) {
    return new GraphQLError(exception.message, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (exception instanceof GraphQLError) {
    return exception;
  }

  logUnexpected(exception);
  return internalServerError();
}
