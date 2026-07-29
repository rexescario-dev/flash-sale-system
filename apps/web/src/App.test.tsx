import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { createTestQueryClient } from './test/query-client';

describe('App', () => {
  it('renders the landing page at /', () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Flash Sale System')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /flash sale/i })).toBeInTheDocument();
  });
});
