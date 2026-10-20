import type { BaseUnit, PricingMode } from '@slevari/shared';

/** Pohledy pro API (spec §13) — peníze vždy haléře. */

export interface ChainView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly colorHex: string;
  readonly isMvp: boolean;
  readonly hasActiveLeaflet: boolean;
}

export interface LeafletSummary {
  readonly id: string;
  readonly chainCode: string;
  readonly chainName: string;
  readonly colorHex: string;
  readonly title: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly productCount: number;
  readonly promotionCount: number;
  /** Top 3 slevy v procentech (spec §5 F1 pravidlo 3). */
  readonly topDiscounts: readonly number[];
}

export interface LeafletProductView {
  readonly productId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string;
  readonly priceMinor: number;
  readonly regularPriceMinor: number | null;
  readonly discountPercent: number | null;
  readonly unitPriceMinor: number;
  readonly unitLabel: string;
  readonly packageAmount: number;
  readonly baseUnit: BaseUnit;
}

export interface LeafletDetail {
  readonly id: string;
  readonly chainCode: string;
  readonly chainName: string;
  readonly title: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly categories: readonly string[];
  readonly products: readonly LeafletProductView[];
}

export interface OfferView {
  readonly productId: string;
  readonly chainCode: string;
  readonly chainName: string;
  readonly colorHex: string;
  readonly priceMinor: number;
  readonly regularPriceMinor: number | null;
  readonly discountPercent: number | null;
  readonly unitPriceMinor: number;
  readonly unitLabel: string;
  readonly packageAmount: number;
  readonly baseUnit: BaseUnit;
  readonly pricingMode: PricingMode;
  readonly validFrom: string;
  readonly validTo: string;
}

export interface ProductSearchResult {
  readonly productId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string;
  readonly baseUnit: BaseUnit;
  readonly offers: readonly OfferView[];
}

export interface ProductRecord {
  readonly productId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string;
  readonly baseUnit: BaseUnit;
}

/** P3 — historie cen (spec §6 P3, §9.8, §9.12). */
export interface PriceHistoryPointView {
  /** `YYYY-MM-DD`; u měsíční agregace vždy 1. den měsíce. */
  readonly date: string;
  readonly granularity: 'daily' | 'monthly';
  readonly priceMinor: number | null;
  readonly unitPriceMinor: number;
  readonly packageAmount: number;
  readonly baseUnit: BaseUnit;
}

export interface PriceHistorySeries {
  readonly chainCode: string;
  readonly chainName: string;
  readonly points: readonly PriceHistoryPointView[];
  /** Data, kde se změnilo balení — graf MUSÍ přerušit linii (spec P3). */
  readonly breaks: readonly string[];
}

export interface PriceHistoryStats {
  readonly minUnitPriceMinor: number | null;
  readonly maxUnitPriceMinor: number | null;
  readonly avgUnitPriceMinor: number | null;
  readonly lowestDate: string | null;
  readonly lowestChainCode: string | null;
  readonly sampleCount: number;
}

export interface PriceHistoryView {
  readonly productId: string;
  readonly productName: string;
  readonly from: string;
  readonly to: string;
  readonly unitLabel: string;
  readonly series: readonly PriceHistorySeries[];
  readonly stats: PriceHistoryStats;
}

/** Řádek z DB — služba z něj skládá série. */
export interface PriceHistoryRow {
  readonly date: string;
  readonly chainCode: string;
  readonly chainName: string;
  readonly priceMinor: number | null;
  readonly unitPriceMinor: number;
  readonly packageAmount: number;
  readonly baseUnit: BaseUnit;
  readonly granularity: 'daily' | 'monthly';
}

/** Kandidát vrácený vyhledávacím portem (rozhodnutí o shodě dělá `matchProduct`). */
export interface SearchCandidateRecord {
  readonly productId: string;
  readonly canonicalName: string;
  readonly brand: string | null;
  readonly category: string;
  readonly baseUnit: BaseUnit;
  readonly aliases: readonly string[];
  readonly similarity: number;
}
