import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from './router';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('renders landing guidance at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: /flash sale/i })).toBeInTheDocument();
    expect(screen.getByText(/\/sales\//i)).toBeInTheDocument();
  });

  it('renders flash sale page shell at /sales/:flashSaleId', () => {
    renderAt('/sales/sale-123');
    expect(screen.getByTestId('flash-sale-page')).toBeInTheDocument();
    expect(screen.getByText(/sale-123/)).toBeInTheDocument();
  });

  it('renders not found for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
  });
});
