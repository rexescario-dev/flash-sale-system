import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { AppEnv } from '../config/env.validation';

import { IoredisRedisClientAdapter } from './ioredis-redis-client.adapter';
import { REDIS_CONNECTION_DEGRADED } from './redis-events';

jest.mock('ioredis');

const MockRedis = Redis as unknown as jest.MockedClass<typeof Redis>;

describe('IoredisRedisClientAdapter', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function createAdapter(url = 'redis://localhost:6379'): IoredisRedisClientAdapter {
    const config = {
      get: jest.fn().mockReturnValue(url),
    } as unknown as ConfigService<AppEnv, true>;
    return new IoredisRedisClientAdapter(config);
  }

  it('connects successfully on module init with locked lifecycle options', async () => {
    const client = {
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    MockRedis.mockImplementation(() => client as never);

    const adapter = createAdapter();
    await expect(adapter.onModuleInit()).resolves.toBeUndefined();

    expect(MockRedis).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      }),
    );
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('does not throw when connect fails and logs redis_connection_degraded', async () => {
    const client = {
      connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      on: jest.fn(),
    };
    MockRedis.mockImplementation(() => client as never);

    const adapter = createAdapter();
    await expect(adapter.onModuleInit()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REDIS_CONNECTION_DEGRADED,
      }),
    );
  });
});
