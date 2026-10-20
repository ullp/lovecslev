import { toMinor } from '../money';
import { normalizePackageSize, unitPriceMinor } from '../units';
import type { LeafletImportDto, LeafletProductDto, MappingResult, NormalizedProduct } from './types';
import { CATEGORIES } from './validator';

export const DEFAULT_CATEGORY = 'Ostatní';

/**
 * Normalizace validovaného letáku (spec §10.2, §10.3, §14.3 bod 5).
 * Vstup: ceny v Kč. Výstup: haléře, base jednotky, jednotkové ceny.
 * Předpokládá, že leták prošel `validateLeaflet` — jinak může vyhodit DomainError.
 */
export function mapLeaflet(dto: LeafletImportDto): MappingResult {
  let normalizedCategoryCount = 0;

  const products: NormalizedProduct[] = dto.products.map((product) => {
    const pricingMode = product.pricing ?? 'PACKAGE';
    const pack = normalizePackageSize(
      { amount: product.packageAmount, unit: product.packageUnit },
      pricingMode,
    );
    const priceMinor = toMinor(product.price);
    const regularPriceMinor =
      product.regularPrice === undefined ? null : toMinor(product.regularPrice);

    let category = DEFAULT_CATEGORY;
    if (product.category !== undefined && CATEGORIES.includes(product.category)) {
      category = product.category;
    } else {
      normalizedCategoryCount += 1;
    }

    return {
      name: product.name.trim(),
      brand: normalizeBrand(product),
      category,
      baseUnit: pack.baseUnit,
      packageAmount: pack.packageAmount,
      pricingMode: pack.pricingMode,
      priceMinor,
      regularPriceMinor,
      unitPriceMinor: unitPriceMinor(priceMinor, pack.packageAmount, pack.baseUnit),
    };
  });

  return {
    leaflet: {
      chainCode: dto.chain,
      validFrom: dto.validFrom,
      validTo: dto.validTo,
      title: dto.title?.trim() || `Leták ${dto.chain} ${dto.validFrom}`,
      sourceUrl: dto.sourceUrl ?? null,
      products,
    },
    normalizedCategoryCount,
  };
}

function normalizeBrand(product: LeafletProductDto): string | null {
  const brand = product.brand?.trim();
  return brand === undefined || brand === '' ? null : brand;
}

/** `discountPercent` se neukládá, počítá se při čtení (spec §9.7). */
export function discountPercent(priceMinor: number, regularPriceMinor: number | null): number | null {
  if (regularPriceMinor === null || regularPriceMinor <= 0 || regularPriceMinor <= priceMinor) return null;
  return Math.round((1 - priceMinor / regularPriceMinor) * 100);
}
