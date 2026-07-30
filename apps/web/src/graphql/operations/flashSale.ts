import { gql } from 'graphql-request';

import type { FlashSale } from '../types';

import { graphqlClient } from '../client';
import { toRequestError } from '../errors';

const FLASH_SALE_QUERY = gql`
  query FlashSale($id: ID!) {
    flashSale(id: $id) {
      id
      status
      remainingStock
      totalStock
      startsAt
      endsAt
      product {
        id
        name
        description
      }
    }
  }
`;

type FlashSaleResponse = {
  flashSale: FlashSale;
};

export async function fetchFlashSale(id: string): Promise<FlashSale> {
  try {
    const data = await graphqlClient.request<FlashSaleResponse>(FLASH_SALE_QUERY, { id });
    return data.flashSale;
  } catch (error) {
    throw toRequestError(error);
  }
}
