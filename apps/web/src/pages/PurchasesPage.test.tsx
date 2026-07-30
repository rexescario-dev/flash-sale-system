import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { identityStorage } from '../features/identity/identity-storage';
import { IdentityProvider } from '../features/identity/IdentityProvider';
import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { PurchasesPage } from './PurchasesPage';

function renderPurchases() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <IdentityProvider>
        <MemoryRouter>
          <PurchasesPage />
        </MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('PurchasesPage', () => {
  it('shows Guest soft empty and issues no GraphQL request', async () => {
    let graphqlCalls = 0;
    server.use(
      http.post(graphqlUrl(), async () => {
        graphqlCalls += 1;
        return HttpResponse.json({
          errors: [{ message: 'should not be called' }],
        });
      }),
    );

    renderPurchases();
    expect(await screen.findByTestId('purchases-page')).toBeInTheDocument();
    expect(screen.getByTestId('purchases-guest')).toBeInTheDocument();
    expect(screen.getByTestId('identity-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('purchases-empty')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(graphqlCalls).toBe(0);
    });
  });

  it('shows Pending then Success panels in GraphQL API order', async () => {
    identityStorage.set('buyer-1');
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('MyPurchases');
        expect(body.variables).toEqual({ userId: 'buyer-1' });
        return HttpResponse.json({
          data: {
            myPurchases: [
              {
                id: 'pur-new',
                flashSale: { id: 'sale-new' },
                product: { id: 'p-new', description: null, name: 'Newer' },
                purchasedAt: '2026-07-29T12:00:00.000Z',
              },
              {
                id: 'pur-old',
                flashSale: { id: 'sale-old' },
                product: { id: 'p-old', description: null, name: 'Older' },
                purchasedAt: '2026-07-28T12:00:00.000Z',
              },
            ],
          },
        });
      }),
    );

    renderPurchases();
    expect(screen.getByTestId('purchases-loading')).toBeInTheDocument();

    const panels = await screen.findAllByTestId('purchase-panel');
    expect(panels).toHaveLength(2);
    // Do not sort — assert DOM order matches GraphQL response order.
    expect(panels[0]).toHaveTextContent('Newer');
    expect(panels[1]).toHaveTextContent('Older');
    expect(screen.getAllByTestId('purchase-sale-link')[0]).toHaveAttribute(
      'href',
      '/sales/sale-new',
    );
  });

  it('shows Empty when identified and myPurchases is []', async () => {
    identityStorage.set('buyer-empty');
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        expect(body.operationName).toBe('MyPurchases');
        return HttpResponse.json({ data: { myPurchases: [] } });
      }),
    );

    renderPurchases();
    expect(await screen.findByTestId('purchases-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('purchases-guest')).not.toBeInTheDocument();
  });

  it('switches query to the new exact userId after Identify/Save', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        if (body.operationName === 'MyPurchases') {
          seen.push(String(body.variables?.userId));
          return HttpResponse.json({
            data: {
              myPurchases: [
                {
                  id: `pur-${body.variables?.userId}`,
                  flashSale: { id: 'sale-1' },
                  product: {
                    id: 'p1',
                    description: null,
                    name: `Item for ${body.variables?.userId}`,
                  },
                  purchasedAt: '2026-07-29T12:00:00.000Z',
                },
              ],
            },
          });
        }
        return HttpResponse.json({
          errors: [{ message: `Unhandled ${body.operationName}` }],
        });
      }),
    );

    renderPurchases();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'alice');
    await user.click(screen.getByTestId('identity-save'));
    expect(await screen.findByText('Item for alice')).toBeInTheDocument();

    await user.click(screen.getByTestId('identity-change'));
    await user.clear(screen.getByTestId('identity-email-input'));
    await user.type(screen.getByTestId('identity-email-input'), 'bob');
    await user.click(screen.getByTestId('identity-save'));
    expect(await screen.findByText('Item for bob')).toBeInTheDocument();
    expect(seen).toContain('alice');
    expect(seen).toContain('bob');
  });
});
