import { Global, Module } from '@nestjs/common';

import { AppLogger } from './app-logger';

@Global()
@Module({
  exports: [AppLogger],
  providers: [AppLogger],
})
export class LoggingModule {}
