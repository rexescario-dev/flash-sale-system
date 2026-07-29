import { gql } from 'graphql-request';

import type { MyPurchaseResult } from '../types';

import { graphqlClient } from '../client';
import { toRequestError } from '../errors';

const MY_PURCHASE_QUERY = gql`
  query MyPurchase($flashSaleId: ID!, $userId: ID!) {
    myPurchase(flashSaleId: $flashSaleId, userId: $userId) {
      purchased
      purchaseId
      purchasedAt
    }
  }
`;

type MyPurchaseResponse = {
  myPurchase: MyPurchaseResult;
};

export async function fetchMyPurchase(
  flashSaleId: string,
  userId: string,
): Promise<MyPurchaseResult> {
  try {
    const data = await graphqlClient.request<MyPurchaseResponse>(MY_PURCHASE_QUERY, {
      flashSaleId,
      userId,
    });
    return data.myPurchase;
  } catch (error) {
    throw toRequestError(error);
  }
}
