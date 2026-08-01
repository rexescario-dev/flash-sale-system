import { Injectable } from '@nestjs/common';

import type { HealthCheck, HealthCheckResult } from './health-check.port';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DatabaseHealthCheck implements HealthCheck {
  readonly name = 'database';

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'up' };
  }
}
