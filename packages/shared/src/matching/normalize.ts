/**
 * Normalizace dotazu pro matching (spec §12.1 krok 1):
 * lower → bez diakritiky → interpunkce na mezery → sjednocení mezer.
 * Stejnou normalizaci používá DB (sloupec `products.search_text` je GENERATED s `unaccent` + `lower`).
 */
export function normalizeQuery(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function tokenize(input: string): string[] {
  const normalized = normalizeQuery(input);
  return normalized === '' ? [] : normalized.split(' ');
}

/** Sloučí název a brand do tvaru odpovídajícího `products.search_text`. */
export function buildSearchText(canonicalName: string, brand?: string | null): string {
  return normalizeQuery(brand ? `${canonicalName} ${brand}` : canonicalName);
}
