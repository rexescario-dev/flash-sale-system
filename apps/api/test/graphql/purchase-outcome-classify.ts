export type ConcurrencyBucket =
  'DUPLICATE' | 'RATE_LIMITED' | 'SOLD_OUT' | 'SUCCESS' | 'UNEXPECTED_ERROR';

export type GraphqlPurchaseResponse = {
  data?: {
    purchaseItem?: {
      status?: string;
    } | null;
  } | null;
  errors?: Array<{ extensions?: { code?: string }; message?: string }> | null;
};

/**
 * Production mapping (Task 0 audit):
 * - PurchaseConflictError / P2002 unique (flash_sale_id, user_id) → ALREADY_PURCHASED
 * - GraphQL data.purchaseItem.status carries business outcomes
 * - RATE_LIMITED is errors[].extensions.code
 */
export function classifyPurchaseResponse(body: GraphqlPurchaseResponse): ConcurrencyBucket {
  const code = body.errors?.[0]?.extensions?.code;
  if (code === 'RATE_LIMITED') return 'RATE_LIMITED';
  if (body.errors?.length) return 'UNEXPECTED_ERROR';

  const status = body.data?.purchaseItem?.status;
  if (status === 'SUCCESS') return 'SUCCESS';
  if (status === 'SOLD_OUT') return 'SOLD_OUT';
  if (status === 'ALREADY_PURCHASED') return 'DUPLICATE';
  return 'UNEXPECTED_ERROR';
}

export function tally(buckets: ConcurrencyBucket[]): Record<ConcurrencyBucket, number> {
  const init: Record<ConcurrencyBucket, number> = {
    DUPLICATE: 0,
    RATE_LIMITED: 0,
    SOLD_OUT: 0,
    SUCCESS: 0,
    UNEXPECTED_ERROR: 0,
  };
  for (const b of buckets) init[b] += 1;
  return init;
}
