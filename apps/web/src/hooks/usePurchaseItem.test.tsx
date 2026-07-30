import type { ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { flashSaleQueryKey } from './useFlashSale';
import { flashSalesQueryKey } from './useFlashSales';
import { myPurchaseQueryKey } from './useMyPurchase';
import { myPurchasesQueryKey } from './useMyPurchases';
import { usePurchaseItem } from './usePurchaseItem';

function wrapperFor(client: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('usePurchaseItem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invalidates flashSale, myPurchase, flashSales, and myPurchases on settlement', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('PurchaseItem');
        return HttpResponse.json({
          data: {
            purchaseItem: {
              purchaseId: 'p-1',
              message: 'ok',
              status: 'SUCCESS',
            },
          },
        });
      }),
    );

    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePurchaseItem(), {
      wrapper: wrapperFor(queryClient),
    });

    result.current.mutate({ flashSaleId: 'sale-123', userId: 'user-456' });

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isError).toBe(true);
    });

    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        flashSaleQueryKey('sale-123'),
        myPurchaseQueryKey('sale-123', 'user-456'),
        flashSalesQueryKey(),
        myPurchasesQueryKey('user-456'),
      ]),
    );
  });

  it('invalidates the same required keys when the mutation errors', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('PurchaseItem');
        return HttpResponse.json({
          errors: [{ extensions: { code: 'INTERNAL_SERVER_ERROR' }, message: 'boom' }],
        });
      }),
    );

    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePurchaseItem(), {
      wrapper: wrapperFor(queryClient),
    });

    result.current.mutate({ flashSaleId: 'sale-123', userId: 'user-456' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        flashSaleQueryKey('sale-123'),
        myPurchaseQueryKey('sale-123', 'user-456'),
        flashSalesQueryKey(),
        myPurchasesQueryKey('user-456'),
      ]),
    );
  });
});
