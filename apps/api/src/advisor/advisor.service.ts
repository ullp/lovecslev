import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DomainError,
  AdvisorParseError,
  buildAdvisorPrompt,
  buildTemplateDraft,
  optimizePurchase,
  parseAdvisorResponse,
  type AdvisorCatalogItem,
  type AdvisorDraft,
  type OfferInput,
} from '@lovecslev/shared';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../catalog/catalog.repository';
import { todayInPrague } from '../common/date';
import { applyPlanGating } from '../optimizer/plan-gate';
import type { OptimizeResponse } from '../optimizer/optimizer.types';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  ADVISOR_DAILY_LIMIT,
  ADVISOR_USAGE_REPOSITORY,
  LLM_CLIENT,
  type AdvisorUsageRepository,
  type LlmClient,
} from './advisor.types';

export interface AdvisorPlanRequest {
  readonly freeText: string;
  readonly budgetMinor?: number;
  /** `YYYY-MM-DD`; default dnešní datum (D24 — deterministické demo/testy). */
  readonly date?: string;
}

export interface AdvisorBudget {
  readonly budgetMinor: number | null;
  readonly feasible: boolean;
  readonly minimalMinor: number | null;
  readonly overByMinor: number;
}

export interface AdvisorPlanResponse {
  readonly items: AdvisorDraft['items'];
  readonly explanation: string;
  readonly optimization: OptimizeResponse;
  readonly budget: AdvisorBudget;
  readonly meta: {
    readonly source: 'LLM' | 'TEMPLATE';
    readonly llmModel: string;
    readonly llmAvailable: boolean;
    readonly fallbackReason: string | null;
    readonly dailyLimit: number;
    readonly usedToday: number;
  };
}

/**
 * AI nákupní poradce (spec §6 P1):
 * LLM navrhne položky POUZE z katalogu → server spočítá ceny a optimalizaci →
 * při výpadku/nevalidní odpovědi se použije deterministická šablona.
 */
@Injectable()
export class AdvisorService {
  private readonly logger = new Logger(AdvisorService.name);

  constructor(
    @Inject(ADVISOR_USAGE_REPOSITORY) private readonly usage: AdvisorUsageRepository,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async plan(userId: string, request: AdvisorPlanRequest): Promise<AdvisorPlanResponse> {
    // Rate-limit MUSÍ být vázaný na skutečný den, ne na datum cen (jinak jde obejít změnou `date`).
    const usageDay = todayInPrague();
    const activeOn = request.date ?? usageDay;
    const usage = await this.usage.incrementAndCheck(userId, usageDay, ADVISOR_DAILY_LIMIT);
    if (!usage.allowed) {
      throw new DomainError('RATE_LIMITED', `Denní limit ${ADVISOR_DAILY_LIMIT} dotazů vyčerpán`, {
        dailyLimit: ADVISOR_DAILY_LIMIT,
        used: usage.used,
      });
    }

    const products = await this.catalog.listProducts(200);
    const advisorCatalog: AdvisorCatalogItem[] = products.map((product) => ({
      productId: product.productId,
      name: product.name,
      baseUnit: product.baseUnit,
      category: product.category,
    }));

    let draft: AdvisorDraft;
    let fallbackReason: string | null = null;

    try {
      const raw = await this.llm.complete(buildAdvisorPrompt(request, advisorCatalog));
      draft = parseAdvisorResponse(raw, advisorCatalog);
    } catch (error) {
      fallbackReason =
        error instanceof AdvisorParseError
          ? `nevalidní odpověď LLM: ${error.message}`
          : error instanceof Error
            ? error.message
            : 'LLM nedostupná';
      this.logger.warn(`Poradce přechází na šablonu: ${fallbackReason}`);
      draft = buildTemplateDraft(request, advisorCatalog);
    }

    const usable = draft.items.filter(
      (item): item is typeof item & { productId: string } => item.productId !== null,
    );
    const offersByProduct = await this.catalog.findOffers(
      usable.map((item) => item.productId),
      activeOn,
    );

    const offers: OfferInput[] = [];
    for (const [productId, chainOffers] of offersByProduct) {
      for (const offer of chainOffers) {
        offers.push({
          productId,
          chainCode: offer.chainCode,
          priceMinor: offer.priceMinor,
          packageAmount: offer.packageAmount,
          baseUnit: offer.baseUnit,
          pricingMode: offer.pricingMode,
        });
      }
    }

    const optimizationResult = optimizePurchase({
      items: usable.map((item) => ({
        productId: item.productId,
        quantityBase: item.quantityBase,
        rawText: item.name,
      })),
      offers,
    });

    const plan = await this.subscriptions.getPlan(userId);
    const optimization = applyPlanGating(optimizationResult, plan);
    // Prázdná varianta B (žádná dostupná akce) nesmí tvrdit, že nákup stojí 0 Kč.
    const variantBTotal =
      optimization.variantB !== null && optimization.variantB.chains.length > 0
        ? optimization.variantB.totalMinor
        : null;
    // Nejnižší dostupná varianta (B bývá levnější než A, proto min, ne „první“).
    const totals = [optimization.variantA?.totalMinor, variantBTotal].filter(
      (value): value is number => typeof value === 'number',
    );
    const minimalMinor = totals.length === 0 ? null : Math.min(...totals);

    const budgetMinor = request.budgetMinor ?? null;
    const feasible = budgetMinor === null || (minimalMinor !== null && minimalMinor <= budgetMinor);

    return {
      items: draft.items,
      explanation: draft.explanation,
      optimization,
      budget: {
        budgetMinor,
        feasible,
        minimalMinor,
        overByMinor: budgetMinor !== null && minimalMinor !== null && minimalMinor > budgetMinor ? minimalMinor - budgetMinor : 0,
      },
      meta: {
        source: draft.source,
        llmModel: this.llm.model,
        llmAvailable: fallbackReason === null,
        fallbackReason,
        dailyLimit: ADVISOR_DAILY_LIMIT,
        usedToday: usage.used,
      },
    };
  }
}
