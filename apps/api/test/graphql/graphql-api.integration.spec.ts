import {
  FLASH_SALE_REPOSITORY,
  FlashSale,
  type FlashSaleId,
  type ProductId,
  PURCHASE_FLOW,
  PURCHASE_REPOSITORY,
  type PurchaseFlowExecuteInput,
  type PurchaseOutcome,
} from '@flash-sale/domain';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import type { RedisClientPort } from '../../src/redis/redis-client.port';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { myPurchaseCacheKey } from '../../src/redis/redis-keys';
import { REDIS_CLIENT } from '../../src/redis/redis.tokens';

type GraphqlError = {
  extensions?: { code?: string };
  message: string;
};

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: GraphqlError[];
};

type GraphqlRequestBody = {
  operationName?: string;
  query: string;
  variables?: Record<string, unknown>;
};

type FlashSaleFixture = {
  endsAt: Date;
  remainingStock: number;
  startsAt: Date;
  suffix: string;
  totalStock: number;
};

async function createAppWithRealProviders(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  return app;
}

async function postGraphql<TData>(
  app: INestApplication,
  body: GraphqlRequestBody,
): Promise<GraphqlResponse<TData>> {
  const baseUrl = await app.getUrl();
  const response = await fetch(`${baseUrl}/graphql`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  return (await response.json()) as GraphqlResponse<TData>;
}

async function seedFlashSale(prisma: PrismaService, fixture: FlashSaleFixture): Promise<string> {
  const productId = `product-graphql-api-${fixture.suffix}`;
  const flashSaleId = `sale-graphql-api-${fixture.suffix}`;
  const now = new Date('2026-07-28T12:00:00.000Z');

  await prisma.product.create({
    data: {
      id: productId,
      name: 'GraphQL API Integration Product',
      updatedAt: now,
    },
  });

  await prisma.flashSale.create({
    data: {
      id: flashSaleId,
      productId,
      endsAt: fixture.endsAt,
      remainingStock: fixture.remainingStock,
      startsAt: fixture.startsAt,
      totalStock: fixture.totalStock,
      updatedAt: now,
    },
  });

  return flashSaleId;
}

async function cleanupFlashSale(prisma: PrismaService, suffix: string): Promise<void> {
  const productId = `product-graphql-api-${suffix}`;
  const flashSaleId = `sale-graphql-api-${suffix}`;
  await prisma.purchase.deleteMany({ where: { flashSaleId } });
  await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
  await prisma.product.deleteMany({ where: { id: productId } });
}

describe('GraphQL API integration (#26) - persistence suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createAppWithRealProviders();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('asserts GraphQL schema contract and rejects unknown purchaseItem argument', async () => {
    const healthResponse = await fetch(`${await app.getUrl()}/health`);
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({ status: 'ok' });

    const introspection = await postGraphql<{
      __schema: {
        mutationType: { fields: Array<{ name: string }> };
        queryType: { fields: Array<{ name: string }> };
        subscriptionType: null;
        types: Array<{ fields?: Array<{ name: string }>; name: string }>;
      };
    }>(app, {
      query: `
        query ContractIntrospection {
          __schema {
            queryType {
              fields { name }
            }
            mutationType {
              fields { name }
            }
            subscriptionType {
              fields { name }
            }
            types {
              name
              fields { name }
            }
          }
        }
      `,
    });

    expect(introspection.errors).toBeUndefined();
    expect(introspection.data).toBeDefined();

    const schema = introspection.data!.__schema;
    const queryNames = schema.queryType.fields.map((field) => field.name);
    const mutationNames = schema.mutationType.fields.map((field) => field.name);
    expect(new Set(queryNames)).toEqual(new Set(['flashSale', 'myPurchase']));
    expect(new Set(mutationNames)).toEqual(new Set(['purchaseItem']));
    expect(schema.subscriptionType).toBeNull();

    const typeFields = new Map(
      schema.types.map((type) => [
        type.name,
        new Set((type.fields ?? []).map((field) => field.name)),
      ]),
    );

    expect(typeFields.get('FlashSale')).toEqual(
      new Set(['id', 'product', 'status', 'remainingStock', 'totalStock', 'startsAt', 'endsAt']),
    );
    expect(typeFields.get('Product')).toEqual(new Set(['id', 'name', 'description']));
    expect(typeFields.get('MyPurchaseResult')).toEqual(
      new Set(['purchased', 'purchaseId', 'purchasedAt']),
    );
    expect(typeFields.get('PurchaseItemResult')).toEqual(
      new Set(['status', 'message', 'purchaseId']),
    );
    expect(typeFields.get('FlashSale')?.has('productId')).toBe(false);
    expect(typeFields.get('PurchaseItemResult')?.has('nowUtc')).toBe(false);

    const unknownArg = await postGraphql(app, {
      query: `
        mutation RejectUnknownArg($flashSaleId: ID!, $userId: ID!, $purchaseId: ID!) {
          purchaseItem(flashSaleId: $flashSaleId, userId: $userId, purchaseId: $purchaseId) {
            status
          }
        }
      `,
      variables: {
        flashSaleId: 'sale-any',
        purchaseId: 'purchase-any',
        userId: 'user-any',
      },
    });

    expect(unknownArg.data).toBeUndefined();
    expect(unknownArg.errors?.[0]?.message).toContain('Unknown argument "purchaseId"');
  });

  it('returns flashSale SUCCESS payload with expected fields only', async () => {
    const suffix = randomUUID();
    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 4,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 10,
      });

      const result = await postGraphql<{ flashSale: Record<string, unknown> }>(app, {
        query: `
          query FlashSale($id: ID!) {
            flashSale(id: $id) {
              id
              status
              remainingStock
              totalStock
              startsAt
              endsAt
            }
          }
        `,
        variables: { id: flashSaleId },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.flashSale).toBeDefined();
      expect(result.data?.flashSale).toMatchObject({
        id: flashSaleId,
        remainingStock: 4,
        totalStock: 10,
      });
      expect(result.data?.flashSale).not.toHaveProperty('productId');
      expect(result.data?.flashSale).not.toHaveProperty('nowUtc');
    } finally {
      await cleanupFlashSale(prisma, suffix);
    }
  });

  it('maps flashSale missing id to NOT_FOUND and whitespace id to BAD_USER_INPUT', async () => {
    const result = await postGraphql(app, {
      query: `
        query MissingFlashSale($id: ID!) {
          flashSale(id: $id) { id }
        }
      `,
      variables: { id: `sale-missing-${randomUUID()}` },
    });

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

    const badInput = await postGraphql(app, {
      query: `
        query BadFlashSaleId($id: ID!) {
          flashSale(id: $id) { id }
        }
      `,
      variables: { id: '   ' },
    });
    expect(badInput.data).toBeNull();
    expect(badInput.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('returns myPurchase false then true and maps missing flashSale to NOT_FOUND', async () => {
    const suffix = randomUUID();
    const userId = `user-graphql-api-${suffix}`;
    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 3,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 3,
      });

      const notPurchased = await postGraphql<{
        myPurchase: { purchaseId: null | string; purchased: boolean; purchasedAt: null | string };
      }>(app, {
        query: `
          query MyPurchase($flashSaleId: ID!, $userId: ID!) {
            myPurchase(flashSaleId: $flashSaleId, userId: $userId) {
              purchased
              purchaseId
              purchasedAt
            }
          }
        `,
        variables: { flashSaleId, userId },
      });
      expect(notPurchased.errors).toBeUndefined();
      expect(notPurchased.data?.myPurchase).toEqual({
        purchaseId: null,
        purchased: false,
        purchasedAt: null,
      });

      const purchasedAt = new Date('2026-07-28T12:30:00.000Z');
      const purchaseId = `purchase-graphql-api-${suffix}`;
      await prisma.purchase.create({
        data: {
          flashSaleId,
          id: purchaseId,
          userId,
          purchasedAt,
        },
      });
      // Direct Prisma write bypasses purchaseItem invalidation — drop negative cache.
      const redis = app.get<RedisClientPort>(REDIS_CLIENT);
      await redis.delete(myPurchaseCacheKey(flashSaleId, userId));

      const purchased = await postGraphql<{
        myPurchase: { purchaseId: null | string; purchased: boolean; purchasedAt: null | string };
      }>(app, {
        query: `
          query MyPurchase($flashSaleId: ID!, $userId: ID!) {
            myPurchase(flashSaleId: $flashSaleId, userId: $userId) {
              purchased
              purchaseId
              purchasedAt
            }
          }
        `,
        variables: { flashSaleId, userId },
      });
      expect(purchased.errors).toBeUndefined();
      expect(purchased.data?.myPurchase.purchased).toBe(true);
      expect(purchased.data?.myPurchase.purchaseId).toBe(purchaseId);
      expect(purchased.data?.myPurchase.purchasedAt).toBe(purchasedAt.toISOString());

      const missingSale = await postGraphql(app, {
        query: `
          query MissingMyPurchase($flashSaleId: ID!, $userId: ID!) {
            myPurchase(flashSaleId: $flashSaleId, userId: $userId) { purchased }
          }
        `,
        variables: {
          flashSaleId: `sale-missing-${randomUUID()}`,
          userId,
        },
      });
      expect(missingSale.data).toBeNull();
      expect(missingSale.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    } finally {
      await cleanupFlashSale(prisma, suffix);
    }
  });

  it('returns purchaseItem SUCCESS and persists row plus decremented stock', async () => {
    const suffix = randomUUID();
    const userId = `user-graphql-api-${suffix}`;
    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 2,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 2,
      });

      const result = await postGraphql<{
        purchaseItem: { purchaseId: null | string; message: string; status: PurchaseOutcome };
      }>(app, {
        query: `
          mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
            purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
              status
              message
              purchaseId
            }
          }
        `,
        variables: { flashSaleId, userId },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.purchaseItem.status).toBe('SUCCESS');
      expect(result.data?.purchaseItem.message).toBe('Purchase completed');
      expect(result.data?.purchaseItem.purchaseId).toEqual(expect.any(String));
      expect(result.data?.purchaseItem).not.toHaveProperty('nowUtc');
      expect(result.data?.purchaseItem).not.toHaveProperty('productId');

      const persistedPurchaseId = result.data?.purchaseItem.purchaseId;
      expect(persistedPurchaseId).toEqual(expect.any(String));
      const persistedPurchase = await prisma.purchase.findUniqueOrThrow({
        where: { id: persistedPurchaseId as string },
      });
      expect(persistedPurchase).not.toBeNull();
      expect(persistedPurchase.flashSaleId).toBe(flashSaleId);
      expect(persistedPurchase.userId).toBe(userId);

      const saleRow = await prisma.flashSale.findUniqueOrThrow({ where: { id: flashSaleId } });
      expect(saleRow.remainingStock).toBe(1);
    } finally {
      await cleanupFlashSale(prisma, suffix);
    }
  });

  it('covers SALE_NOT_STARTED, SALE_ENDED, ALREADY_PURCHASED, and SOLD_OUT outcomes via real PurchaseFlow', async () => {
    const suffixNotStarted = randomUUID();
    const suffixEnded = randomUUID();
    const suffixAlready = randomUUID();
    const suffixSoldOut = randomUUID();

    try {
      const notStartedId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 3 * 60 * 60_000),
        remainingStock: 2,
        startsAt: new Date(Date.now() + 60 * 60_000),
        suffix: suffixNotStarted,
        totalStock: 2,
      });
      const notStarted = await postGraphql<{
        purchaseItem: { purchaseId: null | string; message: string; status: string };
      }>(app, {
        query: `
            mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
              purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
                status
                message
                purchaseId
              }
            }
          `,
        variables: { flashSaleId: notStartedId, userId: `user-not-started-${suffixNotStarted}` },
      });
      expect(notStarted.errors).toBeUndefined();
      expect(notStarted.data?.purchaseItem).toEqual({
        purchaseId: null,
        message: 'Flash sale has not started',
        status: 'SALE_NOT_STARTED',
      });

      const endedId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() - 60 * 60_000),
        remainingStock: 2,
        startsAt: new Date(Date.now() - 3 * 60 * 60_000),
        suffix: suffixEnded,
        totalStock: 2,
      });
      const ended = await postGraphql<{
        purchaseItem: { purchaseId: null | string; message: string; status: string };
      }>(app, {
        query: `
          mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
            purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
              status
              message
              purchaseId
            }
          }
        `,
        variables: { flashSaleId: endedId, userId: `user-ended-${suffixEnded}` },
      });
      expect(ended.errors).toBeUndefined();
      expect(ended.data?.purchaseItem).toEqual({
        purchaseId: null,
        message: 'Flash sale has ended',
        status: 'SALE_ENDED',
      });

      const alreadyId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 60 * 60_000),
        remainingStock: 2,
        startsAt: new Date(Date.now() - 60 * 60_000),
        suffix: suffixAlready,
        totalStock: 2,
      });
      const alreadyUserId = `user-already-${suffixAlready}`;
      await prisma.purchase.create({
        data: {
          flashSaleId: alreadyId,
          id: `purchase-existing-${suffixAlready}`,
          userId: alreadyUserId,
          purchasedAt: new Date('2026-07-28T11:00:00.000Z'),
        },
      });
      const already = await postGraphql<{
        purchaseItem: { purchaseId: null | string; message: string; status: string };
      }>(app, {
        query: `
          mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
            purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
              status
              message
              purchaseId
            }
          }
        `,
        variables: { flashSaleId: alreadyId, userId: alreadyUserId },
      });
      expect(already.errors).toBeUndefined();
      expect(already.data?.purchaseItem).toEqual({
        purchaseId: null,
        message: 'User already purchased this flash sale',
        status: 'ALREADY_PURCHASED',
      });

      const soldOutId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 60 * 60_000),
        remainingStock: 0,
        startsAt: new Date(Date.now() - 60 * 60_000),
        suffix: suffixSoldOut,
        totalStock: 2,
      });
      const soldOut = await postGraphql<{
        purchaseItem: { purchaseId: null | string; message: string; status: string };
      }>(app, {
        query: `
          mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
            purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
              status
              message
              purchaseId
            }
          }
        `,
        variables: { flashSaleId: soldOutId, userId: `user-sold-out-${suffixSoldOut}` },
      });
      expect(soldOut.errors).toBeUndefined();
      expect(soldOut.data?.purchaseItem).toEqual({
        purchaseId: null,
        message: 'Flash sale is sold out',
        status: 'SOLD_OUT',
      });
      expect(await prisma.purchase.count({ where: { flashSaleId: soldOutId } })).toBe(0);
    } finally {
      await cleanupFlashSale(prisma, suffixNotStarted);
      await cleanupFlashSale(prisma, suffixEnded);
      await cleanupFlashSale(prisma, suffixAlready);
      await cleanupFlashSale(prisma, suffixSoldOut);
    }
  });

  it('maps purchaseItem missing flashSale to NOT_FOUND and whitespace userId to BAD_USER_INPUT', async () => {
    const missingSale = await postGraphql(app, {
      query: `
        mutation MissingPurchaseItem($flashSaleId: ID!, $userId: ID!) {
          purchaseItem(flashSaleId: $flashSaleId, userId: $userId) { status }
        }
      `,
      variables: {
        flashSaleId: `sale-missing-${randomUUID()}`,
        userId: `user-${randomUUID()}`,
      },
    });
    expect(missingSale.data).toBeNull();
    expect(missingSale.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

    const badInputSuffix = randomUUID();
    try {
      const existingFlashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 2,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix: badInputSuffix,
        totalStock: 2,
      });
      const badInput = await postGraphql(app, {
        query: `
          mutation BadUserInput($flashSaleId: ID!, $userId: ID!) {
            purchaseItem(flashSaleId: $flashSaleId, userId: $userId) { status }
          }
        `,
        variables: {
          flashSaleId: existingFlashSaleId,
          userId: '   ',
        },
      });
      expect(badInput.data).toBeNull();
      expect(badInput.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    } finally {
      await cleanupFlashSale(prisma, badInputSuffix);
    }
  });
});

describe('GraphQL API integration (#26) - controlled-error suite', () => {
  let app: INestApplication;

  const existingSale = FlashSale.reconstitute({
    id: 'sale-controlled' as FlashSaleId,
    productId: 'product-controlled' as ProductId,
    endsAt: new Date('2026-07-28T14:00:00.000Z'),
    remainingStock: 1,
    startsAt: new Date('2026-07-28T10:00:00.000Z'),
    totalStock: 1,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FLASH_SALE_REPOSITORY)
      .useValue({
        findById: async (id: string) => {
          if (String(id).includes('throw')) {
            throw new Error('secret prisma detail');
          }
          return existingSale;
        },
      })
      .overrideProvider(PURCHASE_REPOSITORY)
      .useValue({
        findByFlashSaleAndUser: async () => {
          throw new Error('secret prisma detail');
        },
      })
      .overrideProvider(PURCHASE_FLOW)
      .useValue({
        execute: async (_input: PurchaseFlowExecuteInput): Promise<PurchaseOutcome> => {
          throw new Error('secret prisma detail');
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  function expectScrubbedInternalError(result: GraphqlResponse<unknown>): void {
    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(result.errors?.[0]?.message).toBe('Internal server error');
    expect(result.errors?.[0]?.message.toLowerCase()).not.toContain('prisma');
    expect(result.errors?.[0]?.message.toLowerCase()).not.toContain('sql');
    expect(result.errors?.[0]?.message.toLowerCase()).not.toContain('stack');
  }

  it('maps unexpected flashSale repository errors to scrubbed INTERNAL_SERVER_ERROR', async () => {
    const result = await postGraphql(app, {
      query: `
        query FlashSale($id: ID!) {
          flashSale(id: $id) { id }
        }
      `,
      variables: { id: `sale-throw-${randomUUID()}` },
    });

    expectScrubbedInternalError(result);
  });

  it('maps unexpected myPurchase repository errors to scrubbed INTERNAL_SERVER_ERROR', async () => {
    const result = await postGraphql(app, {
      query: `
        query MyPurchase($flashSaleId: ID!, $userId: ID!) {
          myPurchase(flashSaleId: $flashSaleId, userId: $userId) { purchased }
        }
      `,
      variables: {
        flashSaleId: `sale-${randomUUID()}`,
        userId: `user-${randomUUID()}`,
      },
    });

    expectScrubbedInternalError(result);
  });

  it('maps unexpected purchaseItem errors to scrubbed INTERNAL_SERVER_ERROR', async () => {
    const result = await postGraphql(app, {
      query: `
        mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
          purchaseItem(flashSaleId: $flashSaleId, userId: $userId) { status }
        }
      `,
      variables: {
        flashSaleId: `sale-${randomUUID()}`,
        userId: `user-${randomUUID()}`,
      },
    });

    expectScrubbedInternalError(result);
  });
});
