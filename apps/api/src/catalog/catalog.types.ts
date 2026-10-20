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
