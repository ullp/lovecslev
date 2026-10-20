import type { SearchPort } from './catalog.repository';
import type { SearchCandidateRecord } from './catalog.types';
import {
  ElasticSearchAdapter,
  FallbackSearchPort,
  type ElasticClientLike,
} from './search.adapters';

function candidate(productId: string): SearchCandidateRecord {
  return {
    productId,
    canonicalName: `Produkt ${productId}`,
    brand: null,
    category: 'Ostatní',
    baseUnit: 'PCS',
    aliases: [],
    similarity: 0.5,
  };
}

class OkPort implements SearchPort {
  calls = 0;
  constructor(
    readonly driver: 'postgres' | 'elasticsearch',
    private readonly result: readonly SearchCandidateRecord[],
  ) {}

  async findCandidates(): Promise<readonly SearchCandidateRecord[]> {
    this.calls += 1;
    return this.result;
  }
}

class FailingPort implements SearchPort {
  readonly driver = 'elasticsearch' as const;
  calls = 0;

  async findCandidates(): Promise<readonly SearchCandidateRecord[]> {
    this.calls += 1;
    throw new Error('ES je mimo provoz');
  }
}

describe('FallbackSearchPort (D21, spec §13.4)', () => {
  it('při výpadku primárního enginu použije fallback a nahlásí driver', async () => {
    const primary = new FailingPort();
    const fallback = new OkPort('postgres', [candidate('prd_a')]);
    const port = new FallbackSearchPort(primary, fallback);

    const result = await port.findCandidates('mleko', 10);

    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(1);
    expect(result[0]?.productId).toBe('prd_a');
    expect(port.driver).toBe('postgres');
  });

  it('když primární funguje, fallback se nevolá', async () => {
    const primary = new OkPort('elasticsearch', [candidate('prd_es')]);
    const fallback = new OkPort('postgres', [candidate('prd_pg')]);
    const port = new FallbackSearchPort(primary, fallback);

    const result = await port.findCandidates('mleko', 10);

    expect(result[0]?.productId).toBe('prd_es');
    expect(fallback.calls).toBe(0);
    expect(port.driver).toBe('elasticsearch');
  });
});

describe('ElasticSearchAdapter (bez sítě přes fake klienta)', () => {
  it('namapuje hity a sestaví fuzziness dotaz', async () => {
    const captured: { index?: string; size?: number; query?: Record<string, unknown> } = {};

    const client: ElasticClientLike = {
      async search(params) {
        captured.index = params.index;
        captured.size = params.size;
        captured.query = params.query;
        return {
          hits: {
            hits: [
              {
                _id: 'prd_mleko',
                _score: 7.5,
                _source: {
                  canonicalName: 'Mléko polotučné',
                  brand: 'Madeta',
                  category: 'Mléčné výrobky',
                  baseUnit: 'ML',
                  aliases: ['mliko'],
                },
              },
              { _id: 'prd_bez_source' },
            ],
          },
        };
      },
    };

    const adapter = new ElasticSearchAdapter(client, 'products');
    const result = await adapter.findCandidates('mleko', 5);

    expect(adapter.driver).toBe('elasticsearch');
    expect(captured).toMatchObject({ index: 'products', size: 5 });
    expect(captured.query).toHaveProperty('multi_match');

    expect(result[0]).toMatchObject({
      productId: 'prd_mleko',
      canonicalName: 'Mléko polotučné',
      category: 'Mléčné výrobky',
      baseUnit: 'ML',
      aliases: ['mliko'],
    });
    // Normalizace skóre na 0..1 (ES skóre není podobnost)
    expect(result[0]?.similarity).toBe(1);
    // Chybějící _source nesmí shodit vyhledávání
    expect(result[1]).toMatchObject({ productId: 'prd_bez_source', category: 'Ostatní', baseUnit: 'PCS' });
  });
});
