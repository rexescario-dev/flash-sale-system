import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { IdentityProvider } from './features/identity/IdentityProvider';
import { graphqlUrl, readGraphqlBody } from './test/msw/graphql';
import { server } from './test/msw/server';
import { createTestQueryClient } from './test/query-client';

describe('App', () => {
  it('renders the catalog page at /', async () => {
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

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <IdentityProvider>
          <MemoryRouter initialEntries={['/']}>
            <App />
          </MemoryRouter>
        </IdentityProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('catalog-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /flash sales/i })).toBeInTheDocument();
  });
});
