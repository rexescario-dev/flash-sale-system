import { type ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { type GqlContextType, type GqlExceptionFilter } from '@nestjs/graphql';
import { type GraphQLError } from 'graphql';

import { mapGraphqlError } from './map-graphql-error';

/**
 * Global exception filter (bound via APP_FILTER). Only GraphQL-context
 * exceptions are mapped to the public GraphQL error contract here;
 * non-GraphQL contexts (e.g. REST controllers) are delegated to Nest's
 * default HTTP exception handling so those exceptions are never swallowed
 * or mis-formatted as GraphQL errors.
 */
@Catch()
export class GraphqlExceptionFilter extends BaseExceptionFilter implements GqlExceptionFilter {
  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): GraphQLError | void {
    if (host.getType<GqlContextType>() !== 'graphql') {
      return super.catch(exception, host);
    }

    return mapGraphqlError(exception);
  }
}
