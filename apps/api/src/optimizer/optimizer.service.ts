import { Injectable } from '@nestjs/common';
import {
  optimizePurchase,
  type OfferInput,
  type OptimizerItem,
  type OptimizerWarning,
  type PurchasePlan,
  type SingleStorePlan,
  type VariantAReason,
} from '@slevari/shared';
import type { OptimizeRequestDto } from './dto/optimize-request.dto';

export type Plan = 'FREE' | 'PREMIUM';

export interface OptimizerMeta {
  readonly maxStores: number;
  readonly tripPenaltyMinor: number;
  readonly chainsEvaluated: number;
  /** Premium funkce, které nejsou v tomto tarifu dostupné (D18). */
  readonly lockedFeatures: readonly string[];
}

export interface OptimizeResponse {
  readonly variantA: SingleStorePlan | null;
  readonly variantAReason: VariantAReason | null;
  readonly variantB: PurchasePlan | null;
  readonly savingsMinor: number;
  readonly recommendedVariant: 'A' | 'B';
  readonly warnings: readonly OptimizerWarning[];
  readonly meta: OptimizerMeta;
}

/**
 * API vrstva optimalizace (spec §11, §13.3) + vynucení tarifu (D18).
 * Veškerá matematika je v @slevari/shared; tady se jen skládá odpověď.
 */
@Injectable()
export class OptimizerService {
  optimize(request: OptimizeRequestDto, plan: Plan): OptimizeResponse {
    const items: OptimizerItem[] = request.items.map((item) => ({
      productId: item.productId ?? null,
      quantityBase: item.quantityBase,
      ...(item.rawText === undefined ? {} : { rawText: item.rawText }),
    }));

    const offers: OfferInput[] = request.offers.map((offer) => ({
      productId: offer.productId,
      chainCode: offer.chainCode,
      priceMinor: offer.priceMinor,
      packageAmount: offer.packageAmount,
      baseUnit: offer.baseUnit,
      pricingMode: offer.pricingMode,
    }));

    const result = optimizePurchase({
      items,
      offers,
      options: {
        ...(request.maxStores === undefined ? {} : { maxStores: request.maxStores }),
        ...(request.tripPenaltyMinor === undefined ? {} : { tripPenaltyMinor: request.tripPenaltyMinor }),
      },
    });

    const meta: OptimizerMeta = { ...result.meta, lockedFeatures: plan === 'PREMIUM' ? [] : ['VARIANT_B'] };

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

    // FREE (D18): pouze Varianta A, bez úspory a bez rozpadu kombinace.
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
}
