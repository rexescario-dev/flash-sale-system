import { HttpException, HttpStatus } from '@nestjs/common';

import type { HealthService, ReadinessResponse } from './health.service';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('GET /health returns 200 body with frozen liveness', () => {
    const healthService = {
      getLiveness: () => ({ status: 'ok' as const }),
      getReadiness: jest.fn(),
    } satisfies Pick<HealthService, 'getLiveness' | 'getReadiness'>;

    const controller = new HealthController(healthService as unknown as HealthService);
    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns ok body when service reports ok', async () => {
    const body: ReadinessResponse = { checks: {}, status: 'ok' };
    const healthService = {
      getLiveness: jest.fn(),
      getReadiness: jest.fn().mockResolvedValue(body),
    } satisfies Pick<HealthService, 'getLiveness' | 'getReadiness'>;

    const controller = new HealthController(healthService as unknown as HealthService);
    await expect(controller.getReady()).resolves.toEqual(body);
  });

  it('GET /health/ready throws 503 with body when service reports error', async () => {
    const body: ReadinessResponse = {
      checks: { database: 'down' },
      status: 'error',
    };
    const healthService = {
      getLiveness: jest.fn(),
      getReadiness: jest.fn().mockResolvedValue(body),
    } satisfies Pick<HealthService, 'getLiveness' | 'getReadiness'>;

    const controller = new HealthController(healthService as unknown as HealthService);

    try {
      await controller.getReady();
      throw new Error('expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(httpError.getResponse()).toEqual(body);
    }
  });
});
