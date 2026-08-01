import type { HealthCheck } from './health-check.port';

import { HealthService } from './health.service';

function fakeCheck(name: string, impl: () => Promise<{ status: string }>): HealthCheck {
  return { check: impl, name };
}

describe('HealthService', () => {
  it('returns frozen liveness ok for REST', () => {
    const service = new HealthService();
    expect(service.getLiveness()).toEqual({ status: 'ok' });
  });

  it('returns ok readiness with empty checks when no checks registered', async () => {
    const service = new HealthService();
    await expect(service.getReadiness()).resolves.toEqual({
      checks: {},
      status: 'ok',
    });
  });

  it('returns ok readiness with empty checks when an empty array is injected', async () => {
    const service = new HealthService([]);
    await expect(service.getReadiness()).resolves.toEqual({
      checks: {},
      status: 'ok',
    });
  });
});

describe('HealthService aggregation', () => {
  it('is ok when every registered check reports up', async () => {
    const service = new HealthService([
      fakeCheck('database', async () => ({ status: 'up' })),
      fakeCheck('redis', async () => ({ status: 'up' })),
    ]);

    await expect(service.getReadiness()).resolves.toEqual({
      checks: { database: 'up', redis: 'up' },
      status: 'ok',
    });
  });

  it('is error when one or more checks report a status other than up', async () => {
    const service = new HealthService([
      fakeCheck('database', async () => ({ status: 'up' })),
      fakeCheck('redis', async () => ({ status: 'down' })),
    ]);

    await expect(service.getReadiness()).resolves.toEqual({
      checks: { database: 'up', redis: 'down' },
      status: 'error',
    });
  });

  it('normalizes thrown checks to down and still aggregates siblings', async () => {
    const service = new HealthService([
      fakeCheck('database', async () => {
        throw new Error('boom');
      }),
      fakeCheck('redis', async () => ({ status: 'up' })),
    ]);

    await expect(service.getReadiness()).resolves.toEqual({
      checks: { database: 'down', redis: 'up' },
      status: 'error',
    });
  });

  it('normalizes rejected checks to down and still aggregates siblings', async () => {
    const service = new HealthService([
      fakeCheck('database', async () => Promise.reject(new Error('boom'))),
      fakeCheck('redis', async () => ({ status: 'up' })),
    ]);

    await expect(service.getReadiness()).resolves.toEqual({
      checks: { database: 'down', redis: 'up' },
      status: 'error',
    });
  });
});
