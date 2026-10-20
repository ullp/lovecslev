import { Module } from '@nestjs/common';
import { ImportModule } from '../import/import.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FileFixtureAdapter, LidlHtmlAdapter } from './adapters/lidl.adapter';
import { LeafletScrapeService } from './leaflet-scrape.service';
import { PrismaScrapeChainRepository } from './prisma-scrape-chain.repository';
import { FileSnapshotStore } from './snapshot.store';
import {
  ADAPTER_REGISTRY,
  SCRAPE_CHAIN_REPOSITORY,
  SNAPSHOT_STORE,
  type LeafletSourceAdapter,
} from './scraping.types';

/**
 * Registry adaptérů (spec §14.5). `SCRAPE_SOURCE=fixture` používá archivované snapshoty
 * (offline demo/CI), výchozí `http` vyžaduje `SCRAPE_LIDL_URL` a právní schválení řetězce.
 */
function buildAdapters(): ReadonlyMap<string, LeafletSourceAdapter> {
  const source = (process.env.SCRAPE_SOURCE ?? 'http').toLowerCase();
  const lidl: LeafletSourceAdapter =
    source === 'fixture' ? new FileFixtureAdapter('LIDL') : new LidlHtmlAdapter();

  return new Map([[lidl.chainCode, lidl]]);
}

@Module({
  imports: [PrismaModule, ImportModule],
  providers: [
    LeafletScrapeService,
    { provide: SCRAPE_CHAIN_REPOSITORY, useClass: PrismaScrapeChainRepository },
    { provide: SNAPSHOT_STORE, useClass: FileSnapshotStore },
    { provide: ADAPTER_REGISTRY, useFactory: buildAdapters },
  ],
  exports: [LeafletScrapeService],
})
export class ScrapingModule {}
