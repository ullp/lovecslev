import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, resolveCorsOrigins } from '../src/app.factory';

/**
 * Web (Next.js) běží na jiném portu než API, takže bez CORS by prohlížeč
 * data vůbec nenačetl. Test hlídá, že se konfigurace nerozjede (D21/§8.4).
 */
describe('CORS pro webového klienta (web :3001 → API :3000)', () => {
  let app: INestApplication;
  const original = process.env.CORS_ORIGINS;

  beforeAll(async () => {
    process.env.CORS_ORIGINS = 'http://localhost:3001';
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (original === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = original;
    }
  });

  it('povolí preflight z webu včetně Authorization', async () => {
    const response = await request(app.getHttpServer())
      .options('/v1/leaflets')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('nepřidá CORS hlavičku cizímu originu', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://evil.example');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('resolveCorsOrigins', () => {
  const original = process.env.CORS_ORIGINS;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = original;
    process.env.NODE_ENV = originalEnv;
  });

  it('vývojový default je web na :3001', () => {
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = 'development';
    expect(resolveCorsOrigins()).toEqual(['http://localhost:3001']);
  });

  it('v produkci bez CORS_ORIGINS nic nepovolí', () => {
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = 'production';
    expect(resolveCorsOrigins()).toEqual([]);
  });

  it('parsuje čárkou oddělený seznam a ignoruje prázdné položky', () => {
    process.env.CORS_ORIGINS = 'http://localhost:3001, https://lovecslev.cz ,,';
    expect(resolveCorsOrigins()).toEqual(['http://localhost:3001', 'https://lovecslev.cz']);
  });
});
