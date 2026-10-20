import { leaflets } from '@slevari/seed-data';
import { validateLeaflet, type LeafletImportDto } from '@slevari/shared';
import { InMemoryLeafletRepository } from '../../test/support/in-memory-leaflet.repository';
import { LeafletImportService } from './leaflet-import.service';

const CHAIN_CODES = ['ALBERT', 'BILLA', 'KAUFLAND', 'LIDL', 'PENNY'];

function setup(): { repository: InMemoryLeafletRepository; service: LeafletImportService } {
  const repository = new InMemoryLeafletRepository(CHAIN_CODES);
  return { repository, service: new LeafletImportService(repository) };
}

describe('LeafletImportService (spec §14.3, §14.4)', () => {
  it('naimportuje 4 referenční letáky a 22 akcí, vytvoří 6 produktů', async () => {
    const { repository, service } = setup();
    const report = await service.importLeaflets(leaflets, { source: 'SEED' });

    expect(report).toEqual({
      leafletsImported: 4,
      leafletsSkipped: 0,
      promotionsUpserted: 22,
      productsCreated: 6,
      errors: [],
    });
    expect(repository.leafletCount).toBe(4);
    expect(repository.productCount).toBe(6);
  });

  it('druhý běh se stejným obsahem je no-op (idempotence dle checksumu)', async () => {
    const { repository, service } = setup();
    await service.importLeaflets(leaflets, { source: 'SEED' });
    const writesAfterFirstRun = repository.writeCount;

    const report = await service.importLeaflets(leaflets, { source: 'SEED' });

    expect(report).toEqual({
      leafletsImported: 0,
      leafletsSkipped: 4,
      promotionsUpserted: 0,
      productsCreated: 0,
      errors: [],
    });
    expect(repository.writeCount).toBe(writesAfterFirstRun);
  });

  it('změna obsahu leták nahradí, nezdvojí akce', async () => {
    const { repository, service } = setup();
    await service.importLeaflets(leaflets, { source: 'SEED' });

    const lidl = leaflets.find((leaflet) => leaflet.chain === 'LIDL');
    if (lidl === undefined) throw new Error('Chybí LIDL leták');

    const cheaper: LeafletImportDto = {
      ...lidl,
      products: lidl.products.map((product, index) =>
        index === 0 ? { ...product, price: product.price - 1 } : product,
      ),
    };

    const report = await service.importLeaflets([cheaper], { source: 'SEED' });

    expect(report.leafletsImported).toBe(1);
    expect(report.leafletsSkipped).toBe(0);
    expect(report.promotionsUpserted).toBe(lidl.products.length);
    expect(repository.promotionCount('LIDL', lidl.validFrom, lidl.validTo)).toBe(lidl.products.length);
  });

  it('neplatný leták se nezapíše a report má indexovanou cestu', async () => {
    const { repository, service } = setup();
    const invalid: LeafletImportDto = {
      ...leaflets[0]!,
      chain: 'TESCO',
    };

    const report = await service.importLeaflets([invalid], { source: 'SEED' });

    expect(report.leafletsImported).toBe(0);
    expect(report.errors.map((issue) => issue.code)).toContain('INVALID_CHAIN');
    expect(report.errors[0]?.path).toBe('$[0].chain');
    expect(repository.writeCount).toBe(0);
  });

  it('neplatná cena projde až do reportu jako INVALID_PRICE', async () => {
    const { service } = setup();
    const broken: LeafletImportDto = {
      chain: 'LIDL',
      validFrom: '2026-10-14',
      validTo: '2026-10-20',
      products: [{ name: 'Máslo', price: 0, packageAmount: 250, packageUnit: 'g' }],
    };

    const report = await service.importLeaflets([broken], { source: 'SEED' });
    expect(report.errors).toEqual([
      expect.objectContaining({ code: 'INVALID_PRICE', path: '$[0].products[0].price' }),
    ]);
  });

  it('quarantine zablokuje propad počtu produktů > 40 % (default pro SCRAPE)', async () => {
    const { repository, service } = setup();
    const lidl = leaflets.find((leaflet) => leaflet.chain === 'LIDL');
    if (lidl === undefined) throw new Error('Chybí LIDL leták');

    const previous: LeafletImportDto = { ...lidl, validFrom: '2026-10-07', validTo: '2026-10-13' };
    await service.importLeaflets([previous], { source: 'SCRAPE' });

    const suspicious: LeafletImportDto = {
      ...lidl,
      products: lidl.products.slice(0, 2),
    };

    const report = await service.importLeaflets([suspicious], { source: 'SCRAPE' });

    expect(report.leafletsImported).toBe(0);
    expect(report.errors[0]?.code).toBe('QUARANTINED');
    expect(repository.promotionCount('LIDL', lidl.validFrom, lidl.validTo)).toBe(0);
  });

  it('quarantine se dá vypnout a u SEED je default vypnutý', async () => {
    const { service } = setup();
    const lidl = leaflets.find((leaflet) => leaflet.chain === 'LIDL');
    if (lidl === undefined) throw new Error('Chybí LIDL leták');

    const previous: LeafletImportDto = { ...lidl, validFrom: '2026-10-07', validTo: '2026-10-13' };
    await service.importLeaflets([previous], { source: 'SEED' });

    const report = await service.importLeaflets([{ ...lidl, products: lidl.products.slice(0, 2) }], {
      source: 'SEED',
    });

    expect(report.errors).toEqual([]);
    expect(report.leafletsImported).toBe(1);
  });

  it('všechny seed letáky projdou validací §14.2', () => {
    for (const leaflet of leaflets) {
      const result = validateLeaflet(leaflet, CHAIN_CODES);
      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });
});
