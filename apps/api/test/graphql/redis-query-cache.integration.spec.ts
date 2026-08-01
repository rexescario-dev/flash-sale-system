import {
  FLASH_SALE_REPOSITORY,
  type FlashSaleId,
  type FlashSaleRepository,
  PURCHASE_REPOSITORY,
  type PurchaseRepository,
  type UserId,
} from '@flash-sale/domain';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

import type { RedisClientPort } from '../../src/redis/redis-client.port';

import { AppModule } from '../../src/app.module';
import { PrismaFlashSaleRepository } from '../../src/flash-sale/prisma-flash-sale.repository';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PrismaPurchaseRepository } from '../../src/purchase/prisma-purchase.repository';
import { flashSaleCacheKey, myPurchaseCacheKey } from '../../src/redis/redis-keys';
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
  const productId = `product-redis-cache-${fixture.suffix}`;
  const flashSaleId = `sale-redis-cache-${fixture.suffix}`;
  const now = new Date('2026-07-29T12:00:00.000Z');

  await prisma.product.create({
    data: {
      id: productId,
      name: 'Redis Query Cache Integration Product',
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
  const productId = `product-redis-cache-${suffix}`;
  const flashSaleId = `sale-redis-cache-${suffix}`;
  await prisma.purchase.deleteMany({ where: { flashSaleId } });
  await prisma.flashSale.deleteMany({ where: { id: flashSaleId } });
  await prisma.product.deleteMany({ where: { id: productId } });
}

const FLASH_SALE_QUERY = `
  query FlashSale($id: ID!) {
    flashSale(id: $id) {
      id
      status
      remainingStock
      totalStock
    }
  }
`;

const MY_PURCHASE_QUERY = `
  query MyPurchase($flashSaleId: ID!, $userId: ID!) {
    myPurchase(flashSaleId: $flashSaleId, userId: $userId) {
      purchased
      purchaseId
      purchasedAt
    }
  }
`;

const PURCHASE_ITEM_MUTATION = `
  mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
    purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
      status
      message
      purchaseId
    }
  }
`;

describe('Redis query-cache GraphQL integration', () => {
  const counters = {
    findByFlashSaleAndUser: 0,
    findByIdWithProduct: 0,
  };

  let app: INestApplication;
  let prisma: PrismaService;
  let inspector: Redis;

  beforeAll(async () => {
    counters.findByFlashSaleAndUser = 0;
    counters.findByIdWithProduct = 0;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FLASH_SALE_REPOSITORY)
      .useFactory({
        factory: (inner: PrismaFlashSaleRepository): FlashSaleRepository => ({
          async findById(id: FlashSaleId) {
            return inner.findById(id);
          },
          async findAllForCatalog() {
            return inner.findAllForCatalog();
          },
          async findByIdWithProduct(id: FlashSaleId) {
            counters.findByIdWithProduct += 1;
            return inner.findByIdWithProduct(id);
          },
        }),
        inject: [PrismaFlashSaleRepository],
      })
      .overrideProvider(PURCHASE_REPOSITORY)
      .useFactory({
        factory: (inner: PrismaPurchaseRepository): PurchaseRepository => ({
          async findByFlashSaleAndUser(flashSaleId: FlashSaleId, userId: UserId) {
            counters.findByFlashSaleAndUser += 1;
            return inner.findByFlashSaleAndUser(flashSaleId, userId);
          },
          async save(purchase, ctx) {
            return inner.save(purchase, ctx);
          },
        }),
        inject: [PrismaPurchaseRepository],
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    prisma = app.get(PrismaService);

    inspector = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6380', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await inspector.connect();
  });

  afterAll(async () => {
    await inspector.quit();
    await app.close();
  });

  it('serves flashSale from Redis after warm and still findByIdWithProduct=1 on second hit', async () => {
    const suffix = randomUUID();
    counters.findByIdWithProduct = 0;

    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 5,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 5,
      });

      const first = await postGraphql<{ flashSale: { id: string } }>(app, {
        query: FLASH_SALE_QUERY,
        variables: { id: flashSaleId },
      });
      expect(first.errors).toBeUndefined();
      expect(first.data?.flashSale.id).toBe(flashSaleId);
      expect(counters.findByIdWithProduct).toBe(1);

      const second = await postGraphql<{ flashSale: { id: string } }>(app, {
        query: FLASH_SALE_QUERY,
        variables: { id: flashSaleId },
      });
      expect(second.errors).toBeUndefined();
      expect(second.data?.flashSale.id).toBe(flashSaleId);
      expect(counters.findByIdWithProduct).toBe(1);

      await expect(inspector.get(flashSaleCacheKey(flashSaleId))).resolves.not.toBeNull();
    } finally {
      await cleanupFlashSale(prisma, suffix);
      await inspector.del(flashSaleCacheKey(`sale-redis-cache-${suffix}`));
    }
  });

  it('caches myPurchase purchase lookup while sale find may run every time', async () => {
    const suffix = randomUUID();
    const userId = `user-redis-cache-${suffix}`;
    counters.findByFlashSaleAndUser = 0;

    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 3,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 3,
      });

      const first = await postGraphql<{
        myPurchase: { purchaseId: null | string; purchased: boolean };
      }>(app, {
        query: MY_PURCHASE_QUERY,
        variables: { flashSaleId, userId },
      });
      expect(first.errors).toBeUndefined();
      expect(first.data?.myPurchase).toEqual({
        purchaseId: null,
        purchased: false,
        purchasedAt: null,
      });
      expect(counters.findByFlashSaleAndUser).toBe(1);

      const second = await postGraphql<{
        myPurchase: { purchaseId: null | string; purchased: boolean };
      }>(app, {
        query: MY_PURCHASE_QUERY,
        variables: { flashSaleId, userId },
      });
      expect(second.errors).toBeUndefined();
      expect(second.data?.myPurchase.purchased).toBe(false);
      expect(counters.findByFlashSaleAndUser).toBe(1);
    } finally {
      await cleanupFlashSale(prisma, suffix);
      await inspector.del(myPurchaseCacheKey(`sale-redis-cache-${suffix}`, userId));
    }
  });

  it('maps missing flashSale on myPurchase to NOT_FOUND without requiring purchase cache', async () => {
    const result = await postGraphql(app, {
      query: MY_PURCHASE_QUERY,
      variables: {
        flashSaleId: `sale-missing-${randomUUID()}`,
        userId: `user-${randomUUID()}`,
      },
    });

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('isolates myPurchase cache between userA and userB', async () => {
    const suffix = randomUUID();
    const userA = `userA-redis-cache-${suffix}`;
    const userB = `userB-redis-cache-${suffix}`;

    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 4,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 4,
      });

      const purchaseId = `purchase-redis-cache-${suffix}`;
      const purchasedAt = new Date('2026-07-29T12:30:00.000Z');
      await prisma.purchase.create({
        data: {
          flashSaleId,
          id: purchaseId,
          userId: userA,
          purchasedAt,
        },
      });

      const forA = await postGraphql<{
        myPurchase: { purchaseId: null | string; purchased: boolean };
      }>(app, {
        query: MY_PURCHASE_QUERY,
        variables: { flashSaleId, userId: userA },
      });
      expect(forA.errors).toBeUndefined();
      expect(forA.data?.myPurchase).toMatchObject({
        purchaseId,
        purchased: true,
      });

      const forB = await postGraphql<{
        myPurchase: { purchaseId: null | string; purchased: boolean };
      }>(app, {
        query: MY_PURCHASE_QUERY,
        variables: { flashSaleId, userId: userB },
      });
      expect(forB.errors).toBeUndefined();
      expect(forB.data?.myPurchase).toEqual({
        purchaseId: null,
        purchased: false,
        purchasedAt: null,
      });

      await expect(inspector.get(myPurchaseCacheKey(flashSaleId, userA))).resolves.not.toBeNull();
      await expect(inspector.get(myPurchaseCacheKey(flashSaleId, userB))).resolves.not.toBeNull();
    } finally {
      await cleanupFlashSale(prisma, suffix);
      await inspector.del(
        myPurchaseCacheKey(`sale-redis-cache-${suffix}`, userA),
        myPurchaseCacheKey(`sale-redis-cache-${suffix}`, userB),
      );
    }
  });

  it('invalidates flash-sale and only buyer myPurchase keys after SUCCESS', async () => {
    const suffix = randomUUID();
    const userA = `userA-redis-inv-${suffix}`;
    const userB = `userB-redis-inv-${suffix}`;
    counters.findByIdWithProduct = 0;

    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 5,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 5,
      });

      await postGraphql(app, {
        query: FLASH_SALE_QUERY,
        variables: { id: flashSaleId },
      });
      expect(counters.findByIdWithProduct).toBe(1);
      await expect(inspector.get(flashSaleCacheKey(flashSaleId))).resolves.not.toBeNull();

      await postGraphql(app, {
        query: MY_PURCHASE_QUERY,
        variables: { flashSaleId, userId: userA },
      });
      await postGraphql(app, {
        query: MY_PURCHASE_QUERY,
        variables: { flashSaleId, userId: userB },
      });
      await expect(inspector.get(myPurchaseCacheKey(flashSaleId, userA))).resolves.not.toBeNull();
      await expect(inspector.get(myPurchaseCacheKey(flashSaleId, userB))).resolves.not.toBeNull();

      const purchase = await postGraphql<{
        purchaseItem: { purchaseId: null | string; status: string };
      }>(app, {
        query: PURCHASE_ITEM_MUTATION,
        variables: { flashSaleId, userId: userA },
      });
      expect(purchase.errors).toBeUndefined();
      expect(purchase.data?.purchaseItem.status).toBe('SUCCESS');

      await expect(inspector.get(flashSaleCacheKey(flashSaleId))).resolves.toBeNull();
      await expect(inspector.get(myPurchaseCacheKey(flashSaleId, userA))).resolves.toBeNull();
      await expect(inspector.get(myPurchaseCacheKey(flashSaleId, userB))).resolves.not.toBeNull();

      const findByIdAfterPurchase = counters.findByIdWithProduct;
      const after = await postGraphql<{ flashSale: { id: string; remainingStock: number } }>(app, {
        query: FLASH_SALE_QUERY,
        variables: { id: flashSaleId },
      });
      expect(after.errors).toBeUndefined();
      expect(after.data?.flashSale.id).toBe(flashSaleId);
      expect(counters.findByIdWithProduct).toBe(findByIdAfterPurchase + 1);
    } finally {
      await cleanupFlashSale(prisma, suffix);
      await inspector.del(
        flashSaleCacheKey(`sale-redis-cache-${suffix}`),
        myPurchaseCacheKey(`sale-redis-cache-${suffix}`, userA),
        myPurchaseCacheKey(`sale-redis-cache-${suffix}`, userB),
      );
    }
  });
});

describe('Redis query-cache GraphQL fail-open', () => {
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

  it('still serves flashSale and myPurchase from Postgres when Redis fails', async () => {
    const suffix = randomUUID();
    const userId = `user-redis-failopen-${suffix}`;

    try {
      const flashSaleId = await seedFlashSale(prisma, {
        endsAt: new Date(Date.now() + 20 * 60_000),
        remainingStock: 2,
        startsAt: new Date(Date.now() - 20 * 60_000),
        suffix,
        totalStock: 2,
      });

      const sale = await postGraphql<{ flashSale: { id: string } }>(app, {
        query: FLASH_SALE_QUERY,
        variables: { id: flashSaleId },
      });
      expect(sale.errors).toBeUndefined();
      expect(sale.data?.flashSale.id).toBe(flashSaleId);

      const purchase = await postGraphql<{
        myPurchase: { purchased: boolean };
      }>(app, {
        query: MY_PURCHASE_QUERY,
        variables: { flashSaleId, userId },
      });
      expect(purchase.errors).toBeUndefined();
      expect(purchase.data?.myPurchase.purchased).toBe(false);
    } finally {
      await cleanupFlashSale(prisma, suffix);
    }
  });
});
