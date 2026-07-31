import http from 'k6/http';

export const PURCHASE_ITEM = `
  mutation PurchaseItem($flashSaleId: ID!, $userId: ID!) {
    purchaseItem(flashSaleId: $flashSaleId, userId: $userId) {
      status
      message
      purchaseId
    }
  }
`;

/**
 * POST a GraphQL operation. Transport failures are flagged explicitly —
 * callers must not invent business statuses from them.
 *
 * @returns {{ transportError: boolean, status: number, body: object|string|null, error?: string }}
 */
export function graphqlRequest(url, { query, variables }) {
  let res;
  try {
    res = http.post(url, JSON.stringify({ query, variables }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return {
      body: null,
      error: String(err),
      status: 0,
      transportError: true,
    };
  }

  // k6 returns status 0 (and often res.error) on dial/network failure without throwing.
  if (res.error || res.status === 0 || res.status < 200 || res.status >= 300) {
    return {
      body: res.body,
      error: res.error || undefined,
      status: res.status,
      transportError: true,
    };
  }

  try {
    const body = res.json();
    return {
      body,
      status: res.status,
      transportError: false,
    };
  } catch (err) {
    return {
      body: res.body,
      error: String(err),
      status: res.status,
      transportError: true,
    };
  }
}
