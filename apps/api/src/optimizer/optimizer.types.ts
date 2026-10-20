import type {
  OptimizerWarning,
  Plan,
  PurchasePlan,
  SingleStorePlan,
  VariantAReason,
} from '@slevari/shared';

export type { Plan };

export interface OptimizerMeta {
  readonly maxStores: number;
  readonly tripPenaltyMinor: number;
  readonly chainsEvaluated: number;
  /** Premium funkce nedostupné v tarifu (D18). */
  readonly lockedFeatures: readonly string[];
}

/** Odpověď API pro F4 (spec §13.3) — FREE dostane `variantB: null`. */
export interface OptimizeResponse {
  readonly variantA: SingleStorePlan | null;
  readonly variantAReason: VariantAReason | null;
  readonly variantB: PurchasePlan | null;
  readonly savingsMinor: number;
  readonly recommendedVariant: 'A' | 'B';
  readonly warnings: readonly OptimizerWarning[];
  readonly meta: OptimizerMeta;
}
