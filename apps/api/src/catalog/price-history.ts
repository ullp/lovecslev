import { DomainError, unitLabel } from '@slevari/shared';
import type {
  PriceHistoryRow,
  PriceHistorySeries,
  PriceHistoryStats,
  PriceHistoryView,
  ProductRecord,
} from './catalog.types';

export const DEFAULT_HISTORY_DAYS = 90;
export const MIN_HISTORY_DAYS = 7;
export const MAX_HISTORY_DAYS = 730;

/** `range` z API: `90d`, `90` i prázdné → dny (spec §13.2 `/history?range=90d`). */
export function parseHistoryRange(range: string | undefined): number {
  if (range === undefined || range.trim() === '') return DEFAULT_HISTORY_DAYS;

  const match = /^(\d{1,4})d?$/.exec(range.trim());
  if (match === null) {
    throw new DomainError('VALIDATION_ERROR', 'range musí být např. 90d nebo 90', { range });
  }

  const days = Number(match[1]);
  if (!Number.isInteger(days) || days < MIN_HISTORY_DAYS || days > MAX_HISTORY_DAYS) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `range musí být ${MIN_HISTORY_DAYS}–${MAX_HISTORY_DAYS} dní`,
      { range },
    );
  }

  return days;
}

export function shiftIsoDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Sestaví P3 odpověď (spec §6 P3): série po řetězcích, přerušení při změně balení,
 * statistiky nad jednotkovými cenami.
 */
export function buildPriceHistoryView(
  product: ProductRecord,
  from: string,
  to: string,
  rows: readonly PriceHistoryRow[],
): PriceHistoryView {
  const byChain = new Map<string, { chainName: string; points: PriceHistoryRow[] }>();

  for (const row of rows) {
    const entry = byChain.get(row.chainCode) ?? { chainName: row.chainName, points: [] };
    entry.points.push(row);
    byChain.set(row.chainCode, entry);
  }

  const series: PriceHistorySeries[] = [...byChain.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([chainCode, entry]) => {
      const points = [...entry.points].sort((a, b) => (a.date < b.date ? -1 : 1));
      const breaks: string[] = [];

      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        if (previous === undefined || current === undefined) continue;
        // 0 = agregát bez balení → nepřerušuje (viz repo).
        if (previous.packageAmount > 0 && current.packageAmount > 0 && previous.packageAmount !== current.packageAmount) {
          breaks.push(current.date);
        }
      }

      return {
        chainCode,
        chainName: entry.chainName,
        points: points.map((point) => ({
          date: point.date,
          granularity: point.granularity,
          priceMinor: point.priceMinor,
          unitPriceMinor: point.unitPriceMinor,
          packageAmount: point.packageAmount,
          baseUnit: point.baseUnit,
        })),
        breaks,
      };
    });

  return {
    productId: product.productId,
    productName: product.name,
    from,
    to,
    unitLabel: unitLabel(product.baseUnit),
    series,
    stats: computeStats(rows),
  };
}

function computeStats(rows: readonly PriceHistoryRow[]): PriceHistoryStats {
  if (rows.length === 0) {
    return {
      minUnitPriceMinor: null,
      maxUnitPriceMinor: null,
      avgUnitPriceMinor: null,
      lowestDate: null,
      lowestChainCode: null,
      sampleCount: 0,
    };
  }

  let min = rows[0]!;
  let max = rows[0]!;
  let sum = 0;

  for (const row of rows) {
    if (row.unitPriceMinor < min.unitPriceMinor) min = row;
    if (row.unitPriceMinor > max.unitPriceMinor) max = row;
    sum += row.unitPriceMinor;
  }

  return {
    minUnitPriceMinor: min.unitPriceMinor,
    maxUnitPriceMinor: max.unitPriceMinor,
    avgUnitPriceMinor: Math.round(sum / rows.length),
    lowestDate: min.date,
    lowestChainCode: min.chainCode,
    sampleCount: rows.length,
  };
}
