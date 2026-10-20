import {
  EDIT_DISTANCE_CONFIDENCE,
  MATCH_AUTO_THRESHOLD,
  MATCH_SUGGEST_THRESHOLD,
  matchProduct,
  type MatchCandidate,
} from '../matching/match';
import { buildSearchText, normalizeQuery, tokenize } from '../matching/normalize';
import { bestWordSimilarity, damerauLevenshtein, trigramSimilarity } from '../matching/similarity';

const CANDIDATES: readonly MatchCandidate[] = [
  {
    productId: 'prd_mleko',
    canonicalName: 'Mléko polotučné',
    brand: 'Madeta',
    aliases: ['mliko', 'mleko'],
  },
  {
    productId: 'prd_toaletni_papir',
    canonicalName: 'Toaletní papír 8 rolí',
    brand: 'Zewa',
    aliases: ['toaletak', 'toaletni papir', 'papir'],
  },
  {
    productId: 'prd_coca_cola',
    canonicalName: 'Coca-Cola Original 1.5 l',
    brand: 'Coca-Cola',
    aliases: ['coca cola', 'cocacola'],
  },
  { productId: 'prd_maslo', canonicalName: 'Máslo', brand: 'Madeta' },
  { productId: 'prd_kureci_prsa', canonicalName: 'Kuřecí prsa', brand: null },
];

describe('normalizeQuery (spec §12.1 krok 1)', () => {
  it('odstraní diakritiku, interpunkci a sjednotí mezery', () => {
    expect(normalizeQuery('Mléko, polotučné')).toBe('mleko polotucne');
    expect(normalizeQuery('  Coca-Cola   Original ')).toBe('coca cola original');
    expect(normalizeQuery('Coca-Cola Original 1.5 l')).toBe('coca cola original 1 5 l');
  });

  it('tokenizuje prázdný vstup jako prázdné pole', () => {
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('Kuřecí prsa')).toEqual(['kureci', 'prsa']);
  });

  it('buildSearchText odpovídá tvaru products.search_text', () => {
    expect(buildSearchText('Mléko polotučné', 'Madeta')).toBe('mleko polotucne madeta');
    expect(buildSearchText('Banány', null)).toBe('banany');
  });
});

describe('trigramSimilarity (kompatibilita s pg_trgm)', () => {
  it('dává stejná čísla jako naměřené hodnoty v Postgresu', () => {
    // spec §12.1 — similarity('mliko','mleko') = 0.333
    expect(trigramSimilarity('mliko', 'mleko')).toBeCloseTo(0.333, 2);
    expect(trigramSimilarity('kureci prsa', 'kureci prsa')).toBe(1);
    expect(trigramSimilarity('maslo', 'maslo')).toBe(1);
  });

  it('nesrovnává nesouvisející slova', () => {
    expect(trigramSimilarity('banany', 'papirova taska')).toBe(0);
    expect(trigramSimilarity('', 'cokoli')).toBe(0);
  });
});

describe('bestWordSimilarity (obdoba pg_trgm word_similarity)', () => {
  it('najde shodu dotazu na část názvu', () => {
    expect(bestWordSimilarity('coca cola', 'coca cola original 1 5 l')).toBe(1);
    expect(bestWordSimilarity('maslo', 'maslo madeta')).toBe(1);
    expect(bestWordSimilarity('mliko', 'mleko polotucne madeta')).toBeCloseTo(0.333, 2);
  });

  it('u nesouvisejícího dotazu zůstává pod prahem pro nabídku', () => {
    expect(bestWordSimilarity('pivo', 'mleko polotucne')).toBeLessThan(MATCH_SUGGEST_THRESHOLD);
  });
});

describe('damerauLevenshtein', () => {
  it('počítá překlep a transpozici jako 1 operaci', () => {
    expect(damerauLevenshtein('mliko', 'mleko')).toBe(1);
    expect(damerauLevenshtein('masol', 'maslo')).toBe(1);
    expect(damerauLevenshtein('maslo', 'maslo')).toBe(0);
    expect(damerauLevenshtein('', 'abc')).toBe(3);
  });
});

describe('matchProduct (spec §12.1)', () => {
  it('exact match po normalizaci (diakritika i velikost písmen)', () => {
    expect(matchProduct('Máslo', CANDIDATES)).toMatchObject({
      productId: 'prd_maslo',
      method: 'EXACT',
      confidence: 1,
      status: 'RESOLVED_AUTO',
    });
    expect(matchProduct('KUŘECÍ PRSA', CANDIDATES).productId).toBe('prd_kureci_prsa');
  });

  it('alias match pro hovorový výraz', () => {
    expect(matchProduct('toaleťák', CANDIDATES)).toMatchObject({
      productId: 'prd_toaletni_papir',
      method: 'ALIAS',
      status: 'RESOLVED_AUTO',
      matchedOn: 'toaletak',
    });
  });

  it('alias match pro značku', () => {
    expect(matchProduct('Coca cola', CANDIDATES)).toMatchObject({
      productId: 'prd_coca_cola',
      method: 'ALIAS',
      status: 'RESOLVED_AUTO',
    });
  });

  it('překlep bez aliasu vyřeší edit-distance pravidlo (0.90, AUTO)', () => {
    const withoutAliases: MatchCandidate[] = [
      { productId: 'prd_mleko', canonicalName: 'Mléko polotučné', brand: 'Madeta' },
    ];
    const result = matchProduct('mliko', withoutAliases);

    expect(result).toMatchObject({
      productId: 'prd_mleko',
      method: 'TRIGRAM',
      confidence: EDIT_DISTANCE_CONFIDENCE,
      status: 'RESOLVED_AUTO',
    });
  });

  it('nesouvisející dotaz = UNRESOLVED bez produktu', () => {
    expect(matchProduct('xyz123', CANDIDATES)).toEqual({
      productId: null,
      method: 'NONE',
      confidence: 0,
      status: 'UNRESOLVED',
      matchedOn: null,
    });
    expect(matchProduct('   ', CANDIDATES).status).toBe('UNRESOLVED');
  });

  it('výsledek nezávisí na pořadí kandidátů (determinismus)', () => {
    const forward = matchProduct('mleko', CANDIDATES);
    const reversed = matchProduct('mleko', [...CANDIDATES].reverse());
    expect(forward).toEqual(reversed);
  });

  it('při shodě confidence vyhrává nižší productId', () => {
    const twins: MatchCandidate[] = [
      { productId: 'prd_b', canonicalName: 'Mléko polotučné' },
      { productId: 'prd_a', canonicalName: 'Mléko polotučné' },
    ];
    expect(matchProduct('Mléko polotučné', twins).productId).toBe('prd_a');
  });

  it('prahy odpovídají spec §12.1', () => {
    expect(MATCH_AUTO_THRESHOLD).toBe(0.6);
    expect(MATCH_SUGGEST_THRESHOLD).toBe(0.4);
    expect(EDIT_DISTANCE_CONFIDENCE).toBe(0.9);
  });
});
