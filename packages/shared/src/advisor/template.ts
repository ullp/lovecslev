import type { AdvisorCatalogItem, AdvisorDraft, AdvisorItemSuggestion, AdvisorRequest } from './types';

/** Základní koš domácnosti — deterministický fallback bez LLM (spec §6 P1). */
const TEMPLATE_STAPLES: readonly { readonly keywords: readonly string[]; readonly quantityBase: number }[] = [
  { keywords: ['mleko', 'mléko'], quantityBase: 4000 },
  { keywords: ['maslo', 'máslo'], quantityBase: 500 },
  { keywords: ['kureci', 'kuřecí'], quantityBase: 2000 },
  { keywords: ['banan', 'banán'], quantityBase: 2000 },
  { keywords: ['toaletni', 'toaletní', 'papir', 'papír'], quantityBase: 8 },
  { keywords: ['ryze', 'rýže'], quantityBase: 1000 },
  { keywords: ['testovin', 'těstovin'], quantityBase: 1000 },
  { keywords: ['chleb', 'chléb'], quantityBase: 1 },
];

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Deterministický fallback: z katalogu vybere základní potraviny podle klíčových slov.
 * Používá se, když LLM není dostupná nebo vrátí nevalidní JSON — uživatel nikdy nesmí zůstat bez odpovědi.
 */
export function buildTemplateDraft(
  request: AdvisorRequest,
  catalog: readonly AdvisorCatalogItem[],
): AdvisorDraft {
  const byName = catalog.map((item) => ({ item, normalized: normalize(item.name) }));
  const items: AdvisorItemSuggestion[] = [];
  const used = new Set<string>();

  for (const staple of TEMPLATE_STAPLES) {
    const match = byName.find(
      ({ item, normalized }) =>
        !used.has(item.productId) &&
        staple.keywords.some((keyword) => normalized.includes(normalize(keyword))),
    );
    if (match === undefined) continue;

    used.add(match.item.productId);
    items.push({
      productId: match.item.productId,
      name: match.item.name,
      quantityBase: match.item.baseUnit === 'PCS' ? Math.max(1, staple.quantityBase) : staple.quantityBase,
      baseUnit: match.item.baseUnit,
    });
  }

  const explanation =
    'Základní koš domácnosti (šablona bez AI): mléko, máslo, maso, ovoce a drogerie. ' +
    (request.budgetMinor === undefined
      ? 'Rozpočet nebyl zadán.'
      : 'Rozpočet se ověřuje proti nejlevnější variantě.');

  return { items, explanation, source: 'TEMPLATE' };
}
