import type { RedisClientPort } from '../redis/redis-client.port';

import { RedisHealthCheck } from './redis.health-check';

describe('RedisHealthCheck', () => {
  it('exposes registry name redis', () => {
    const redis = { ping: jest.fn() } as unknown as RedisClientPort;
    const check = new RedisHealthCheck(redis);
    expect(check.name).toBe('redis');
  });

  it('returns up when ping resolves and calls ping exactly once', async () => {
    const ping = jest.fn().mockResolvedValue(undefined);
    const redis = { ping } as unknown as RedisClientPort;
    const check = new RedisHealthCheck(redis);

    await expect(check.check()).resolves.toEqual({ status: 'up' });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('rejects when ping rejects (no local down mapping)', async () => {
    const ping = jest.fn().mockRejectedValue(new Error('redis unreachable'));
    const redis = { ping } as unknown as RedisClientPort;
    const check = new RedisHealthCheck(redis);

    await expect(check.check()).rejects.toThrow('redis unreachable');
  });
});
