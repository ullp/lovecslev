import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.factory';
import { CatalogModule } from '../src/catalog/catalog.module';
import { CATALOG_REPOSITORY, SEARCH_PORT, type SearchPort } from '../src/catalog/catalog.repository';
import type { SearchCandidateRecord } from '../src/catalog/catalog.types';
import { InMemoryCatalogRepository } from './support/in-memory-catalog.repository';

const CANDIDATES: readonly SearchCandidateRecord[] = [
  {
    productId: 'prd_mleko',
    canonicalName: 'Mléko polotučné',
    brand: 'Madeta',
    category: 'Mléčné výrobky',
    baseUnit: 'ML',
    aliases: ['mliko', 'mleko'],
    similarity: 0.95,
  },
  {
    productId: 'prd_toaletni_papir',
    canonicalName: 'Toaletní papír 8 rolí',
    brand: 'Zewa',
    category: 'Drogerie',
    baseUnit: 'PCS',
    aliases: ['toaletak', 'toaletni papir'],
    similarity: 0.7,
  },
];

const searchPort: SearchPort = {
  driver: 'postgres',
  async findCandidates(): Promise<readonly SearchCandidateRecord[]> {
    return CANDIDATES;
  },
};

describe('Catalog API (e2e, F1 + F2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [CatalogModule] })
      .overrideProvider(CATALOG_REPOSITORY)
      .useValue(new InMemoryCatalogRepository())
      .overrideProvider(SEARCH_PORT)
      .useValue(searchPort)
      .compile();

    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/chains vrátí řetězce včetně příznaku aktivního letáku', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/chains?activeOn=2026-10-20')
      .expect(200);

    expect(response.body.meta.activeOn).toBe('2026-10-20');
    expect(response.body.data.map((chain: { code: string }) => chain.code)).toEqual([
      'LIDL',
      'KAUFLAND',
      'PENNY',
    ]);
  });

  it('GET /v1/leaflets vrací aktivní letáky a umí filtrovat řetězec', async () => {
    const all = await request(app.getHttpServer()).get('/v1/leaflets?activeOn=2026-10-20').expect(200);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.meta.total).toBe(2);

    const filtered = await request(app.getHttpServer())
      .get('/v1/leaflets?activeOn=2026-10-20&chainCode=KAUFLAND')
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].chainCode).toBe('KAUFLAND');
  });

  it('GET /v1/leaflets/:id/products stránkuje a vrací kategorie', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/leaflets/leaflet-lidl/products?page=2&pageSize=1')
      .expect(200);

    expect(response.body.data.page).toBe(2);
    expect(response.body.data.pageSize).toBe(1);
    expect(response.body.data.total).toBe(2);
    expect(response.body.data.products).toHaveLength(1);
    expect(response.body.data.categories).toEqual(['Mléčné výrobky', 'Maso a ryby']);
  });

  it('neexistující leták vrací 404 s doménovým kódem', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/leaflets/neexistuje/products')
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('nevalidní activeOn vrací 400', async () => {
    await request(app.getHttpServer()).get('/v1/leaflets?activeOn=20.10.2026').expect(400);
  });

  it('GET /v1/products/search vrátí produkt s nabídkami a metadaty', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/products/search?q=Mléko&activeOn=2026-10-20')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].productId).toBe('prd_mleko');
    expect(response.body.data[0].offers[0]).toMatchObject({
      chainCode: 'LIDL',
      unitPriceMinor: 1990,
      unitLabel: 'Kč/l',
    });
    expect(response.body.meta.match.status).toBe('RESOLVED_AUTO');
    expect(response.body.meta.driver).toBe('postgres');
  });

  it('příliš krátký dotaz odmítne už DTO', async () => {
    await request(app.getHttpServer()).get('/v1/products/search?q=a').expect(400);
  });

  it('neznámý dotaz vrátí prázdné pole a návrhy', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/products/search?q=xyz12345')
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta.match.status).toBe('UNRESOLVED');
    expect(response.body.meta.suggestions).toHaveLength(2);
  });
});
