import { DomainError } from '../errors';
import {
  isComparable,
  normalizePackageSize,
  unitLabel,
  unitPriceMinor,
} from '../units';

describe('normalizePackageSize (spec §10.2)', () => {
  it('převede kg na gramy', () => {
    expect(normalizePackageSize({ amount: 1, unit: 'kg' }, 'WEIGHT')).toEqual({
      baseUnit: 'G',
      packageAmount: 1000,
      pricingMode: 'WEIGHT',
    });
  });

  it('převede litry na mililitry', () => {
    expect(normalizePackageSize({ amount: 1.5, unit: 'l' }, 'PACKAGE')).toEqual({
      baseUnit: 'ML',
      packageAmount: 1500,
      pricingMode: 'PACKAGE',
    });
  });

  it('zachová gramy a mililitry', () => {
    expect(normalizePackageSize({ amount: 250, unit: 'g' }, 'PACKAGE').packageAmount).toBe(250);
    expect(normalizePackageSize({ amount: 330, unit: 'ml' }, 'PACKAGE').packageAmount).toBe(330);
  });

  it('převede role na kusy', () => {
    expect(normalizePackageSize({ amount: 8, unit: 'role' }, 'PACKAGE')).toEqual({
      baseUnit: 'PCS',
      packageAmount: 8,
      pricingMode: 'PACKAGE',
    });
  });

  it('je case-insensitive a toleruje mezery', () => {
    expect(normalizePackageSize({ amount: 1, unit: ' KG ' as 'kg' }, 'WEIGHT').packageAmount).toBe(1000);
  });

  it('odmítne neznámou jednotku', () => {
    expect(() => normalizePackageSize({ amount: 1, unit: 'libra' as 'g' }, 'PACKAGE')).toThrow(DomainError);
    expect(() => normalizePackageSize({ amount: 1, unit: 'libra' as 'g' }, 'PACKAGE')).toThrow(/Nepodporovaná jednotka/);
  });

  it('odmítne nulové nebo záporné množství balení', () => {
    expect(() => normalizePackageSize({ amount: 0, unit: 'g' }, 'PACKAGE')).toThrow(/packageAmount/);
    expect(() => normalizePackageSize({ amount: -1, unit: 'g' }, 'PACKAGE')).toThrow(DomainError);
  });
});

describe('unitPriceMinor (spec §10.3)', () => {
  it('u hmotnosti počítá cenu za 1 kg', () => {
    expect(unitPriceMinor(4490, 250, 'G')).toBe(17960);
    expect(unitPriceMinor(12900, 1000, 'G')).toBe(12900);
  });

  it('u objemu počítá cenu za 1 l', () => {
    expect(unitPriceMinor(1990, 1000, 'ML')).toBe(1990);
    expect(unitPriceMinor(3990, 1500, 'ML')).toBe(2660);
  });

  it('u kusů počítá cenu za 1 ks a zaokrouhluje', () => {
    expect(unitPriceMinor(6990, 8, 'PCS')).toBe(874);
    expect(unitPriceMinor(1000, 3, 'PCS')).toBe(333);
  });

  it('odmítne neplatné vstupy', () => {
    expect(() => unitPriceMinor(19.9, 1000, 'G')).toThrow(DomainError);
    expect(() => unitPriceMinor(1990, 0, 'G')).toThrow(DomainError);
  });
});

describe('unitLabel a srovnatelnost', () => {
  it('mapuje jednotky na české labely', () => {
    expect(unitLabel('G')).toBe('Kč/kg');
    expect(unitLabel('ML')).toBe('Kč/l');
    expect(unitLabel('PCS')).toBe('Kč/ks');
  });

  it('porovnávat lze jen shodné base units (spec §10.5)', () => {
    expect(isComparable('G', 'G')).toBe(true);
    expect(isComparable('G', 'ML')).toBe(false);
    expect(isComparable('ML', 'PCS')).toBe(false);
  });
});
