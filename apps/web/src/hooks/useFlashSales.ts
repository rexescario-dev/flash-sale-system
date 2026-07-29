import { useQuery } from '@tanstack/react-query';

import { fetchFlashSales } from '../graphql/operations/flashSales';

export function flashSalesQueryKey() {
  return ['flashSales'] as const;
}

export function useFlashSales() {
  return useQuery({
    queryFn: fetchFlashSales,
    queryKey: flashSalesQueryKey(),
  });
}
