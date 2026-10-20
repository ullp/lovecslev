import { Inject, Injectable } from '@nestjs/common';
import { mapLeaflet, validateLeaflet, type ImportIssue, type LeafletImportDto } from '@slevari/shared';
import { leafletChecksum } from './checksum';
import {
  LEAFLET_REPOSITORY,
  type ImportSource,
  type LeafletRepository,
  type PromotionWrite,
} from './leaflet.repository';

/** Quarantine: pokles počtu produktů o více než 40 % proti předchozímu letáku (spec §14.5). */
export const QUARANTINE_DROP_RATIO = 0.4;

export interface ImportOptions {
  readonly source: ImportSource;
  /** Default: zapnuto jen pro `SCRAPE` (spec §14.5). */
  readonly quarantine?: boolean;
}

export interface ImportReport {
  leafletsImported: number;
  leafletsSkipped: number;
  promotionsUpserted: number;
  productsCreated: number;
  errors: ImportIssue[];
}

const EMPTY_REPORT = (): ImportReport => ({
  leafletsImported: 0,
  leafletsSkipped: 0,
  promotionsUpserted: 0,
  productsCreated: 0,
  errors: [],
});

/**
 * Import letáků (spec §14): validace → normalizace → idempotence → zápis.
 * Veškerá doménová logika je v @slevari/shared; tady je orchestrace a perzistence.
 */
@Injectable()
export class LeafletImportService {
  constructor(@Inject(LEAFLET_REPOSITORY) private readonly repository: LeafletRepository) {}

  async importLeaflets(
    dtos: readonly LeafletImportDto[],
    options: ImportOptions,
  ): Promise<ImportReport> {
    const report = EMPTY_REPORT();
    const knownChains = await this.repository.listActiveChainCodes();
    const quarantine = options.quarantine ?? options.source === 'SCRAPE';

    for (const [index, dto] of dtos.entries()) {
      const validation = validateLeaflet(dto, knownChains);
      if (!validation.ok) {
        report.errors.push(...validation.issues.map((issue) => prefixPath(issue, index)));
        continue;
      }

      const chainId = await this.repository.findChainIdByCode(dto.chain);
      if (chainId === null) {
        report.errors.push({
          code: 'INVALID_CHAIN',
          path: `$[${index}].chain`,
          message: `Řetězec "${dto.chain}" neexistuje`,
        });
        continue;
      }

      const mapped = mapLeaflet(dto);
      const checksum = leafletChecksum(dto);
      const existing = await this.repository.findLeaflet(chainId, dto.validFrom, dto.validTo);

      if (existing !== null && existing.checksum === checksum) {
        report.leafletsSkipped += 1;
        continue;
      }

      if (quarantine && existing === null) {
        const previousCount = await this.repository.countPromotionsOfPreviousLeaflet(
          chainId,
          dto.validFrom,
        );
        const minimum = Math.ceil(previousCount * (1 - QUARANTINE_DROP_RATIO));
        if (previousCount > 0 && mapped.leaflet.products.length < minimum) {
          report.errors.push({
            code: 'QUARANTINED',
            path: `$[${index}].products`,
            message:
              `Import zablokován: ${mapped.leaflet.products.length} produktů proti ` +
              `${previousCount} v předchozím letáku (limit ${minimum})`,
          });
          continue;
        }
      }

      const promotions: PromotionWrite[] = mapped.leaflet.products.map((product) => ({
        name: product.name,
        brand: product.brand,
        category: product.category,
        baseUnit: product.baseUnit,
        packageAmount: product.packageAmount,
        pricingMode: product.pricingMode,
        priceMinor: product.priceMinor,
        regularPriceMinor: product.regularPriceMinor,
        unitPriceMinor: product.unitPriceMinor,
      }));

      const written = await this.repository.replaceLeaflet({
        chainId,
        title: mapped.leaflet.title,
        validFrom: mapped.leaflet.validFrom,
        validTo: mapped.leaflet.validTo,
        checksum,
        source: options.source,
        sourceUrl: mapped.leaflet.sourceUrl,
        promotions,
      });

      report.leafletsImported += 1;
      report.promotionsUpserted += written.promotionsWritten;
      report.productsCreated += written.productsCreated;
    }

    return report;
  }
}

/** `$.products[0].name` → `$[2].products[0].name` (aby bylo v reportu vidět, který leták selhal). */
function prefixPath(issue: ImportIssue, index: number): ImportIssue {
  return { ...issue, path: `$[${index}]${issue.path.slice(1)}` };
}
