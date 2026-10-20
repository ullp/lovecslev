import { Inject, Injectable, Logger } from '@nestjs/common';
import { LeafletImportService } from '../import/leaflet-import.service';
import type { LeafletSourceAdapter } from './scraping.types';
import {
  ADAPTER_REGISTRY,
  CIRCUIT_BREAKER_PAUSE_HOURS,
  CIRCUIT_BREAKER_THRESHOLD,
  SCRAPE_CHAIN_REPOSITORY,
  SNAPSHOT_STORE,
  type ScrapeChainRepository,
  type ScrapeChainResult,
  type ScrapeReport,
  type SnapshotStore,
} from './scraping.types';

/**
 * Orchestrace scrapingu (spec §14.5): právní gate → circuit breaker → snapshot →
 * parse → import (s quarantine) → monitoring report.
 */
@Injectable()
export class LeafletScrapeService {
  private readonly logger = new Logger(LeafletScrapeService.name);

  constructor(
    @Inject(SCRAPE_CHAIN_REPOSITORY) private readonly chains: ScrapeChainRepository,
    @Inject(ADAPTER_REGISTRY) private readonly adapters: ReadonlyMap<string, LeafletSourceAdapter>,
    @Inject(SNAPSHOT_STORE) private readonly snapshots: SnapshotStore,
    private readonly importer: LeafletImportService,
  ) {}

  async scrapeAll(options: {
    now?: Date;
    period: { validFrom: string; validTo: string };
  }): Promise<ScrapeReport> {
    const now = options.now ?? new Date();
    const startedAt = now.toISOString();
    const results: ScrapeChainResult[] = [];

    const targets = await this.chains.listTargets();

    for (const target of targets) {
      if (!target.legalApproved) {
        results.push({ chainCode: target.code, status: 'SKIPPED_LEGAL' });
        continue;
      }

      if (target.pausedUntil !== null && target.pausedUntil.getTime() > now.getTime()) {
        results.push({
          chainCode: target.code,
          status: 'SKIPPED_PAUSED',
          reason: `pozastaveno do ${target.pausedUntil.toISOString()}`,
        });
        continue;
      }

      const adapter = this.adapters.get(target.code);
      if (adapter === undefined) {
        results.push({ chainCode: target.code, status: 'SKIPPED_NO_ADAPTER' });
        continue;
      }

      try {
        const snapshot = await adapter.fetch(options.period);
        const saved = await this.snapshots.save(snapshot, options.period.validFrom);
        const dto = adapter.parse(snapshot);

        const report = await this.importer.importLeaflets([dto], { source: 'SCRAPE' });
        const quarantined = report.errors.some((error) => error.code === 'QUARANTINED');

        if (report.errors.length > 0 && !quarantined) {
          throw new Error(report.errors.map((error) => `${error.code}: ${error.message}`).join('; '));
        }

        await this.chains.resetFailures(target.id);

        const unchanged = report.leafletsSkipped > 0 && report.promotionsUpserted === 0;
        const result: ScrapeChainResult = {
          chainCode: target.code,
          status: quarantined ? 'QUARANTINED' : unchanged ? 'UNCHANGED' : 'IMPORTED',
          snapshotPath: saved.path,
          promotions: report.promotionsUpserted,
          quarantined,
          ...(quarantined && report.errors[0] !== undefined ? { reason: report.errors[0].message } : {}),
        };
        results.push(result);
      } catch (error) {
        const failures = target.failures + 1;
        const pauseUntil =
          failures >= CIRCUIT_BREAKER_THRESHOLD
            ? new Date(now.getTime() + CIRCUIT_BREAKER_PAUSE_HOURS * 3_600_000)
            : null;

        await this.chains.recordFailure(target.id, pauseUntil ?? now, failures);
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Scraping ${target.code} selhal (${failures}×): ${reason}`);

        results.push({ chainCode: target.code, status: 'FAILED', reason });
      }
    }

    const finishedAt = new Date().toISOString();
    const imported = results.filter((result) => result.status === 'IMPORTED').length;
    const failed = results.filter((result) => result.status === 'FAILED').length;

    return {
      startedAt,
      finishedAt,
      chains: results,
      imported,
      failed,
      skipped: results.length - imported - failed,
    };
  }
}
