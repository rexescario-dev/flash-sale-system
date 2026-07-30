import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

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
  });

  it('renders flash sale page shell at /sales/:flashSaleId', async () => {
    renderAt('/sales/sale-123');
    expect(await screen.findByTestId('flash-sale-page')).toBeInTheDocument();
    expect(screen.getByText(/sale-123/)).toBeInTheDocument();
  });

  it('renders not found for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
  });
});
