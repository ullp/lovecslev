import { readFile, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateLeaflet } from '@lovecslev/shared';
import { FileSnapshotStore } from './snapshot.store';
import { LeafletScrapeService } from './leaflet-scrape.service';
import { parseLidlHtml } from './adapters/lidl.adapter';
import type {
  ChainScrapeTarget,
  LeafletSourceAdapter,
  RawSnapshot,
  ScrapeChainRepository,
  SnapshotStore,
} from './scraping.types';
import type { ImportReport, LeafletImportService } from '../import/leaflet-import.service';

const PERIOD = { validFrom: '2026-10-21', validTo: '2026-10-27' };

class FakeChainRepository implements ScrapeChainRepository {
  readonly failures: { chainId: string; pauseUntil: Date; failures: number }[] = [];
  readonly resets: string[] = [];

  constructor(public targets: ChainScrapeTarget[]) {}

  async listTargets(): Promise<readonly ChainScrapeTarget[]> {
    return this.targets;
  }

  async recordFailure(chainId: string, pauseUntil: Date, failures: number): Promise<void> {
    this.failures.push({ chainId, pauseUntil, failures });
    this.targets = this.targets.map((target) =>
      target.id === chainId ? { ...target, failures, pausedUntil: pauseUntil } : target,
    );
  }

  async resetFailures(chainId: string): Promise<void> {
    this.resets.push(chainId);
  }
}

class FakeAdapter implements LeafletSourceAdapter {
  readonly chainCode = 'LIDL';
  fetchCalls = 0;

  constructor(private readonly behavior: RawSnapshot | Error) {}

  async fetch(): Promise<RawSnapshot> {
    this.fetchCalls += 1;
    if (this.behavior instanceof Error) throw this.behavior;
    return this.behavior;
  }

  parse(snapshot: RawSnapshot) {
    return parseLidlHtml(snapshot);
  }
}

class FakeSnapshotStore implements SnapshotStore {
  async save(_snapshot: RawSnapshot, validFrom: string): Promise<{ path: string; sha256: string }> {
    return { path: `lidl/${validFrom}/abc.html`, sha256: 'abc' };
  }
}

function fakeImporter(report: Partial<ImportReport> = {}): LeafletImportService {
  return {
    importLeaflets: async () => ({
      leafletsImported: 1,
      leafletsSkipped: 0,
      promotionsUpserted: 5,
      productsCreated: 0,
      errors: [],
      ...report,
    }),
  } as unknown as LeafletImportService;
}

const TARGET: ChainScrapeTarget = {
  id: 'chain-lidl',
  code: 'LIDL',
  legalApproved: true,
  failures: 0,
  pausedUntil: null,
};

describe('Lidl parser (spec §14.5) — contract test nad archivovaným snapshotem', () => {
  it('naparsuje 5 produktů a výstup projde validací §14.2', async () => {
    const body = await readFile(join(__dirname, '../../test/fixtures/scrape/lidl-2026-10-21.html'), 'utf8');
    const snapshot: RawSnapshot = {
      chainCode: 'LIDL',
      contentType: 'text/html',
      body,
      sourceUrl: 'file://fixture',
      fetchedAt: new Date('2026-10-21T05:00:00Z'),
    };

    const dto = parseLidlHtml(snapshot);

    expect(dto.chain).toBe('LIDL');
    expect(dto.validFrom).toBe('2026-10-21');
    expect(dto.products).toHaveLength(5);
    expect(dto.products[0]).toMatchObject({
      name: 'Mléko polotučné',
      brand: 'Madeta',
      price: 19.9,
      regularPrice: 24.9,
      packageAmount: 1,
      packageUnit: 'l',
    });
    expect(dto.products.find((product) => product.name === 'Kuřecí prsa')?.pricing).toBe('WEIGHT');

    const validation = validateLeaflet(dto, ['LIDL', 'ALBERT', 'KAUFLAND', 'BILLA']);
    expect(validation.issues).toEqual([]);
  });
});

describe('LeafletScrapeService (spec §14.5)', () => {
  const snapshot: RawSnapshot = {
    chainCode: 'LIDL',
    contentType: 'text/html',
    body: '<section class="leaflet" data-valid-from="2026-10-21" data-valid-to="2026-10-27"><article class="product" data-name="Mléko" data-price="19,90" data-amount="1" data-unit="l"></article></section>',
    sourceUrl: 'file://fixture',
    fetchedAt: new Date('2026-10-21T05:00:00Z'),
  };

  function setup(targets: ChainScrapeTarget[] = [TARGET], adapter: FakeAdapter = new FakeAdapter(snapshot)) {
    const chains = new FakeChainRepository(targets);
    const service = new LeafletScrapeService(
      chains,
      new Map([[adapter.chainCode, adapter]]),
      new FakeSnapshotStore(),
      fakeImporter(),
    );
    return { service, chains, adapter };
  }

  it('bez právního schválení se řetězec vůbec nestahuje', async () => {
    const { service, adapter } = setup([{ ...TARGET, legalApproved: false }]);

    const report = await service.scrapeAll({ period: PERIOD });

    expect(report.chains[0]).toEqual({ chainCode: 'LIDL', status: 'SKIPPED_LEGAL' });
    expect(adapter.fetchCalls).toBe(0);
    expect(report.imported).toBe(0);
    expect(report.skipped).toBe(1);
  });

  it('pozastavený řetězec se přeskočí (circuit breaker)', async () => {
    const { service, adapter } = setup([{ ...TARGET, pausedUntil: new Date(Date.now() + 3_600_000) }]);

    const report = await service.scrapeAll({ period: PERIOD });

    expect(report.chains[0]?.status).toBe('SKIPPED_PAUSED');
    expect(adapter.fetchCalls).toBe(0);
  });

  it('úspěch uloží snapshot, naimportuje a resetuje počítadlo selhání', async () => {
    const { service, chains } = setup();

    const report = await service.scrapeAll({ period: PERIOD });

    expect(report.chains[0]).toMatchObject({ status: 'IMPORTED', promotions: 5, quarantined: false });
    expect(report.chains[0]?.snapshotPath).toContain('lidl/');
    expect(chains.resets).toEqual(['chain-lidl']);
    expect(report.imported).toBe(1);
  });

  it('selhání adaptéru zvýší počítadlo; po druhém selhání se řetězec pozastaví', async () => {
    const { service, chains } = setup([{ ...TARGET, failures: 1 }], new FakeAdapter(new Error('zdroj nedostupný')));

    const report = await service.scrapeAll({ period: PERIOD });

    expect(report.chains[0]).toMatchObject({ status: 'FAILED', reason: 'zdroj nedostupný' });
    expect(report.failed).toBe(1);
    expect(chains.failures[0]).toMatchObject({ chainId: 'chain-lidl', failures: 2 });
    expect(chains.failures[0]?.pauseUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('první selhání ještě nepozastaví', async () => {
    const { service, chains } = setup([TARGET], new FakeAdapter(new Error('timeout')));

    await service.scrapeAll({ period: PERIOD });

    expect(chains.failures[0]?.failures).toBe(1);
    expect(chains.failures[0]?.pauseUntil.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('quarantine je stav, ne selhání (počítadlo se resetuje)', async () => {
    const chains = new FakeChainRepository([TARGET]);
    const service = new LeafletScrapeService(
      chains,
      new Map([['LIDL', new FakeAdapter(snapshot)]]),
      new FakeSnapshotStore(),
      fakeImporter({
        leafletsImported: 0,
        promotionsUpserted: 0,
        errors: [{ code: 'QUARANTINED', path: '$.products', message: 'propad > 40 %' }],
      }),
    );

    const report = await service.scrapeAll({ period: PERIOD });

    expect(report.chains[0]).toMatchObject({ status: 'QUARANTINED', quarantined: true });
    expect(chains.resets).toEqual(['chain-lidl']);
    expect(report.failed).toBe(0);
  });

  it('chybějící adaptér = SKIPPED_NO_ADAPTER', async () => {
    const chains = new FakeChainRepository([{ ...TARGET, code: 'KAUFLAND' }]);
    const service = new LeafletScrapeService(
      chains,
      new Map([['LIDL', new FakeAdapter(snapshot)]]),
      new FakeSnapshotStore(),
      fakeImporter(),
    );

    const report = await service.scrapeAll({ period: PERIOD });

    expect(report.chains[0]?.status).toBe('SKIPPED_NO_ADAPTER');
  });
});

describe('FileSnapshotStore (spec §14.5)', () => {
  it('uloží snapshot do <root>/<chain>/<date>/<sha256>.<ext>', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lovecslev-snap-'));
    const store = new FileSnapshotStore(dir);

    const saved = await store.save(
      {
        chainCode: 'LIDL',
        contentType: 'text/html',
        body: '<html>test</html>',
        sourceUrl: 'file://fixture',
        fetchedAt: new Date('2026-10-21T05:00:00Z'),
      },
      '2026-10-21',
    );

    expect(saved.path).toMatch(/^lidl\/2026-10-21\/[0-9a-f]{64}\.html$/);
    const files = await readdir(join(dir, 'lidl', '2026-10-21'));
    expect(files).toHaveLength(1);
    expect(await readFile(join(dir, saved.path), 'utf8')).toBe('<html>test</html>');
  });
});
