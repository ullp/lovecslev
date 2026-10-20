import { lineCost, packagesRequired } from '../pricing';
import type { OfferPrice } from '../pricing';

const butterLidl: OfferPrice = {
  priceMinor: 5490,
  packageAmount: 250,
  baseUnit: 'G',
  pricingMode: 'PACKAGE',
};

const chickenLidl: OfferPrice = {
  priceMinor: 12900,
  packageAmount: 1000,
  baseUnit: 'G',
  pricingMode: 'WEIGHT',
};

describe('packagesRequired (spec §10.4)', () => {
  it('zaokrouhluje nahoru — část balení koupit nelze', () => {
    expect(packagesRequired(500, 250)).toBe(2);
    expect(packagesRequired(6000, 1000)).toBe(6);
    expect(packagesRequired(8, 8)).toBe(1);
  });

  it('potřeba menší než balení = 1 balení', () => {
    expect(packagesRequired(100, 250)).toBe(1);
    expect(packagesRequired(1, 1000)).toBe(1);
  });

  it('nedělá chybu na hranici balení (plovoucí čárka)', () => {
    expect(packagesRequired(0.3, 0.1)).toBe(3);
    expect(packagesRequired(3, 1)).toBe(3);
  });

  it('odmítne neplatné množství', () => {
    expect(() => packagesRequired(0, 250)).toThrow(/quantityBase/);
    expect(() => packagesRequired(-5, 250)).toThrow(/quantityBase/);
    expect(() => packagesRequired(500, 0)).toThrow(/packageAmount/);
  });
});

describe('lineCost (spec §10.4)', () => {
  it('PACKAGE: 500 g másla po 250 g baleních = 2 balení', () => {
    expect(lineCost(500, butterLidl)).toEqual({
      packages: 2,
      lineTotalMinor: 10980,
      unitPriceMinor: 21960,
    });
  });

  it('WEIGHT: 2 kg kuřecích prsou po 129 Kč/kg = 258 Kč', () => {
    expect(lineCost(2000, chickenLidl)).toEqual({
      packages: null,
      lineTotalMinor: 25800,
      unitPriceMinor: 12900,
    });
  });

  it('WEIGHT: částečné množství je proporcionální (750 g)', () => {
    expect(lineCost(750, chickenLidl).lineTotalMinor).toBe(9675);
  });

  it('WEIGHT: nezaokrouhluje na celá kila (1,2 kg)', () => {
    expect(lineCost(1200, chickenLidl).lineTotalMinor).toBe(15480);
  });

  it('odmítne neplatné vstupy', () => {
    expect(() => lineCost(0, butterLidl)).toThrow(/quantityBase/);
    expect(() => lineCost(500, { ...butterLidl, packageAmount: 0 })).toThrow(/packageAmount/);
    expect(() => lineCost(500, { ...butterLidl, priceMinor: 54.9 })).toThrow(/haléřích/);
  });
});
