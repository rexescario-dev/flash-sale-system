import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const required = {
    DATABASE_URL: 'postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale',
    REDIS_URL: 'redis://localhost:6379',
  };

  it('applies locked defaults for cache TTLs, rate limits, and TRUSTED_PROXY', () => {
    const env = validateEnv({ ...required, NODE_ENV: 'development' });

    expect(env.FLASH_SALE_CACHE_TTL_SECONDS).toBe(5);
    expect(env.MY_PURCHASE_CACHE_TTL_SECONDS).toBe(5);
    expect(env.MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS).toBe(2);
    expect(env.RATE_LIMIT_PURCHASE_ITEM_MAX).toBe(30);
    expect(env.RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS).toBe(60);
    expect(env.TRUSTED_PROXY).toBe(false);
  });

  it('parses explicit positive integer overrides', () => {
    const env = validateEnv({
      ...required,
      FLASH_SALE_CACHE_TTL_SECONDS: '10',
      MY_PURCHASE_CACHE_TTL_SECONDS: '12',
      MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS: '3',
      RATE_LIMIT_PURCHASE_ITEM_MAX: '50',
      RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS: '90',
    });

    expect(env.FLASH_SALE_CACHE_TTL_SECONDS).toBe(10);
    expect(env.MY_PURCHASE_CACHE_TTL_SECONDS).toBe(12);
    expect(env.MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS).toBe(3);
    expect(env.RATE_LIMIT_PURCHASE_ITEM_MAX).toBe(50);
    expect(env.RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS).toBe(90);
  });

  it('sets TRUSTED_PROXY true only when the env string is exactly true', () => {
    expect(validateEnv({ ...required, TRUSTED_PROXY: 'true' }).TRUSTED_PROXY).toBe(true);
    expect(validateEnv({ ...required, TRUSTED_PROXY: 'True' }).TRUSTED_PROXY).toBe(false);
    expect(validateEnv({ ...required, TRUSTED_PROXY: 'TRUE' }).TRUSTED_PROXY).toBe(false);
    expect(validateEnv({ ...required, TRUSTED_PROXY: '1' }).TRUSTED_PROXY).toBe(false);
    expect(validateEnv({ ...required, TRUSTED_PROXY: true }).TRUSTED_PROXY).toBe(false);
  });

  it('rejects non-positive integers for EPIC-04 numeric settings', () => {
    expect(() => validateEnv({ ...required, FLASH_SALE_CACHE_TTL_SECONDS: '0' })).toThrow(
      'FLASH_SALE_CACHE_TTL_SECONDS must be a positive integer',
    );

    expect(() => validateEnv({ ...required, RATE_LIMIT_PURCHASE_ITEM_MAX: '-1' })).toThrow(
      'RATE_LIMIT_PURCHASE_ITEM_MAX must be a positive integer',
    );

    expect(() => validateEnv({ ...required, MY_PURCHASE_CACHE_TTL_SECONDS: '1.5' })).toThrow(
      'MY_PURCHASE_CACHE_TTL_SECONDS must be a positive integer',
    );
  });

  it('uses test defaults for DATABASE_URL and REDIS_URL when NODE_ENV is test', () => {
    const env = validateEnv({ NODE_ENV: 'test' });

    expect(env.DATABASE_URL).toBe(
      'postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale',
    );
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
  });
});
