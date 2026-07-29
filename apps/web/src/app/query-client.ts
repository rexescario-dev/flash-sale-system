import { QueryClient } from '@tanstack/react-query';

import { RequestError } from '../graphql/errors';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: {
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof RequestError && error.kind === 'GRAPHQL') {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}
