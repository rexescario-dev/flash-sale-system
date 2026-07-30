import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import type { CatalogFlashSale } from '../graphql/types';

import { IdentityProvider } from '../features/identity/IdentityProvider';
import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { CatalogPage } from './CatalogPage';

function catalogSale(overrides: Partial<CatalogFlashSale> = {}): CatalogFlashSale {
  return {
    id: 'sale-1',
    endsAt: '2026-06-02T00:00:00.000Z',
    product: { id: 'p1', description: 'Desc', name: 'Alpha' },
    remainingStock: 2,
    startsAt: '2026-06-01T00:00:00.000Z',
    status: 'ACTIVE',
    totalStock: 5,
    ...overrides,
  };
}

function renderCatalog() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <IdentityProvider>
        <MemoryRouter>
          <CatalogPage />
        </MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
  );
}

describe('CatalogPage', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows identity strip as Guest', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('FlashSales');
        return HttpResponse.json({ data: { flashSales: [] } });
      }),
    );
    renderCatalog();
    expect(await screen.findByTestId('identity-strip')).toBeInTheDocument();
    expect(screen.getByTestId('identity-status')).toHaveTextContent(/guest/i);
  });

  it('persists identity across remount via strip', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('FlashSales');
        return HttpResponse.json({ data: { flashSales: [] } });
      }),
    );
    const { unmount } = renderCatalog();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'persist-me');
    await user.click(screen.getByTestId('identity-save'));
    unmount();
    renderCatalog();
    expect(screen.getByTestId('identity-status')).toHaveTextContent('Shopping as persist-me');
  });

  it('shows initial loading then the catalog grid', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('FlashSales');
        return HttpResponse.json({
          data: {
            flashSales: [
              catalogSale({
                id: 'sale-a',
                product: { id: 'p-a', description: null, name: 'Alpha' },
              }),
              catalogSale({
                id: 'sale-b',
                product: { id: 'p-b', description: 'B', name: 'Beta' },
                status: 'UPCOMING',
              }),
            ],
          },
        });
      }),
    );

    renderCatalog();
    expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();

    expect(await screen.findByTestId('catalog-page')).toBeInTheDocument();
    const cards = await screen.findAllByTestId('catalog-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByRole('link', { name: /alpha/i })).toHaveAttribute('href', '/sales/sale-a');
    expect(screen.getByRole('link', { name: /beta/i })).toHaveAttribute('href', '/sales/sale-b');
    expect(screen.getAllByText('2 / 5 remaining')).toHaveLength(2);
  });

  it('shows empty state when flashSales is []', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('FlashSales');
        return HttpResponse.json({ data: { flashSales: [] } });
      }),
    );
    renderCatalog();
    expect(await screen.findByTestId('catalog-empty')).toBeInTheDocument();
    expect(screen.queryAllByTestId('catalog-card')).toHaveLength(0);
  });
});
