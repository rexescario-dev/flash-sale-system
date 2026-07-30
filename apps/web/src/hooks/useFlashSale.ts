import { useQuery } from '@tanstack/react-query';

import { isNonWhitespaceId } from '../graphql/id';
import { fetchFlashSale } from '../graphql/operations/flashSale';

/** Includes `withProduct` so pre-#124 cached rows (no nested product) are not reused. */
export function flashSaleQueryKey(flashSaleId: string) {
  return ['flashSale', flashSaleId, 'withProduct'] as const;
}

export function useFlashSale(flashSaleId: string) {
  return useQuery({
    enabled: isNonWhitespaceId(flashSaleId),
    queryFn: () => fetchFlashSale(flashSaleId),
    queryKey: flashSaleQueryKey(flashSaleId),
  });
}
