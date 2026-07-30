import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import type { FlashSale, MyPurchaseResult, PurchaseItemResult } from '../graphql/types';

import { AppRoutes } from '../app/router';
import { identityStorage } from '../features/identity/identity-storage';
import { IdentityProvider } from '../features/identity/IdentityProvider';
import { graphqlUrl, readGraphqlBody } from '../test/msw/graphql';
import { server } from '../test/msw/server';
import { createTestQueryClient } from '../test/query-client';
import { FlashSalePage } from './FlashSalePage';

type Counters = {
  flashSale: Map<string, number>;
  myPurchase: Map<string, number>;
  purchaseItem: number;
};

function keyOf(flashSaleId: string, userId: string) {
  return `${flashSaleId}::${userId}`;
}

function activeSale(id: string, overrides: Partial<FlashSale> = {}): FlashSale {
  return {
    id,
    endsAt: '2099-12-31T00:00:00.000Z',
    product: {
      id: `product-${id}`,
      description: 'A great widget',
      name: 'Aurora Headphones',
    },
    remainingStock: 5,
    startsAt: '2000-01-01T00:00:00.000Z',
    status: 'ACTIVE',
    totalStock: 10,
    ...overrides,
  };
}

function renderSale(path: string, options: { userId?: string } = {}) {
  localStorage.clear();
  if (options.userId !== undefined) {
    identityStorage.set(options.userId);
  }
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<FlashSalePage />} path="/sales/:flashSaleId" />
          </Routes>
        </MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
  );
  return { queryClient, user };
}

/**
 * PurchaseRail and StickyBuyBar are both mounted whenever a sale is loaded
 * (dual mount is intentional; visibility between them is CSS-only). Any
 * selector for their shared internals (buy button, buy-helper,
 * already-purchased, request-error, purchase-outcome, ...) can therefore
 * match twice. Tests interact with / assert on the first match, since both
 * surfaces share identical state and handlers.
 */
function buyButtons() {
  return screen.getAllByRole('button', { name: /buy now|buying/i });
}

function buyButton(): HTMLElement {
  return first(buyButtons());
}

function first<T>(items: T[]): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error('Expected at least one matching element');
  }
  return item;
}

function buyHelpers() {
  return screen.getAllByTestId('buy-helper');
}

async function identifyViaStrip(user: ReturnType<typeof userEvent.setup>, raw: string) {
  const identify = screen.queryAllByTestId('identity-identify')[0];
  if (identify) {
    await user.click(identify);
  } else {
    await user.click(first(screen.getAllByTestId('identity-change')));
  }
  const input = first(screen.getAllByTestId('identity-email-input'));
  await user.clear(input);
  await user.type(input, raw);
  await user.click(first(screen.getAllByTestId('identity-save')));
}

function installHandlers(options: {
  counters?: Counters;
  flashSale?: ((id: string) => FlashSale) | FlashSale;
  myPurchase?: ((vars: Record<string, unknown>) => MyPurchaseResult) | MyPurchaseResult;
  purchaseErrorOnAttempts?: number[];
  purchaseItem?:
    | ((vars: Record<string, unknown>, attempt: number) => 'ERROR' | PurchaseItemResult)
    | PurchaseItemResult;
}) {
  const counters = options.counters ?? {
    flashSale: new Map(),
    myPurchase: new Map(),
    purchaseItem: 0,
  };
  let purchaseAttempts = 0;

  server.use(
    http.post(graphqlUrl(), async ({ request }) => {
      const body = await readGraphqlBody(request);
      const variables = body.variables ?? {};

      if (body.operationName === 'FlashSale') {
        const id = String(variables.id);
        counters.flashSale.set(id, (counters.flashSale.get(id) ?? 0) + 1);
        const sale =
          typeof options.flashSale === 'function'
            ? options.flashSale(id)
            : (options.flashSale ?? activeSale(id));
        return HttpResponse.json({ data: { flashSale: sale } });
      }

      if (body.operationName === 'MyPurchase') {
        const flashSaleId = String(variables.flashSaleId);
        const userId = String(variables.userId);
        const k = keyOf(flashSaleId, userId);
        counters.myPurchase.set(k, (counters.myPurchase.get(k) ?? 0) + 1);
        if (!options.myPurchase) {
          return HttpResponse.json({
            data: {
              myPurchase: { purchaseId: null, purchased: false, purchasedAt: null },
            },
          });
        }
        if (typeof options.myPurchase === 'function') {
          return HttpResponse.json({ data: { myPurchase: options.myPurchase(variables) } });
        }
        return HttpResponse.json({ data: { myPurchase: options.myPurchase } });
      }

      if (body.operationName === 'PurchaseItem') {
        purchaseAttempts += 1;
        counters.purchaseItem += 1;
        if (options.purchaseErrorOnAttempts?.includes(purchaseAttempts)) {
          return HttpResponse.json({
            errors: [
              {
                extensions: { code: 'INTERNAL_SERVER_ERROR' },
                message: 'warehouse txn exploded',
              },
            ],
          });
        }
        const resultFactory = options.purchaseItem;
        const result =
          typeof resultFactory === 'function'
            ? resultFactory(variables, purchaseAttempts)
            : (resultFactory ?? {
                purchaseId: 'p-1',
                message: 'Purchase completed',
                status: 'SUCCESS' as const,
              });
        if (result === 'ERROR') {
          return HttpResponse.json({
            errors: [{ extensions: { code: 'INTERNAL_SERVER_ERROR' }, message: 'boom' }],
          });
        }
        return HttpResponse.json({ data: { purchaseItem: result } });
      }

      return HttpResponse.json({
        errors: [
          {
            extensions: { code: 'UNHANDLED_TEST_OPERATION' },
            message: `Unhandled GraphQL operation ${body.operationName}`,
          },
        ],
      });
    }),
  );

  return counters;
}

describe('FlashSalePage', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('mounts both PurchaseRail and StickyBuyBar and shows the product name once loaded', async () => {
    installHandlers({ flashSale: activeSale('sale-dual') });
    renderSale('/sales/sale-dual');
    await screen.findByTestId('sale-status');
    expect(await screen.findByText('Aurora Headphones')).toBeInTheDocument();
    expect(screen.getByTestId('purchase-rail')).toBeInTheDocument();
    expect(screen.getByTestId('sticky-buy-bar')).toBeInTheDocument();
    expect(screen.getByTestId('back-to-products')).toBeInTheDocument();
  });

  it('renders backend status even when timestamps look outside the window', async () => {
    installHandlers({
      flashSale: activeSale('sale-window', {
        endsAt: '2001-01-01T00:00:00.000Z',
        startsAt: '2000-01-01T00:00:00.000Z',
        status: 'ACTIVE',
      }),
    });
    renderSale('/sales/sale-window');
    expect(await screen.findByTestId('sale-status')).toHaveTextContent('ACTIVE');
  });

  it('renders ENDED from API even when timestamps look inside the window', async () => {
    installHandlers({
      flashSale: activeSale('sale-ended', {
        endsAt: '2099-12-31T00:00:00.000Z',
        startsAt: '2000-01-01T00:00:00.000Z',
        status: 'ENDED',
      }),
    });
    renderSale('/sales/sale-ended');
    expect(await screen.findByTestId('sale-status')).toHaveTextContent('ENDED');
    expect(buyButton()).toBeDisabled();
  });

  it('sends exact route flashSaleId to FlashSale query', async () => {
    const seen: string[] = [];
    installHandlers({
      flashSale: (id) => {
        seen.push(id);
        return activeSale(id);
      },
    });
    renderSale('/sales/Sale_ABC-123.~test');
    await screen.findByTestId('sale-status');
    expect(seen[0]).toBe('Sale_ABC-123.~test');
  });

  it('shows safe request error for unhandled GraphQL operations', async () => {
    renderSale('/sales/sale-unhandled');
    const alert = await screen.findByTestId('request-error');
    expect(alert).toHaveTextContent(/couldn't complete your request/i);
    expect(alert).not.toHaveTextContent('UNHANDLED_TEST_OPERATION');
    expect(alert).not.toHaveTextContent('Unhandled GraphQL operation');
    // Desktop purchase surface stays mounted (Buy disabled) when sale fails to load.
    expect(screen.getByTestId('purchase-rail')).toBeInTheDocument();
    expect(screen.getByTestId('sticky-buy-bar')).toBeInTheDocument();
  });

  it('does not call myPurchase for Guest and shows identify hint', async () => {
    const counters = installHandlers({});
    renderSale('/sales/sale-123');
    await screen.findByTestId('sale-status');
    expect(await screen.findByText('Aurora Headphones')).toBeInTheDocument();
    const helpers = buyHelpers();
    expect(helpers.length).toBeGreaterThan(0);
    expect(helpers[0]).toHaveTextContent(/enter your email/i);
    expect(screen.queryByLabelText(/user id/i)).not.toBeInTheDocument();
    expect(counters.myPurchase.size).toBe(0);
  });

  it('does not call myPurchase for whitespace-only draft (Save disabled)', async () => {
    const counters = installHandlers({});
    const { user } = renderSale('/sales/sale-123');
    await screen.findByTestId('sale-status');
    await user.click(first(screen.getAllByTestId('identity-identify')));
    await user.type(first(screen.getAllByTestId('identity-email-input')), '   ');
    expect(screen.getAllByTestId('identity-save')[0]).toBeDisabled();
    expect(counters.myPurchase.size).toBe(0);
  });

  it('calls myPurchase with exact raw userId and preserves Buy on request error', async () => {
    let lastUserId: string | undefined;
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        if (body.operationName === 'FlashSale') {
          return HttpResponse.json({
            data: { flashSale: activeSale(String(body.variables?.id)) },
          });
        }
        if (body.operationName === 'MyPurchase') {
          lastUserId = String(body.variables?.userId);
          return HttpResponse.json({
            errors: [
              {
                extensions: { code: 'INTERNAL_SERVER_ERROR' },
                message: 'lookup failed in shard-9',
              },
            ],
          });
        }
        return HttpResponse.json({
          errors: [{ extensions: { code: 'UNHANDLED_TEST_OPERATION' }, message: 'nope' }],
        });
      }),
    );

    const { user } = renderSale('/sales/sale-123');
    await screen.findByTestId('sale-status');
    await identifyViaStrip(user, ' user-123 ');
    await screen.findByTestId('request-error');
    expect(lastUserId).toBe(' user-123 ');
    expect(screen.getByTestId('request-error')).not.toHaveTextContent('shard-9');
    expect(buyButton()).toBeEnabled();
  });

  it('disables Buy when already purchased', async () => {
    installHandlers({
      myPurchase: { purchaseId: 'p-9', purchased: true, purchasedAt: '2026-01-01T00:00:00.000Z' },
    });
    renderSale('/sales/sale-123', { userId: 'user-1' });
    const alreadyPurchased = await screen.findAllByTestId('already-purchased');
    expect(alreadyPurchased[0]).toBeInTheDocument();
    expect(buyButton()).toBeDisabled();
  });

  it('preserves exact raw userId and route flashSaleId on purchaseItem', async () => {
    const purchaseVars: Array<Record<string, unknown>> = [];
    installHandlers({
      purchaseItem: (vars) => {
        purchaseVars.push(vars);
        return { purchaseId: 'p-1', message: 'Purchase completed', status: 'SUCCESS' };
      },
    });
    const { user } = renderSale('/sales/Sale_ABC-123.~test');
    await screen.findByTestId('sale-status');
    await identifyViaStrip(user, ' user-123 ');
    await waitFor(() => {
      expect(buyButton()).toBeEnabled();
    });
    await user.click(buyButton());
    await screen.findAllByTestId('purchase-outcome');
    expect(purchaseVars[0]?.flashSaleId).toBe('Sale_ABC-123.~test');
    expect(purchaseVars[0]?.userId).toBe(' user-123 ');
  });

  it('never shows SUCCESS before the backend returns SUCCESS', async () => {
    let resolvePurchase: ((value: Response) => void) | undefined;
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        if (body.operationName === 'FlashSale') {
          return HttpResponse.json({
            data: { flashSale: activeSale(String(body.variables?.id)) },
          });
        }
        if (body.operationName === 'MyPurchase') {
          return HttpResponse.json({
            data: {
              myPurchase: { purchaseId: null, purchased: false, purchasedAt: null },
            },
          });
        }
        if (body.operationName === 'PurchaseItem') {
          return await new Promise<Response>((resolve) => {
            resolvePurchase = resolve;
          });
        }
        return HttpResponse.json({
          errors: [{ extensions: { code: 'UNHANDLED_TEST_OPERATION' }, message: 'nope' }],
        });
      }),
    );

    const { user } = renderSale('/sales/sale-123', { userId: 'user-1' });
    await screen.findByTestId('sale-status');
    await waitFor(() => {
      expect(buyButton()).toBeEnabled();
    });
    await user.click(buyButton());
    await waitFor(() => {
      expect(buyButtons()[0]).toHaveTextContent(/buying/i);
    });
    expect(screen.queryByTestId('purchase-outcome')).not.toBeInTheDocument();

    resolvePurchase?.(
      HttpResponse.json({
        data: {
          purchaseItem: {
            purchaseId: 'p-1',
            message: 'Purchase completed',
            status: 'SUCCESS',
          },
        },
      }),
    );
    const statuses = await screen.findAllByTestId('purchase-outcome-status');
    expect(statuses[0]).toHaveTextContent('Purchase successful');
  });

  it('invalidates flashSale and matching myPurchase after mutation settlement including errors', async () => {
    const counters = installHandlers({
      purchaseErrorOnAttempts: [1],
      purchaseItem: {
        purchaseId: 'p-1',
        message: 'Purchase completed',
        status: 'SUCCESS',
      },
    });
    const { user } = renderSale('/sales/sale-123', { userId: 'user-456' });
    await screen.findByTestId('sale-status');
    await waitFor(() => {
      expect(counters.myPurchase.get(keyOf('sale-123', 'user-456'))).toBe(1);
    });
    const flashBefore = counters.flashSale.get('sale-123') ?? 0;
    await user.click(buyButton());
    await screen.findAllByTestId('request-error');
    await waitFor(() => {
      expect(counters.flashSale.get('sale-123')).toBeGreaterThan(flashBefore);
      expect(counters.myPurchase.get(keyOf('sale-123', 'user-456'))).toBeGreaterThan(1);
    });
  });

  it('shows SOLD_OUT outcome when stale UI was ACTIVE', async () => {
    installHandlers({
      flashSale: activeSale('sale-123', { remainingStock: 1, status: 'ACTIVE' }),
      purchaseItem: { purchaseId: null, message: 'Sold out', status: 'SOLD_OUT' },
    });
    const { user } = renderSale('/sales/sale-123', { userId: 'user-1' });
    await screen.findByTestId('sale-status');
    await waitFor(() => {
      expect(buyButton()).toBeEnabled();
    });
    await user.click(buyButton());
    const statuses = await screen.findAllByTestId('purchase-outcome-status');
    expect(statuses[0]).toHaveTextContent('Sold out');
    expect(screen.queryByText(/purchase successful/i)).not.toBeInTheDocument();
  });

  it('retries purchase after request error and clears prior error on SUCCESS', async () => {
    installHandlers({
      purchaseErrorOnAttempts: [1],
      purchaseItem: {
        purchaseId: 'p-2',
        message: 'Purchase completed',
        status: 'SUCCESS',
      },
    });
    const { user } = renderSale('/sales/sale-123', { userId: 'user-1' });
    await screen.findByTestId('sale-status');
    await waitFor(() => {
      expect(buyButton()).toBeEnabled();
    });
    await user.click(buyButton());
    const requestErrors = await screen.findAllByTestId('request-error');
    expect(requestErrors[0]).toHaveTextContent(/couldn't complete your purchase/i);
    expect(requestErrors[0]).not.toHaveTextContent('warehouse');
    await user.click(first(screen.getAllByRole('button', { name: /try again/i })));
    const statuses = await screen.findAllByTestId('purchase-outcome-status');
    expect(statuses[0]).toHaveTextContent('Purchase successful');
    expect(screen.queryByTestId('request-error')).not.toBeInTheDocument();
  });

  it('renders each business outcome distinctly', async () => {
    const outcomes: PurchaseItemResult[] = [
      { purchaseId: 'p', message: 'ok', status: 'SUCCESS' },
      { purchaseId: null, message: 'already', status: 'ALREADY_PURCHASED' },
      { purchaseId: null, message: 'soon', status: 'SALE_NOT_STARTED' },
      { purchaseId: null, message: 'ended', status: 'SALE_ENDED' },
      { purchaseId: null, message: 'gone', status: 'SOLD_OUT' },
    ];

    for (const outcome of outcomes) {
      installHandlers({ purchaseItem: outcome });
      const { user } = renderSale('/sales/sale-123', { userId: `user-${outcome.status}` });
      await screen.findByTestId('sale-status');
      await waitFor(() => {
        expect(buyButton()).toBeEnabled();
      });
      await user.click(buyButton());
      const statuses = await screen.findAllByTestId('purchase-outcome-status');
      expect(statuses[0]).toBeInTheDocument();
      cleanup();
      localStorage.clear();
    }
  });

  it('after switching identity, previous myPurchase cache no longer drives PurchasePanel', async () => {
    installHandlers({
      myPurchase: (vars) => {
        const userId = String(vars.userId);
        if (userId === 'user-a') {
          return { purchaseId: 'p-a', purchased: true, purchasedAt: '2026-01-01T00:00:00.000Z' };
        }
        return { purchaseId: null, purchased: false, purchasedAt: null };
      },
    });
    const { user } = renderSale('/sales/sale-123', { userId: 'user-a' });
    const alreadyPurchased = await screen.findAllByTestId('already-purchased');
    expect(alreadyPurchased[0]).toBeInTheDocument();
    expect(buyButton()).toBeDisabled();

    await identifyViaStrip(user, 'user-b');
    await waitFor(() => {
      expect(screen.queryByTestId('already-purchased')).not.toBeInTheDocument();
    });
    expect(screen.getAllByTestId('identity-status')[0]).toHaveTextContent('Shopping as user-b');
    await waitFor(() => {
      expect(buyButton()).toBeEnabled();
    });
  });

  it('hides prior identity purchase outcome after switching identity', async () => {
    installHandlers({
      purchaseItem: {
        purchaseId: 'p-1',
        message: 'Purchase completed',
        status: 'SUCCESS',
      },
    });
    const { user } = renderSale('/sales/sale-123', { userId: 'user-a' });
    await screen.findByTestId('sale-status');
    await waitFor(() => {
      expect(buyButton()).toBeEnabled();
    });
    await user.click(buyButton());
    const purchaseOutcomes = await screen.findAllByTestId('purchase-outcome');
    expect(purchaseOutcomes[0]).toBeInTheDocument();

    await identifyViaStrip(user, 'user-b');
    await waitFor(() => {
      expect(screen.queryByTestId('purchase-outcome')).not.toBeInTheDocument();
    });
  });
});

describe('AppRoutes unmatched GraphQL stays loud', () => {
  it('catalog at / mounts with QueryClient and handles FlashSales errors', async () => {
    server.use(
      http.post(graphqlUrl(), async ({ request }) => {
        const body = await readGraphqlBody(request);
        if (body.operationName === 'FlashSales') {
          return HttpResponse.json({
            errors: [{ extensions: { code: 'UNHANDLED_TEST_OPERATION' }, message: 'nope' }],
          });
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
            <AppRoutes />
          </MemoryRouter>
        </IdentityProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('catalog-page')).toBeInTheDocument();
    expect(await screen.findByTestId('catalog-error')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-error')).not.toHaveTextContent('UNHANDLED_TEST_OPERATION');
  });
});
