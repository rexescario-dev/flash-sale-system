import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FlashSale, MyPurchaseResult, PurchaseItemResult } from '../graphql/types';

import { AppRoutes } from '../app/router';
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
    remainingStock: 5,
    startsAt: '2000-01-01T00:00:00.000Z',
    status: 'ACTIVE',
    totalStock: 10,
    ...overrides,
  };
}

function renderSale(path: string) {
  const queryClient = createTestQueryClient();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<FlashSalePage />} path="/sales/:flashSaleId" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { queryClient, user };
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
            message: `Unhandled GraphQL operation in test: ${body.operationName ?? 'unknown'}`,
          },
        ],
      });
    }),
  );

  return counters;
}

describe('FlashSalePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
    expect(screen.getByRole('button', { name: /buy now/i })).toBeDisabled();
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
    // Default MSW handler only — no FlashSale override
    renderSale('/sales/sale-unhandled');
    const alert = await screen.findByTestId('request-error');
    expect(alert).toHaveTextContent(/couldn't complete your request/i);
    expect(alert).not.toHaveTextContent('UNHANDLED_TEST_OPERATION');
    expect(alert).not.toHaveTextContent('Unhandled GraphQL operation');
  });

  it('does not call myPurchase for whitespace-only userId', async () => {
    const counters = installHandlers({});
    const { user } = renderSale('/sales/sale-123');
    await screen.findByTestId('sale-status');
    await user.type(screen.getByLabelText(/user id/i), '   ');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(counters.myPurchase.size).toBe(0);
  });

  it('debounces myPurchase with exact raw userId and preserves Buy on request error', async () => {
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
    await user.type(screen.getByLabelText(/user id/i), ' user-123 ');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await screen.findByTestId('request-error');
    expect(lastUserId).toBe(' user-123 ');
    expect(screen.getByTestId('request-error')).not.toHaveTextContent('shard-9');
    expect(screen.getByRole('button', { name: /buy now/i })).toBeEnabled();
  });

  it('disables Buy when already purchased', async () => {
    installHandlers({
      myPurchase: { purchaseId: 'p-9', purchased: true, purchasedAt: '2026-01-01T00:00:00.000Z' },
    });
    const { user } = renderSale('/sales/sale-123');
    await screen.findByTestId('sale-status');
    await user.type(screen.getByLabelText(/user id/i), 'user-1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(await screen.findByTestId('already-purchased')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy now/i })).toBeDisabled();
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
    await user.type(screen.getByLabelText(/user id/i), ' user-123 ');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buy now/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /buy now/i }));
    await screen.findByTestId('purchase-outcome');
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

    const { user } = renderSale('/sales/sale-123');
    await screen.findByTestId('sale-status');
    await user.type(screen.getByLabelText(/user id/i), 'user-1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buy now/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /buy now/i }));
    expect(await screen.findByTestId('purchase-pending')).toBeInTheDocument();
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
    expect(await screen.findByTestId('purchase-outcome-status')).toHaveTextContent(
      'Purchase successful',
    );
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
    const { user } = renderSale('/sales/sale-123');
    await screen.findByTestId('sale-status');
    await user.type(screen.getByLabelText(/user id/i), 'user-456');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => {
      expect(counters.myPurchase.get(keyOf('sale-123', 'user-456'))).toBe(1);
    });
    const flashBefore = counters.flashSale.get('sale-123') ?? 0;
    await user.click(screen.getByRole('button', { name: /buy now/i }));
    await screen.findByTestId('request-error');
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
    const { user } = renderSale('/sales/sale-123');
    await screen.findByTestId('sale-status');
    await user.type(screen.getByLabelText(/user id/i), 'user-1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buy now/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /buy now/i }));
    expect(await screen.findByTestId('purchase-outcome-status')).toHaveTextContent('Sold out');
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
    const { user } = renderSale('/sales/sale-123');
    await screen.findByTestId('sale-status');
    await user.type(screen.getByLabelText(/user id/i), 'user-1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buy now/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /buy now/i }));
    expect(await screen.findByTestId('request-error')).toHaveTextContent(
      /couldn't complete your purchase/i,
    );
    expect(screen.getByTestId('request-error')).not.toHaveTextContent('warehouse');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('purchase-outcome-status')).toHaveTextContent(
      'Purchase successful',
    );
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
      const { user } = renderSale('/sales/sale-123');
      await screen.findByTestId('sale-status');
      await user.type(screen.getByLabelText(/user id/i), `user-${outcome.status}`);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /buy now/i })).toBeEnabled();
      });
      await user.click(screen.getByRole('button', { name: /buy now/i }));
      expect(await screen.findByTestId('purchase-outcome-status')).toBeInTheDocument();
      cleanup();
    }
  });
});

describe('AppRoutes unmatched GraphQL stays loud', () => {
  it('landing still works without GraphQL', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /flash sale/i })).toBeInTheDocument();
  });
});
