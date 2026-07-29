import { useQuery } from '@tanstack/react-query';

import { isNonWhitespaceId } from '../graphql/id';
import { fetchMyPurchase } from '../graphql/operations/myPurchase';

export function myPurchaseQueryKey(flashSaleId: string, userId: string) {
  return ['myPurchase', flashSaleId, userId] as const;
}

export function useMyPurchase(flashSaleId: string, userId: string) {
  return useQuery({
    enabled: isNonWhitespaceId(flashSaleId) && isNonWhitespaceId(userId),
    queryFn: () => fetchMyPurchase(flashSaleId, userId),
    queryKey: myPurchaseQueryKey(flashSaleId, userId),
  });
}
