import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async onModuleInit(): Promise<void> {
    // Skip eager connect during unit tests; Prisma Client is still generated and injectable.
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    await this.$connect();
  }
}
