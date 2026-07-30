import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { PurchaseHistoryItem } from '../../../graphql/types';

import { PurchaseHistoryPanel } from './PurchaseHistoryPanel';

function item(overrides: Partial<PurchaseHistoryItem> = {}): PurchaseHistoryItem {
  return {
    id: 'pur-1',
    flashSale: { id: 'sale-42' },
    product: { id: 'p1', description: 'A long enough description for clamp', name: 'Aurora' },
    purchasedAt: '2026-07-29T07:14:00.000Z',
    ...overrides,
  };
}

function renderPanel(row: PurchaseHistoryItem) {
  return render(
    <MemoryRouter>
      <PurchaseHistoryPanel item={row} />
    </MemoryRouter>,
  );
}

describe('PurchaseHistoryPanel', () => {
  it('shows product name, muted id, and View sale Link href', () => {
    renderPanel(item());
    expect(screen.getByTestId('purchase-panel')).toBeInTheDocument();
    expect(screen.getByText('Aurora')).toBeInTheDocument();
    expect(screen.getByText(/pur-1/)).toBeInTheDocument();
    expect(screen.getByTestId('purchase-sale-link')).toHaveAttribute('href', '/sales/sale-42');
  });

  it('omits null and whitespace-only descriptions; shows non-empty description', () => {
    const { rerender } = render(
      <MemoryRouter>
        <PurchaseHistoryPanel
          item={item({ product: { id: 'p1', description: null, name: 'X' } })}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('purchase-panel-description')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PurchaseHistoryPanel
          item={item({ product: { id: 'p1', description: '   ', name: 'X' } })}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('purchase-panel-description')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PurchaseHistoryPanel
          item={item({ product: { id: 'p1', description: 'Hello', name: 'X' } })}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('purchase-panel-description')).toHaveTextContent('Hello');
  });

  it('renders absolute local purchasedAt (implementation-defined; non-relative)', () => {
    renderPanel(item({ purchasedAt: '2026-07-29T07:14:00.000Z' }));
    const panel = screen.getByTestId('purchase-panel');
    expect(panel).toHaveTextContent(/Purchased/i);
    expect(panel).not.toHaveTextContent('2026-07-29T07:14:00.000Z');
    expect(panel).not.toHaveTextContent(/ago/i);
  });
});
