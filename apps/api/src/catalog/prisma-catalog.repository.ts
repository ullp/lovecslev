import { Injectable } from '@nestjs/common';
import { discountPercent, unitLabel, type BaseUnit, type PricingMode } from '@slevari/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CatalogRepository, LeafletProductsQuery } from './catalog.repository';
import type {
  ChainView,
  LeafletDetail,
  LeafletProductView,
  LeafletSummary,
  OfferView,
  PriceHistoryRow,
  ProductRecord,
} from './catalog.types';

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const toIso = (date: Date): string => date.toISOString().slice(0, 10);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

/** Čtecí strana katalogu (spec §5 F1/F2, §9). */
@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listChains(activeOn: string): Promise<readonly ChainView[]> {
    const date = toDate(activeOn);
    const chains = await this.prisma.chain.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        colorHex: true,
        isMvp: true,
        leaflets: {
          where: { validFrom: { lte: date }, validTo: { gte: date } },
          select: { id: true },
          take: 1,
        },
      },
    });

    return chains.map((chain) => ({
      id: chain.id,
      code: chain.code,
      name: chain.name,
      colorHex: chain.colorHex,
      isMvp: chain.isMvp,
      hasActiveLeaflet: chain.leaflets.length > 0,
    }));
  }

  async listLeaflets(activeOn: string, chainCode?: string): Promise<readonly LeafletSummary[]> {
    const date = toDate(activeOn);
    const leaflets = await this.prisma.leaflet.findMany({
      where: {
        validFrom: { lte: date },
        validTo: { gte: date },
        ...(chainCode === undefined ? {} : { chain: { code: chainCode } }),
      },
      orderBy: [{ chain: { code: 'asc' } }, { validTo: 'asc' }],
      select: {
        id: true,
        title: true,
        validFrom: true,
        validTo: true,
        chain: { select: { code: true, name: true, colorHex: true } },
        promotions: { select: { productId: true, priceMinor: true, regularPriceMinor: true } },
      },
    });

    return leaflets.map((leaflet) => {
      const discounts = leaflet.promotions
        .map((promotion) => discountPercent(promotion.priceMinor, promotion.regularPriceMinor))
        .filter((value): value is number => value !== null)
        .sort((a, b) => b - a)
        .slice(0, 3);

      return {
        id: leaflet.id,
        chainCode: leaflet.chain.code,
        chainName: leaflet.chain.name,
        colorHex: leaflet.chain.colorHex,
        title: leaflet.title,
        validFrom: toIso(leaflet.validFrom),
        validTo: toIso(leaflet.validTo),
        productCount: new Set(leaflet.promotions.map((promotion) => promotion.productId)).size,
        promotionCount: leaflet.promotions.length,
        topDiscounts: discounts,
      };
    });
  }

  async getLeaflet(leafletId: string, query: LeafletProductsQuery): Promise<LeafletDetail | null> {
    // Neplatný UUID by jinak shodil Prisma; chováme se jako „neexistuje“ (404 dle §13.4).
    if (!isUuid(leafletId)) return null;

    const leaflet = await this.prisma.leaflet.findUnique({
      where: { id: leafletId },
      select: {
        id: true,
        title: true,
        validFrom: true,
        validTo: true,
        chain: { select: { code: true, name: true } },
        promotions: {
          orderBy: { unitPriceMinor: 'asc' },
          select: {
            priceMinor: true,
            regularPriceMinor: true,
            unitPriceMinor: true,
            packageAmount: true,
            packageUnit: true,
            product: {
              select: { id: true, canonicalName: true, brand: true, category: true },
            },
          },
        },
      },
    });

    if (leaflet === null) return null;

    const categories = [
      ...new Set(leaflet.promotions.map((promotion) => promotion.product.category)),
    ].sort((a, b) => a.localeCompare(b, 'cs'));

    const filtered =
      query.category === undefined
        ? leaflet.promotions
        : leaflet.promotions.filter((promotion) => promotion.product.category === query.category);

    const start = (query.page - 1) * query.pageSize;
    const pageItems = filtered.slice(start, start + query.pageSize);

    const products: LeafletProductView[] = pageItems.map((promotion) => ({
      productId: promotion.product.id,
      name: promotion.product.canonicalName,
      brand: promotion.product.brand,
      category: promotion.product.category,
      priceMinor: promotion.priceMinor,
      regularPriceMinor: promotion.regularPriceMinor,
      discountPercent: discountPercent(promotion.priceMinor, promotion.regularPriceMinor),
      unitPriceMinor: promotion.unitPriceMinor,
      unitLabel: unitLabel(promotion.packageUnit as BaseUnit),
      packageAmount: Number(promotion.packageAmount),
      baseUnit: promotion.packageUnit as BaseUnit,
    }));

    return {
      id: leaflet.id,
      chainCode: leaflet.chain.code,
      chainName: leaflet.chain.name,
      title: leaflet.title,
      validFrom: toIso(leaflet.validFrom),
      validTo: toIso(leaflet.validTo),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
      categories,
      products,
    };
  }

  async findOffers(
    productIds: readonly string[],
    activeOn: string,
  ): Promise<ReadonlyMap<string, readonly OfferView[]>> {
    const result = new Map<string, OfferView[]>();
    if (productIds.length === 0) return result;

    const date = toDate(activeOn);
    const promotions = await this.prisma.promotion.findMany({
      where: {
        productId: { in: [...productIds] },
        leaflet: { validFrom: { lte: date }, validTo: { gte: date } },
      },
      select: {
        productId: true,
        priceMinor: true,
        regularPriceMinor: true,
        unitPriceMinor: true,
        packageAmount: true,
        packageUnit: true,
        pricingMode: true,
        scope: true,
        leaflet: { select: { validFrom: true, validTo: true } },
        chain: { select: { code: true, name: true, colorHex: true } },
      },
    });

    // Pro produkt+řetězec vyhrává nejnižší jednotková cena; při shodě lokální akce (STORE).
    const bestPerChain = new Map<string, (typeof promotions)[number]>();
    for (const promotion of promotions) {
      const key = `${promotion.productId}|${promotion.chain.code}`;
      const current = bestPerChain.get(key);
      if (
        current === undefined ||
        promotion.unitPriceMinor < current.unitPriceMinor ||
        (promotion.unitPriceMinor === current.unitPriceMinor &&
          promotion.scope === 'STORE' &&
          current.scope !== 'STORE')
      ) {
        bestPerChain.set(key, promotion);
      }
    }

    for (const promotion of bestPerChain.values()) {
      const offers = result.get(promotion.productId) ?? [];
      offers.push({
        productId: promotion.productId,
        chainCode: promotion.chain.code,
        chainName: promotion.chain.name,
        colorHex: promotion.chain.colorHex,
        priceMinor: promotion.priceMinor,
        regularPriceMinor: promotion.regularPriceMinor,
        discountPercent: discountPercent(promotion.priceMinor, promotion.regularPriceMinor),
        unitPriceMinor: promotion.unitPriceMinor,
        unitLabel: unitLabel(promotion.packageUnit as BaseUnit),
        packageAmount: Number(promotion.packageAmount),
        baseUnit: promotion.packageUnit as BaseUnit,
        pricingMode: promotion.pricingMode as PricingMode,
        validFrom: toIso(promotion.leaflet.validFrom),
        validTo: toIso(promotion.leaflet.validTo),
      });
      result.set(promotion.productId, offers);
    }

    for (const offers of result.values()) {
      offers.sort(
        (a, b) => a.unitPriceMinor - b.unitPriceMinor || (a.chainCode < b.chainCode ? -1 : 1),
      );
    }

    return result;
  }

  async findProduct(productId: string): Promise<ProductRecord | null> {
    if (!isUuid(productId)) return null;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, canonicalName: true, brand: true, category: true, baseUnit: true },
    });
    if (product === null) return null;

    return {
      productId: product.id,
      name: product.canonicalName,
      brand: product.brand,
      category: product.category,
      baseUnit: product.baseUnit,
    };
  }

  async findChainByCode(code: string): Promise<{ id: string; code: string } | null> {
    const chain = await this.prisma.chain.findFirst({
      where: { code, isActive: true },
      select: { id: true, code: true },
    });
    return chain;
  }

  async findPriceHistory(productId: string, from: string, to: string): Promise<readonly PriceHistoryRow[]> {
    if (!isUuid(productId)) return [];

    const [daily, monthly] = await Promise.all([
      this.prisma.priceHistoryPoint.findMany({
        where: { productId, date: { gte: toDate(from), lte: toDate(to) } },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          priceMinor: true,
          unitPriceMinor: true,
          packageAmount: true,
          packageUnit: true,
          chain: { select: { code: true, name: true } },
        },
      }),
      this.prisma.priceHistoryMonthly.findMany({
        where: { productId, month: { gte: toDate(from), lte: toDate(to) } },
        orderBy: { month: 'asc' },
        select: {
          month: true,
          avgUnitPriceMinor: true,
          chain: { select: { code: true, name: true } },
        },
      }),
    ]);

    const rows: PriceHistoryRow[] = daily.map((point) => ({
      date: toIso(point.date),
      chainCode: point.chain.code,
      chainName: point.chain.name,
      priceMinor: point.priceMinor,
      unitPriceMinor: point.unitPriceMinor,
      packageAmount: Number(point.packageAmount),
      baseUnit: point.packageUnit as BaseUnit,
      granularity: 'daily',
    }));

    for (const point of monthly) {
      rows.push({
        date: toIso(point.month),
        chainCode: point.chain.code,
        chainName: point.chain.name,
        priceMinor: null,
        unitPriceMinor: point.avgUnitPriceMinor,
        // Agregát nemá balení; 0 znamená „neznámé“ a nesmí vytvořit break.
        packageAmount: 0,
        baseUnit: 'PCS',
        granularity: 'monthly',
      });
    }

    return rows;
  }
}
