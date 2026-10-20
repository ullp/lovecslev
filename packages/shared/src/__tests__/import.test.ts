import { discountPercent, mapLeaflet } from '../import/mapper';
import type { LeafletImportDto } from '../import/types';
import { CATEGORIES, validateLeaflet } from '../import/validator';

const CHAINS = ['LIDL', 'KAUFLAND', 'ALBERT', 'BILLA'];

function leaflet(overrides: Partial<LeafletImportDto> = {}): LeafletImportDto {
  return {
    chain: 'LIDL',
    validFrom: '2026-10-14',
    validTo: '2026-10-20',
    products: [
      {
        name: 'Mléko polotučné',
        brand: 'Madeta',
        price: 19.9,
        regularPrice: 24.9,
        packageAmount: 1,
        packageUnit: 'l',
        category: 'Mléčné výrobky',
      },
      {
        name: 'Kuřecí prsa',
        price: 129,
        packageAmount: 1,
        packageUnit: 'kg',
        pricing: 'WEIGHT',
        category: 'Maso a ryby',
      },
    ],
    ...overrides,
  };
}

function codes(dto: LeafletImportDto): string[] {
  return validateLeaflet(dto, CHAINS).issues.map((issue) => issue.code);
}

describe('validateLeaflet (spec §14.2)', () => {
  it('platný leták projde', () => {
    expect(validateLeaflet(leaflet(), CHAINS)).toEqual({ ok: true, issues: [] });
  });

  it('1 — neznámý/neaktivní řetězec', () => {
    expect(codes(leaflet({ chain: 'PENNY' }))).toContain('INVALID_CHAIN');
  });

  it('2 — obrácená platnost', () => {
    expect(codes(leaflet({ validFrom: '2026-10-21', validTo: '2026-10-20' }))).toContain('INVALID_VALIDITY');
  });

  it('2 — platnost delší než 31 dní', () => {
    expect(codes(leaflet({ validFrom: '2026-10-01', validTo: '2026-11-15' }))).toContain('INVALID_VALIDITY');
  });

  it('2 — špatný formát data', () => {
    expect(codes(leaflet({ validFrom: '14.10.2026' }))).toContain('INVALID_VALIDITY');
  });

  it('3 — cena nula, záporná nebo nad limit', () => {
    const withPrice = (price: number): LeafletImportDto =>
      leaflet({
        products: [{ name: 'Máslo', price, packageAmount: 250, packageUnit: 'g', category: 'Mléčné výrobky' }],
      });

    expect(codes(withPrice(0))).toContain('INVALID_PRICE');
    expect(codes(withPrice(-5))).toContain('INVALID_PRICE');
    expect(codes(withPrice(100_001))).toContain('INVALID_PRICE');
  });

  it('4 — regularPrice musí být větší než price', () => {
    const dto = leaflet({
      products: [{ name: 'Máslo', price: 49.9, regularPrice: 49.9, packageAmount: 250, packageUnit: 'g' }],
    });
    expect(codes(dto)).toContain('INVALID_REGULAR_PRICE');
  });

  it('5 — neplatná jednotka', () => {
    const dto = leaflet({
      products: [{ name: 'Máslo', price: 49.9, packageAmount: 250, packageUnit: 'libra' as 'g' }],
    });
    expect(codes(dto)).toContain('INVALID_UNIT');
  });

  it('5 — vážené zboží v kusech nedává smysl', () => {
    const dto = leaflet({
      products: [{ name: 'Toaletní papír', price: 69.9, packageAmount: 8, packageUnit: 'role', pricing: 'WEIGHT' }],
    });
    expect(codes(dto)).toContain('INVALID_UNIT');
  });

  it('6 — prázdný nebo příliš dlouhý název', () => {
    expect(
      codes(leaflet({ products: [{ name: '   ', price: 10, packageAmount: 1, packageUnit: 'ks' }] })),
    ).toContain('INVALID_PRODUCT_NAME');
    expect(
      codes(leaflet({ products: [{ name: 'x'.repeat(256), price: 10, packageAmount: 1, packageUnit: 'ks' }] })),
    ).toContain('INVALID_PRODUCT_NAME');
  });

  it('7 — duplicitní produkt se stejným balením', () => {
    const product = { name: 'Máslo', price: 49.9, packageAmount: 250, packageUnit: 'g' as const };
    expect(codes(leaflet({ products: [product, { ...product }] }))).toContain('DUPLICATE_PRODUCT');
  });

  it('stejný název s jiným balením je povolený', () => {
    const dto = leaflet({
      products: [
        { name: 'Máslo', price: 49.9, packageAmount: 250, packageUnit: 'g' },
        { name: 'Máslo', price: 89.9, packageAmount: 500, packageUnit: 'g' },
      ],
    });
    expect(validateLeaflet(dto, CHAINS).ok).toBe(true);
  });

  it('8 — neznámá kategorie není chyba (normalizuje se na Ostatní)', () => {
    const dto = leaflet({
      products: [{ name: 'Něco', price: 10, packageAmount: 1, packageUnit: 'ks', category: 'Neznámá' }],
    });
    expect(validateLeaflet(dto, CHAINS).ok).toBe(true);
    expect(mapLeaflet(dto).normalizedCategoryCount).toBe(1);
  });

  it('bez produktů = strukturální chyba', () => {
    expect(codes(leaflet({ products: [] }))).toContain('INVALID_STRUCTURE');
  });

  it('vrací všechny chyby najednou, ne jen první', () => {
    const dto = leaflet({
      chain: 'PENNY',
      validFrom: '2026-10-21',
      validTo: '2026-10-20',
      products: [{ name: '', price: 0, packageAmount: 0, packageUnit: 'g' }],
    });
    const result = validateLeaflet(dto, CHAINS);
    expect(result.ok).toBe(false);
    expect(new Set(result.issues.map((issue) => issue.code))).toEqual(
      new Set(['INVALID_CHAIN', 'INVALID_VALIDITY', 'INVALID_PRODUCT_NAME', 'INVALID_PRICE', 'INVALID_UNIT']),
    );
  });
});

describe('mapLeaflet (spec §10.2, §10.3)', () => {
  const mapped = mapLeaflet(leaflet());

  it('převede ceny na haléře a dopočítá jednotkové ceny', () => {
    const [milk, chicken] = mapped.leaflet.products;
    expect(milk?.priceMinor).toBe(1990);
    expect(milk?.regularPriceMinor).toBe(2490);
    expect(milk?.baseUnit).toBe('ML');
    expect(milk?.packageAmount).toBe(1000);
    expect(milk?.unitPriceMinor).toBe(1990);

    expect(chicken?.baseUnit).toBe('G');
    expect(chicken?.pricingMode).toBe('WEIGHT');
    expect(chicken?.unitPriceMinor).toBe(12900);
  });

  it('dopočítá titulek a mapuje řetězec', () => {
    expect(mapped.leaflet.title).toBe('Leták LIDL 2026-10-14');
    expect(mapped.leaflet.sourceUrl).toBeNull();
    expect(mapped.leaflet.chainCode).toBe('LIDL');
  });

  it('brand: prázdný řetězec se ukládá jako null', () => {
    const result = mapLeaflet(
      leaflet({
        products: [
          { name: 'Banány', brand: '  ', price: 29.9, packageAmount: 1, packageUnit: 'kg', pricing: 'WEIGHT' },
        ],
      }),
    );
    expect(result.leaflet.products[0]?.brand).toBeNull();
  });

  it('neznámá kategorie se normalizuje na Ostatní a počítá se', () => {
    const result = mapLeaflet(
      leaflet({ products: [{ name: 'Něco', price: 10, packageAmount: 1, packageUnit: 'ks', category: 'Blbost' }] }),
    );
    expect(result.leaflet.products[0]?.category).toBe('Ostatní');
    expect(result.normalizedCategoryCount).toBe(1);
  });

  it('známé kategorie zůstávají', () => {
    expect(CATEGORIES).toContain('Drogerie');
    expect(mapped.normalizedCategoryCount).toBe(0);
  });
});

describe('discountPercent (spec §9.7)', () => {
  it('počítá slevu v procentech', () => {
    expect(discountPercent(1990, 2490)).toBe(20);
    expect(discountPercent(6990, 8990)).toBe(22);
  });

  it('bez běžné ceny nebo při nesmyslných datech vrací null', () => {
    expect(discountPercent(1990, null)).toBeNull();
    expect(discountPercent(2490, 2490)).toBeNull();
    expect(discountPercent(2490, 1990)).toBeNull();
  });
});
