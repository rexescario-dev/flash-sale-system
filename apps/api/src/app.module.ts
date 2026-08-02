import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';

import { validateEnv } from './config/env.validation';
import { FlashSaleModule } from './flash-sale/flash-sale.module';
import { GraphqlCommonModule } from './graphql/graphql-common.module';
import { createGraphqlLoggingPlugin } from './graphql/graphql-logging.plugin';
import { HealthModule } from './health/health.module';
import { AppLogger } from './logging/app-logger';
import { LoggingModule } from './logging/logging.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchaseModule } from './purchase/purchase.module';
import { RedisModule } from './redis/redis.module';

/**
 * Turbo/`pnpm --filter api` runs with cwd `apps/api`, while the committed
 * local `.env` lives at the monorepo root. Resolve both.
 */
const envFilePath = [
  join(__dirname, '..', '..', '..', '.env'),
  join(process.cwd(), '.env'),
  join(process.cwd(), '..', '..', '.env'),
];

@Module({
  imports: [
    FlashSaleModule,
    GraphqlCommonModule,
    HealthModule,
    LoggingModule,
    PrismaModule,
    PurchaseModule,
    RedisModule,
    ConfigModule.forRoot({
      envFilePath,
      isGlobal: true,
      validate: validateEnv,
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [AppLogger],
      useFactory: (appLogger: AppLogger) => ({
        autoSchemaFile: true,
        introspection: process.env.NODE_ENV !== 'production',
        playground: process.env.NODE_ENV !== 'production',
        plugins: [createGraphqlLoggingPlugin(appLogger)],
      }),
    }),
  ],
})
export class AppModule {}
