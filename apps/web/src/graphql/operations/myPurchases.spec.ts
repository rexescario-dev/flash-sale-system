import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { graphqlUrl, readGraphqlBody } from '../../test/msw/graphql';
import { server } from '../../test/msw/server';
import { fetchMyPurchases } from './myPurchases';

afterEach(() => {
  server.resetHandlers();
});

describe('fetchMyPurchases', () => {
  it('requests MyPurchases with exact userId and returns history items as returned', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('MyPurchases');
        expect(body.variables).toEqual({ userId: 'user-exact' });
        return HttpResponse.json({
          data: {
            myPurchases: [
              {
                id: 'pur-1',
                flashSale: { id: 'sale-1' },
                product: { id: 'p1', description: 'Nice', name: 'Widget' },
                purchasedAt: '2026-07-29T07:14:00.000Z',
              },
            ],
          },
        });
      }),
    );

    const rows = await fetchMyPurchases('user-exact');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('pur-1');
    expect(rows[0]?.flashSale.id).toBe('sale-1');
    expect(rows[0]?.product.name).toBe('Widget');
    expect(rows[0]?.product.description).toBe('Nice');
    expect('purchaseId' in (rows[0] as object)).toBe(false);
  });
});
