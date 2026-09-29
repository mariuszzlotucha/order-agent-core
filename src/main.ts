import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '0.0.0.0');
}

bootstrap();
