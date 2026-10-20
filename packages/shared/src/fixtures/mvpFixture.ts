/**
 * Referenční datová sada — ZÁVAZNÁ pro testy, seed a demo (spec §19).
 * Čísla zde MUSÍ odpovídat tabulkám v dev/requirement-base-doc.md §19.4–§19.6.
 * Ceny jsou v haléřích (spec §0.5).
 */
import type { OfferInput, OptimizerItem } from '../optimizer';
import { normalizePackageSize, type NormalizedPackage, type PackageUnit, type PricingMode } from '../units';

export type ChainCode = 'LIDL' | 'ALBERT' | 'KAUFLAND' | 'BILLA';

export interface ProductMeta {
  readonly canonicalName: string;
  readonly brand: string | null;
  readonly category: string;
  /** Balení tak, jak je uvádí leták („1 l“, „250 g“, „8 rolí“, „1 kg“). */
  readonly packageSize: { readonly amount: number; readonly unit: PackageUnit };
  readonly pricingMode: PricingMode;
}

/** Spec §19.1 (+ brand/category pro import) */
export const PRODUCTS: Readonly<Record<string, ProductMeta>> = {
  prd_mleko: {
    canonicalName: 'Mléko polotučné',
    brand: 'Madeta',
    category: 'Mléčné výrobky',
    packageSize: { amount: 1, unit: 'l' },
    pricingMode: 'PACKAGE',
  },
  prd_maslo: {
    canonicalName: 'Máslo',
    brand: 'Madeta',
    category: 'Mléčné výrobky',
    packageSize: { amount: 250, unit: 'g' },
    pricingMode: 'PACKAGE',
  },
  prd_kureci_prsa: {
    canonicalName: 'Kuřecí prsa',
    brand: null,
    category: 'Maso a ryby',
    packageSize: { amount: 1, unit: 'kg' },
    pricingMode: 'WEIGHT',
  },
  prd_banany: {
    canonicalName: 'Banány',
    brand: null,
    category: 'Ovoce a zelenina',
    packageSize: { amount: 1, unit: 'kg' },
    pricingMode: 'WEIGHT',
  },
  prd_toaletni_papir: {
    canonicalName: 'Toaletní papír 8 rolí',
    brand: 'Zewa',
    category: 'Drogerie',
    packageSize: { amount: 8, unit: 'role' },
    pricingMode: 'PACKAGE',
  },
  prd_coca_cola: {
    canonicalName: 'Coca-Cola Original 1.5 l',
    brand: 'Coca-Cola',
    category: 'Nápoje',
    packageSize: { amount: 1.5, unit: 'l' },
    pricingMode: 'PACKAGE',
  },
};

/** Spec §19.4 — cena za balení v haléřích (u WEIGHT za 1000 g). */
export const PRICE_TABLE: Readonly<Record<string, Partial<Record<ChainCode, number>>>> = {
  prd_mleko: { LIDL: 1990, ALBERT: 2490, KAUFLAND: 2790, BILLA: 2690 },
  prd_maslo: { LIDL: 5490, ALBERT: 5290, KAUFLAND: 4490, BILLA: 5690 },
  prd_kureci_prsa: { LIDL: 12900, ALBERT: 13900, KAUFLAND: 13500, BILLA: 14900 },
  prd_banany: { LIDL: 2990, ALBERT: 3490, KAUFLAND: 3990, BILLA: 3690 },
  prd_toaletni_papir: { LIDL: 9990, ALBERT: 9490, KAUFLAND: 6990 },
  prd_coca_cola: { ALBERT: 3290, KAUFLAND: 3490, BILLA: 3390 },
};

/** Běžné (neakční) ceny pro výpočet `discountPercent` (spec §9.7). */
export const REGULAR_PRICE_TABLE: Readonly<Record<string, Partial<Record<ChainCode, number>>>> = {
  prd_mleko: { LIDL: 2490, ALBERT: 2790, KAUFLAND: 2990, BILLA: 2890 },
  prd_maslo: { LIDL: 5990, ALBERT: 5890, KAUFLAND: 5490, BILLA: 6190 },
  prd_kureci_prsa: { LIDL: 14900, ALBERT: 15500, KAUFLAND: 15200, BILLA: 16500 },
  prd_banany: { LIDL: 3490, ALBERT: 3990, KAUFLAND: 4290, BILLA: 4190 },
  prd_toaletni_papir: { LIDL: 10990, ALBERT: 10490, KAUFLAND: 8990 },
  prd_coca_cola: { ALBERT: 3690, KAUFLAND: 3790, BILLA: 3890 },
};

function metaFor(productId: string): ProductMeta {
  const meta = PRODUCTS[productId];
  if (meta === undefined) throw new Error(`Fixture nezná produkt ${productId}`);
  return meta;
}

/** Odvozené base jednotky produktu (spec §10.2) — jediný zdroj pravdy pro seed i optimalizaci. */
export function productPackage(productId: string): NormalizedPackage {
  const meta = metaFor(productId);
  return normalizePackageSize(meta.packageSize, meta.pricingMode);
}

/** Spec §19.4 převedené na nabídky (produkt × řetězec). */
export const OFFERS: readonly OfferInput[] = Object.entries(PRICE_TABLE).flatMap(([productId, byChain]) =>
  Object.entries(byChain).map(([chainCode, priceMinor]) => {
    const pack = productPackage(productId);
    return {
      productId,
      chainCode,
      priceMinor: priceMinor as number,
      packageAmount: pack.packageAmount,
      baseUnit: pack.baseUnit,
      pricingMode: pack.pricingMode,
    };
  }),
);

/** Spec §19.5 — nákupní seznam „Týdenní nákup“ v base jednotkách. */
export const SHOPPING_LIST: readonly OptimizerItem[] = [
  { productId: 'prd_mleko', quantityBase: 6000, rawText: 'Mléko' },
  { productId: 'prd_maslo', quantityBase: 500, rawText: 'Máslo' },
  { productId: 'prd_kureci_prsa', quantityBase: 2000, rawText: 'Kuřecí prsa' },
  { productId: 'prd_banany', quantityBase: 2000, rawText: 'Banány' },
  { productId: 'prd_toaletni_papir', quantityBase: 8, rawText: 'Toaletní papír' },
];

/** Spec §19.3 — letáky řetězců (stejné období pro celou fixture). */
export const LEAFLET_PERIOD = { validFrom: '2026-10-14', validTo: '2026-10-20' } as const;

export const CHAINS: readonly ChainCode[] = ['LIDL', 'ALBERT', 'KAUFLAND', 'BILLA'];

/** Spec §19.2 — aliasy (normalizované: lowercase, bez diakritiky) pro matching §12. */
export const PRODUCT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  prd_mleko: ['mliko', 'mleko', 'mleko polotucne'],
  prd_maslo: ['maslo'],
  prd_kureci_prsa: ['kureci prsa', 'kureci prsicka'],
  prd_banany: ['banany'],
  prd_toaletni_papir: ['toaletak', 'toaletni papir', 'papir'],
  prd_coca_cola: ['coca cola', 'cocacola'],
};

/** Spec §19.6 — očekávané hodnoty, na kterých stojí golden testy. */
export const EXPECTED = {
  lineCosts: {
    LIDL: {
      prd_mleko: 11940,
      prd_maslo: 10980,
      prd_kureci_prsa: 25800,
      prd_banany: 5980,
      prd_toaletni_papir: 9990,
    },
    ALBERT: {
      prd_mleko: 14940,
      prd_maslo: 10580,
      prd_kureci_prsa: 27800,
      prd_banany: 6980,
      prd_toaletni_papir: 9490,
    },
    KAUFLAND: {
      prd_mleko: 16740,
      prd_maslo: 8980,
      prd_kureci_prsa: 27000,
      prd_banany: 7980,
      prd_toaletni_papir: 6990,
    },
    BILLA: { prd_mleko: 16140, prd_maslo: 11380, prd_kureci_prsa: 29800, prd_banany: 7380 },
  },
  singleStoreTotals: { LIDL: 64690, KAUFLAND: 67690, ALBERT: 69790, BILLA: 64700 },
  variantAChain: 'LIDL',
  variantATotalMinor: 64690,
  variantBTotalMinor: 59690,
  variantBSplit: { KAUFLAND: 15970, LIDL: 43720 },
  savingsMinor: 5000,
  unitPrices: {
    masloKaufland: 17960,
    kureciLidl: 12900,
    papirKaufland: 874,
  },
} as const;
