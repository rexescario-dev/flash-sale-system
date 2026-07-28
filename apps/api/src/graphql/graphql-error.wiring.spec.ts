import type { ArgumentsHost } from '@nestjs/common';

import { BaseExceptionFilter, type HttpAdapterHost } from '@nestjs/core';
import { GraphQLError } from 'graphql';

import { GraphqlExceptionFilter } from './graphql-error.wiring';
import * as mapGraphqlErrorModule from './map-graphql-error';

function buildHost(type: string): ArgumentsHost {
  return { getType: () => type } as unknown as ArgumentsHost;
}

function buildAdapterHost(): HttpAdapterHost {
  return { httpAdapter: {} } as HttpAdapterHost;
}

describe('GraphqlExceptionFilter', () => {
  it('maps GraphQL-context exceptions via mapGraphqlError', () => {
    const filter = new GraphqlExceptionFilter(buildAdapterHost());
    const mapped = new GraphQLError('mapped');
    const mapSpy = jest.spyOn(mapGraphqlErrorModule, 'mapGraphqlError').mockReturnValue(mapped);

    const result = filter.catch(new Error('boom'), buildHost('graphql'));

    expect(mapSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(mapped);

    mapSpy.mockRestore();
  });

  it('delegates non-GraphQL contexts to base HTTP exception handling without mapping', () => {
    const filter = new GraphqlExceptionFilter(buildAdapterHost());
    const mapSpy = jest.spyOn(mapGraphqlErrorModule, 'mapGraphqlError');
    const baseCatchSpy = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);

    const exception = new Error('http boom');
    const host = buildHost('http');
    filter.catch(exception, host);

    expect(baseCatchSpy).toHaveBeenCalledWith(exception, host);
    expect(mapSpy).not.toHaveBeenCalled();

    baseCatchSpy.mockRestore();
    mapSpy.mockRestore();
  });
});
