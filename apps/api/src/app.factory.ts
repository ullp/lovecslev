import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';
import { HttpExceptionFilter } from './common/http-exception.filter';

/**
 * Společná konfigurace aplikace — používají ji main.ts i e2e testy,
 * aby se globální pipes/filtry nemohly rozejít (spec §8.4).
 */
export function configureApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Pořadí: doménové chyby mají přednost, zbytek normalizuje HttpExceptionFilter.
  app.useGlobalFilters(new HttpExceptionFilter(), new DomainExceptionFilter());
  return app;
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: false });
  return configureApp(app);
}
