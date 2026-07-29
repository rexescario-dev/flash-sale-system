import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';

import { validateEnv } from './config/env.validation';
import { FlashSaleModule } from './flash-sale/flash-sale.module';
import { GraphqlCommonModule } from './graphql/graphql-common.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchaseModule } from './purchase/purchase.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    FlashSaleModule,
    GraphqlCommonModule,
    HealthModule,
    PrismaModule,
    PurchaseModule,
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      autoSchemaFile: true,
      driver: ApolloDriver,
      introspection: process.env.NODE_ENV !== 'production',
      playground: process.env.NODE_ENV !== 'production',
    }),
  ],
})
export class AppModule {}
