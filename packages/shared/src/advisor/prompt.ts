import type { AdvisorCatalogItem, AdvisorRequest } from './types';

/**
 * Prompt pro LLM (spec §6 P1). Striktně omezuje výběr na katalogové `productId`
 * a zakazuje vymýšlet ceny — ceny počítá server z DB.
 */
export function buildAdvisorPrompt(
  request: AdvisorRequest,
  catalog: readonly AdvisorCatalogItem[],
): string {
  const catalogLines = catalog.map(
    (item) => `- ${item.productId} | ${item.name} | ${item.category} | baseUnit=${item.baseUnit}`,
  );

  const budget =
    request.budgetMinor === undefined
      ? 'Rozpočet není zadán.'
      : `Rozpočet: ${(request.budgetMinor / 100).toFixed(2)} Kč.`;

  return [
    'Jsi nákupní poradce pro českou domácnost.',
    'Z požadavku uživatele sestav nákupní seznam POUZE z nabídnutého katalogu.',
    'Pravidla:',
    '1. Odpověz výhradně validním JSON, bez markdownu a bez komentářů.',
    '2. Tvar: {"items":[{"productId":"...","quantity":<number>}],"explanation":"<max 500 znaků>"}',
    '3. productId MUSÍ být přesně z katalogu níže; nic nevymýšlej.',
    '4. quantity je v base jednotce produktu (ML, G, PCS) a musí být > 0.',
    '5. Ceny neuváděj — spočítá je server.',
    budget,
    `Požadavek uživatele: ${request.freeText}`,
    'Katalog:',
    ...catalogLines,
  ].join('\n');
}
