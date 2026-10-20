import type { BaseUnit, PackageUnit, PricingMode } from '../units';

/**
 * Kontrakt importu letáku (spec §5 F1, §14.2).
 * Ceny jsou v KORUNÁCH (desetinné), protože tak je uvádí zdroj; převod na haléře dělá mapper.
 */
export interface LeafletProductDto {
  readonly name: string;
  readonly brand?: string;
  /** Akční cena v Kč za balení (u váženého zboží za 1 kg / 1 l). */
  readonly price: number;
  readonly regularPrice?: number;
  readonly packageAmount: number;
  readonly packageUnit: PackageUnit;
  readonly category?: string;
  /** Nepovinné; default `PACKAGE`. `WEIGHT` = vážené zboží (cena za kg/l). */
  readonly pricing?: PricingMode;
}

export interface LeafletImportDto {
  /** Kód řetězce (`LIDL`, `KAUFLAND`, …). */
  readonly chain: string;
  /** `YYYY-MM-DD` */
  readonly validFrom: string;
  /** `YYYY-MM-DD` */
  readonly validTo: string;
  readonly title?: string;
  readonly sourceUrl?: string;
  readonly products: readonly LeafletProductDto[];
}

/** Kódy chyb dle §14.2 — shodné s validační tabulkou ve specifikaci. */
export type ImportIssueCode =
  | 'INVALID_STRUCTURE'
  | 'INVALID_CHAIN'
  | 'INVALID_VALIDITY'
  | 'INVALID_PRICE'
  | 'INVALID_REGULAR_PRICE'
  | 'INVALID_UNIT'
  | 'INVALID_PRODUCT_NAME'
  | 'DUPLICATE_PRODUCT'
  /** Import byl zablokován quarantine pravidlem (spec §14.5) — data se nezapsala. */
  | 'QUARANTINED';

export interface ImportIssue {
  readonly code: ImportIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ImportIssue[];
}

/** Produkt po normalizaci — připravený k zápisu do `products`/`promotions` (spec §9.5, §9.7). */
export interface NormalizedProduct {
  readonly name: string;
  readonly brand: string | null;
  readonly category: string;
  readonly baseUnit: BaseUnit;
  /** Množství balení v base jednotce (1 l = 1000 ML). */
  readonly packageAmount: number;
  readonly pricingMode: PricingMode;
  readonly priceMinor: number;
  readonly regularPriceMinor: number | null;
  readonly unitPriceMinor: number;
}

export interface NormalizedLeaflet {
  readonly chainCode: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly title: string;
  readonly sourceUrl: string | null;
  readonly products: readonly NormalizedProduct[];
}

export interface MappingResult {
  readonly leaflet: NormalizedLeaflet;
  /** Produkty, které se kvůli neplatné kategorii zařadily do `Ostatní` (spec §5 F1 pravidlo 5). */
  readonly normalizedCategoryCount: number;
}
