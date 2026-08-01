import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

import type { AppEnv } from '../../src/config/env.validation';
import type { RedisClientPort } from '../../src/redis/redis-client.port';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
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

type GraphqlHttpResult<TData> = {
  body: GraphqlResponse<TData>;
  status: number;
};

type FlashSaleFixture = {
  endsAt: Date;
  remainingStock: number;
  startsAt: Date;
  suffix: string;
  totalStock: number;
};

const failingRedisClient: RedisClientPort = {
  async delete() {
    throw new Error('redis down');
  },
  async get() {
    throw new Error('redis down');
  },
  async incrWithExpiryOnFirst() {
    throw new Error('redis down');
  },
  async ping() {
    throw new Error('redis down');
  },
  async set() {
    throw new Error('redis down');
  },
};

const PURCHASE_ITEM_MUTATION = `
  mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
    purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
      status
      message
      purchaseId
    }
  }
`;

const FLASH_SALE_QUERY = `
  query MissingFlashSale($id: ID!) {
    flashSale(id: $id) { id }
  }
`;

async function postGraphqlWithStatus<TData>(
  app: INestApplication,
  body: GraphqlRequestBody,
): Promise<GraphqlHttpResult<TData>> {
  const baseUrl = await app.getUrl();
  const response = await fetch(`${baseUrl}/graphql`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  return {
    body: (await response.json()) as GraphqlResponse<TData>,
    status: response.status,
  };
}

async function seedFlashSale(prisma: PrismaService, fixture: FlashSaleFixture): Promise<string> {
  const productId = `product-rate-limit-${fixture.suffix}`;
  const flashSaleId = `sale-rate-limit-${fixture.suffix}`;
  const now = new Date('2026-07-29T12:00:00.000Z');

  await prisma.product.create({
    data: {
      id: productId,
      name: 'Purchase Rate Limit Integration Product',
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
  const productId = `product-rate-limit-${suffix}`;
  const flashSaleId = `sale-rate-limit-${suffix}`;
  await prisma.purchase.deleteMany({ where: { flashSaleId } });
  await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
  await prisma.product.deleteMany({ where: { id: productId } });
}

async function clearPurchaseItemRateLimitKeys(inspector: Redis): Promise<void> {
  const keys = await inspector.keys('rate-limit:v1:purchaseItem:ip:*');
  if (keys.length > 0) {
    await inspector.del(...keys);
  }
}

describe('purchaseItem rate-limit GraphQL integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let inspector: Redis;
  let configGetSpy: jest.SpyInstance;

  beforeAll(async () => {
    inspector = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6380', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await inspector.connect();
    await clearPurchaseItemRateLimitKeys(inspector);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // ConfigModule.forRoot() runs at AppModule import time, so process.env overrides
    // in this beforeAll cannot rewrite validated rate-limit defaults. Patch get().
    const config = moduleRef.get(ConfigService<AppEnv, true>);
    const originalGet = config.get.bind(config);
    configGetSpy = jest.spyOn(config, 'get').mockImplementation(((
      propertyPath: keyof AppEnv | string,
      options?: Parameters<ConfigService<AppEnv, true>['get']>[1],
    ) => {
      if (propertyPath === 'RATE_LIMIT_PURCHASE_ITEM_MAX') {
        return 2;
      }
      if (propertyPath === 'RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS') {
        return 3600;
      }
      return originalGet(propertyPath as never, options as never);
    }) as ConfigService<AppEnv, true>['get']);

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    prisma = app.get(PrismaService);

    expect(config.get('RATE_LIMIT_PURCHASE_ITEM_MAX', { infer: true })).toBe(2);
    expect(config.get('RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS', { infer: true })).toBe(3600);
  });

  afterAll(async () => {
    await clearPurchaseItemRateLimitKeys(inspector);
    await inspector.quit();
    configGetSpy.mockRestore();
    await app.close();
  });

  it('allows two purchases from same IP with different userIds then RATE_LIMITEDs the third', async () => {
    const suffix = randomUUID();
    const userA = `userA-rate-limit-${suffix}`;
    const userB = `userB-rate-limit-${suffix}`;
    const userRejected = `userRejected-rate-limit-${suffix}`;

    await clearPurchaseItemRateLimitKeys(inspector);

    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 5,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 5,
      });

      const first = await postGraphqlWithStatus<{
        purchaseItem: { purchaseId: null | string; status: string };
      }>(app, {
        query: PURCHASE_ITEM_MUTATION,
        variables: { flashSaleId, userId: userA },
      });
      expect(first.body.errors).toBeUndefined();
      expect(first.body.data?.purchaseItem.status).toBe('SUCCESS');

      const second = await postGraphqlWithStatus<{
        purchaseItem: { purchaseId: null | string; status: string };
      }>(app, {
        query: PURCHASE_ITEM_MUTATION,
        variables: { flashSaleId, userId: userB },
      });
      expect(second.body.errors).toBeUndefined();
      expect(second.body.data?.purchaseItem.status).toBe('SUCCESS');

      const rateKeys = await inspector.keys('rate-limit:v1:purchaseItem:ip:*');
      expect(rateKeys.length).toBeGreaterThan(0);
      const counter = await inspector.get(rateKeys[0]!);
      expect(Number(counter)).toBe(2);

      const notFoundControl = await postGraphqlWithStatus(app, {
        query: FLASH_SALE_QUERY,
        variables: { id: `sale-missing-${randomUUID()}` },
      });
      expect(notFoundControl.body.data).toBeNull();
      expect(notFoundControl.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

      const third = await postGraphqlWithStatus<{
        purchaseItem: { purchaseId: null | string; status: string };
      }>(app, {
        query: PURCHASE_ITEM_MUTATION,
        variables: { flashSaleId, userId: userRejected },
      });

      expect(third.body.errors?.[0]?.extensions?.code).toBe('RATE_LIMITED');
      expect(third.body.data).toBeNull();
      expect(third.status).toBe(notFoundControl.status);

      const rejectedPurchase = await prisma.purchase.findFirst({
        where: { flashSaleId, userId: userRejected },
      });
      expect(rejectedPurchase).toBeNull();
    } finally {
      await cleanupFlashSale(prisma, suffix);
      await clearPurchaseItemRateLimitKeys(inspector);
    }
  });
});

describe('purchaseItem rate-limit GraphQL fail-open', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(failingRedisClient)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('still reaches SUCCESS when Redis rate-limit path fails open', async () => {
    const suffix = randomUUID();
    const userId = `user-rate-failopen-${suffix}`;

    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 3,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 3,
      });

      const result = await postGraphqlWithStatus<{
        purchaseItem: { purchaseId: null | string; status: string };
      }>(app, {
        query: PURCHASE_ITEM_MUTATION,
        variables: { flashSaleId, userId },
      });

      expect(result.body.errors).toBeUndefined();
      expect(result.body.data?.purchaseItem.status).toBe('SUCCESS');
      expect(result.body.data?.purchaseItem.purchaseId).toEqual(expect.any(String));

      const persisted = await prisma.purchase.findUnique({
        where: { id: result.body.data!.purchaseItem.purchaseId as string },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.userId).toBe(userId);
    } finally {
      await cleanupFlashSale(prisma, suffix);
    }
  });
});
