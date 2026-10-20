import { DomainError } from '@slevari/shared';
import type { SearchPort } from './catalog.repository';
import { CatalogService } from './catalog.service';
import type { SearchCandidateRecord } from './catalog.types';
import { InMemoryCatalogRepository } from '../../test/support/in-memory-catalog.repository';

const CANDIDATES: readonly SearchCandidateRecord[] = [
  {
    productId: 'prd_mleko',
    canonicalName: 'Mléko polotučné',
    brand: 'Madeta',
    category: 'Mléčné výrobky',
    baseUnit: 'ML',
    aliases: ['mliko', 'mleko'],
    similarity: 0.9,
  },
  {
    productId: 'prd_penny_only',
    canonicalName: 'Cizí produkt',
    brand: null,
    category: 'Ostatní',
    baseUnit: 'PCS',
    aliases: [],
    similarity: 0.05,
  },
];

class FakeSearchPort implements SearchPort {
  readonly driver = 'postgres' as const;
  lastQuery: string | null = null;
  lastLimit = 0;

  constructor(private readonly candidates: readonly SearchCandidateRecord[] = CANDIDATES) {}

  async findCandidates(query: string, limit: number): Promise<readonly SearchCandidateRecord[]> {
    this.lastQuery = query;
    this.lastLimit = limit;
    return this.candidates;
  }
}

function setup(candidates?: readonly SearchCandidateRecord[]) {
  const repository = new InMemoryCatalogRepository();
  const search = new FakeSearchPort(candidates);
  return { repository, search, service: new CatalogService(repository, search) };
}

describe('CatalogService (spec §5 F1/F2)', () => {
  it('deleguje seznam řetězců a letáků na repository', async () => {
    const { service, repository } = setup();

    const chains = await service.listChains('2026-10-20');
    const leaflets = await service.listLeaflets('2026-10-20');

    expect(chains.map((chain) => chain.code)).toEqual(['LIDL', 'KAUFLAND', 'PENNY']);
    expect(chains.find((chain) => chain.code === 'PENNY')?.hasActiveLeaflet).toBe(false);
    expect(leaflets).toHaveLength(2);
    expect(repository.calls).toEqual(['listChains', 'listLeaflets']);
  });

  it('detail neexistujícího letáku = NOT_FOUND (404 dle §13.4)', async () => {
    const { service } = setup();
    await expect(service.getLeaflet('neexistuje', { page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.getLeaflet('neexistuje', { page: 1, pageSize: 20 })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('F2: najde produkt a vrátí nabídky seřazené dle jednotkové ceny', async () => {
    const { service, search } = setup();

    const response = await service.searchProducts('Mléko', 20, '2026-10-20');

    expect(search.lastQuery).toBe('mleko');
    expect(response.products).toHaveLength(1);
    expect(response.products[0]?.productId).toBe('prd_mleko');
    expect(response.products[0]?.offers.map((offer) => offer.chainCode)).toEqual(['LIDL', 'KAUFLAND']);
    expect(response.products[0]?.offers[0]?.unitPriceMinor).toBe(1990);
    expect(response.meta.match).toMatchObject({ method: 'ALIAS', status: 'RESOLVED_AUTO' });
    expect(response.meta.driver).toBe('postgres');
  });

  it('F2: překlep bez aliasu vyřeší edit-distance pravidlo', async () => {
    const { service } = setup([
      {
        productId: 'prd_mleko',
        canonicalName: 'Mléko polotučné',
        brand: 'Madeta',
        category: 'Mléčné výrobky',
        baseUnit: 'ML',
        aliases: [],
        similarity: 0.33,
      },
    ]);

    const response = await service.searchProducts('mliko', 20, '2026-10-20');

    expect(response.meta.match).toMatchObject({
      productId: 'prd_mleko',
      method: 'TRIGRAM',
      confidence: 0.9,
      status: 'RESOLVED_AUTO',
    });
  });

  it('F2: nerozpoznaný dotaz vrátí prázdno a 3 návrhy', async () => {
    const candidates: SearchCandidateRecord[] = Array.from({ length: 5 }, (_, index) => ({
      productId: `prd_${index}`,
      canonicalName: `Produkt ${index}`,
      brand: null,
      category: 'Ostatní',
      baseUnit: 'PCS' as const,
      aliases: [],
      similarity: index / 10,
    }));
    const { service } = setup(candidates);

    const response = await service.searchProducts('xyz123', 20, '2026-10-20');

    expect(response.products).toEqual([]);
    expect(response.meta.match.status).toBe('UNRESOLVED');
    expect(response.meta.suggestions).toHaveLength(3);
    expect(response.meta.suggestions[0]?.similarity).toBeGreaterThanOrEqual(
      response.meta.suggestions[1]?.similarity ?? 0,
    );
  });

  it('F2: příliš krátký dotaz = VALIDATION_ERROR', async () => {
    const { service } = setup();
    await expect(service.searchProducts('a', 20, '2026-10-20')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('F2: produkt bez nabídky vrátí prázdné offers, ne chybu', async () => {
    const { service } = setup([
      {
        productId: 'prd_bez_akce',
        canonicalName: 'Mléko',
        brand: null,
        category: 'Mléčné výrobky',
        baseUnit: 'ML',
        aliases: [],
        similarity: 1,
      },
    ]);

    const response = await service.searchProducts('Mléko', 20, '2026-10-20');
    expect(response.products[0]?.offers).toEqual([]);
  });
});
