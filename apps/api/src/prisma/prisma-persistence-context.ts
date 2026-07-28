import { PERSISTENCE_CONTEXT_BRAND, type PersistenceContext } from '@flash-sale/domain';
import { Prisma, type PrismaClient } from '@prisma/client';

const PRISMA_TX_CLIENT = Symbol('PRISMA_TX_CLIENT');

type PrismaBoundPersistenceContext = PersistenceContext & {
  readonly [PRISMA_TX_CLIENT]: Prisma.TransactionClient;
};

export function createPrismaPersistenceContext(
  client: Prisma.TransactionClient,
): PersistenceContext {
  const ctx: PrismaBoundPersistenceContext = {
    [PERSISTENCE_CONTEXT_BRAND]: true,
    [PRISMA_TX_CLIENT]: client,
  };
  return ctx;
}

/**
 * When ctx is omitted, returns rootPrisma.
 * When ctx is provided, validates the domain brand + Prisma txn binding and returns
 * that TransactionClient. MUST NOT fall back to root when ctx is provided.
 *
 * Callers must only pass `tx` from Prisma `$transaction` into `createPrismaPersistenceContext`.
 * The binder does not independently prove an arbitrary runtime object is a TransactionClient.
 */
export function resolvePrismaClient(rootPrisma: PrismaClient): PrismaClient;
export function resolvePrismaClient(
  rootPrisma: PrismaClient,
  ctx: PersistenceContext,
): Prisma.TransactionClient;
export function resolvePrismaClient(
  rootPrisma: PrismaClient,
  ctx?: PersistenceContext,
): Prisma.TransactionClient | PrismaClient {
  if (ctx === undefined) {
    return rootPrisma;
  }

  if (ctx[PERSISTENCE_CONTEXT_BRAND] !== true) {
    throw new Error('Invalid PersistenceContext: missing domain brand');
  }

  const bound = ctx as PrismaBoundPersistenceContext;
  const client = bound[PRISMA_TX_CLIENT];
  if (client === undefined) {
    throw new Error('Invalid PersistenceContext: missing Prisma transaction client');
  }
  return client;
}
