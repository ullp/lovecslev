import { DomainError } from '@lovecslev/shared';
import { buildPriceHistoryView, parseHistoryRange, shiftIsoDate } from './price-history';
import type { PriceHistoryRow, ProductRecord } from './catalog.types';

const PRODUCT: ProductRecord = {
  productId: 'prd_mleko',
  name: 'Mléko polotučné',
  brand: 'Madeta',
  category: 'Mléčné výrobky',
  baseUnit: 'ML',
};

function row(overrides: Partial<PriceHistoryRow> = {}): PriceHistoryRow {
  return {
    date: '2026-09-01',
    chainCode: 'LIDL',
    chainName: 'Lidl',
    priceMinor: 1990,
    unitPriceMinor: 1990,
    packageAmount: 1000,
    baseUnit: 'ML',
    granularity: 'daily',
    ...overrides,
  };
}

describe('parseHistoryRange (spec §13.2)', () => {
  it('akceptuje 90d i 90 a default 90', () => {
    expect(parseHistoryRange(undefined)).toBe(90);
    expect(parseHistoryRange('90d')).toBe(90);
    expect(parseHistoryRange('90')).toBe(90);
    expect(parseHistoryRange(' 30d ')).toBe(30);
  });

  it('odmítne nesmysly a meze mimo rozsah', () => {
    expect(() => parseHistoryRange('abc')).toThrow(DomainError);
    expect(() => parseHistoryRange('5')).toThrow(/7–730/);
    expect(() => parseHistoryRange('1000')).toThrow(/7–730/);
  });
});

describe('shiftIsoDate', () => {
  it('posouvá dny i přes hranici měsíce', () => {
    expect(shiftIsoDate('2026-10-20', -29)).toBe('2026-09-21');
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('buildPriceHistoryView (spec §6 P3)', () => {
  const rows: readonly PriceHistoryRow[] = [
    row({ date: '2026-09-01', chainCode: 'KAUFLAND', chainName: 'Kaufland', priceMinor: 2790, unitPriceMinor: 2790 }),
    row({ date: '2026-10-01', chainCode: 'LIDL', priceMinor: 3990, unitPriceMinor: 1995, packageAmount: 2000 }),
    row({ date: '2026-08-01', chainCode: 'LIDL', priceMinor: 2190, unitPriceMinor: 2190 }),
    row({ date: '2026-09-01', chainCode: 'LIDL', priceMinor: 1990, unitPriceMinor: 1990 }),
  ];

  const view = buildPriceHistoryView(PRODUCT, '2026-08-01', '2026-10-20', rows);

  it('seskupí body po řetězcích a seřadí je podle data', () => {
    expect(view.series.map((serie) => serie.chainCode)).toEqual(['KAUFLAND', 'LIDL']);
    expect(view.series[1]?.points.map((point) => point.date)).toEqual([
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
    ]);
  });

  it('označí přerušení při změně balení', () => {
    expect(view.series[1]?.breaks).toEqual(['2026-10-01']);
    expect(view.series[0]?.breaks).toEqual([]);
  });

  it('spočítá statistiky nad jednotkovými cenami', () => {
    expect(view.stats).toEqual({
      minUnitPriceMinor: 1990,
      maxUnitPriceMinor: 2790,
      avgUnitPriceMinor: 2241,
      lowestDate: '2026-09-01',
      lowestChainCode: 'LIDL',
      sampleCount: 4,
    });
  });

  it('vrátí unit label z produktu a prázdné statistiky bez dat', () => {
    expect(view.unitLabel).toBe('Kč/l');
    const empty = buildPriceHistoryView(PRODUCT, '2026-10-01', '2026-10-20', []);
    expect(empty.series).toEqual([]);
    expect(empty.stats.sampleCount).toBe(0);
    expect(empty.stats.minUnitPriceMinor).toBeNull();
  });

  it('měsíční agregace (bez balení) nepřerušuje linii', () => {
    const monthly = buildPriceHistoryView(PRODUCT, '2026-01-01', '2026-10-20', [
      row({ date: '2026-01-01', unitPriceMinor: 2100, packageAmount: 0, priceMinor: null, granularity: 'monthly' }),
      row({ date: '2026-09-01', unitPriceMinor: 1990 }),
    ]);
    expect(monthly.series[0]?.breaks).toEqual([]);
    expect(monthly.series[0]?.points[0]?.granularity).toBe('monthly');
  });
});
