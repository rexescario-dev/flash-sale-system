import { flashSaleCacheKey, myPurchaseCacheKey, purchaseItemRateLimitKey } from './redis-keys';

describe('redis-keys', () => {
  it('builds flash-sale and my-purchase keys from validated ids', () => {
    expect(flashSaleCacheKey('sale-1')).toBe('flash-sale:v1:sale-1');
    expect(myPurchaseCacheKey('sale-1', 'user-1')).toBe('my-purchase:v1:sale-1:user-1');
  });

  it('builds stable distinct rate-limit keys for IPv4 and IPv6', () => {
    const ipv4 = purchaseItemRateLimitKey('203.0.113.10');
    const ipv6 = purchaseItemRateLimitKey('2001:db8::1');

    expect(ipv4).toBe('rate-limit:v1:purchaseItem:ip:203.0.113.10');
    expect(ipv6).toBe('rate-limit:v1:purchaseItem:ip:2001:db8::1');
    expect(ipv4).not.toBe(ipv6);
    expect(ipv6).toContain(':');
  });
});
