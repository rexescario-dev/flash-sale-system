import { Inject, Injectable, Optional } from '@nestjs/common';

import type { HealthCheck } from './health-check.port';

import { HEALTH_CHECKS } from './health.tokens';

export type LivenessResponse = { status: 'ok' };
export type ReadinessResponse = {
  checks: Record<string, string>;
  status: 'error' | 'ok';
};

@Injectable()
export class HealthService {
  private readonly checks: HealthCheck[];

  constructor(
    @Optional()
    @Inject(HEALTH_CHECKS)
    checks?: HealthCheck | HealthCheck[],
  ) {
    if (checks == null) {
      this.checks = [];
    } else {
      this.checks = Array.isArray(checks) ? checks : [checks];
    }
  }

  getLiveness(): LivenessResponse {
    return { status: 'ok' };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const settled = await Promise.all(
      this.checks.map(async (check) => {
        try {
          const result = await check.check();
          return { name: check.name, status: result.status };
        } catch {
          return { name: check.name, status: 'down' };
        }
      }),
    );

    const checks: Record<string, string> = {};
    for (const entry of settled) {
      checks[entry.name] = entry.status;
    }

    const status = settled.every((entry) => entry.status === 'up') ? 'ok' : 'error';
    return { checks, status };
  }
}
