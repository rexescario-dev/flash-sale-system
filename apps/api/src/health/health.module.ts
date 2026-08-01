import { Module } from '@nestjs/common';

import { DatabaseHealthCheck } from './database.health-check';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HEALTH_CHECKS } from './health.tokens';
import { RedisHealthCheck } from './redis.health-check';

@Module({
  controllers: [HealthController],
  providers: [
    DatabaseHealthCheck,
    HealthService,
    RedisHealthCheck,
    {
      inject: [DatabaseHealthCheck, RedisHealthCheck],
      provide: HEALTH_CHECKS,
      useFactory: (db: DatabaseHealthCheck, redis: RedisHealthCheck) => [db, redis],
    },
  ],
})
export class HealthModule {}
