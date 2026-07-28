import { FlashSaleNotFoundError } from '@flash-sale/domain';
import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';

import { GraphqlBadUserInputError } from './graphql-bad-user-input.error';
import { mapGraphqlError } from './map-graphql-error';

describe('mapGraphqlError', () => {
  it('maps FlashSaleNotFoundError to NOT_FOUND', () => {
    const err = mapGraphqlError(new FlashSaleNotFoundError());
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.extensions?.code).toBe('NOT_FOUND');
  });

  it('maps GraphqlBadUserInputError to BAD_USER_INPUT', () => {
    const err = mapGraphqlError(new GraphqlBadUserInputError('bad'));
    expect(err.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('scrubs HttpException to INTERNAL_SERVER_ERROR without leaking details', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const err = mapGraphqlError(new BadRequestException('missing field'));

    expect(err.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(err.message).toBe('Internal server error');
    expect(err.message).not.toMatch(/missing field/i);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('scrubs 5xx HttpException to INTERNAL_SERVER_ERROR and logs it', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const err = mapGraphqlError(new InternalServerErrorException('db connection dropped'));

    expect(err.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(err.message).toBe('Internal server error');
    expect(err.message).not.toMatch(/db connection/i);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('passes through a GraphQLError whose code is already a public code', () => {
    const original = new GraphQLError('bad input', {
      extensions: { code: 'BAD_USER_INPUT' },
    });

    const err = mapGraphqlError(original);

    expect(err).toBe(original);
  });

  it('passes through a GraphQLError with non-public code (native GraphQL errors remain intact)', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const original = new GraphQLError('Cannot query field "foo" on type "Query".', {
      extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
    });

    const err = mapGraphqlError(original);

    expect(err).toBe(original);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('passes through a GraphQLError with no code', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const original = new GraphQLError('Variable "$id" of required type "ID!" was not provided.');

    const err = mapGraphqlError(original);

    expect(err).toBe(original);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('scrubs unexpected errors to INTERNAL_SERVER_ERROR without leaking details', () => {
    const err = mapGraphqlError(new Error('prisma P2002 secret sql'));
    expect(err.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(err.message).toBe('Internal server error');
    expect(err.message).not.toMatch(/prisma|P2002|sql/i);
  });

  it('logs unexpected exceptions with original details', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const original = new Error('boom');

    mapGraphqlError(original);

    expect(errorSpy).toHaveBeenCalled();
    const latestCall = errorSpy.mock.calls.at(-1);
    expect(latestCall?.[0]).toBe('Unexpected GraphQL error');
    expect(String(latestCall?.[1])).toContain('boom');
    errorSpy.mockRestore();
  });
});
