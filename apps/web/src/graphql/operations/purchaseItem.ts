import { gql } from 'graphql-request';

import type { PurchaseItemResult } from '../types';

import { graphqlClient } from '../client';
import { toRequestError } from '../errors';

const PURCHASE_ITEM_MUTATION = gql`
  mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
    purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
      status
      message
      purchaseId
    }
  }
`;

type PurchaseItemResponse = {
  purchaseItem: PurchaseItemResult;
};

export async function mutatePurchaseItem(
  flashSaleId: string,
  userId: string,
): Promise<PurchaseItemResult> {
  try {
    const data = await graphqlClient.request<PurchaseItemResponse>(PURCHASE_ITEM_MUTATION, {
      flashSaleId,
      userId,
    });
    return data.purchaseItem;
  } catch (error) {
    throw toRequestError(error);
  }
}
