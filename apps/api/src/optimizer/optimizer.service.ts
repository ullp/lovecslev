import { Injectable } from '@nestjs/common';
import { optimizePurchase, type OfferInput, type OptimizerItem, type Plan } from '@lovecslev/shared';
import type { OptimizeRequestDto } from './dto/optimize-request.dto';
import { applyPlanGating } from './plan-gate';
import type { OptimizeResponse } from './optimizer.types';

/**
 * API vrstva optimalizace pro bezstavový preview endpoint (spec §11, §13.3).
 * Veškerá matematika je v @lovecslev/shared; tady se jen skládá odpověď.
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
        ...(request.tripPenaltyMinor === undefined
          ? {}
          : { tripPenaltyMinor: request.tripPenaltyMinor }),
      },
    });

    return applyPlanGating(result, plan);
  }
}
