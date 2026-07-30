import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { identityStorage } from '../features/identity/identity-storage';
import { IdentityProvider } from '../features/identity/IdentityProvider';
import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { AppRoutes } from './router';

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <IdentityProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
  );
}

describe('AppRoutes', () => {
  afterEach(() => {
    identityStorage.clear();
  });

  it('propagates identity set via the page IdentityStrip into the nav status live', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        if (body.operationName === 'FlashSales') {
          return HttpResponse.json({ data: { flashSales: [] } });
        }
        return HttpResponse.json({
          errors: [{ message: `Unhandled ${body.operationName}` }],
        });
      }),
    );

    const user = userEvent.setup();
    renderAt('/');

    expect(await screen.findByTestId('catalog-page')).toBeInTheDocument();
    expect(screen.getByTestId('nav-identity-status')).toHaveTextContent('Shopping as Guest');

    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'buyer-live');
    await user.click(screen.getByTestId('identity-save'));

    expect(screen.getByTestId('nav-identity-status')).toHaveTextContent('Shopping as buyer-live');
  });

  it('renders catalog at /', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        if (body.operationName === 'FlashSales') {
          return HttpResponse.json({ data: { flashSales: [] } });
        }
        return HttpResponse.json({
          errors: [{ message: `Unhandled ${body.operationName}` }],
        });
      }),
    );

    renderAt('/');
    expect(await screen.findByTestId('catalog-page')).toBeInTheDocument();
    expect(await screen.findByTestId('catalog-empty')).toBeInTheDocument();
    expect(screen.queryByText(/enter a flash sale url/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('customer-nav')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('renders flash sale page shell at /sales/:flashSaleId', async () => {
    renderAt('/sales/sale-123');
    expect(await screen.findByTestId('flash-sale-page')).toBeInTheDocument();
    expect(screen.getByTestId('back-to-products')).toBeInTheDocument();
    expect(screen.getByTestId('customer-nav')).toBeInTheDocument();
    expect(screen.getByTestId('nav-flash-sales')).toHaveAttribute('aria-current', 'page');
  });

  it('renders purchases page at /purchases', async () => {
    renderAt('/purchases');
    expect(await screen.findByTestId('purchases-page')).toBeInTheDocument();
    expect(screen.getByTestId('customer-nav')).toBeInTheDocument();
    expect(screen.getByTestId('nav-purchases')).toHaveAttribute('aria-current', 'page');
  });

  it('renders not found for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
    expect(screen.queryByTestId('customer-nav')).not.toBeInTheDocument();
  });
});
