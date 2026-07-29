import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import type { AppEnv } from './config/env.validation';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<AppEnv, true>);
  // SPA (Vite :5173) and API (:3000/:3001) are cross-origin in local/E2E stacks.
  app.enableCors({ origin: true });
  if (config.get('TRUSTED_PROXY', { infer: true })) {
    app.set('trust proxy', 1);
  }
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

void bootstrap();
