import { classifyPurchaseResponse, tally } from './purchase-outcome-classify';

describe('purchase-outcome-classify', () => {
  it('maps ALREADY_PURCHASED to DUPLICATE and RATE_LIMITED from extensions.code', () => {
    expect(
      classifyPurchaseResponse({
        data: { purchaseItem: { status: 'ALREADY_PURCHASED' } },
      }),
    ).toBe('DUPLICATE');
    expect(
      classifyPurchaseResponse({
        errors: [{ extensions: { code: 'RATE_LIMITED' }, message: 'slow down' }],
      }),
    ).toBe('RATE_LIMITED');
  });

  it('tallies buckets', () => {
    expect(tally(['SUCCESS', 'SOLD_OUT', 'SOLD_OUT', 'DUPLICATE'])).toEqual({
      DUPLICATE: 1,
      RATE_LIMITED: 0,
      SOLD_OUT: 2,
      SUCCESS: 1,
      UNEXPECTED_ERROR: 0,
    });
  });
});
