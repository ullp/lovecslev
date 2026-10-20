import { Inject, Injectable } from '@nestjs/common';
import {
  DomainError,
  PLAN_LIMITS,
  matchProduct,
  normalizeQuery,
  optimizePurchase,
  type BaseUnit,
  type OfferInput,
  type OptimizerWarning,
} from '@slevari/shared';
import {
  CATALOG_REPOSITORY,
  SEARCH_PORT,
  type CatalogRepository,
  type SearchPort,
} from '../catalog/catalog.repository';
import { todayInPrague } from '../common/date';
import { HOUSEHOLD_ACCESS, type HouseholdAccess } from '../households/households.types';
import { applyPlanGating } from '../optimizer/plan-gate';
import type { OptimizeResponse } from '../optimizer/optimizer.types';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { LISTS_REPOSITORY, type ListsRepository } from './lists.repository';
import type { ListItemRecord, ListRecord, ListSummary } from './lists.types';

export interface AddItemRequest {
  readonly rawText: string;
  readonly quantityBase?: number;
}

export interface UpdateItemRequest {
  readonly productId?: string;
  readonly quantityBase?: number;
}

export interface OptimizeListOptions {
  /** `YYYY-MM-DD`; default dnešní datum v Europe/Prague (spec §13.2). */
  readonly date?: string;
  readonly maxStores?: number;
  readonly tripPenaltyMinor?: number;
  readonly includeVariantB?: boolean;
}

export interface ListDetail {
  readonly id: string;
  readonly name: string;
  readonly isShared: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly items: readonly ListItemRecord[];
}

const MAX_RAW_TEXT = 255;

/** F3 + F4 nad uloženým seznamem (spec §5, §13.2). */
@Injectable()
export class ListsService {
  constructor(
    @Inject(LISTS_REPOSITORY) private readonly lists: ListsRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(SEARCH_PORT) private readonly search: SearchPort,
    private readonly subscriptions: SubscriptionsService,
    @Inject(HOUSEHOLD_ACCESS) private readonly households: HouseholdAccess,
  ) {}

  async list(userId: string): Promise<readonly ListSummary[]> {
    return this.lists.listSummaries(userId);
  }

  async create(
    userId: string,
    name: string | undefined,
    householdId: string | null = null,
  ): Promise<ListRecord> {
    const plan = await this.subscriptions.getPlan(userId);
    const existing = await this.lists.countLists(userId);
    const limit = PLAN_LIMITS[plan].maxLists;

    if (existing >= limit) {
      throw new DomainError('PLAN_LIMIT_REACHED', `Tarif ${plan} umožňuje ${limit} seznam(y)`, {
        plan,
        limit,
      });
    }

    if (householdId !== null) {
      const member = await this.households.isMember(userId, householdId);
      if (!member) {
        throw new DomainError('NOT_FOUND', `Domácnost ${householdId} neexistuje`, { householdId });
      }
    }

    return this.lists.create({
      ownerUserId: userId,
      name: name?.trim() || 'Můj nákup',
      householdId,
    });
  }

  async get(userId: string, listId: string): Promise<ListDetail> {
    const list = await this.requireList(userId, listId);
    return {
      id: list.id,
      name: list.name,
      isShared: list.isShared,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      items: await this.lists.listItems(list.id),
    };
  }

  async rename(userId: string, listId: string, name: string): Promise<void> {
    await this.requireList(userId, listId);
    await this.lists.rename(listId, name.trim());
  }

  async remove(userId: string, listId: string): Promise<void> {
    await this.requireList(userId, listId);
    await this.lists.softDelete(listId);
  }

  /**
   * Přidání položky: volný text se ULOŽÍ VŽDY, matching jen doplní produkt (spec §5 F3 pravidlo 4).
   */
  async addItem(userId: string, listId: string, request: AddItemRequest): Promise<ListItemRecord> {
    const list = await this.requireList(userId, listId);
    const plan = await this.subscriptions.getPlan(userId);
    const itemCount = await this.lists.countItems(list.id);
    const limit = PLAN_LIMITS[plan].maxItemsPerList;

    if (itemCount >= limit) {
      throw new DomainError('PLAN_LIMIT_REACHED', `Tarif ${plan} umožňuje ${limit} položek v seznamu`, {
        plan,
        limit,
      });
    }

    const rawText = request.rawText.trim();
    if (rawText === '' || rawText.length > MAX_RAW_TEXT) {
      throw new DomainError('VALIDATION_ERROR', `Text položky musí mít 1–${MAX_RAW_TEXT} znaků`, {
        rawText,
      });
    }
    if (request.quantityBase !== undefined && request.quantityBase <= 0) {
      throw new DomainError('VALIDATION_ERROR', 'Množství musí být kladné', {
        quantityBase: request.quantityBase,
      });
    }

    const normalized = normalizeQuery(rawText);
    const candidates = normalized.length >= 2 ? await this.search.findCandidates(normalized, 10) : [];
    const match = matchProduct(normalized, candidates);
    const matched = candidates.find((candidate) => candidate.productId === match.productId);
    const baseUnit: BaseUnit = matched?.baseUnit ?? 'PCS';

    return this.lists.addItem({
      listId: list.id,
      rawText,
      productId: match.productId,
      quantityBase: request.quantityBase ?? (baseUnit === 'PCS' ? 1 : 1000),
      baseUnit,
      matchStatus:
        match.status === 'RESOLVED_AUTO'
          ? 'RESOLVED_AUTO'
          : match.status === 'SUGGESTED'
            ? 'SUGGESTED'
            : 'UNRESOLVED',
      matchMethod: match.method === 'NONE' ? 'NONE' : match.method,
      matchConfidence: match.confidence,
    });
  }

  /** Potvrzení/oprava shody uživatelem (spec §5 F3 pravidlo 3). */
  async updateItem(
    userId: string,
    listId: string,
    itemId: string,
    patch: UpdateItemRequest,
  ): Promise<ListItemRecord> {
    await this.requireList(userId, listId);
    const item = await this.requireItem(listId, itemId);

    if (patch.quantityBase !== undefined && patch.quantityBase <= 0) {
      throw new DomainError('VALIDATION_ERROR', 'Množství musí být kladné', { ...patch });
    }
    if (patch.productId === undefined) {
      return patch.quantityBase === undefined
        ? item
        : this.lists.updateItem(item.id, { quantityBase: patch.quantityBase });
    }

    const product = await this.catalog.findProduct(patch.productId);
    if (product === null) {
      throw new DomainError('NOT_FOUND', `Produkt ${patch.productId} neexistuje`, {
        productId: patch.productId,
      });
    }

    return this.lists.updateItem(item.id, {
      productId: product.productId,
      baseUnit: product.baseUnit,
      quantityBase: patch.quantityBase ?? (product.baseUnit === 'PCS' ? 1 : 1000),
      matchStatus: 'RESOLVED_CONFIRMED',
      matchMethod: 'USER',
      matchConfidence: 1,
    });
  }

  async removeItem(userId: string, listId: string, itemId: string): Promise<void> {
    await this.requireList(userId, listId);
    const item = await this.requireItem(listId, itemId);
    await this.lists.deleteItem(item.id);
  }

  /**
   * F4 nad uloženým seznamem: ceny z DB, optimalizace z domény, tarif ze subscriptions (D18).
   */
  async optimize(
    userId: string,
    listId: string,
    options: OptimizeListOptions,
  ): Promise<OptimizeResponse> {
    const list = await this.requireList(userId, listId);
    const plan = await this.subscriptions.getPlan(userId);
    const variantBAllowed = plan === 'PREMIUM' || process.env.FREE_VARIANT_B === 'true';

    if (options.includeVariantB === true && !variantBAllowed) {
      throw new DomainError('PREMIUM_REQUIRED', 'Kombinace obchodů je dostupná v tarifu Premium', {
        requiredPlan: 'PREMIUM',
      });
    }

    const items = await this.lists.listItems(list.id);
    const usable = items.filter(
      (item) =>
        item.productId !== null &&
        (item.matchStatus === 'RESOLVED_AUTO' || item.matchStatus === 'RESOLVED_CONFIRMED'),
    );
    const skipped = items.filter((item) => !usable.includes(item));

    const productIds = usable.map((item) => item.productId as string);
    const activeOn = options.date ?? todayInPrague();
    const offersByProduct = await this.catalog.findOffers(productIds, activeOn);
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

    const result = optimizePurchase({
      items: usable.map((item) => ({
        productId: item.productId,
        quantityBase: item.quantityBase,
        rawText: item.rawText,
      })),
      offers,
      options: {
        ...(options.maxStores === undefined ? {} : { maxStores: options.maxStores }),
        ...(options.tripPenaltyMinor === undefined
          ? {}
          : { tripPenaltyMinor: options.tripPenaltyMinor }),
      },
    });

    const gated = applyPlanGating(result, plan);
    const skippedWarnings: OptimizerWarning[] = skipped.map((item) => ({
      code: 'ITEM_NOT_MATCHED',
      productId: item.productId,
      rawText: item.rawText,
    }));

    return { ...gated, warnings: [...gated.warnings, ...skippedWarnings] };
  }

  private async requireList(userId: string, listId: string): Promise<ListRecord> {
    const list = await this.lists.find(listId);
    // Cizí seznam se hlásí jako neexistující (ochrana proti IDOR, spec §15.3).
    if (list === null) {
      throw new DomainError('NOT_FOUND', `Seznam ${listId} neexistuje`, { listId });
    }
    if (list.ownerUserId === userId) return list;

    // Sdílený seznam (P4): přístup má každý člen domácnosti.
    if (list.householdId !== null && (await this.households.isMember(userId, list.householdId))) {
      return list;
    }

    throw new DomainError('NOT_FOUND', `Seznam ${listId} neexistuje`, { listId });
  }

  private async requireItem(listId: string, itemId: string): Promise<ListItemRecord> {
    const item = await this.lists.findItem(itemId);
    if (item === null || item.listId !== listId) {
      throw new DomainError('NOT_FOUND', `Položka ${itemId} v seznamu neexistuje`, { itemId });
    }
    return item;
  }
}
