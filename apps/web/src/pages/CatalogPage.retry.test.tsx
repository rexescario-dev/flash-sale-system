import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { IdentityProvider } from '../features/identity/IdentityProvider';
import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { CatalogPage } from './CatalogPage';

describe('CatalogPage retry persistence', () => {
  it('keeps error UI visible during retry and then shows the grid', async () => {
    let attempts = 0;

    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('FlashSales');
        attempts += 1;

        if (attempts === 1) {
          return HttpResponse.json({
            errors: [{ extensions: { code: 'INTERNAL' }, message: 'boom' }],
          });
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 250);
        });

        return HttpResponse.json({
          data: {
            flashSales: [
              {
                id: 'sale-1',
                endsAt: '2026-06-02T00:00:00.000Z',
                product: { id: 'p1', description: 'Desc', name: 'Alpha' },
                remainingStock: 2,
                startsAt: '2026-06-01T00:00:00.000Z',
                status: 'ACTIVE',
                totalStock: 5,
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
            <CatalogPage />
          </MemoryRouter>
        </IdentityProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('catalog-error')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('catalog-retry'));

    expect(screen.getByTestId('catalog-error')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-retry')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();

    expect(await screen.findByRole('link', { name: /alpha/i })).toHaveAttribute(
      'href',
      '/sales/sale-1',
    );
    expect(attempts).toBeGreaterThanOrEqual(2);
  });
});
