import { useQuery } from '@tanstack/react-query';

import { isNonWhitespaceId } from '../graphql/id';
import { fetchFlashSale } from '../graphql/operations/flashSale';

export function flashSaleQueryKey(flashSaleId: string) {
  return ['flashSale', flashSaleId] as const;
}

export function useFlashSale(flashSaleId: string) {
  return useQuery({
    enabled: isNonWhitespaceId(flashSaleId),
    queryFn: () => fetchFlashSale(flashSaleId),
    queryKey: flashSaleQueryKey(flashSaleId),
  });
}
