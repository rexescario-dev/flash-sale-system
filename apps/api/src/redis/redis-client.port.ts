export type RedisClientPort = {
  delete(key: string): Promise<void>;
  get(key: string): Promise<null | string>;
  /**
   * Atomically INCR key; if the result is 1, set EXPIRE ttlSeconds in the same Lua script.
   * Must never leave a key without TTL after the first successful increment.
   */
  incrWithExpiryOnFirst(key: string, ttlSeconds: number): Promise<number>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};
