import { Module } from '@nestjs/common';

import { DatabaseHealthCheck } from './database.health-check';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HEALTH_CHECKS } from './health.tokens';

@Module({
  controllers: [HealthController],
  providers: [
    DatabaseHealthCheck,
    HealthService,
    {
      provide: HEALTH_CHECKS,
      useExisting: DatabaseHealthCheck,
    },
  ],
})
export class HealthModule {}
