import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { CLOCK, SystemClock } from './clock';
import { GraphqlExceptionFilter } from './graphql-error.wiring';

@Global()
@Module({
  exports: [CLOCK],
  providers: [
    SystemClock,
    // Chosen wiring: Nest GqlExceptionFilter via APP_FILTER.
    // #26 HTTP GraphQL assertions are the authority that this delivers the
    // locked extensions.code contract; not pre-proven by this module alone.
    {
      provide: APP_FILTER,
      useClass: GraphqlExceptionFilter,
    },
    {
      provide: CLOCK,
      useExisting: SystemClock,
    },
  ],
})
export class GraphqlCommonModule {}
