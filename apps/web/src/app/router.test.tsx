import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createTestQueryClient } from '../test/query-client';
import { AppRoutes } from './router';

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppRoutes', () => {
  it('renders landing guidance at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: /flash sale/i })).toBeInTheDocument();
    expect(screen.getByText(/\/sales\//i)).toBeInTheDocument();
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
