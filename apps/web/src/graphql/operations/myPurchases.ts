import { gql } from 'graphql-request';

import type { PurchaseHistoryItem } from '../types';

import { graphqlClient } from '../client';
import { toRequestError } from '../errors';

const MY_PURCHASES_QUERY = gql`
  query MyPurchases($userId: ID!) {
    myPurchases(userId: $userId) {
      id
      purchasedAt
      flashSale {
        id
      }
      product {
        id
        name
        description
      }
    }
  }
`;

type MyPurchasesResponse = {
  myPurchases: PurchaseHistoryItem[];
};

export async function fetchMyPurchases(userId: string): Promise<PurchaseHistoryItem[]> {
  try {
    const data = await graphqlClient.request<MyPurchasesResponse>(MY_PURCHASES_QUERY, {
      userId,
    });
    return data.myPurchases;
  } catch (error) {
    throw toRequestError(error);
  }
}
