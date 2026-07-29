export type AppEnv = {
  DATABASE_URL: string;
  FLASH_SALE_CACHE_TTL_SECONDS: number;
  MY_PURCHASE_CACHE_TTL_SECONDS: number;
  MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS: number;
  NODE_ENV?: string;
  PORT: number;
  RATE_LIMIT_PURCHASE_ITEM_MAX: number;
  RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS: number;
  REDIS_URL: string;
  TRUSTED_PROXY: boolean;
};

function parsePositiveInt(value: unknown, name: string, defaultValue: number): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

/**
 * Fail-fast validation for required API environment variables.
 * In `test`, defaults are applied so unit/smoke tests do not need Docker.
 */
export function validateEnv(config: Record<string, unknown>): AppEnv {
  const nodeEnv = typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'development';
  const isTest = nodeEnv === 'test';

  const databaseUrl =
    typeof config.DATABASE_URL === 'string' && config.DATABASE_URL.length > 0
      ? config.DATABASE_URL
      : isTest
        ? 'postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale'
        : undefined;

  const redisUrl =
    typeof config.REDIS_URL === 'string' && config.REDIS_URL.length > 0
      ? config.REDIS_URL
      : isTest
        ? 'redis://localhost:6379'
        : undefined;

  const missing: string[] = [];
  if (!databaseUrl) missing.push('DATABASE_URL');
  if (!redisUrl) missing.push('REDIS_URL');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const portRaw = config.PORT;
  const port =
    typeof portRaw === 'string' && portRaw.length > 0
      ? Number(portRaw)
      : typeof portRaw === 'number'
        ? portRaw
        : 3000;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('PORT must be a positive number');
  }

  return {
    DATABASE_URL: databaseUrl!,
    FLASH_SALE_CACHE_TTL_SECONDS: parsePositiveInt(
      config.FLASH_SALE_CACHE_TTL_SECONDS,
      'FLASH_SALE_CACHE_TTL_SECONDS',
      5,
    ),
    MY_PURCHASE_CACHE_TTL_SECONDS: parsePositiveInt(
      config.MY_PURCHASE_CACHE_TTL_SECONDS,
      'MY_PURCHASE_CACHE_TTL_SECONDS',
      5,
    ),
    MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS: parsePositiveInt(
      config.MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS,
      'MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS',
      2,
    ),
    NODE_ENV: nodeEnv,
    PORT: port,
    RATE_LIMIT_PURCHASE_ITEM_MAX: parsePositiveInt(
      config.RATE_LIMIT_PURCHASE_ITEM_MAX,
      'RATE_LIMIT_PURCHASE_ITEM_MAX',
      30,
    ),
    RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS: parsePositiveInt(
      config.RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS,
      'RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS',
      60,
    ),
    REDIS_URL: redisUrl!,
    TRUSTED_PROXY: config.TRUSTED_PROXY === 'true',
  };
}
