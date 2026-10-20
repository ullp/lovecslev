import type { Plan } from '@slevari/shared';
import type { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { InMemoryCatalogRepository } from '../../test/support/in-memory-catalog.repository';
import { AdvisorService } from './advisor.service';
import type { AdvisorUsageRepository, LlmClient } from './advisor.types';

class FakeUsageRepository implements AdvisorUsageRepository {
  used = 0;
  readonly days: string[] = [];

  async incrementAndCheck(_userId: string, day: string, limit: number) {
    this.used += 1;
    this.days.push(day);
    return { allowed: this.used <= limit, used: this.used };
  }
}

class FakeLlm implements LlmClient {
  readonly model = 'fake-model';
  calls = 0;

  constructor(private readonly behavior: string | Error) {}

  async complete(): Promise<string> {
    this.calls += 1;
    if (this.behavior instanceof Error) throw this.behavior;
    return this.behavior;
  }
}

function setup(options: { llm?: string | Error; plan?: Plan } = {}) {
  const usage = new FakeUsageRepository();
  const llm = new FakeLlm(options.llm ?? new Error('LLM není nakonfigurována'));
  const catalog = new InMemoryCatalogRepository();
  const plan: Plan = options.plan ?? 'PREMIUM';
  const subscriptions = { getPlan: async () => plan } as unknown as SubscriptionsService;
  const service = new AdvisorService(usage, llm, catalog, subscriptions);
  return { service, usage, llm, catalog };
}

describe('AdvisorService (spec §6 P1)', () => {
  it('platná odpověď LLM se použije a ceny spočítá server', async () => {
    const products = await new InMemoryCatalogRepository().listProducts(10);
    const milk = products.find((product) => product.name.includes('Mléko'));
    const butter = products.find((product) => product.name.includes('Máslo'));
    if (milk === undefined || butter === undefined) throw new Error('Fixture neobsahuje mléko/máslo');

    const { service, llm } = setup({
      llm: JSON.stringify({
        items: [
          { productId: milk.productId, quantity: 4000 },
          { productId: butter.productId, quantity: 500 },
        ],
        explanation: 'Týdenní nákup pro dva.',
      }),
    });

    const result = await service.plan('user-1', { freeText: 'nákup na týden pro dva' });

    expect(llm.calls).toBe(1);
    expect(result.meta).toMatchObject({ source: 'LLM', llmAvailable: true, fallbackReason: null });
    expect(result.items).toHaveLength(2);
    expect(result.optimization.variantA).toMatchObject({ chainCode: 'LIDL', totalMinor: 18940 });
    expect(result.optimization.variantB?.totalMinor).toBe(16940);
    expect(result.budget).toMatchObject({ budgetMinor: null, feasible: true, minimalMinor: 16940 });
  });

  it('nedostupná LLM → deterministická šablona a důvod fallbacku', async () => {
    const { service } = setup({ llm: new Error('LLM není nakonfigurována') });

    const result = await service.plan('user-1', { freeText: 'nákup na týden pro rodinu' });

    expect(result.meta.source).toBe('TEMPLATE');
    expect(result.meta.llmAvailable).toBe(false);
    expect(result.meta.fallbackReason).toContain('LLM není nakonfigurována');
    // Šablona bere i kuřecí prsa; fake katalog pro ně nemá akci → warning + striktní coverage (§11.3).
    expect(result.items.map((item) => item.name)).toEqual(['Mléko polotučné', 'Máslo', 'Kuřecí prsa']);
    expect(result.optimization.warnings).toEqual([
      { code: 'ITEM_UNAVAILABLE', productId: 'prd_kureci_prsa', rawText: 'Kuřecí prsa' },
    ]);
    expect(result.optimization.variantB?.totalMinor).toBe(16940);
  });

  it('nevalidní JSON od LLM → šablona s chybou parseru', async () => {
    const { service } = setup({ llm: '{"items": "tohle není pole"}' });

    const result = await service.plan('user-1', { freeText: 'nákup na týden pro rodinu' });

    expect(result.meta.source).toBe('TEMPLATE');
    expect(result.meta.fallbackReason).toContain('nevalidní odpověď LLM');
  });

  it('rozpočet: nedostatečný rozpočet je označen i s přesahem', async () => {
    const { service } = setup();

    const result = await service.plan('user-1', {
      freeText: 'nákup na týden pro rodinu',
      budgetMinor: 10000,
    });

    expect(result.budget.budgetMinor).toBe(10000);
    expect(result.budget.feasible).toBe(false);
    expect(result.budget.minimalMinor).toBe(16940);
    expect(result.budget.overByMinor).toBe(6940);
  });

  it('FREE tarif dostane jen Variantu A (D18)', async () => {
    const { service } = setup({ plan: 'FREE' });

    const result = await service.plan('user-1', { freeText: 'nákup na týden pro rodinu' });

    expect(result.optimization.variantB).toBeNull();
    expect(result.optimization.meta.lockedFeatures).toEqual(['VARIANT_B']);
    // Kuřecí prsa nemají v fake katalogu akci → varianta A nemůže pokrýt celý seznam.
    expect(result.optimization.variantA).toBeNull();
    expect(result.optimization.variantAReason).toBe('NO_SINGLE_STORE');
    expect(result.budget.minimalMinor).toBeNull();
  });

  it('denní limit 10 dotazů → RATE_LIMITED', async () => {
    const { service, usage } = setup();
    usage.used = 10;

    await expect(service.plan('user-1', { freeText: 'nákup na týden pro rodinu' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      details: { dailyLimit: 10 },
    });
  });

  it('rate-limit se počítá podle skutečného dne, ne podle data cen', async () => {
    const { service, usage } = setup();

    await service.plan('user-1', { freeText: 'nákup na týden', date: '2026-10-01' });
    await service.plan('user-1', { freeText: 'nákup na týden', date: '2026-10-02' });

    // Různá `date` nesmí založit nový čítač — jinak jde limit obejít.
    expect(new Set(usage.days).size).toBe(1);
    expect(usage.days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('počítadlo se inkrementuje u každého volání', async () => {
    const { service, usage } = setup();

    await service.plan('user-1', { freeText: 'nákup na týden pro rodinu' });
    const second = await service.plan('user-1', { freeText: 'nákup na týden pro rodinu' });

    expect(usage.used).toBe(2);
    expect(second.meta.usedToday).toBe(2);
  });
});
