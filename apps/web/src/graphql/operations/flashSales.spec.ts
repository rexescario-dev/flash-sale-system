import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { graphqlUrl, readGraphqlBody } from '../../test/msw/graphql';
import { server } from '../../test/msw/server';
import { fetchFlashSales } from './flashSales';

afterEach(() => {
  server.resetHandlers();
});

describe('fetchFlashSales', () => {
  it('requests FlashSales and returns catalog rows with nested product', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('FlashSales');
        return HttpResponse.json({
          data: {
            flashSales: [
              {
                id: 'sale-1',
                endsAt: '2026-01-02T00:00:00.000Z',
                product: { id: 'p1', description: 'Nice', name: 'Widget' },
                remainingStock: 3,
                startsAt: '2026-01-01T00:00:00.000Z',
                status: 'ACTIVE',
                totalStock: 10,
              },
            ],
          },
        });
      }),
    );

    const rows = await fetchFlashSales();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.product.name).toBe('Widget');
    expect(rows[0]?.product.description).toBe('Nice');
  });
});
