import type { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';

import { AppLogger } from '../logging/app-logger';
import { LogEvent } from '../logging/log-event';
import { createGraphqlLoggingPlugin } from './graphql-logging.plugin';

type Listener = GraphQLRequestListener<Record<string, unknown>>;

async function startListener(
  plugin: ApolloServerPlugin,
  request: { operationName?: null | string; query?: string },
): Promise<Listener> {
  const result = await plugin.requestDidStart?.({
    contextValue: {},
    request,
  } as never);
  if (!result) {
    throw new Error('expected request listener');
  }
  return result as Listener;
}

describe('createGraphqlLoggingPlugin', () => {
  let appLogger: { error: jest.Mock; info: jest.Mock };
  let plugin: ApolloServerPlugin;

  beforeEach(() => {
    appLogger = {
      error: jest.fn(),
      info: jest.fn(),
    };
    plugin = createGraphqlLoggingPlugin(appLogger as unknown as AppLogger);
  });

  it('emits graphql.request.completed on successful execution', async () => {
    const listener = await startListener(plugin, {
      operationName: 'PurchaseItem',
      query: 'mutation PurchaseItem { purchaseItem }',
    });

    await listener.didResolveOperation?.({
      operation: { operation: 'mutation' },
      operationName: 'PurchaseItem',
    } as never);

    await listener.willSendResponse?.({} as never);

    expect(appLogger.info).toHaveBeenCalledWith(
      LogEvent.GRAPHQL_REQUEST_COMPLETED,
      expect.objectContaining({
        durationMs: expect.any(Number),
        operationName: 'PurchaseItem',
        operationType: 'mutation',
      }),
    );
    expect(appLogger.error).not.toHaveBeenCalled();
  });

  it('emits completed when only expected GraphQL error codes are present', async () => {
    const listener = await startListener(plugin, {
      operationName: 'PurchaseItem',
      query: 'mutation { purchaseItem }',
    });

    await listener.didResolveOperation?.({
      operation: { operation: 'mutation' },
      operationName: 'PurchaseItem',
    } as never);

    await listener.didEncounterErrors?.({
      errors: [{ extensions: { code: 'RATE_LIMITED' }, message: 'rate limited' }],
    } as never);

    await listener.willSendResponse?.({} as never);

    expect(appLogger.info).toHaveBeenCalledWith(
      LogEvent.GRAPHQL_REQUEST_COMPLETED,
      expect.objectContaining({
        durationMs: expect.any(Number),
        operationName: 'PurchaseItem',
        operationType: 'mutation',
      }),
    );
    expect(appLogger.error).not.toHaveBeenCalled();
  });

  it('emits failed with error string and no stack for unexpected errors', async () => {
    const listener = await startListener(plugin, {
      operationName: 'PurchaseItem',
      query: 'mutation { purchaseItem }',
    });

    await listener.didResolveOperation?.({
      operation: { operation: 'mutation' },
      operationName: 'PurchaseItem',
    } as never);

    await listener.didEncounterErrors?.({
      errors: [
        {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
          message: 'Internal server error',
          stack: 'Error: Internal server error\n    at x',
        },
      ],
    } as never);

    await listener.willSendResponse?.({} as never);

    expect(appLogger.error).toHaveBeenCalledTimes(1);
    expect(appLogger.error).toHaveBeenCalledWith(
      LogEvent.GRAPHQL_REQUEST_FAILED,
      expect.objectContaining({
        durationMs: expect.any(Number),
        operationName: 'PurchaseItem',
        operationType: 'mutation',
      }),
      'Internal server error',
    );
    const fields = appLogger.error.mock.calls[0][1] as Record<string, unknown>;
    expect(fields).not.toHaveProperty('error');
    expect(fields).not.toHaveProperty('stack');
    expect(JSON.stringify(appLogger.error.mock.calls[0])).not.toContain('at x');
    expect(appLogger.info).not.toHaveBeenCalled();
  });

  it('emits no graphql.request.* when execution never begins (no didResolveOperation)', async () => {
    const listener = await startListener(plugin, {
      operationName: null,
      query: '{',
    });

    await listener.willSendResponse?.({} as never);
    await listener.didEncounterErrors?.({
      errors: [{ message: 'Syntax Error' }],
    } as never);

    expect(appLogger.info).not.toHaveBeenCalled();
    expect(appLogger.error).not.toHaveBeenCalled();
  });

  it('emits completed with operationName null for anonymous operations', async () => {
    const listener = await startListener(plugin, {
      operationName: null,
      query: 'mutation { purchaseItem }',
    });

    await listener.didResolveOperation?.({
      operation: { operation: 'mutation' },
      operationName: null,
    } as never);

    await listener.willSendResponse?.({} as never);

    expect(appLogger.info).toHaveBeenCalledWith(
      LogEvent.GRAPHQL_REQUEST_COMPLETED,
      expect.objectContaining({
        durationMs: expect.any(Number),
        operationName: null,
        operationType: 'mutation',
      }),
    );
  });

  it('emits failed when any unexpected error is mixed with expected codes', async () => {
    const listener = await startListener(plugin, {
      operationName: 'PurchaseItem',
      query: 'mutation { purchaseItem }',
    });

    await listener.didResolveOperation?.({
      operation: { operation: 'mutation' },
      operationName: 'PurchaseItem',
    } as never);

    await listener.didEncounterErrors?.({
      errors: [
        { extensions: { code: 'RATE_LIMITED' }, message: 'rate limited' },
        { extensions: { code: 'INTERNAL_SERVER_ERROR' }, message: 'boom' },
      ],
    } as never);

    await listener.willSendResponse?.({} as never);

    expect(appLogger.error).toHaveBeenCalledWith(
      LogEvent.GRAPHQL_REQUEST_FAILED,
      expect.objectContaining({
        operationName: 'PurchaseItem',
        operationType: 'mutation',
      }),
      'boom',
    );
    expect(appLogger.info).not.toHaveBeenCalled();
  });
});
