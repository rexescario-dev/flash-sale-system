import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns liveness ok for REST', () => {
    const service = new HealthService();
    expect(service.getLiveness()).toEqual({ status: 'ok' });
  });
});
