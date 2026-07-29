import type { Request } from 'express';

import {
  FlashSale,
  type FlashSaleId,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
  type ProductId,
  type PurchaseFlow,
  type UserId,
} from '@flash-sale/domain';
import { ConfigService } from '@nestjs/config';

import type { AppEnv } from '../config/env.validation';
import type { FlashSaleQueryCache } from '../flash-sale/flash-sale-query.cache';
import type { Clock } from '../graphql/clock';
import type { MyPurchaseQueryCache } from './my-purchase-query.cache';
import type { PurchaseItemRateLimiter } from './purchase-item.rate-limiter';

import { GraphqlRateLimitedError } from '../graphql/graphql-rate-limited.error';
import { PurchaseResolver } from './purchase.resolver';

const mockReq = {
  ip: '203.0.113.10',
  socket: { remoteAddress: '203.0.113.10' },
} as unknown as Request;

describe('PurchaseResolver.myPurchase', () => {
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const clock: Clock = { nowUtc: () => nowUtc };

  const sale = FlashSale.reconstitute({
    id: 'sale-1' as FlashSaleId,
    productId: 'product-1' as ProductId,
    endsAt: new Date('2026-07-28T14:00:00.000Z'),
    remainingStock: 3,
    startsAt: new Date('2026-07-28T10:00:00.000Z'),
    totalStock: 5,
  });

  function build(
    flashSales: Partial<FlashSaleRepository>,
    cache: Partial<MyPurchaseQueryCache> = {},
    flow: Partial<PurchaseFlow> = {},
  ) {
    const config = {
      get: jest.fn().mockReturnValue(false),
    } as unknown as ConfigService<AppEnv, true>;
    const rateLimiter = {
      consume: jest.fn().mockResolvedValue('allow'),
    } as unknown as PurchaseItemRateLimiter;

    return new PurchaseResolver(
      flashSales as FlashSaleRepository,
      flow as PurchaseFlow,
      clock,
      config,
      { invalidate: jest.fn() } as unknown as FlashSaleQueryCache,
      cache as MyPurchaseQueryCache,
      rateLimiter,
    );
  }

  it('sale missing → findById called, cache.get NOT called, FlashSaleNotFoundError', async () => {
    const findById = jest.fn().mockResolvedValue(null);
    const get = jest.fn();
    const resolver = build({ findById }, { get });

    await expect(resolver.myPurchase('sale-1', 'user-1')).rejects.toBeInstanceOf(
      FlashSaleNotFoundError,
    );
    expect(findById).toHaveBeenCalledWith('sale-1');
    expect(get).not.toHaveBeenCalled();
  });

  it('sale exists → findById then cache.get with validated ids', async () => {
    const findById = jest.fn().mockResolvedValue(sale);
    const get = jest.fn().mockResolvedValue({
      purchaseId: null,
      purchased: false,
      purchasedAt: null,
    });
    const resolver = build({ findById }, { get });

    await expect(resolver.myPurchase('sale-1', 'user-1')).resolves.toEqual({
      purchaseId: null,
      purchased: false,
      purchasedAt: null,
    });
    expect(findById).toHaveBeenCalledWith('sale-1' as FlashSaleId);
    expect(get).toHaveBeenCalledWith('sale-1' as FlashSaleId, 'user-1' as UserId);
    const findByIdOrder = findById.mock.invocationCallOrder[0];
    const getOrder = get.mock.invocationCallOrder[0];
    expect(findByIdOrder).toBeDefined();
    expect(getOrder).toBeDefined();
    expect(findByIdOrder!).toBeLessThan(getOrder!);
  });

  it('returns purchased true from cache when sale exists', async () => {
    const purchasedAt = new Date('2026-07-28T11:00:00.000Z');
    const resolver = build(
      { findById: jest.fn().mockResolvedValue(sale) },
      {
        get: jest.fn().mockResolvedValue({
          purchaseId: 'purchase-1',
          purchased: true,
          purchasedAt,
        }),
      },
    );

    await expect(resolver.myPurchase('sale-1', 'user-1')).resolves.toEqual({
      purchaseId: 'purchase-1',
      purchased: true,
      purchasedAt,
    });
  });

  it('rejects whitespace-only userId before ports', async () => {
    const findById = jest.fn();
    const get = jest.fn();
    const resolver = build({ findById }, { get });

    await expect(resolver.myPurchase('sale-1', '   ')).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(findById).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only flashSaleId before ports', async () => {
    const findById = jest.fn();
    const get = jest.fn();
    const resolver = build({ findById }, { get });

    await expect(resolver.myPurchase('   ', 'user-1')).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(findById).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only flashSaleId %j before ports',
    async (raw) => {
      const findById = jest.fn();
      const get = jest.fn();
      const resolver = build({ findById }, { get });

      await expect(resolver.myPurchase(raw, 'user-1')).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(findById).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
    },
  );

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only userId %j before ports',
    async (raw) => {
      const findById = jest.fn();
      const get = jest.fn();
      const resolver = build({ findById }, { get });

      await expect(resolver.myPurchase('sale-1', raw)).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(findById).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
    },
  );
});

describe('PurchaseResolver.purchaseItem', () => {
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const clock: Clock = { nowUtc: () => nowUtc };

  function build(
    flow: Partial<PurchaseFlow>,
    caches: {
      flashSaleInvalidate?: jest.Mock;
      myPurchaseInvalidate?: jest.Mock;
    } = {},
    rateLimit: {
      consume?: jest.Mock;
      trustedProxy?: boolean;
    } = {},
  ) {
    const flashSaleInvalidate =
      caches.flashSaleInvalidate ?? jest.fn().mockResolvedValue(undefined);
    const myPurchaseInvalidate =
      caches.myPurchaseInvalidate ?? jest.fn().mockResolvedValue(undefined);
    const consume = rateLimit.consume ?? jest.fn().mockResolvedValue('allow');
    const config = {
      get: jest.fn().mockReturnValue(rateLimit.trustedProxy ?? false),
    } as unknown as ConfigService<AppEnv, true>;

    return {
      consume,
      flashSaleInvalidate,
      myPurchaseInvalidate,
      resolver: new PurchaseResolver(
        { findById: jest.fn() } as unknown as FlashSaleRepository,
        flow as PurchaseFlow,
        clock,
        config,
        { invalidate: flashSaleInvalidate } as unknown as FlashSaleQueryCache,
        {
          get: jest.fn(),
          invalidate: myPurchaseInvalidate,
        } as unknown as MyPurchaseQueryCache,
        { consume } as unknown as PurchaseItemRateLimiter,
      ),
    };
  }

  it('validates ids before calling PurchaseFlow', async () => {
    const execute = jest.fn();
    const { consume, resolver } = build({ execute });
    await expect(resolver.purchaseItem('sale-1', '   ', mockReq)).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(execute).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
  });

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only flashSaleId %j before calling PurchaseFlow',
    async (raw) => {
      const execute = jest.fn();
      const { resolver } = build({ execute });

      await expect(resolver.purchaseItem(raw, 'user-1', mockReq)).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only userId %j before calling PurchaseFlow',
    async (raw) => {
      const execute = jest.fn();
      const { resolver } = build({ execute });

      await expect(resolver.purchaseItem('sale-1', raw, mockReq)).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('rate limit ⇒ execute never called', async () => {
    const execute = jest.fn();
    const consume = jest.fn().mockResolvedValue('limit');
    const { resolver } = build({ execute }, {}, { consume });

    await expect(resolver.purchaseItem('sale-1', 'user-1', mockReq)).rejects.toBeInstanceOf(
      GraphqlRateLimitedError,
    );
    expect(consume).toHaveBeenCalledWith('203.0.113.10');
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes generated purchaseId and clock nowUtc into execute before returning', async () => {
    const execute = jest.fn().mockImplementation(async (input) => {
      expect(input.purchaseId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(input.nowUtc).toBe(nowUtc);
      return 'SUCCESS';
    });
    const { resolver } = build({ execute });
    const result = await resolver.purchaseItem('sale-1', 'user-1', mockReq);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].purchaseId).toBe(result.purchaseId);
    expect(result).toEqual({
      purchaseId: expect.any(String),
      message: 'Purchase completed',
      status: 'SUCCESS',
    });
  });

  it('does not accept a client purchaseId argument (TypeScript / resolver arity)', () => {
    // flashSaleId, userId, req (Context) — no client-supplied purchaseId
    expect(PurchaseResolver.prototype.purchaseItem.length).toBe(3);
  });

  it.each([
    ['ALREADY_PURCHASED', 'User already purchased this flash sale'],
    ['SALE_NOT_STARTED', 'Flash sale has not started'],
    ['SALE_ENDED', 'Flash sale has ended'],
    ['SOLD_OUT', 'Flash sale is sold out'],
  ] as const)('maps %s with null purchaseId', async (outcome, message) => {
    const { resolver } = build({ execute: jest.fn().mockResolvedValue(outcome) });
    await expect(resolver.purchaseItem('sale-1', 'user-1', mockReq)).resolves.toEqual({
      purchaseId: null,
      message,
      status: outcome,
    });
  });

  it('propagates FlashSaleNotFoundError', async () => {
    const { resolver } = build({
      execute: jest.fn().mockRejectedValue(new FlashSaleNotFoundError()),
    });
    await expect(resolver.purchaseItem('sale-1', 'user-1', mockReq)).rejects.toBeInstanceOf(
      FlashSaleNotFoundError,
    );
  });

  it('SUCCESS → invalidates both caches with validated ids', async () => {
    const execute = jest.fn().mockResolvedValue('SUCCESS');
    const flashSaleInvalidate = jest.fn().mockResolvedValue(undefined);
    const myPurchaseInvalidate = jest.fn().mockResolvedValue(undefined);
    const { resolver } = build({ execute }, { flashSaleInvalidate, myPurchaseInvalidate });

    const result = await resolver.purchaseItem('sale-1', 'user-A', mockReq);

    expect(result.status).toBe('SUCCESS');
    expect(flashSaleInvalidate).toHaveBeenCalledWith('sale-1' as FlashSaleId);
    expect(myPurchaseInvalidate).toHaveBeenCalledWith('sale-1' as FlashSaleId, 'user-A' as UserId);
    expect(flashSaleInvalidate).toHaveBeenCalledTimes(1);
    expect(myPurchaseInvalidate).toHaveBeenCalledTimes(1);
  });

  it('SUCCESS → invalidates only purchasing userId (not other users)', async () => {
    const execute = jest.fn().mockResolvedValue('SUCCESS');
    const myPurchaseInvalidate = jest.fn().mockResolvedValue(undefined);
    const { resolver } = build({ execute }, { myPurchaseInvalidate });

    await resolver.purchaseItem('sale-1', 'user-A', mockReq);

    expect(myPurchaseInvalidate).toHaveBeenCalledWith('sale-1' as FlashSaleId, 'user-A' as UserId);
    expect(myPurchaseInvalidate).not.toHaveBeenCalledWith(expect.anything(), 'user-B' as UserId);
    for (const call of myPurchaseInvalidate.mock.calls) {
      expect(call[1]).not.toBe('user-B');
    }
  });

  it('SOLD_OUT → no invalidate calls', async () => {
    const flashSaleInvalidate = jest.fn().mockResolvedValue(undefined);
    const myPurchaseInvalidate = jest.fn().mockResolvedValue(undefined);
    const { resolver } = build(
      { execute: jest.fn().mockResolvedValue('SOLD_OUT') },
      { flashSaleInvalidate, myPurchaseInvalidate },
    );

    await expect(resolver.purchaseItem('sale-1', 'user-1', mockReq)).resolves.toEqual({
      purchaseId: null,
      message: 'Flash sale is sold out',
      status: 'SOLD_OUT',
    });
    expect(flashSaleInvalidate).not.toHaveBeenCalled();
    expect(myPurchaseInvalidate).not.toHaveBeenCalled();
  });

  it.each(['ALREADY_PURCHASED', 'SALE_NOT_STARTED', 'SALE_ENDED'] as const)(
    '%s → no invalidate calls',
    async (outcome) => {
      const flashSaleInvalidate = jest.fn().mockResolvedValue(undefined);
      const myPurchaseInvalidate = jest.fn().mockResolvedValue(undefined);
      const { resolver } = build(
        { execute: jest.fn().mockResolvedValue(outcome) },
        { flashSaleInvalidate, myPurchaseInvalidate },
      );

      await resolver.purchaseItem('sale-1', 'user-1', mockReq);
      expect(flashSaleInvalidate).not.toHaveBeenCalled();
      expect(myPurchaseInvalidate).not.toHaveBeenCalled();
    },
  );

  it('SUCCESS still returns after invalidate stubs resolve (never-reject contract)', async () => {
    const flashSaleInvalidate = jest.fn().mockResolvedValue(undefined);
    const myPurchaseInvalidate = jest.fn().mockResolvedValue(undefined);
    const { resolver } = build(
      { execute: jest.fn().mockResolvedValue('SUCCESS') },
      { flashSaleInvalidate, myPurchaseInvalidate },
    );

    await expect(resolver.purchaseItem('sale-1', 'user-1', mockReq)).resolves.toMatchObject({
      message: 'Purchase completed',
      status: 'SUCCESS',
    });
    expect(flashSaleInvalidate).toHaveBeenCalled();
    expect(myPurchaseInvalidate).toHaveBeenCalled();
  });
});
