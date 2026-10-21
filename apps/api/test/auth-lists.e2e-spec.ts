import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Plan } from '@lovecslev/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { REFRESH_TOKEN_REPOSITORY, USER_REPOSITORY } from '../src/auth/auth.types';
import { PASSWORD_HASHER } from '../src/auth/password.hasher';
import { CATALOG_REPOSITORY, SEARCH_PORT, type SearchPort } from '../src/catalog/catalog.repository';
import type { SearchCandidateRecord } from '../src/catalog/catalog.types';
import { LISTS_REPOSITORY } from '../src/lists/lists.repository';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import {
  FakePasswordHasher,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from './support/in-memory-auth.repositories';
import { InMemoryCatalogRepository } from './support/in-memory-catalog.repository';
import { InMemoryListsRepository } from './support/in-memory-lists.repository';

const CANDIDATES: readonly SearchCandidateRecord[] = [
  {
    productId: 'prd_mleko',
    canonicalName: 'Mléko polotučné',
    brand: 'Madeta',
    category: 'Mléčné výrobky',
    baseUnit: 'ML',
    aliases: ['mliko', 'mleko'],
    similarity: 0.33,
  },
  {
    productId: 'prd_maslo',
    canonicalName: 'Máslo',
    brand: 'Madeta',
    category: 'Mléčné výrobky',
    baseUnit: 'G',
    aliases: ['maslo'],
    similarity: 0.95,
  },
];

describe('Auth + lists (e2e, spec §16 bod 2)', () => {
  let app: INestApplication;
  let plan: Plan = 'FREE';

  const searchPort: SearchPort = {
    driver: 'postgres',
    async findCandidates() {
      return CANDIDATES;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY)
      .useValue(new InMemoryUserRepository())
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(new InMemoryRefreshTokenRepository())
      .overrideProvider(PASSWORD_HASHER)
      .useValue(new FakePasswordHasher())
      .overrideProvider(LISTS_REPOSITORY)
      .useValue(new InMemoryListsRepository())
      .overrideProvider(CATALOG_REPOSITORY)
      .useValue(new InMemoryCatalogRepository())
      .overrideProvider(SEARCH_PORT)
      .useValue(searchPort)
      .overrideProvider(SubscriptionsService)
      .useValue({ getPlan: async () => plan })
      .compile();

    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  async function registerUser(email: string): Promise<string> {
    const response = await api().post('/v1/auth/register').send({ email, password: 'heslo1234' }).expect(201);
    return response.body.data.tokens.accessToken as string;
  }

  it('kompletní tok: registrace → seznam → položky → optimalizace (FREE)', async () => {
    const access = await registerUser('flow@test.cz');

    const list = await api()
      .post('/v1/lists')
      .set('Authorization', `Bearer ${access}`)
      .send({ name: 'Týdenní nákup' })
      .expect(201);
    const listId = list.body.data.id as string;

    await api()
      .post(`/v1/lists/${listId}/items`)
      .set('Authorization', `Bearer ${access}`)
      .send({ rawText: 'mliko', quantityBase: 6000 })
      .expect(201);

    const item = await api()
      .post(`/v1/lists/${listId}/items`)
      .set('Authorization', `Bearer ${access}`)
      .send({ rawText: 'maslo', quantityBase: 500 })
      .expect(201);
    expect(item.body.data.matchStatus).toBe('RESOLVED_AUTO');

    const optimize = await api()
      .post(`/v1/lists/${listId}/optimize`)
      .set('Authorization', `Bearer ${access}`)
      .send({ date: '2026-10-20' })
      .expect(200);

    expect(optimize.body.data.variantA.chainCode).toBe('LIDL');
    expect(optimize.body.data.variantA.totalMinor).toBe(22920);
    expect(optimize.body.data.variantB).toBeNull();
    expect(optimize.body.meta.lockedFeatures).toEqual(['VARIANT_B']);
  });

  it('FREE nemůže vytvořit druhý seznam ani žádat variantu B', async () => {
    plan = 'FREE';
    const access = await registerUser('free@test.cz');

    const list = await api()
      .post('/v1/lists')
      .set('Authorization', `Bearer ${access}`)
      .send({})
      .expect(201);

    await api()
      .post('/v1/lists')
      .set('Authorization', `Bearer ${access}`)
      .send({ name: 'Druhý' })
      .expect(403);

    const rejected = await api()
      .post(`/v1/lists/${list.body.data.id}/optimize`)
      .set('Authorization', `Bearer ${access}`)
      .send({ includeVariantB: true })
      .expect(403);
    expect(rejected.body.error.code).toBe('PREMIUM_REQUIRED');
  });

  it('PREMIUM dostane variantu B s úsporou', async () => {
    plan = 'PREMIUM';
    const access = await registerUser('premium@test.cz');

    const list = await api()
      .post('/v1/lists')
      .set('Authorization', `Bearer ${access}`)
      .send({})
      .expect(201);
    const listId = list.body.data.id as string;

    for (const [rawText, quantityBase] of [
      ['mliko', 6000],
      ['maslo', 500],
    ] as const) {
      await api()
        .post(`/v1/lists/${listId}/items`)
        .set('Authorization', `Bearer ${access}`)
        .send({ rawText, quantityBase })
        .expect(201);
    }

    const optimize = await api()
      .post(`/v1/lists/${listId}/optimize`)
      .set('Authorization', `Bearer ${access}`)
      .send({ date: '2026-10-20' })
      .expect(200);

    const chains = optimize.body.data.variantB.chains.map(
      (chain: { chainCode: string }) => chain.chainCode,
    );
    expect(chains).toEqual(['KAUFLAND', 'LIDL']);
    expect(optimize.body.data.variantB.totalMinor).toBe(20920);
    expect(optimize.body.data.savingsMinor).toBe(2000);
    plan = 'FREE';
  });

  it('bez tokenu i s cizím tokenem vrací 401/404 (IDOR)', async () => {
    await api().get('/v1/lists').expect(401);

    const owner = await registerUser('owner@test.cz');
    const list = await api()
      .post('/v1/lists')
      .set('Authorization', `Bearer ${owner}`)
      .send({})
      .expect(201);

    const intruder = await registerUser('intruder@test.cz');
    await api()
      .get(`/v1/lists/${list.body.data.id}`)
      .set('Authorization', `Bearer ${intruder}`)
      .expect(404);
  });

  it('refresh token rotuje a logout ho revokuje', async () => {
    const registered = await api()
      .post('/v1/auth/register')
      .send({ email: 'rotate@test.cz', password: 'heslo1234' })
      .expect(201);
    const refreshToken = registered.body.data.tokens.refreshToken as string;

    const rotated = await api().post('/v1/auth/refresh').send({ refreshToken }).expect(200);
    expect(rotated.body.data.tokens.refreshToken).not.toBe(refreshToken);

    await api().post('/v1/auth/refresh').send({ refreshToken }).expect(401);

    await api()
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${rotated.body.data.tokens.accessToken}`)
      .send({ refreshToken: rotated.body.data.tokens.refreshToken })
      .expect(204);

    await api()
      .post('/v1/auth/refresh')
      .send({ refreshToken: rotated.body.data.tokens.refreshToken })
      .expect(401);
  });
});
