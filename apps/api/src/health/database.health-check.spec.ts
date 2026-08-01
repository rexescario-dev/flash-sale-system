import type { PrismaService } from '../prisma/prisma.service';

import { DatabaseHealthCheck } from './database.health-check';

describe('DatabaseHealthCheck', () => {
  it('exposes registry name database', () => {
    const prisma = { $queryRaw: jest.fn() } as unknown as PrismaService;
    const check = new DatabaseHealthCheck(prisma);
    expect(check.name).toBe('database');
  });

  it('returns up when the probe query resolves', async () => {
    const queryRaw = jest.fn().mockResolvedValue(undefined);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const check = new DatabaseHealthCheck(prisma);

    await expect(check.check()).resolves.toEqual({ status: 'up' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects when the probe query rejects (no local down mapping)', async () => {
    const queryRaw = jest.fn().mockRejectedValue(new Error('db unreachable'));
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const check = new DatabaseHealthCheck(prisma);

    await expect(check.check()).rejects.toThrow('db unreachable');
  });
});
