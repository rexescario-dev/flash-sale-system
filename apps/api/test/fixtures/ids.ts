export const E2E_PREFIX = {
  product: 'e2e-product-',
  sale: 'e2e-sale-',
  user: 'e2e-user-',
} as const;

export const CONCURRENCY_PREFIX = {
  product: 'concurrency-product-',
  sale: 'concurrency-sale-',
  user: 'concurrency-user-',
} as const;

export function e2eProductId(suffix: string): string {
  return `${E2E_PREFIX.product}${suffix}`;
}

export function e2eSaleId(suffix: string): string {
  return `${E2E_PREFIX.sale}${suffix}`;
}

export function e2eUserId(suffix: string): string {
  return `${E2E_PREFIX.user}${suffix}`;
}

export function concurrencySaleId(suffix: string): string {
  return `${CONCURRENCY_PREFIX.sale}${suffix}`;
}

export function concurrencyProductId(suffix: string): string {
  return `${CONCURRENCY_PREFIX.product}${suffix}`;
}

export function concurrencyUserId(suffix: string): string {
  return `${CONCURRENCY_PREFIX.user}${suffix}`;
}
