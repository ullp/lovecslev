import { DomainError } from '../errors';
import { optimizePurchase, type OptimizationResult, type OfferInput, type OptimizerItem } from '../optimizer';
import { EXPECTED, OFFERS, SHOPPING_LIST } from './fixtures/mvpFixture';

function lineFor(result: OptimizationResult, productId: string) {
  const line = result.variantA?.items.find((item) => item.productId === productId);
  if (line === undefined) throw new Error(`Chybí řádek ${productId}`);
  return line;
}

function chainLine(result: OptimizationResult, chainCode: string, productId: string) {
  const chain = result.variantB.chains.find((item) => item.chainCode === chainCode);
  const line = chain?.items.find((item) => item.productId === productId);
  if (line === undefined) throw new Error(`Chybí řádek ${chainCode}/${productId}`);
  return line;
}

describe('optimizePurchase — golden fixture (spec §19.6)', () => {
  const result = optimizePurchase({ items: SHOPPING_LIST, offers: OFFERS });

  it('Varianta A = LIDL za 646,90 Kč', () => {
    expect(result.variantA).not.toBeNull();
    expect(result.variantA?.chainCode).toBe(EXPECTED.variantAChain);
    expect(result.variantA?.totalMinor).toBe(EXPECTED.variantATotalMinor);
    expect(result.variantA?.items).toHaveLength(5);
    expect(result.variantAReason).toBeNull();
  });

  it('ceny řádků Varianty A odpovídají fixture', () => {
    expect(lineFor(result, 'prd_mleko').lineTotalMinor).toBe(EXPECTED.lineCosts.LIDL.prd_mleko);
    expect(lineFor(result, 'prd_maslo').lineTotalMinor).toBe(EXPECTED.lineCosts.LIDL.prd_maslo);
    expect(lineFor(result, 'prd_kureci_prsa').lineTotalMinor).toBe(EXPECTED.lineCosts.LIDL.prd_kureci_prsa);
    expect(lineFor(result, 'prd_banany').lineTotalMinor).toBe(EXPECTED.lineCosts.LIDL.prd_banany);
    expect(lineFor(result, 'prd_toaletni_papir').lineTotalMinor).toBe(EXPECTED.lineCosts.LIDL.prd_toaletni_papir);
  });

  it('počty balení odpovídají §19.5', () => {
    expect(lineFor(result, 'prd_mleko').packages).toBe(6);
    expect(lineFor(result, 'prd_maslo').packages).toBe(2);
    expect(lineFor(result, 'prd_toaletni_papir').packages).toBe(1);
    expect(lineFor(result, 'prd_kureci_prsa').packages).toBeNull();
  });

  it('Varianta B = LIDL + KAUFLAND za 596,90 Kč', () => {
    expect(result.variantB.chains.map((chain) => chain.chainCode)).toEqual(['KAUFLAND', 'LIDL']);
    expect(result.variantB.totalMinor).toBe(EXPECTED.variantBTotalMinor);
    expect(result.variantB.totalWithoutPenaltyMinor).toBe(EXPECTED.variantBTotalMinor);
  });

  it('subtally řetězců odpovídají fixture', () => {
    const subtotals = Object.fromEntries(
      result.variantB.chains.map((chain) => [chain.chainCode, chain.subtotalMinor]),
    );
    expect(subtotals).toEqual({ KAUFLAND: 15970, LIDL: 43720 });
  });

  it('řádky Varianty B jdou za nejlevnějším řetězcem', () => {
    expect(chainLine(result, 'KAUFLAND', 'prd_maslo').lineTotalMinor).toBe(8980);
    expect(chainLine(result, 'KAUFLAND', 'prd_toaletni_papir').lineTotalMinor).toBe(6990);
    expect(chainLine(result, 'LIDL', 'prd_mleko').lineTotalMinor).toBe(11940);
    expect(chainLine(result, 'LIDL', 'prd_kureci_prsa').lineTotalMinor).toBe(25800);
    expect(chainLine(result, 'LIDL', 'prd_banany').lineTotalMinor).toBe(5980);
  });

  it('úspora 50,00 Kč a doporučení Varianty B', () => {
    expect(result.savingsMinor).toBe(EXPECTED.savingsMinor);
    expect(result.recommendedVariant).toBe('B');
    expect(result.variantA!.totalMinor - result.variantB.totalMinor).toBe(EXPECTED.savingsMinor);
  });

  it('jednotkové ceny se počítají z balení (ne z absolutní ceny)', () => {
    expect(chainLine(result, 'KAUFLAND', 'prd_maslo').unitPriceMinor).toBe(EXPECTED.unitPrices.masloKaufland);
    expect(chainLine(result, 'LIDL', 'prd_kureci_prsa').unitPriceMinor).toBe(EXPECTED.unitPrices.kureciLidl);
    expect(chainLine(result, 'KAUFLAND', 'prd_toaletni_papir').unitPriceMinor).toBe(EXPECTED.unitPrices.papirKaufland);
  });

  it('žádné warningy a správná meta data', () => {
    expect(result.warnings).toEqual([]);
    expect(result.meta).toEqual({ maxStores: 3, tripPenaltyMinor: 0, chainsEvaluated: 4 });
  });
});

describe('pokrytí a výjimky (spec §5 F4, §11.3)', () => {
  it('BILLA sama nestačí na Variantu A (chybí toaletní papír)', () => {
    const offers = OFFERS.filter((offer) => offer.chainCode === 'BILLA');
    const result = optimizePurchase({ items: SHOPPING_LIST, offers });

    expect(result.variantA).toBeNull();
    expect(result.variantAReason).toBe('NO_SINGLE_STORE');
    expect(result.warnings).toEqual([
      { code: 'ITEM_UNAVAILABLE', productId: 'prd_toaletni_papir', rawText: 'Toaletní papír' },
    ]);
    expect(result.variantB.totalMinor).toBe(EXPECTED.singleStoreTotals.BILLA);
    expect(result.recommendedVariant).toBe('B');
    expect(result.savingsMinor).toBe(0);
  });

  it('nerozpoznaná položka se vyloučí s ITEM_NOT_MATCHED a výpočet neselže', () => {
    const items: OptimizerItem[] = [
      { productId: 'prd_maslo', quantityBase: 500 },
      { productId: null, quantityBase: 1000, rawText: 'xyz123' },
    ];
    const result = optimizePurchase({ items, offers: OFFERS });

    expect(result.warnings).toEqual([{ code: 'ITEM_NOT_MATCHED', productId: null, rawText: 'xyz123' }]);
    expect(result.variantA?.items).toHaveLength(1);
    expect(result.variantA?.totalMinor).toBe(8980);
  });

  it('žádná hodnotitelná položka → NO_ELIGIBLE_ITEMS, prázdný plán', () => {
    const result = optimizePurchase({
      items: [{ productId: null, quantityBase: 1000, rawText: 'nesmysl' }],
      offers: OFFERS,
    });

    expect(result.variantA).toBeNull();
    expect(result.variantAReason).toBe('NO_ELIGIBLE_ITEMS');
    expect(result.variantB).toEqual({ totalMinor: 0, totalWithoutPenaltyMinor: 0, chains: [] });
    expect(result.savingsMinor).toBe(0);
  });

  it('produkt bez nabídky → ITEM_UNAVAILABLE', () => {
    const result = optimizePurchase({
      items: [{ productId: 'prd_neexistuje', quantityBase: 1000 }],
      offers: OFFERS,
    });
    expect(result.warnings).toEqual([
      { code: 'ITEM_UNAVAILABLE', productId: 'prd_neexistuje', rawText: null },
    ]);
    expect(result.variantAReason).toBe('NO_ELIGIBLE_ITEMS');
  });

  it('duplicitní nabídka: vyhrává nižší cena', () => {
    const original = OFFERS.find((offer) => offer.productId === 'prd_maslo' && offer.chainCode === 'LIDL');
    if (original === undefined) throw new Error('Fixture neobsahuje LIDL máslo');

    const result = optimizePurchase({
      items: [{ productId: 'prd_maslo', quantityBase: 500 }],
      offers: [original, { ...original, priceMinor: 4990 }],
    });
    expect(result.variantA?.totalMinor).toBe(9980);
  });

  it('duplicitní nabídka: při stejné ceně vyhrává větší balení', () => {
    const small = OFFERS.find((offer) => offer.productId === 'prd_maslo' && offer.chainCode === 'LIDL');
    if (small === undefined) throw new Error('Fixture neobsahuje LIDL máslo');

    const result = optimizePurchase({
      items: [{ productId: 'prd_maslo', quantityBase: 500 }],
      offers: [small, { ...small, packageAmount: 500 }],
    });
    // 500 g balení za stejnou cenu -> stačí 1 balení místo 2.
    expect(result.variantA?.items[0]?.packages).toBe(1);
    expect(result.variantA?.totalMinor).toBe(small.priceMinor);
  });

  it('warningy jsou seřazené deterministicky (kód, produkt, text)', () => {
    const items: OptimizerItem[] = [
      { productId: null, quantityBase: 1000, rawText: 'zzz' },
      { productId: 'prd_neexistuje', quantityBase: 1000, rawText: 'aaa' },
      { productId: null, quantityBase: 1000, rawText: 'aaa' },
    ];

    const forward = optimizePurchase({ items, offers: OFFERS });
    const reversed = optimizePurchase({ items: [...items].reverse(), offers: OFFERS });

    expect(forward.warnings).toEqual(reversed.warnings);
    expect(forward.warnings.map((warning) => warning.code)).toEqual([
      'ITEM_NOT_MATCHED',
      'ITEM_NOT_MATCHED',
      'ITEM_UNAVAILABLE',
    ]);
    expect(forward.warnings.map((warning) => warning.rawText)).toEqual(['aaa', 'zzz', 'aaa']);
  });
});

/** Deterministický PRNG (mulberry32) — testy nesmí být flaky. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

describe('determinismus (spec §11.6)', () => {
  it('100 permutací vstupu dá identický výsledek', () => {
    const reference = JSON.stringify(optimizePurchase({ items: SHOPPING_LIST, offers: OFFERS }));
    const random = mulberry32(20261020);

    for (let iteration = 0; iteration < 100; iteration += 1) {
      const result = optimizePurchase({
        items: shuffle(SHOPPING_LIST, random),
        offers: shuffle(OFFERS, random),
      });
      expect(JSON.stringify(result)).toBe(reference);
    }
  });
});

describe('penalizace cesty a maxStores (spec §11.1, §11.4, §11.5, D17)', () => {
  it('maxStores = 1 zakáže kombinaci obchodů (B == A)', () => {
    const result = optimizePurchase({ items: SHOPPING_LIST, offers: OFFERS, options: { maxStores: 1 } });

    expect(result.variantB.chains.map((chain) => chain.chainCode)).toEqual(['LIDL']);
    expect(result.variantB.totalMinor).toBe(EXPECTED.variantATotalMinor);
    expect(result.savingsMinor).toBe(0);
    expect(result.recommendedVariant).toBe('A');
  });

  it('penalizace 60 Kč za druhý obchod doporučí jeden obchod a úspora je 0', () => {
    const result = optimizePurchase({
      items: SHOPPING_LIST,
      offers: OFFERS,
      options: { tripPenaltyMinor: 6000 },
    });

    // 2 obchody: 59 690 + 6 000 = 65 690 > 1 obchod: 64 690 -> vrací se Varianta A jako plán B.
    expect(result.variantB.chains.map((chain) => chain.chainCode)).toEqual(['LIDL']);
    expect(result.variantB.totalWithoutPenaltyMinor).toBe(EXPECTED.variantATotalMinor);
    expect(result.variantB.totalMinor).toBe(EXPECTED.variantATotalMinor);
    expect(result.savingsMinor).toBe(0);
    expect(result.recommendedVariant).toBe('A');
    expect(result.meta.tripPenaltyMinor).toBe(6000);
  });

  it('malá penalizace (30 Kč) zachová kombinaci a sníží úsporu', () => {
    const result = optimizePurchase({
      items: SHOPPING_LIST,
      offers: OFFERS,
      options: { tripPenaltyMinor: 3000 },
    });

    expect(result.variantB.chains.map((chain) => chain.chainCode)).toEqual(['KAUFLAND', 'LIDL']);
    expect(result.variantB.totalWithoutPenaltyMinor).toBe(EXPECTED.variantBTotalMinor);
    expect(result.variantB.totalMinor).toBe(EXPECTED.variantBTotalMinor + 3000);
    expect(result.savingsMinor).toBe(EXPECTED.variantATotalMinor - (EXPECTED.variantBTotalMinor + 3000));
    expect(result.recommendedVariant).toBe('B');
  });

  it('úspora nikdy není negativní', () => {
    const result = optimizePurchase({
      items: SHOPPING_LIST,
      offers: OFFERS,
      options: { tripPenaltyMinor: 10000 },
    });
    expect(result.savingsMinor).toBeGreaterThanOrEqual(0);
  });

  it('neplatné options vyhodí INVALID_OPTIMIZER_INPUT', () => {
    const run = (options: { maxStores?: number; tripPenaltyMinor?: number }) =>
      optimizePurchase({ items: SHOPPING_LIST, offers: OFFERS, options });

    expect(() => run({ maxStores: 0 })).toThrow(/maxStores/);
    expect(() => run({ maxStores: 6 })).toThrow(/maxStores/);
    expect(() => run({ maxStores: 2.5 })).toThrow(/maxStores/);
    expect(() => run({ tripPenaltyMinor: -1 })).toThrow(/tripPenaltyMinor/);
    expect(() => run({ tripPenaltyMinor: 10001 })).toThrow(/tripPenaltyMinor/);
  });

  it('neplatné nabídky vyhodí doménovou chybu', () => {
    const base: OfferInput = {
      productId: 'prd_maslo',
      chainCode: 'LIDL',
      priceMinor: 5490,
      packageAmount: 250,
      baseUnit: 'G',
      pricingMode: 'PACKAGE',
    };
    const call = (offer: OfferInput) => () =>
      optimizePurchase({ items: [{ productId: 'prd_maslo', quantityBase: 500 }], offers: [offer] });

    expect(call({ ...base, priceMinor: 0 })).toThrow(/Cena musí být/);
    expect(call({ ...base, priceMinor: 54.9 })).toThrow(/haléřích/);
    expect(call({ ...base, packageAmount: 0 })).toThrow(/packageAmount/);
    expect(call({ ...base, productId: '  ' })).toThrow(DomainError);
  });
});

describe('tie-break (spec §11.6)', () => {
  const offer = (productId: string, chainCode: string, priceMinor: number): OfferInput => ({
    productId,
    chainCode,
    priceMinor,
    packageAmount: 1000,
    baseUnit: 'G',
    pricingMode: 'PACKAGE',
  });

  it('při shodné ceně vyhrává abecedně první řetězec', () => {
    const result = optimizePurchase({
      items: [{ productId: 'p1', quantityBase: 1000 }],
      offers: [offer('p1', 'LIDL', 1000), offer('p1', 'ALBERT', 1000)],
    });

    expect(result.variantA?.chainCode).toBe('ALBERT');
    expect(result.variantB.chains.map((chain) => chain.chainCode)).toEqual(['ALBERT']);
  });

  it('při shodné ceně vyhrává méně obchodů', () => {
    const result = optimizePurchase({
      items: [
        { productId: 'p1', quantityBase: 1000 },
        { productId: 'p2', quantityBase: 1000 },
      ],
      offers: [
        offer('p1', 'ALBERT', 1000),
        offer('p2', 'BILLA', 1000),
        offer('p1', 'KAUFLAND', 1000),
        offer('p2', 'KAUFLAND', 1000),
      ],
    });

    expect(result.variantB.chains).toHaveLength(1);
    expect(result.variantB.chains[0]?.chainCode).toBe('KAUFLAND');
    expect(result.variantB.totalMinor).toBe(2000);
  });
});

describe('výkon (spec §15.1)', () => {
  it('30 položek × 10 řetězců se spočítá do 500 ms', () => {
    const chains = ['ALBERT', 'BILLA', 'COOP', 'GLOBUS', 'KAUFLAND', 'LIDL', 'NORMA', 'PENNY', 'TESCO', 'XXL'];
    const offers: OfferInput[] = [];
    const items: OptimizerItem[] = [];

    for (let index = 0; index < 30; index += 1) {
      const productId = `p${index}`;
      items.push({ productId, quantityBase: 1000 });
      chains.forEach((chainCode, chainIndex) => {
        offers.push({
          productId,
          chainCode,
          priceMinor: 1000 + index * 10 + chainIndex * 7,
          packageAmount: 1000,
          baseUnit: 'G',
          pricingMode: 'WEIGHT',
        });
      });
    }

    const started = Date.now();
    const result = optimizePurchase({ items, offers });
    const duration = Date.now() - started;

    expect(result.variantA).not.toBeNull();
    expect(duration).toBeLessThan(500);
  });
});
