import { DomainError } from './errors';
import { type Minor, assertMinor } from './money';

/** Normalizované jednotky pro porovnávání cen (spec §10.1). Nic jiného se neukládá. */
export type BaseUnit = 'G' | 'ML' | 'PCS';

/** PACKAGE = kupuje se po celých baleních (ceil), WEIGHT = vážené zboží (proporcionálně). */
export type PricingMode = 'PACKAGE' | 'WEIGHT';

/** Jednotky povolené na vstupu importu (spec §10.2). */
export type PackageUnit = 'kg' | 'g' | 'l' | 'ml' | 'ks' | 'role';

export interface PackageSize {
  readonly amount: number;
  readonly unit: PackageUnit;
}

export interface NormalizedPackage {
  readonly baseUnit: BaseUnit;
  readonly packageAmount: number;
  readonly pricingMode: PricingMode;
}

interface UnitConversion {
  readonly baseUnit: BaseUnit;
  readonly multiplier: number;
}

const CONVERSIONS: Readonly<Record<PackageUnit, UnitConversion>> = {
  kg: { baseUnit: 'G', multiplier: 1000 },
  g: { baseUnit: 'G', multiplier: 1 },
  l: { baseUnit: 'ML', multiplier: 1000 },
  ml: { baseUnit: 'ML', multiplier: 1 },
  ks: { baseUnit: 'PCS', multiplier: 1 },
  role: { baseUnit: 'PCS', multiplier: 1 },
};

/** Převede vstupní balení („1,5 l“) na base unit + množství v base unit (spec §10.2). */
export function normalizePackageSize(size: PackageSize, pricingMode: PricingMode): NormalizedPackage {
  if (!Number.isFinite(size.amount) || size.amount <= 0) {
    throw new DomainError('INVALID_PACKAGE_AMOUNT', `packageAmount musí být > 0, dostal jsem ${String(size.amount)}`, {
      amount: size.amount,
    });
  }
  const key = normalizeUnitKey(size.unit);
  const conversion = CONVERSIONS[key];
  if (conversion === undefined) {
    throw new DomainError('INVALID_UNIT', `Nepodporovaná jednotka "${String(size.unit)}"`, { unit: size.unit });
  }
  return {
    baseUnit: conversion.baseUnit,
    packageAmount: roundTo3(size.amount * conversion.multiplier),
    pricingMode,
  };
}

/**
 * Jednotková cena (spec §10.3):
 *  - PCS: za 1 ks
 *  - G/ML: za 1 kg / 1 l (tj. na 1000 base jednotek)
 * Zaokrouhlení na celé haléře.
 */
export function unitPriceMinor(priceMinor: Minor, packageAmount: number, baseUnit: BaseUnit): Minor {
  assertMinor(priceMinor, 'priceMinor');
  if (!Number.isFinite(packageAmount) || packageAmount <= 0) {
    throw new DomainError('INVALID_PACKAGE_AMOUNT', `packageAmount musí být > 0, dostal jsem ${String(packageAmount)}`, {
      packageAmount,
    });
  }
  return baseUnit === 'PCS'
    ? Math.round(priceMinor / packageAmount)
    : Math.round((priceMinor / packageAmount) * 1000);
}

export function unitLabel(baseUnit: BaseUnit): 'Kč/kg' | 'Kč/l' | 'Kč/ks' {
  switch (baseUnit) {
    case 'G':
      return 'Kč/kg';
    case 'ML':
      return 'Kč/l';
    case 'PCS':
      return 'Kč/ks';
  }
}

/** Ceny lze porovnávat jen při shodné base unit (spec §10.5). */
export function isComparable(a: BaseUnit, b: BaseUnit): boolean {
  return a === b;
}

function normalizeUnitKey(unit: string): PackageUnit {
  return unit.trim().toLowerCase() as PackageUnit;
}

function roundTo3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
