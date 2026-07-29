import { useMutation, useQueryClient } from '@tanstack/react-query';

import { mutatePurchaseItem } from '../graphql/operations/purchaseItem';
import { flashSaleQueryKey } from './useFlashSale';
import { myPurchaseQueryKey } from './useMyPurchase';

type PurchaseVariables = {
  flashSaleId: string;
  userId: string;
};

export function usePurchaseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ flashSaleId, userId }: PurchaseVariables) =>
      mutatePurchaseItem(flashSaleId, userId),
    onSettled: (_data, _error, variables) => {
      if (!variables) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: myPurchaseQueryKey(variables.flashSaleId, variables.userId),
      });
      void queryClient.invalidateQueries({
        queryKey: flashSaleQueryKey(variables.flashSaleId),
      });
    },
  });
}
