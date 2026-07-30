import type { ReactElement, ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { IdentityProvider } from '../features/identity/IdentityProvider';
import { createTestQueryClient } from './query-client';

type Options = Omit<RenderOptions, 'wrapper'> & {
  initialEntries?: string[];
};

export function renderApp(ui: ReactElement, options: Options = {}) {
  const { initialEntries = ['/'], ...rest } = options;
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <IdentityProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </IdentityProvider>
      </QueryClientProvider>
    );
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...rest }),
  };
}
