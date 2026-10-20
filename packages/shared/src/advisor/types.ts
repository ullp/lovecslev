import type { BaseUnit } from '../units';

/** Vstup poradce (spec §6 P1). */
export interface AdvisorRequest {
  readonly freeText: string;
  /** Volitelný rozpočet v haléřích. */
  readonly budgetMinor?: number;
}

/** Položka navržená LLM/šablonou po napárování na katalog. */
export interface AdvisorItemSuggestion {
  /** `null` = produkt se nepodařilo napárovat (půjde do warnings). */
  readonly productId: string | null;
  readonly name: string;
  readonly quantityBase: number;
  readonly baseUnit: BaseUnit;
}

export interface AdvisorDraft {
  readonly items: readonly AdvisorItemSuggestion[];
  readonly explanation: string;
  readonly source: 'LLM' | 'TEMPLATE';
}

/** Produkt z katalogu, ze kterého smí LLM vybírat (NESMÍ vymýšlet nové). */
export interface AdvisorCatalogItem {
  readonly productId: string;
  readonly name: string;
  readonly baseUnit: BaseUnit;
  readonly category: string;
}

export const ADVISOR_MAX_EXPLANATION = 500;
export const ADVISOR_MAX_ITEMS = 30;

export class AdvisorParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvisorParseError';
  }
}

/**
 * Striktní parser LLM odpovědi (spec §6 P1): `{ items: [{ productId, quantity }], explanation }`.
 * Produkty MUSÍ existovat v katalogu, který jsme LLM dali — cokoli jiného se zahodí.
 */
export function parseAdvisorResponse(raw: string, catalog: readonly AdvisorCatalogItem[]): AdvisorDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AdvisorParseError('Odpověď LLM není platný JSON');
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new AdvisorParseError('Odpověď LLM musí být objekt');
  }

  const candidate = parsed as { items?: unknown; explanation?: unknown };
  if (!Array.isArray(candidate.items)) {
    throw new AdvisorParseError('Odpověď LLM nemá pole items');
  }

  const byId = new Map(catalog.map((item) => [item.productId, item]));
  const items: AdvisorItemSuggestion[] = [];
  const seen = new Set<string>();

  for (const rawItem of candidate.items) {
    if (rawItem === null || typeof rawItem !== 'object') continue;
    const item = rawItem as { productId?: unknown; quantity?: unknown };
    if (typeof item.productId !== 'string') continue;

    const known = byId.get(item.productId);
    if (known === undefined) continue; // halucinovaný produkt → ignorovat
    if (seen.has(item.productId)) continue;

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    seen.add(item.productId);
    items.push({
      productId: known.productId,
      name: known.name,
      quantityBase: Math.round(quantity),
      baseUnit: known.baseUnit,
    });

    if (items.length >= ADVISOR_MAX_ITEMS) break;
  }

  if (items.length === 0) {
    throw new AdvisorParseError('LLM nevrátila žádnou použitelnou položku z katalogu');
  }

  const explanation =
    typeof candidate.explanation === 'string' ? candidate.explanation.slice(0, ADVISOR_MAX_EXPLANATION) : '';

  return { items, explanation, source: 'LLM' };
}
