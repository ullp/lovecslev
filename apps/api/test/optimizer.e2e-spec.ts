import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EXPECTED, OFFERS, SHOPPING_LIST } from '@slevari/shared';
import { createApp } from '../src/app.factory';

describe('API (e2e) — M0 scaffold', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const payload = () => ({
    items: SHOPPING_LIST.map((item) => ({ ...item })),
    offers: OFFERS.map((offer) => ({ ...offer })),
  });

  it('GET /health je veřejný', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'slevari-api' });
  });

  it('POST /v1/optimizer/preview (PREMIUM) vrátí Variantu A i B', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/optimizer/preview')
      .set('X-Plan', 'PREMIUM')
      .send(payload())
      .expect(200);

    expect(response.body.variantA.chainCode).toBe(EXPECTED.variantAChain);
    expect(response.body.variantA.totalMinor).toBe(EXPECTED.variantATotalMinor);
    expect(response.body.variantB.totalMinor).toBe(EXPECTED.variantBTotalMinor);
    expect(response.body.savingsMinor).toBe(EXPECTED.savingsMinor);
    expect(response.body.meta.lockedFeatures).toEqual([]);
  });

  it('POST /v1/optimizer/preview (FREE) vrací jen Variantu A', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/optimizer/preview')
      .send(payload())
      .expect(200);

    expect(response.body.variantA.totalMinor).toBe(EXPECTED.variantATotalMinor);
    expect(response.body.variantB).toBeNull();
    expect(response.body.savingsMinor).toBe(0);
    expect(response.body.meta.lockedFeatures).toEqual(['VARIANT_B']);
  });

  it('odmítne prázdný seznam (validace DTO)', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/optimizer/preview')
      .send({ items: [], offers: [] })
      .expect(400);

    expect(response.body.error ?? response.body.message).toBeDefined();
  });

  it('odmítne neznámé pole (whitelist)', async () => {
    await request(app.getHttpServer())
      .post('/v1/optimizer/preview')
      .send({ ...payload(), neznamyParametr: true })
      .expect(400);
  });

  it('mapuje doménovou chybu na 400 s kódem (spec §13.4)', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/optimizer/preview')
      .send({ ...payload(), maxStores: 9 })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_OPTIMIZER_INPUT');
    expect(response.body.error.details.maxStores).toBe(9);
  });
});
