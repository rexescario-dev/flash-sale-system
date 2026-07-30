import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { createQueryClient } from './app/query-client';
import { IdentityProvider } from './features/identity/IdentityProvider';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

const queryClient = createQueryClient();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <IdentityProvider>
          <App />
        </IdentityProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
