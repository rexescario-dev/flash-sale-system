export function flashSaleCacheKey(flashSaleId: string): string {
  return `flash-sale:v1:${flashSaleId}`;
}

export function myPurchaseCacheKey(flashSaleId: string, userId: string): string {
  return `my-purchase:v1:${flashSaleId}:${userId}`;
}

export function purchaseItemRateLimitKey(clientIp: string): string {
  return `rate-limit:v1:purchaseItem:ip:${clientIp}`;
}
