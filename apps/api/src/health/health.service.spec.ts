import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns liveness ok for REST', () => {
    const service = new HealthService();
    expect(service.getLiveness()).toEqual({ status: 'ok' });
  });

  it('returns ok string for GraphQL', () => {
    const service = new HealthService();
    expect(service.getLivenessStatus()).toBe('ok');
  });
});
