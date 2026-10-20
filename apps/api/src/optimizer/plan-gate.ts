import type { OptimizationResult, Plan } from '@slevari/shared';
import type { OptimizeResponse } from './optimizer.types';

/**
 * Vynucení tarifu na jednom místě (D18, spec §7 pravidlo 5).
 * FREE: jen Varianta A, úspora 0, `lockedFeatures: ["VARIANT_B"]`.
 */
export function applyPlanGating(result: OptimizationResult, plan: Plan): OptimizeResponse {
  const meta = { ...result.meta, lockedFeatures: plan === 'PREMIUM' ? [] : ['VARIANT_B'] };

  if (plan === 'PREMIUM') {
    return {
      variantA: result.variantA,
      variantAReason: result.variantAReason,
      variantB: result.variantB,
      savingsMinor: result.savingsMinor,
      recommendedVariant: result.recommendedVariant,
      warnings: result.warnings,
      meta,
    };
  }

  return {
    variantA: result.variantA,
    variantAReason: result.variantAReason,
    variantB: null,
    savingsMinor: 0,
    recommendedVariant: 'A',
    warnings: result.warnings,
    meta,
  };
}
