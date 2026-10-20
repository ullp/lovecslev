/**
 * Zrcadlo API kontraktu (spec §13) — typy jsou záměrně duplikované,
 * protože API DTO nejsou exportovaná z backendu. Změna kontraktu = změna zde.
 */
export type BaseUnit = 'G' | 'ML' | 'PCS';
export type Plan = 'FREE' | 'PREMIUM';

export interface Envelope<T> {
  readonly data: T;
  readonly meta?: Record<string, unknown>;
}

export interface ChainView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly colorHex: string;
  readonly isMvp: boolean;
  readonly hasActiveLeaflet: boolean;
}

export interface LeafletSummary {
  readonly id: string;
  readonly chainCode: string;
  readonly chainName: string;
  readonly colorHex: string;
  readonly title: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly productCount: number;
  readonly promotionCount: number;
  readonly topDiscounts: readonly number[];
}

export interface LeafletProduct {
  readonly productId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string;
  readonly priceMinor: number;
  readonly regularPriceMinor: number | null;
  readonly discountPercent: number | null;
  readonly unitPriceMinor: number;
  readonly unitLabel: string;
  readonly packageAmount: number;
  readonly baseUnit: BaseUnit;
}

export interface LeafletDetail {
  readonly id: string;
  readonly chainCode: string;
  readonly chainName: string;
  readonly title: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly categories: readonly string[];
  readonly products: readonly LeafletProduct[];
}

export interface OfferView {
  readonly productId: string;
  readonly chainCode: string;
  readonly chainName: string;
  readonly colorHex: string;
  readonly priceMinor: number;
  readonly regularPriceMinor: number | null;
  readonly discountPercent: number | null;
  readonly unitPriceMinor: number;
  readonly unitLabel: string;
  readonly packageAmount: number;
  readonly baseUnit: BaseUnit;
  readonly validFrom: string;
  readonly validTo: string;
}

export interface ProductSearchResult {
  readonly productId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string;
  readonly baseUnit: BaseUnit;
  readonly offers: readonly OfferView[];
}

export interface MatchInfo {
  readonly productId: string | null;
  readonly method: 'EXACT' | 'ALIAS' | 'TRIGRAM' | 'NONE';
  readonly confidence: number;
  readonly status: 'RESOLVED_AUTO' | 'SUGGESTED' | 'UNRESOLVED';
  readonly matchedOn: string | null;
}

export interface SearchMeta {
  readonly query: string;
  readonly normalizedQuery: string;
  readonly driver: 'postgres' | 'elasticsearch';
  readonly match: MatchInfo;
  readonly suggestions: readonly { productId: string; name: string; similarity: number }[];
  readonly activeOn?: string;
}

export interface ListSummary {
  readonly id: string;
  readonly name: string;
  readonly isShared: boolean;
  readonly itemCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListItem {
  readonly id: string;
  readonly listId: string;
  readonly rawText: string;
  readonly productId: string | null;
  readonly quantityBase: number;
  readonly baseUnit: BaseUnit;
  readonly matchStatus: 'RESOLVED_AUTO' | 'RESOLVED_CONFIRMED' | 'SUGGESTED' | 'UNRESOLVED';
  readonly matchMethod: 'EXACT' | 'ALIAS' | 'TRIGRAM' | 'AI' | 'USER' | 'NONE';
  readonly matchConfidence: number | null;
  readonly sortOrder: number;
}

export interface ListDetail extends ListSummary {
  readonly items: readonly ListItem[];
}

export interface PurchaseLine {
  readonly productId: string;
  readonly chainCode: string;
  readonly quantityBase: number;
  readonly packages: number | null;
  readonly lineTotalMinor: number;
  readonly unitPriceMinor: number;
}

export interface ChainPlan {
  readonly chainCode: string;
  readonly subtotalMinor: number;
  readonly items: readonly PurchaseLine[];
}

export interface OptimizationResult {
  readonly variantA: { chainCode: string; totalMinor: number; items: readonly PurchaseLine[] } | null;
  readonly variantAReason: 'NO_SINGLE_STORE' | 'NO_ELIGIBLE_ITEMS' | null;
  readonly variantB: {
    totalMinor: number;
    totalWithoutPenaltyMinor: number;
    chains: readonly ChainPlan[];
  } | null;
  readonly savingsMinor: number;
  readonly recommendedVariant: 'A' | 'B';
  readonly warnings: readonly {
    code: 'ITEM_NOT_MATCHED' | 'ITEM_UNAVAILABLE';
    productId: string | null;
    rawText: string | null;
  }[];
  readonly meta: {
    maxStores: number;
    tripPenaltyMinor: number;
    chainsEvaluated: number;
    lockedFeatures: readonly string[];
  };
}

export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
}

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

/** P3 — historie cen (spec §6 P3). */
export interface PriceHistoryPoint {
  readonly date: string;
  readonly granularity: 'daily' | 'monthly';
  readonly priceMinor: number | null;
  readonly unitPriceMinor: number;
  readonly packageAmount: number;
  readonly baseUnit: BaseUnit;
}

export interface PriceHistorySeries {
  readonly chainCode: string;
  readonly chainName: string;
  readonly points: readonly PriceHistoryPoint[];
  readonly breaks: readonly string[];
}

export interface PriceHistory {
  readonly productId: string;
  readonly productName: string;
  readonly from: string;
  readonly to: string;
  readonly unitLabel: string;
  readonly series: readonly PriceHistorySeries[];
  readonly stats: {
    readonly minUnitPriceMinor: number | null;
    readonly maxUnitPriceMinor: number | null;
    readonly avgUnitPriceMinor: number | null;
    readonly lowestDate: string | null;
    readonly lowestChainCode: string | null;
    readonly sampleCount: number;
  };
}

/** P2 — hlídač cen (spec §6 P2). */
export interface PriceAlert {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly chainCode: string | null;
  readonly targetUnitPriceMinor: number;
  readonly isActive: boolean;
  readonly lastNotifiedAt: string | null;
  readonly lastNotifiedUnitPriceMinor: number | null;
  readonly createdAt: string;
}

/** P4 — domácnost (spec §6 P4). */
export interface HouseholdMember {
  readonly userId: string;
  readonly email: string;
  readonly role: 'OWNER' | 'MEMBER';
  readonly joinedAt: string;
}

export interface Household {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly members: readonly HouseholdMember[];
}
