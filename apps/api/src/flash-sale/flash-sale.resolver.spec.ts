import {
  FlashSale,
  type FlashSaleId,
  FlashSaleNotFoundError,
  type FlashSaleRepository,
  type ProductId,
} from '@flash-sale/domain';

import type { Clock } from '../graphql/clock';

import { FlashSaleResolver } from './flash-sale.resolver';

describe('FlashSaleResolver', () => {
  const nowUtc = new Date('2026-07-28T12:00:00.000Z');
  const clock: Clock = { nowUtc: () => nowUtc };

  function build(repo: Partial<FlashSaleRepository>) {
    return new FlashSaleResolver(repo as FlashSaleRepository, clock);
  }

  it('maps domain FlashSale using injected clock for status', async () => {
    const nowUtcSpy = jest.fn(() => nowUtc);
    const clockWithSpy: Clock = { nowUtc: nowUtcSpy };
    const flashSale = FlashSale.reconstitute({
      id: 'sale-1' as FlashSaleId,
      productId: 'product-1' as ProductId, // domain fixture only — must never appear in GraphQL output
      endsAt: new Date('2026-07-28T14:00:00.000Z'),
      remainingStock: 3,
      startsAt: new Date('2026-07-28T10:00:00.000Z'),
      totalStock: 5,
    });
    const resolver = new FlashSaleResolver(
      { findById: jest.fn().mockResolvedValue(flashSale) } as unknown as FlashSaleRepository,
      clockWithSpy,
    );

    const result = await resolver.flashSale('sale-1');

    expect(nowUtcSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: 'sale-1',
      endsAt: flashSale.getEndsAt(),
      remainingStock: 3,
      startsAt: flashSale.getStartsAt(),
      status: 'ACTIVE',
      totalStock: 5,
    });
    expect(result).not.toHaveProperty('productId');
  });

  it('throws FlashSaleNotFoundError when missing', async () => {
    const resolver = build({
      findById: jest.fn().mockResolvedValue(null),
    });
    await expect(resolver.flashSale('missing')).rejects.toBeInstanceOf(FlashSaleNotFoundError);
  });

  it.each(['', ' ', '\t', '\n', '   '])(
    'rejects whitespace-only id %j before repository',
    async (raw) => {
      const findById = jest.fn();
      const resolver = build({ findById });

      await expect(resolver.flashSale(raw)).rejects.toMatchObject({
        code: 'BAD_USER_INPUT',
      });
      expect(findById).not.toHaveBeenCalled();
    },
  );
});
