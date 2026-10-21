import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';
import { HttpExceptionFilter } from './common/http-exception.filter';

/**
 * Povolené originy pro prohlížeč. Web (Next.js) běží na jiném portu než API,
 * takže bez CORS by klientská `fetch()` volání skončila chybou.
 *
 *  - `CORS_ORIGINS` = čárkou oddělený seznam, např. `http://localhost:3001`
 *  - bez proměnné: ve vývoji `http://localhost:3001`, v produkci žádný
 *    cross-origin (počítá se se same-origin reverse proxy).
 */
export function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (raw !== undefined && raw.trim() !== '') {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }
  return process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3001'];
}

/**
 * Společná konfigurace aplikace — používají ji main.ts i e2e testy,
 * aby se globální pipes/filtry nemohly rozejít (spec §8.4).
 */
export function configureApp(app: INestApplication): INestApplication {
  const corsOrigins = resolveCorsOrigins();
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    });
  }

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
