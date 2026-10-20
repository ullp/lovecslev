/** Minimální API klient pro Expo (F1, F2, F5 — veřejné endpointy bez auth). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

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

export interface Offer {
  readonly chainCode: string;
  readonly chainName: string;
  readonly colorHex: string;
  readonly priceMinor: number;
  readonly unitPriceMinor: number;
  readonly unitLabel: string;
  readonly discountPercent: number | null;
  readonly validTo: string;
}

export interface SearchProduct {
  readonly productId: string;
  readonly name: string;
  readonly category: string;
  readonly offers: readonly Offer[];
}

export interface SearchMeta {
  readonly normalizedQuery: string;
  readonly driver: 'postgres' | 'elasticsearch';
  readonly match: { readonly method: string; readonly confidence: number; readonly status: string };
  readonly suggestions: readonly { readonly productId: string; readonly name: string }[];
}

export interface NearbyStore {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly chainName: string;
  readonly colorHex: string;
  readonly distanceMeters: number;
  readonly hasActiveLeaflet: boolean;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL.replace(/\/+$/, '')}${path}`);
  const payload = (await response.json()) as { data?: T; error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `API odpovědělo ${response.status}`);
  }

  return payload.data as T;
}

export const api = {
  leaflets: () => get<readonly LeafletSummary[]>('/v1/leaflets'),

  search: async (query: string): Promise<{ products: readonly SearchProduct[]; meta: SearchMeta }> => {
    const response = await fetch(
      `${API_URL.replace(/\/+$/, '')}/v1/products/search?q=${encodeURIComponent(query)}&limit=10`,
    );
    const payload = (await response.json()) as {
      data?: readonly SearchProduct[];
      meta?: SearchMeta;
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(payload.error?.message ?? `API odpovědělo ${response.status}`);
    return { products: payload.data ?? [], meta: payload.meta as SearchMeta };
  },

  nearby: (lat: number, lng: number, radiusKm = 5) =>
    get<readonly NearbyStore[]>(`/v1/stores/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
};
