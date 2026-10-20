import { DomainError } from './errors';
import { type Minor, assertMinor } from './money';
import { type BaseUnit, type PricingMode, unitPriceMinor } from './units';

export interface OfferPrice {
  readonly priceMinor: Minor;
  readonly packageAmount: number;
  readonly baseUnit: BaseUnit;
  readonly pricingMode: PricingMode;
}

export interface LineCost {
  /** Počet balení u PACKAGE, `null` u WEIGHT (vážené zboží). */
  readonly packages: number | null;
  readonly lineTotalMinor: Minor;
  readonly unitPriceMinor: Minor;
}

/** Počet balení nutných k pokrytí potřeby — část balení koupit nelze (spec §10.4). */
export function packagesRequired(quantityBase: number, packageAmount: number): number {
  assertQuantity(quantityBase);
  assertPackageAmount(packageAmount);
  // Ošetření plovoucí čárky: 0.3 / 0.1 = 2.9999999999999996 -> ceil dá 3, což je správně,
  // ale 3 / 1 = 3 musí zůstat 3; proto EPSILON.
  return Math.ceil(quantityBase / packageAmount - 1e-9);
}

/**
 * Cena řádku nákupního seznamu (spec §10.4).
 *  PACKAGE: ceil(quantity / packageAmount) * price
 *  WEIGHT:  round(quantity / packageAmount * price)
 */
export function lineCost(quantityBase: number, offer: OfferPrice): LineCost {
  assertQuantity(quantityBase);
  assertPackageAmount(offer.packageAmount);
  assertMinor(offer.priceMinor, 'offer.priceMinor');

  const unitPrice = unitPriceMinor(offer.priceMinor, offer.packageAmount, offer.baseUnit);

  if (offer.pricingMode === 'WEIGHT') {
    return {
      packages: null,
      lineTotalMinor: Math.round((quantityBase / offer.packageAmount) * offer.priceMinor),
      unitPriceMinor: unitPrice,
    };
  }

  const packages = packagesRequired(quantityBase, offer.packageAmount);
  return {
    packages,
    lineTotalMinor: packages * offer.priceMinor,
    unitPriceMinor: unitPrice,
  };
}

function assertQuantity(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError('INVALID_QUANTITY', `quantityBase musí být > 0, dostal jsem ${String(value)}`, { value });
  }
}

function assertPackageAmount(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError(
      'INVALID_PACKAGE_AMOUNT',
      `packageAmount musí být > 0, dostal jsem ${String(value)}`,
      { value },
    );
  }
}
