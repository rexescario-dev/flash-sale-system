import { useQuery } from '@tanstack/react-query';

import { isNonWhitespaceId } from '../graphql/id';
import { fetchMyPurchases } from '../graphql/operations/myPurchases';

export function myPurchasesQueryKey(userId: string) {
  return ['myPurchases', userId] as const;
}

export function useMyPurchases(userId: string) {
  return useQuery({
    enabled: isNonWhitespaceId(userId),
    queryFn: () => fetchMyPurchases(userId),
    queryKey: myPurchasesQueryKey(userId),
  });
}
