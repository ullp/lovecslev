import type { BaseUnit, PricingMode } from '@slevari/shared';

export type ImportSource = 'SEED' | 'MANUAL' | 'IMPORT' | 'SCRAPE';

export interface PromotionWrite {
  readonly name: string;
  readonly brand: string | null;
  readonly category: string;
  readonly baseUnit: BaseUnit;
  readonly packageAmount: number;
  readonly pricingMode: PricingMode;
  readonly priceMinor: number;
  readonly regularPriceMinor: number | null;
  readonly unitPriceMinor: number;
}

export interface LeafletWrite {
  readonly chainId: string;
  readonly title: string;
  /** `YYYY-MM-DD` */
  readonly validFrom: string;
  /** `YYYY-MM-DD` */
  readonly validTo: string;
  readonly checksum: string;
  readonly source: ImportSource;
  readonly sourceUrl: string | null;
  readonly promotions: readonly PromotionWrite[];
}

export interface WriteResult {
  readonly leafletId: string;
  readonly promotionsWritten: number;
  readonly productsCreated: number;
}

export interface StoredLeaflet {
  readonly id: string;
  readonly checksum: string;
}

/**
 * Perzistenční port (spec §8.4 bod 8): importní logika nesmí záviset na Prisma.
 * Testy používají in-memory implementaci, produkce `PrismaLeafletRepository`.
 */
export interface LeafletRepository {
  listActiveChainCodes(): Promise<readonly string[]>;
  findChainIdByCode(code: string): Promise<string | null>;
  findLeaflet(chainId: string, validFrom: string, validTo: string): Promise<StoredLeaflet | null>;
  /** Počet akcí předchozího (časově nejbližšího staršího) letáku daného řetězce — pro quarantine. */
  countPromotionsOfPreviousLeaflet(chainId: string, beforeValidFrom: string): Promise<number>;
  /** Idempotentní zápis: nahradí akce letáku, upsertne produkty a doplní historii cen. */
  replaceLeaflet(input: LeafletWrite): Promise<WriteResult>;
}

export const LEAFLET_REPOSITORY = Symbol('LEAFLET_REPOSITORY');
