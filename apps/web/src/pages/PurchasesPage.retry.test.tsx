import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { identityStorage } from '../features/identity/identity-storage';
import { IdentityProvider } from '../features/identity/IdentityProvider';
import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { PurchasesPage } from './PurchasesPage';

afterEach(() => {
  localStorage.clear();
});

describe('PurchasesPage retry persistence', () => {
  it('keeps Error UI visible during retry then shows Success', async () => {
    identityStorage.set('buyer-retry');
    let attempts = 0;

    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('MyPurchases');
        attempts += 1;

        if (attempts === 1) {
          return HttpResponse.json({
            errors: [{ extensions: { code: 'INTERNAL' }, message: 'boom' }],
          });
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 80);
        });

        return HttpResponse.json({
          data: {
            myPurchases: [
              {
                id: 'pur-1',
                flashSale: { id: 'sale-1' },
                product: { id: 'p1', description: null, name: 'Alpha' },
                purchasedAt: '2026-07-29T12:00:00.000Z',
              },
            ],
          },
        });
      }),
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <IdentityProvider>
          <MemoryRouter>
            <PurchasesPage />
          </MemoryRouter>
        </IdentityProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('purchases-error')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-loading')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('purchases-retry'));

    expect(screen.getByTestId('purchases-error')).toBeInTheDocument();
    expect(screen.getByTestId('purchases-retry')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-loading')).not.toBeInTheDocument();

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(attempts).toBeGreaterThanOrEqual(2);
  });
});
