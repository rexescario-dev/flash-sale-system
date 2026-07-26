export type AppEnv = {
  NODE_ENV?: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
};

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
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl!,
    REDIS_URL: redisUrl!,
  };
}
