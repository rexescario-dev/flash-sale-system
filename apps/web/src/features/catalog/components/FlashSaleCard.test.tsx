import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { CatalogFlashSale } from '../../../graphql/types';

import { FlashSaleCard } from './FlashSaleCard';

function sale(overrides: Partial<CatalogFlashSale> = {}): CatalogFlashSale {
  return {
    id: 'sale-42',
    endsAt: '2026-06-02T12:00:00.000Z',
    product: { id: 'p1', description: 'A great widget', name: 'Flash Widget' },
    remainingStock: 4,
    startsAt: '2026-06-01T12:00:00.000Z',
    status: 'ACTIVE',
    totalStock: 20,
    ...overrides,
  };
}

function renderCard(row: CatalogFlashSale) {
  return render(
    <MemoryRouter>
      <FlashSaleCard sale={row} />
    </MemoryRouter>,
  );
}

describe('FlashSaleCard', () => {
  it('links the whole card to /sales/:flashSaleId and shows name + stock', () => {
    renderCard(sale());
    const link = screen.getByRole('link', { name: /flash widget/i });
    expect(link).toHaveAttribute('href', '/sales/sale-42');
    expect(screen.getByTestId('catalog-card')).toBe(link);
    expect(link.querySelector('button, input, select, textarea, [role="button"]')).toBeNull();
    expect(screen.getByText('4 / 20 remaining')).toBeInTheDocument();
    expect(screen.getByText('A great widget')).toBeInTheDocument();
    expect(screen.getByTestId('sale-status-badge')).toHaveTextContent('Active');
  });

  it('omits description when null', () => {
    renderCard(sale({ product: { id: 'p1', description: null, name: 'X' } }));
    expect(screen.queryByTestId('catalog-card-description')).not.toBeInTheDocument();
  });

  it('omits description when empty string', () => {
    renderCard(sale({ product: { id: 'p1', description: '', name: 'X' } }));
    expect(screen.queryByTestId('catalog-card-description')).not.toBeInTheDocument();
  });

  it('renders non-empty description', () => {
    renderCard(sale({ product: { id: 'p1', description: 'Shown', name: 'X' } }));
    expect(screen.getByTestId('catalog-card-description')).toHaveTextContent('Shown');
  });
});
