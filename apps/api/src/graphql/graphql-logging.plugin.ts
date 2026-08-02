import type { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import type { GraphQLError } from 'graphql';

import type { AppLogger } from '../logging/app-logger';

import { LogEvent } from '../logging/log-event';

/** Private allow-list (not part of the public logging contract). Extend when new expected app errors appear. */
const EXPECTED_EXECUTION_ERROR_CODES = new Set(['RATE_LIMITED', 'BAD_USER_INPUT', 'NOT_FOUND']);

function errorCode(
  err: { extensions?: { code?: unknown }; message: string } | GraphQLError,
): string | undefined {
  const code = err.extensions?.code;
  return typeof code === 'string' ? code : undefined;
}

function isExpectedErrorsOnly(
  errors: readonly { extensions?: { code?: unknown }; message: string }[],
): boolean {
  return (
    errors.length > 0 &&
    errors.every((err) => {
      const code = errorCode(err);
      return code !== undefined && EXPECTED_EXECUTION_ERROR_CODES.has(code);
    })
  );
}

export function createGraphqlLoggingPlugin(appLogger: AppLogger): ApolloServerPlugin {
  return {
    async requestDidStart(): Promise<GraphQLRequestListener<Record<string, unknown>>> {
      const startedAt = Date.now();
      let executionBegan = false;
      let operationName: null | string = null;
      let operationType: string | undefined;
      let encounteredErrors: readonly { extensions?: { code?: unknown }; message: string }[] = [];

      return {
        async didEncounterErrors(ctx) {
          encounteredErrors = ctx.errors ?? [];
        },

        async didResolveOperation(ctx) {
          executionBegan = true;
          operationName = ctx.operationName ?? null;
          operationType = ctx.operation?.operation;
        },

        async willSendResponse() {
          if (!executionBegan) {
            return;
          }

          const durationMs = Date.now() - startedAt;
          const fields = {
            durationMs,
            operationName,
            operationType,
          };

          if (encounteredErrors.length === 0 || isExpectedErrorsOnly(encounteredErrors)) {
            appLogger.info(LogEvent.GRAPHQL_REQUEST_COMPLETED, fields);
            return;
          }

          const unexpected =
            encounteredErrors.find((err) => {
              const code = errorCode(err);
              return code === undefined || !EXPECTED_EXECUTION_ERROR_CODES.has(code);
            }) ?? encounteredErrors[0];
          appLogger.error(
            LogEvent.GRAPHQL_REQUEST_FAILED,
            fields,
            unexpected?.message ?? 'unknown error',
          );
        },
      };
    },
  };
}
