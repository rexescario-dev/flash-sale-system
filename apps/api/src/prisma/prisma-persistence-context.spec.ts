import { PERSISTENCE_CONTEXT_BRAND } from '@flash-sale/domain';

import type { PrismaService } from './prisma.service';

import { createPrismaPersistenceContext, resolvePrismaClient } from './prisma-persistence-context';

describe('prisma-persistence-context', () => {
  const root = { tag: 'root' } as unknown as PrismaService;
  const tx = { tag: 'tx' } as never;

  it('returns root when ctx is omitted', () => {
    expect(resolvePrismaClient(root)).toBe(root);
  });

  it('returns the bound TransactionClient when ctx is valid', () => {
    const ctx = createPrismaPersistenceContext(tx);
    expect(resolvePrismaClient(root, ctx)).toBe(tx);
  });

  it('rejects a context missing the domain brand', () => {
    const fake = { [Symbol('other')]: true } as never;
    expect(() => resolvePrismaClient(root, fake)).toThrow(/missing domain brand/);
  });

  it('rejects a branded context missing the Prisma binding', () => {
    const fake = { [PERSISTENCE_CONTEXT_BRAND]: true } as never;
    expect(() => resolvePrismaClient(root, fake)).toThrow(/missing Prisma transaction client/);
  });
});
