import { DomainError } from '../errors';
import { normalizePackageSize } from '../units';
import type { ImportIssue, LeafletImportDto, LeafletProductDto, ValidationResult } from './types';

export const MAX_PRICE_KC = 100_000;
export const MAX_VALIDITY_DAYS = 31;
export const MAX_NAME_LENGTH = 255;

/** Číselník kategorií (spec §5 F1 pravidlo 5). Neznámá kategorie → `Ostatní`. */
export const CATEGORIES: readonly string[] = [
  'Mléčné výrobky',
  'Maso a ryby',
  'Ovoce a zelenina',
  'Pekařské výrobky',
  'Nápoje',
  'Trvanlivé potraviny',
  'Mražené potraviny',
  'Drogerie',
  'Ostatní',
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validace letáku dle §14.2 — čistá funkce, vrací VŠECHNY chyby (ne jen první).
 * `knownChains` = kódy aktivních řetězců z DB.
 */
export function validateLeaflet(dto: LeafletImportDto, knownChains: readonly string[]): ValidationResult {
  const issues: ImportIssue[] = [];

  if (typeof dto !== 'object' || dto === null) {
    return { ok: false, issues: [{ code: 'INVALID_STRUCTURE', path: '$', message: 'Leták musí být objekt' }] };
  }
  if (!Array.isArray(dto.products) || dto.products.length === 0) {
    issues.push({
      code: 'INVALID_STRUCTURE',
      path: '$.products',
      message: 'Leták musí obsahovat alespoň jeden produkt',
    });
  }

  if (!knownChains.includes(dto.chain)) {
    issues.push({
      code: 'INVALID_CHAIN',
      path: '$.chain',
      message: `Neznámý nebo neaktivní řetězec "${String(dto.chain)}"`,
    });
  }

  validateValidity(dto, issues);

  const seen = new Set<string>();
  dto.products.forEach((product, index) => validateProduct(product, index, seen, issues));

  return { ok: issues.length === 0, issues };
}

function validateValidity(dto: LeafletImportDto, issues: ImportIssue[]): void {
  const from = dto.validFrom;
  const to = dto.validTo;

  if (!DATE_PATTERN.test(String(from)) || !DATE_PATTERN.test(String(to))) {
    issues.push({
      code: 'INVALID_VALIDITY',
      path: '$.validFrom',
      message: 'Platnost musí být ve formátu YYYY-MM-DD',
    });
    return;
  }

  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    issues.push({ code: 'INVALID_VALIDITY', path: '$.validFrom', message: 'Neplatné datum' });
    return;
  }
  if (toTime < fromTime) {
    issues.push({
      code: 'INVALID_VALIDITY',
      path: '$.validTo',
      message: `validTo (${to}) nesmí být před validFrom (${from})`,
    });
    return;
  }

  const days = Math.round((toTime - fromTime) / 86_400_000) + 1;
  if (days > MAX_VALIDITY_DAYS) {
    issues.push({
      code: 'INVALID_VALIDITY',
      path: '$.validTo',
      message: `Platnost ${days} dní přesahuje maximum ${MAX_VALIDITY_DAYS} dní`,
    });
  }
}

function validateProduct(
  product: LeafletProductDto,
  index: number,
  seen: Set<string>,
  issues: ImportIssue[],
): void {
  const path = `$.products[${index}]`;

  if (typeof product !== 'object' || product === null) {
    issues.push({ code: 'INVALID_STRUCTURE', path, message: 'Produkt musí být objekt' });
    return;
  }

  const name = typeof product.name === 'string' ? product.name.trim() : '';
  if (name === '' || name.length > MAX_NAME_LENGTH) {
    issues.push({
      code: 'INVALID_PRODUCT_NAME',
      path: `${path}.name`,
      message: `Název musí být neprázdný a max ${MAX_NAME_LENGTH} znaků`,
    });
  }

  if (!Number.isFinite(product.price) || product.price <= 0 || product.price > MAX_PRICE_KC) {
    issues.push({
      code: 'INVALID_PRICE',
      path: `${path}.price`,
      message: `Cena musí být > 0 a ≤ ${MAX_PRICE_KC} Kč, dostal jsem ${String(product.price)}`,
    });
  }

  if (product.regularPrice !== undefined) {
    if (
      !Number.isFinite(product.regularPrice) ||
      product.regularPrice <= 0 ||
      product.regularPrice > MAX_PRICE_KC ||
      product.regularPrice <= product.price
    ) {
      issues.push({
        code: 'INVALID_REGULAR_PRICE',
        path: `${path}.regularPrice`,
        message: 'regularPrice musí být > price a ≤ ' + `${MAX_PRICE_KC} Kč`,
      });
    }
  }

  const pricingMode = product.pricing ?? 'PACKAGE';
  let baseUnit: string | null = null;
  try {
    const normalized = normalizePackageSize(
      { amount: product.packageAmount, unit: product.packageUnit },
      pricingMode,
    );
    baseUnit = normalized.baseUnit;
  } catch (error) {
    const code = error instanceof DomainError ? 'INVALID_UNIT' : 'INVALID_STRUCTURE';
    issues.push({
      code,
      path: `${path}.packageUnit`,
      message: error instanceof Error ? error.message : 'Neplatná jednotka',
    });
  }

  if (pricingMode === 'WEIGHT' && baseUnit === 'PCS') {
    issues.push({
      code: 'INVALID_UNIT',
      path: `${path}.pricing`,
      message: 'Vážené zboží (WEIGHT) nelze kombinovat s jednotkou kusů',
    });
  }

  const key = `${name}|${String(product.packageAmount)}|${String(product.packageUnit)}`;
  if (seen.has(key)) {
    issues.push({
      code: 'DUPLICATE_PRODUCT',
      path,
      message: `Produkt "${name}" je v letáku vícekrát se stejným balením`,
    });
  }
  seen.add(key);
}
