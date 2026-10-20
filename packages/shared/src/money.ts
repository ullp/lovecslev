import { DomainError } from './errors';

/**
 * Peníze jsou VŽDY celá čísla v haléřích (spec §0.5, D8).
 * 1990 === 19,90 Kč. Nikdy nepoužívej float pro peníze.
 */
export type Minor = number;

/** Ověří, že hodnota je platná nezáporná částka v haléřích. */
export function assertMinor(value: number, field = 'amount'): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainError(
      'INVALID_PRICE',
      `${field} musí být nezáporné celé číslo v haléřích, dostal jsem ${String(value)}`,
      { field, value },
    );
  }
}

export function sumMinor(values: readonly Minor[]): Minor {
  let total = 0;
  for (const value of values) {
    assertMinor(value, 'sumMinor.value');
    total += value;
  }
  return total;
}

/**
 * Převod z korun (desetinné číslo ze vstupního JSON letáku) na haléře.
 * Používá se POUZE na vstupu importu (spec §14.2); v doméně se dál počítá v Minor.
 */
export function toMinor(koruna: number): Minor {
  if (!Number.isFinite(koruna) || koruna < 0) {
    throw new DomainError('INVALID_PRICE', `Neplatná cena ${String(koruna)}`, { koruna });
  }
  return Math.round(koruna * 100);
}

/**
 * Formátování pro UI: 1990 -> "19,90 Kč", 123456789 -> "1 234 567,89 Kč".
 * Záměrně bez Intl (deterministické napříč prostředími a testy, spec §15.5).
 */
export function formatCzk(minor: Minor): string {
  if (!Number.isInteger(minor)) {
    throw new DomainError('INVALID_PRICE', `Cena musí být v celých haléřích, dostal jsem ${String(minor)}`, {
      minor,
    });
  }
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 100);
  const cents = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${negative ? '-' : ''}${grouped},${String(cents).padStart(2, '0')}\u00A0Kč`;
}
