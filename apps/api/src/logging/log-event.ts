export const LogEvent = {
  GRAPHQL_REQUEST_COMPLETED: 'graphql.request.completed',
  GRAPHQL_REQUEST_FAILED: 'graphql.request.failed',
  PURCHASE_ATTEMPTED: 'purchase.attempted',
  PURCHASE_COMPLETED: 'purchase.completed',
  PURCHASE_DUPLICATE: 'purchase.duplicate',
  PURCHASE_FAILED: 'purchase.failed',
  PURCHASE_QUERY_COMPLETED: 'purchase.query.completed',
  PURCHASE_RATE_LIMITED: 'purchase.rate_limited',
  PURCHASE_SALE_ENDED: 'purchase.sale_ended',
  PURCHASE_SALE_NOT_STARTED: 'purchase.sale_not_started',
  PURCHASE_SOLD_OUT: 'purchase.sold_out',
} as const;

export type LogEventName = (typeof LogEvent)[keyof typeof LogEvent];
