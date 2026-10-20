import { Injectable } from '@nestjs/common';
import {
  LeafletSource,
  PriceHistorySource,
  PromotionScope,
  type Prisma,
} from '@prisma/client';
import type {
  LeafletRepository,
  LeafletWrite,
  PromotionWrite,
  StoredLeaflet,
  WriteResult,
} from './leaflet.repository';
import { PrismaService } from '../prisma/prisma.service';

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** Datumové rozsahy v UTC (spec §0.6) — bez tohohle by se `date` posunul o časové pásmo. */
function daysBetween(fromIso: string, toIso: string): Date[] {
  const days: Date[] = [];
  const end = toDate(toIso).getTime();
  for (let time = toDate(fromIso).getTime(); time <= end; time += 86_400_000) {
    days.push(new Date(time));
  }
  return days;
}

/** Prisma implementace portu (spec §9, §14.3). Veškerá práce s DB je tady. */
@Injectable()
export class PrismaLeafletRepository implements LeafletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveChainCodes(): Promise<readonly string[]> {
    const chains = await this.prisma.chain.findMany({
      where: { isActive: true },
      select: { code: true },
      orderBy: { code: 'asc' },
    });
    return chains.map((chain) => chain.code);
  }

  async findChainIdByCode(code: string): Promise<string | null> {
    const chain = await this.prisma.chain.findFirst({
      where: { code, isActive: true },
      select: { id: true },
    });
    return chain?.id ?? null;
  }

  async findLeaflet(chainId: string, validFrom: string, validTo: string): Promise<StoredLeaflet | null> {
    return this.prisma.leaflet.findUnique({
      where: { chainId_validFrom_validTo: { chainId, validFrom: toDate(validFrom), validTo: toDate(validTo) } },
      select: { id: true, checksum: true },
    });
  }

  async countPromotionsOfPreviousLeaflet(chainId: string, beforeValidFrom: string): Promise<number> {
    const previous = await this.prisma.leaflet.findFirst({
      where: { chainId, validFrom: { lt: toDate(beforeValidFrom) } },
      orderBy: { validFrom: 'desc' },
      select: { _count: { select: { promotions: true } } },
    });
    return previous?._count.promotions ?? 0;
  }

  async replaceLeaflet(input: LeafletWrite): Promise<WriteResult> {
    return this.prisma.$transaction(async (tx) => {
      const leaflet = await tx.leaflet.upsert({
        where: {
          chainId_validFrom_validTo: {
            chainId: input.chainId,
            validFrom: toDate(input.validFrom),
            validTo: toDate(input.validTo),
          },
        },
        create: {
          chainId: input.chainId,
          title: input.title,
          validFrom: toDate(input.validFrom),
          validTo: toDate(input.validTo),
          checksum: input.checksum,
          source: input.source as LeafletSource,
          sourceUrl: input.sourceUrl,
        },
        update: {
          title: input.title,
          checksum: input.checksum,
          source: input.source as LeafletSource,
          sourceUrl: input.sourceUrl,
          importedAt: new Date(),
        },
        select: { id: true },
      });

      // Nahrazení v jedné transakci — nikdy nesmí zůstat částečný stav (spec §14.3 bod 4).
      await tx.promotion.deleteMany({ where: { leafletId: leaflet.id } });

      let productsCreated = 0;
      const promotions: Prisma.PromotionCreateManyInput[] = [];
      const productIds = new Map<string, string>();

      for (const promotion of input.promotions) {
        const { productId, created } = await upsertProduct(tx, promotion);
        if (created) productsCreated += 1;
        productIds.set(productKey(promotion), productId);

        promotions.push({
          leafletId: leaflet.id,
          productId,
          chainId: input.chainId,
          storeId: null,
          scope: PromotionScope.CHAIN,
          priceMinor: promotion.priceMinor,
          regularPriceMinor: promotion.regularPriceMinor,
          packageAmount: promotion.packageAmount,
          packageUnit: promotion.baseUnit,
          pricingMode: promotion.pricingMode,
          unitPriceMinor: promotion.unitPriceMinor,
        });
      }

      await tx.promotion.createMany({ data: promotions });
      await writePriceHistory(tx, input, productIds);

      return { leafletId: leaflet.id, promotionsWritten: promotions.length, productsCreated };
    });
  }
}

function productKey(promotion: PromotionWrite): string {
  return `${promotion.name}|${promotion.brand ?? ''}`;
}

/**
 * Produkty se párují dle (canonical_name, brand) — spec §14.3 bod 5.
 * `brand` je nullable, a Postgres bere NULLy v unikátním indexu jako distintkní,
 * proto se pro `brand = null` používá findFirst místo findUnique.
 */
async function upsertProduct(
  tx: Prisma.TransactionClient,
  promotion: PromotionWrite,
): Promise<{ productId: string; created: boolean }> {
  const existing = await tx.product.findFirst({
    where: {
      canonicalName: promotion.name,
      brand: promotion.brand,
    },
    select: { id: true },
  });

  if (existing !== null) {
    return { productId: existing.id, created: false };
  }

  const created = await tx.product.create({
    data: {
      canonicalName: promotion.name,
      brand: promotion.brand,
      category: promotion.category,
      baseUnit: promotion.baseUnit,
      packageAmount: promotion.packageAmount,
      pricingMode: promotion.pricingMode,
    },
    select: { id: true },
  });

  return { productId: created.id, created: true };
}

/**
 * Denní materializace cen (spec §9.8, P3): pro každý den platnosti letáku uloží
 * nejnižší jednotkovou cenu produktu v daném řetězci.
 */
async function writePriceHistory(
  tx: Prisma.TransactionClient,
  input: LeafletWrite,
  productIds: ReadonlyMap<string, string>,
): Promise<void> {
  const bestByProduct = new Map<string, PromotionWrite>();
  for (const promotion of input.promotions) {
    const key = productKey(promotion);
    const current = bestByProduct.get(key);
    if (current === undefined || promotion.unitPriceMinor < current.unitPriceMinor) {
      bestByProduct.set(key, promotion);
    }
  }

  const days = daysBetween(input.validFrom, input.validTo);

  for (const promotion of bestByProduct.values()) {
    const productId = productIds.get(productKey(promotion));
    if (productId === undefined) continue;

    for (const date of days) {
      await tx.priceHistoryPoint.upsert({
        where: { productId_chainId_date: { productId, chainId: input.chainId, date } },
        create: {
          productId,
          chainId: input.chainId,
          date,
          priceMinor: promotion.priceMinor,
          unitPriceMinor: promotion.unitPriceMinor,
          packageAmount: promotion.packageAmount,
          packageUnit: promotion.baseUnit,
          source: PriceHistorySource.PROMO,
        },
        update: {
          priceMinor: promotion.priceMinor,
          unitPriceMinor: promotion.unitPriceMinor,
          packageAmount: promotion.packageAmount,
          packageUnit: promotion.baseUnit,
          source: PriceHistorySource.PROMO,
        },
      });
    }
  }
}
