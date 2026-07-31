/**
 * Map a GraphQL purchaseItem response into a stress classification bucket.
 * Aligns with apps/api/test/graphql/purchase-outcome-classify.ts conceptually,
 * but keeps ALREADY_PURCHASED as the bucket name (metrics map it to duplicate).
 *
 * @param {object|null|undefined} body Parsed GraphQL JSON body
 * @param {boolean} [transportError]
 * @returns {'SUCCESS'|'SOLD_OUT'|'ALREADY_PURCHASED'|'RATE_LIMITED'|'UNEXPECTED_ERROR'}
 */
export function classifyPurchaseResponse(body, transportError) {
  if (transportError) return 'UNEXPECTED_ERROR';
  if (!body || typeof body !== 'object') return 'UNEXPECTED_ERROR';

  const code =
    body.errors && body.errors[0] && body.errors[0].extensions
      ? body.errors[0].extensions.code
      : undefined;
  if (code === 'RATE_LIMITED') return 'RATE_LIMITED';
  if (body.errors && body.errors.length) return 'UNEXPECTED_ERROR';

  const status = body.data && body.data.purchaseItem ? body.data.purchaseItem.status : undefined;
  if (status === 'SUCCESS') return 'SUCCESS';
  if (status === 'SOLD_OUT') return 'SOLD_OUT';
  if (status === 'ALREADY_PURCHASED') return 'ALREADY_PURCHASED';
  return 'UNEXPECTED_ERROR';
}
