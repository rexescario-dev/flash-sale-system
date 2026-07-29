import { gql } from 'graphql-request';

import type { CatalogFlashSale } from '../types';

import { graphqlClient } from '../client';
import { toRequestError } from '../errors';

const FLASH_SALES_QUERY = gql`
  query FlashSales {
    flashSales {
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

type FlashSalesResponse = {
  flashSales: CatalogFlashSale[];
};

export async function fetchFlashSales(): Promise<CatalogFlashSale[]> {
  try {
    const data = await graphqlClient.request<FlashSalesResponse>(FLASH_SALES_QUERY);
    return data.flashSales;
  } catch (error) {
    throw toRequestError(error);
  }
}
