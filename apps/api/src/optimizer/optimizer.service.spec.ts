import { EXPECTED, OFFERS, SHOPPING_LIST } from '@slevari/shared';
import { OptimizerService } from './optimizer.service';
import type { OptimizeRequestDto } from './dto/optimize-request.dto';

function buildRequest(overrides: Partial<OptimizeRequestDto> = {}): OptimizeRequestDto {
  return {
    items: SHOPPING_LIST.map((item) => ({
      productId: item.productId,
      quantityBase: item.quantityBase,
      ...(item.rawText === undefined ? {} : { rawText: item.rawText }),
    })),
    offers: OFFERS.map((offer) => ({ ...offer })),
    ...overrides,
  };
}

describe('OptimizerService (spec §11, §13.3, D18)', () => {
  const service = new OptimizerService();

  describe('PREMIUM', () => {
    const result = service.optimize(buildRequest(), 'PREMIUM');

    it('vrací Variantu A i B s úsporou', () => {
      expect(result.variantA?.chainCode).toBe(EXPECTED.variantAChain);
      expect(result.variantA?.totalMinor).toBe(EXPECTED.variantATotalMinor);
      expect(result.variantB?.totalMinor).toBe(EXPECTED.variantBTotalMinor);
      expect(result.savingsMinor).toBe(EXPECTED.savingsMinor);
      expect(result.recommendedVariant).toBe('B');
      expect(result.meta.lockedFeatures).toEqual([]);
    });

    it('rozpad kombinace odpovídá fixture', () => {
      const chains = result.variantB?.chains ?? [];
      expect(chains.map((chain) => chain.chainCode)).toEqual(['KAUFLAND', 'LIDL']);
      expect(chains[0]?.subtotalMinor).toBe(EXPECTED.variantBSplit.KAUFLAND);
      expect(chains[1]?.subtotalMinor).toBe(EXPECTED.variantBSplit.LIDL);
    });

    it('předává maxStores a penalizaci do domény', () => {
      const gated = service.optimize(
        buildRequest({ maxStores: 1, tripPenaltyMinor: 3000 }),
        'PREMIUM',
      );
      expect(gated.variantB?.chains.map((chain) => chain.chainCode)).toEqual(['LIDL']);
      expect(gated.meta.tripPenaltyMinor).toBe(3000);
      expect(gated.meta.maxStores).toBe(1);
    });
  });

  describe('FREE (D18)', () => {
    const result = service.optimize(buildRequest(), 'FREE');

    it('dostane pouze Variantu A', () => {
      expect(result.variantA?.totalMinor).toBe(EXPECTED.variantATotalMinor);
      expect(result.variantB).toBeNull();
      expect(result.savingsMinor).toBe(0);
      expect(result.recommendedVariant).toBe('A');
    });

    it('nese příznak zamčené funkce', () => {
      expect(result.meta.lockedFeatures).toEqual(['VARIANT_B']);
    });
  });

  it('propouští warningy pro nerozpoznané položky', () => {
    const result = service.optimize(
      buildRequest({
        items: [
          { productId: 'prd_maslo', quantityBase: 500 },
          { productId: null, quantityBase: 1000, rawText: 'xyz123' },
        ],
      }),
      'PREMIUM',
    );

    expect(result.warnings).toEqual([
      { code: 'ITEM_NOT_MATCHED', productId: null, rawText: 'xyz123' },
    ]);
    expect(result.variantA?.items).toHaveLength(1);
  });
});
