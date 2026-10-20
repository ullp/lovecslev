import type { Plan } from '@slevari/shared';
import type { SearchPort } from '../catalog/catalog.repository';
import type { SearchCandidateRecord } from '../catalog/catalog.types';
import type { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { InMemoryCatalogRepository } from '../../test/support/in-memory-catalog.repository';
import { InMemoryListsRepository } from '../../test/support/in-memory-lists.repository';
import { ListsService } from './lists.service';

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

function setup(initialPlan: Plan = 'FREE') {
  const lists = new InMemoryListsRepository();
  const catalog = new InMemoryCatalogRepository();
  let plan: Plan = initialPlan;
  const subscriptions = { getPlan: async () => plan } as unknown as SubscriptionsService;
  const search: SearchPort = {
    driver: 'postgres',
    async findCandidates() {
      return CANDIDATES;
    },
  };
  const service = new ListsService(lists, catalog, search, subscriptions);
  return {
    service,
    lists,
    catalog,
    setPlan: (next: Plan) => {
      plan = next;
    },
  };
}

describe('ListsService — tarify a limity (spec §7, F3)', () => {
  it('FREE smí jen 1 seznam, PREMIUM víc', async () => {
    const { service, setPlan } = setup('FREE');

    await service.create('user-1', 'Týdenní nákup');
    await expect(service.create('user-1', 'Druhý')).rejects.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
    });

    setPlan('PREMIUM');
    await expect(service.create('user-1', 'Druhý')).resolves.toBeDefined();
  });

  it('FREE limit 30 položek na seznam', async () => {
    const { service } = setup('FREE');
    const list = await service.create('user-1', undefined);

    for (let index = 0; index < 30; index += 1) {
      await service.addItem('user-1', list.id, { rawText: `položka ${index}` });
    }

    await expect(service.addItem('user-1', list.id, { rawText: 'přes limit' })).rejects.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
    });
  });

  it('cizí seznam se hlásí jako neexistující (IDOR)', async () => {
    const { service } = setup();
    const list = await service.create('user-1', undefined);

    await expect(service.get('user-2', list.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.optimize('user-2', list.id, {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('ListsService — položky a matching (spec §5 F3)', () => {
  it('překlep „mliko“ se uloží jako RESOLVED_AUTO s produktem', async () => {
    const { service } = setup();
    const list = await service.create('user-1', undefined);

    const item = await service.addItem('user-1', list.id, { rawText: 'mliko' });

    expect(item.productId).toBe('prd_mleko');
    expect(item.baseUnit).toBe('ML');
    expect(item.quantityBase).toBe(1000);
    expect(item.matchStatus).toBe('RESOLVED_AUTO');
  });

  it('nerozpoznaný text se přesto uloží jako UNRESOLVED', async () => {
    const { service } = setup();
    const list = await service.create('user-1', undefined);

    const item = await service.addItem('user-1', list.id, { rawText: 'xyz123' });

    expect(item.productId).toBeNull();
    expect(item.matchStatus).toBe('UNRESOLVED');
    expect(item.matchMethod).toBe('NONE');
    expect(item.baseUnit).toBe('PCS');
  });

  it('potvrzení shody uživatelem přepne na RESOLVED_CONFIRMED a doplní jednotku', async () => {
    const { service } = setup();
    const list = await service.create('user-1', undefined);
    const item = await service.addItem('user-1', list.id, { rawText: 'xyz123' });

    const confirmed = await service.updateItem('user-1', list.id, item.id, {
      productId: 'prd_maslo',
      quantityBase: 500,
    });

    expect(confirmed).toMatchObject({
      productId: 'prd_maslo',
      baseUnit: 'G',
      quantityBase: 500,
      matchStatus: 'RESOLVED_CONFIRMED',
      matchMethod: 'USER',
      matchConfidence: 1,
    });
  });

  it('potvrzení neexistujícího produktu = NOT_FOUND', async () => {
    const { service } = setup();
    const list = await service.create('user-1', undefined);
    const item = await service.addItem('user-1', list.id, { rawText: 'xyz123' });

    await expect(
      service.updateItem('user-1', list.id, item.id, { productId: 'prd_neexistuje' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('prázdný text nebo neplatné množství = VALIDATION_ERROR', async () => {
    const { service } = setup();
    const list = await service.create('user-1', undefined);

    await expect(service.addItem('user-1', list.id, { rawText: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(
      service.addItem('user-1', list.id, { rawText: 'mléko', quantityBase: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('ListsService — optimalizace nad DB (F4, D18)', () => {
  it('FREE dostane jen Variantu A bez úspory, unresolved položky jdou do warnings', async () => {
    const { service } = setup('FREE');
    const list = await service.create('user-1', undefined);
    await service.addItem('user-1', list.id, { rawText: 'mliko', quantityBase: 6000 });
    await service.addItem('user-1', list.id, { rawText: 'maslo', quantityBase: 500 });
    await service.addItem('user-1', list.id, { rawText: 'xyz123' });

    const result = await service.optimize('user-1', list.id, {});

    expect(result.variantA?.chainCode).toBe('LIDL');
    expect(result.variantA?.totalMinor).toBe(22920);
    expect(result.variantB).toBeNull();
    expect(result.savingsMinor).toBe(0);
    expect(result.meta.lockedFeatures).toEqual(['VARIANT_B']);
    expect(result.warnings).toEqual([
      { code: 'ITEM_NOT_MATCHED', productId: null, rawText: 'xyz123' },
    ]);
  });

  it('PREMIUM dostane kombinaci obchodů i úsporu', async () => {
    const { service } = setup('PREMIUM');
    const list = await service.create('user-1', undefined);
    await service.addItem('user-1', list.id, { rawText: 'mliko', quantityBase: 6000 });
    await service.addItem('user-1', list.id, { rawText: 'maslo', quantityBase: 500 });

    const result = await service.optimize('user-1', list.id, {});

    expect(result.variantB?.chains.map((chain) => chain.chainCode)).toEqual(['KAUFLAND', 'LIDL']);
    expect(result.variantB?.totalMinor).toBe(20920);
    expect(result.savingsMinor).toBe(2000);
    expect(result.recommendedVariant).toBe('B');
    expect(result.meta.lockedFeatures).toEqual([]);
  });

  it('FREE s includeVariantB = PREMIUM_REQUIRED', async () => {
    const { service } = setup('FREE');
    const list = await service.create('user-1', undefined);

    await expect(
      service.optimize('user-1', list.id, { includeVariantB: true }),
    ).rejects.toMatchObject({ code: 'PREMIUM_REQUIRED' });
  });
});
