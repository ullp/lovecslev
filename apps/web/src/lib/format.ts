import { formatCzk } from '@lovecslev/shared';
import type { BaseUnit } from './types';

export { formatCzk };

/** `2026-10-14` → `14. 10. 2026` (cs-CZ, bez Intl kvůli determinismu SSR i klienta). */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (year === undefined || month === undefined || day === undefined) return iso;
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

/** `6000 ML` → `6 l`, `250 G` → `250 g`, `8 PCS` → `8 ks`. */
export function formatQuantity(quantityBase: number, baseUnit: BaseUnit): string {
  if (baseUnit === 'ML') {
    return quantityBase >= 1000 ? `${round(quantityBase / 1000)} l` : `${quantityBase} ml`;
  }
  if (baseUnit === 'G') {
    return quantityBase >= 1000 ? `${round(quantityBase / 1000)} kg` : `${quantityBase} g`;
  }
  return `${quantityBase} ks`;
}

/** `1990` haléřů + `Kč/l` → `19,90 Kč / l` (jednotková cena dle spec §10.3). */
export function formatUnitPriceMinor(unitPriceMinor: number, unitLabel: string): string {
  return `${formatCzk(unitPriceMinor)} / ${unitLabel.replace(/^Kč\//, '')}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
