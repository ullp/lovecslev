/**
 * CLI scraping (spec §14.5): právní gate + circuit breaker + snapshot + import.
 * Spuštění:
 *   SCRAPE_SOURCE=fixture npm run scrape --workspace=@slevari/api -- --valid-from=2026-10-21 --valid-to=2026-10-27
 */
import 'reflect-metadata';
import { LidlHtmlAdapter, FileFixtureAdapter } from '../scraping/adapters/lidl.adapter';
import { LeafletScrapeService } from '../scraping/leaflet-scrape.service';
import { PrismaScrapeChainRepository } from '../scraping/prisma-scrape-chain.repository';
import { FileSnapshotStore } from '../scraping/snapshot.store';
import { LeafletImportService } from '../import/leaflet-import.service';
import { PrismaLeafletRepository } from '../import/prisma-leaflet.repository';
import { PrismaService } from '../prisma/prisma.service';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const validFrom = argValue('valid-from');
    const validTo = argValue('valid-to');
    if (validFrom === undefined || validTo === undefined) {
      throw new Error('Použijte --valid-from=YYYY-MM-DD a --valid-to=YYYY-MM-DD');
    }

    const source = (process.env.SCRAPE_SOURCE ?? 'http').toLowerCase();
    const lidl = source === 'fixture' ? new FileFixtureAdapter('LIDL') : new LidlHtmlAdapter();

    const service = new LeafletScrapeService(
      new PrismaScrapeChainRepository(prisma),
      new Map([[lidl.chainCode, lidl]]),
      new FileSnapshotStore(),
      new LeafletImportService(new PrismaLeafletRepository(prisma)),
    );

    const report = await service.scrapeAll({ period: { validFrom, validTo } });
    console.log(JSON.stringify(report, null, 2));

    if (report.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
