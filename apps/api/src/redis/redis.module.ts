import { Global, Module } from '@nestjs/common';

import { IoredisRedisClientAdapter } from './ioredis-redis-client.adapter';
import { REDIS_CLIENT } from './redis.tokens';

@Global()
@Module({
  exports: [REDIS_CLIENT],
  providers: [
    IoredisRedisClientAdapter,
    { provide: REDIS_CLIENT, useExisting: IoredisRedisClientAdapter },
  ],
})
export class RedisModule {}
