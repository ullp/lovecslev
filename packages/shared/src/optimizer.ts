import { DomainError } from './errors';
import { type Minor, assertMinor } from './money';
import { type LineCost, lineCost } from './pricing';
import type { BaseUnit, PricingMode } from './units';

/** Spec §11.1 — výchozí konfigurace optimalizace. */
export const DEFAULT_MAX_STORES = 3;
export const MAX_STORES_LIMIT = 5;
export const DEFAULT_TRIP_PENALTY_MINOR = 0;
export const TRIP_PENALTY_LIMIT_MINOR = 10_000;

export interface OfferInput {
  readonly productId: string;
  readonly chainCode: string;
  /** Cena za balení (u WEIGHT za 1000 base jednotek), celé haléře. */
  readonly priceMinor: Minor;
  readonly packageAmount: number;
  readonly baseUnit: BaseUnit;
  readonly pricingMode: PricingMode;
}

export interface OptimizerItem {
  /** `null` = položka seznamu nebyla rozpoznána (spec §5 F3) -> warning, ne chyba. */
  readonly productId: string | null;
  readonly quantityBase: number;
  readonly rawText?: string;
}

export interface OptimizerOptions {
  readonly maxStores?: number;
  readonly tripPenaltyMinor?: Minor;
}

export interface OptimizerInput {
  readonly items: readonly OptimizerItem[];
  readonly offers: readonly OfferInput[];
  readonly options?: OptimizerOptions;
}

export type WarningCode = 'ITEM_NOT_MATCHED' | 'ITEM_UNAVAILABLE';

export interface OptimizerWarning {
  readonly code: WarningCode;
  readonly productId: string | null;
  readonly rawText: string | null;
}

export interface PlanLine {
  readonly productId: string;
  readonly chainCode: string;
  readonly quantityBase: number;
  readonly packages: number | null;
  readonly lineTotalMinor: Minor;
  readonly unitPriceMinor: Minor;
}

export interface ChainPlan {
  readonly chainCode: string;
  readonly subtotalMinor: Minor;
  readonly items: readonly PlanLine[];
}

export interface SingleStorePlan {
  readonly chainCode: string;
  readonly totalMinor: Minor;
  readonly items: readonly PlanLine[];
}

export interface PurchasePlan {
  /** Včetně `tripPenaltyMinor` za každý další obchod (spec §11.4). */
  readonly totalMinor: Minor;
  /** Bez penalizace za cestu — pro transparentní UI (spec §11.5). */
  readonly totalWithoutPenaltyMinor: Minor;
  readonly chains: readonly ChainPlan[];
}

export type VariantAReason = 'NO_SINGLE_STORE' | 'NO_ELIGIBLE_ITEMS';

export interface OptimizationResult {
  readonly variantA: SingleStorePlan | null;
  readonly variantAReason: VariantAReason | null;
  readonly variantB: PurchasePlan;
  readonly savingsMinor: Minor;
  readonly recommendedVariant: 'A' | 'B';
  readonly warnings: readonly OptimizerWarning[];
  readonly meta: {
    readonly maxStores: number;
    readonly tripPenaltyMinor: Minor;
    readonly chainsEvaluated: number;
  };
}

interface ItemCost {
  readonly cost: LineCost;
  readonly offer: OfferInput;
}

interface EvaluableItem {
  readonly productId: string;
  readonly quantityBase: number;
  readonly byChain: ReadonlyMap<string, ItemCost>;
}

/**
 * Výpočet nejlevnějšího nákupu (spec §11) — čistá deterministická funkce.
 *
 * - Varianta A: nejlevnější jediný řetězec, který pokrývá VŠECHNY položky.
 * - Varianta B: nejlevnější kombinace 1..maxStores řetězců (+ tripPenaltyMinor za další obchod).
 * - Úspora nikdy není negativní; při shodě vyhrává méně obchodů, pak abecední pořadí.
 */
export function optimizePurchase(input: OptimizerInput): OptimizationResult {
  const maxStores = resolveMaxStores(input.options?.maxStores);
  const tripPenaltyMinor = resolveTripPenalty(input.options?.tripPenaltyMinor);

  const { evaluable, warnings, hasUnavailableItems } = resolveItems(input.items, input.offers);
  const chainsEvaluated = collectChains(input.offers.map((offer) => offer.chainCode)).length;

  if (evaluable.length === 0) {
    return {
      variantA: null,
      variantAReason: 'NO_ELIGIBLE_ITEMS',
      variantB: { totalMinor: 0, totalWithoutPenaltyMinor: 0, chains: [] },
      savingsMinor: 0,
      recommendedVariant: 'A',
      warnings,
      meta: { maxStores, tripPenaltyMinor, chainsEvaluated },
    };
  }

  const relevantChains = collectChains(evaluable.flatMap((item) => [...item.byChain.keys()]));

  // Striktní coverage (spec §11.3): Varianta A musí pokrýt CELÝ seznam.
  // Pokud některá položka není v žádném řetězci, žádný řetězec nemůže být Variantou A.
  const variantA = hasUnavailableItems ? null : findBestSingleStore(evaluable, relevantChains);
  const bestCombination = findBestCombination(evaluable, relevantChains, maxStores, tripPenaltyMinor);
  const variantB = buildPlan(bestCombination, evaluable, tripPenaltyMinor);

  const savingsMinor = variantA === null ? 0 : Math.max(0, variantA.totalMinor - variantB.totalMinor);
  const recommendedVariant: 'A' | 'B' = variantA === null ? 'B' : savingsMinor > 0 ? 'B' : 'A';

  return {
    variantA,
    variantAReason: variantA === null ? 'NO_SINGLE_STORE' : null,
    variantB,
    savingsMinor,
    recommendedVariant,
    warnings,
    meta: { maxStores, tripPenaltyMinor, chainsEvaluated },
  };
}

function resolveMaxStores(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_STORES;
  if (!Number.isInteger(value) || value < 1 || value > MAX_STORES_LIMIT) {
    throw new DomainError(
      'INVALID_OPTIMIZER_INPUT',
      `maxStores musí být celé číslo 1..${MAX_STORES_LIMIT}, dostal jsem ${String(value)}`,
      { maxStores: value },
    );
  }
  return value;
}

function resolveTripPenalty(value: Minor | undefined): Minor {
  if (value === undefined) return DEFAULT_TRIP_PENALTY_MINOR;
  if (!Number.isInteger(value) || value < 0 || value > TRIP_PENALTY_LIMIT_MINOR) {
    throw new DomainError(
      'INVALID_OPTIMIZER_INPUT',
      `tripPenaltyMinor musí být celé číslo 0..${TRIP_PENALTY_LIMIT_MINOR}, dostal jsem ${String(value)}`,
      { tripPenaltyMinor: value },
    );
  }
  return value;
}

/**
 * Rozdělí položky na hodnotitelné (mají produkt a alespoň jednu nabídku)
 * a warningy pro zbytek. Položky se nikdy „nevymýšlí“ (spec §5 F4 pravidla 5–6).
 */
function resolveItems(
  items: readonly OptimizerItem[],
  offers: readonly OfferInput[],
): { evaluable: EvaluableItem[]; warnings: OptimizerWarning[]; hasUnavailableItems: boolean } {
  const offersByProduct = new Map<string, Map<string, OfferInput>>();

  for (const offer of offers) {
    validateOffer(offer);
    let byChain = offersByProduct.get(offer.productId);
    if (byChain === undefined) {
      byChain = new Map<string, OfferInput>();
      offersByProduct.set(offer.productId, byChain);
    }
    const current = byChain.get(offer.chainCode);
    if (current === undefined || isBetterOffer(offer, current)) {
      byChain.set(offer.chainCode, offer);
    }
  }

  const evaluable: EvaluableItem[] = [];
  const warnings: OptimizerWarning[] = [];
  let hasUnavailableItems = false;

  for (const item of items) {
    if (item.productId === null) {
      warnings.push({ code: 'ITEM_NOT_MATCHED', productId: null, rawText: item.rawText ?? null });
      continue;
    }
    const byChain = offersByProduct.get(item.productId);
    if (byChain === undefined || byChain.size === 0) {
      hasUnavailableItems = true;
      warnings.push({ code: 'ITEM_UNAVAILABLE', productId: item.productId, rawText: item.rawText ?? null });
      continue;
    }
    const costs = new Map<string, ItemCost>();
    for (const [chainCode, offer] of byChain) {
      costs.set(chainCode, { cost: lineCost(item.quantityBase, offer), offer });
    }
    evaluable.push({ productId: item.productId, quantityBase: item.quantityBase, byChain: costs });
  }

  // Warningy musí být deterministické bez ohledu na pořadí vstupu (spec §11.6).
  warnings.sort(
    (a, b) =>
      compareChainCodes(a.code, b.code) ||
      compareChainCodes(a.productId ?? '', b.productId ?? '') ||
      compareChainCodes(a.rawText ?? '', b.rawText ?? ''),
  );

  return { evaluable, warnings, hasUnavailableItems };
}

function validateOffer(offer: OfferInput): void {
  assertMinor(offer.priceMinor, 'offer.priceMinor');
  if (offer.priceMinor <= 0) {
    throw new DomainError('INVALID_PRICE', `Cena musí být > 0, dostal jsem ${String(offer.priceMinor)}`, {
      priceMinor: offer.priceMinor,
    });
  }
  if (offer.productId.trim() === '' || offer.chainCode.trim() === '') {
    throw new DomainError('INVALID_OPTIMIZER_INPUT', 'productId a chainCode musí být neprázdné', {});
  }
  if (!Number.isFinite(offer.packageAmount) || offer.packageAmount <= 0) {
    throw new DomainError(
      'INVALID_PACKAGE_AMOUNT',
      `packageAmount musí být > 0, dostal jsem ${String(offer.packageAmount)}`,
      { packageAmount: offer.packageAmount },
    );
  }
}

/** Při duplicitní nabídce (stejný produkt + řetězec) vyhrává nižší cena, pak větší balení. */
function isBetterOffer(candidate: OfferInput, current: OfferInput): boolean {
  if (candidate.priceMinor !== current.priceMinor) return candidate.priceMinor < current.priceMinor;
  return candidate.packageAmount > current.packageAmount;
}

function collectChains(codes: readonly string[]): string[] {
  return [...new Set(codes)].sort((a, b) => compareChainCodes(a, b));
}

function compareChainCodes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function findBestSingleStore(evaluable: readonly EvaluableItem[], chains: readonly string[]): SingleStorePlan | null {
  let bestChain: string | null = null;
  let bestTotal = 0;

  for (const chainCode of chains) {
    let total = 0;
    let coversAll = true;
    for (const item of evaluable) {
      const found = item.byChain.get(chainCode);
      if (found === undefined) {
        coversAll = false;
        break;
      }
      total += found.cost.lineTotalMinor;
    }
    if (!coversAll) continue;
    if (bestChain === null || total < bestTotal) {
      bestChain = chainCode;
      bestTotal = total;
    }
  }

  if (bestChain === null) return null;

  const items: PlanLine[] = [];
  for (const item of evaluable) {
    const found = item.byChain.get(bestChain);
    if (found === undefined) continue; // typová pojistka, coverage už byla ověřena
    items.push(toPlanLine(item, bestChain, found));
  }
  // Kanonické pořadí výstupu — nezávisí na pořadí vstupu (spec §11.6).
  items.sort((a, b) => compareChainCodes(a.productId, b.productId));

  return { chainCode: bestChain, totalMinor: bestTotal, items };
}

interface Combination {
  readonly codes: readonly string[];
  readonly rawTotalMinor: Minor;
  readonly scoreMinor: Minor;
}

function findBestCombination(
  evaluable: readonly EvaluableItem[],
  chains: readonly string[],
  maxStores: number,
  tripPenaltyMinor: Minor,
): Combination {
  let best: Combination | null = null;

  for (let size = 1; size <= Math.min(maxStores, chains.length); size += 1) {
    for (const codes of combinations(chains, size)) {
      const rawTotal = totalForChains(evaluable, codes);
      if (rawTotal === null) continue;
      const candidate: Combination = {
        codes,
        rawTotalMinor: rawTotal,
        scoreMinor: rawTotal + tripPenaltyMinor * (size - 1),
      };
      if (best === null || isBetterCombination(candidate, best)) {
        best = candidate;
      }
    }
  }

  return best ?? { codes: [], rawTotalMinor: 0, scoreMinor: 0 };
}

/** Součet nejlevnějších cen položek v rámci podmnožiny řetězců; `null` = podmnožina nepokrývá vše. */
function totalForChains(evaluable: readonly EvaluableItem[], codes: readonly string[]): Minor | null {
  let total = 0;
  for (const item of evaluable) {
    let cheapest: Minor | null = null;
    for (const code of codes) {
      const found = item.byChain.get(code);
      if (found === undefined) continue;
      if (cheapest === null || found.cost.lineTotalMinor < cheapest) {
        cheapest = found.cost.lineTotalMinor;
      }
    }
    if (cheapest === null) return null;
    total += cheapest;
  }
  return total;
}

/** Tie-break (spec §11.6): cena -> méně obchodů -> abecedně dle kódu řetězce. */
function isBetterCombination(candidate: Combination, current: Combination): boolean {
  if (candidate.scoreMinor !== current.scoreMinor) return candidate.scoreMinor < current.scoreMinor;
  if (candidate.codes.length !== current.codes.length) return candidate.codes.length < current.codes.length;
  return compareChainCodes(candidate.codes.join(','), current.codes.join(',')) < 0;
}

function buildPlan(
  best: Combination,
  evaluable: readonly EvaluableItem[],
  tripPenaltyMinor: Minor,
): PurchasePlan {
  const sortedCodes = [...best.codes].sort((a, b) => compareChainCodes(a, b));
  const byChain = new Map<string, PlanLine[]>();
  let rawTotal = 0;

  for (const item of evaluable) {
    let chosenChain: string | null = null;
    let chosen: ItemCost | null = null;
    for (const code of sortedCodes) {
      const found = item.byChain.get(code);
      if (found === undefined) continue;
      if (chosen === null || found.cost.lineTotalMinor < chosen.cost.lineTotalMinor) {
        chosen = found;
        chosenChain = code;
      }
    }
    if (chosen === null || chosenChain === null) continue;
    rawTotal += chosen.cost.lineTotalMinor;
    const lines = byChain.get(chosenChain) ?? [];
    lines.push(toPlanLine(item, chosenChain, chosen));
    byChain.set(chosenChain, lines);
  }

  const chains: ChainPlan[] = [...byChain.entries()]
    .sort((a, b) => compareChainCodes(a[0], b[0]))
    .map(([chainCode, lines]) => ({
      chainCode,
      subtotalMinor: lines.reduce((acc, line) => acc + line.lineTotalMinor, 0),
      // Kanonické pořadí řádků (spec §11.6).
      items: [...lines].sort((x, y) => compareChainCodes(x.productId, y.productId)),
    }));

  const penalty = tripPenaltyMinor * Math.max(0, chains.length - 1);
  return { totalMinor: rawTotal + penalty, totalWithoutPenaltyMinor: rawTotal, chains };
}

function toPlanLine(item: EvaluableItem, chainCode: string, found: ItemCost): PlanLine {
  return {
    productId: item.productId,
    chainCode,
    quantityBase: item.quantityBase,
    packages: found.cost.packages,
    lineTotalMinor: found.cost.lineTotalMinor,
    unitPriceMinor: found.cost.unitPriceMinor,
  };
}

function combinations<T>(values: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (size > values.length) return [];
  const result: T[][] = [];
  const current: T[] = [];

  const walk = (start: number): void => {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let index = start; index < values.length; index += 1) {
      const value = values[index];
      if (value === undefined) continue;
      current.push(value);
      walk(index + 1);
      current.pop();
    }
  };

  walk(0);
  return result;
}


