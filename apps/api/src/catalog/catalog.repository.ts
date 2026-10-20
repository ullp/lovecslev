import type {
  ChainView,
  LeafletDetail,
  LeafletSummary,
  OfferView,
  PriceHistoryRow,
  ProductRecord,
  SearchCandidateRecord,
} from './catalog.types';

export interface LeafletProductsQuery {
  readonly category?: string;
  readonly page: number;
  readonly pageSize: number;
}

/** Port nad katalogem (spec §8.4 bod 8) — služba nezná Prisma. */
export interface CatalogRepository {
  listChains(activeOn: string): Promise<readonly ChainView[]>;
  listLeaflets(activeOn: string, chainCode?: string): Promise<readonly LeafletSummary[]>;
  getLeaflet(leafletId: string, query: LeafletProductsQuery): Promise<LeafletDetail | null>;
  /** Nejnižší platná akce pro každý produkt a řetězec k danému datu (spec §11.1). */
  findOffers(productIds: readonly string[], activeOn: string): Promise<ReadonlyMap<string, readonly OfferView[]>>;
  /** Produkt pro potvrzení shody v seznamu (spec §5 F3). */
  findProduct(productId: string): Promise<ProductRecord | null>;
  /** P3: denní body + měsíční agregace v rozsahu (spec §9.8, §9.12). */
  findPriceHistory(productId: string, from: string, to: string): Promise<readonly PriceHistoryRow[]>;
  /** Řetězec podle kódu (P2: cílení alertu na řetězec). */
  findChainByCode(code: string): Promise<{ id: string; code: string } | null>;
}

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

/** Vyhledávací port: ES primárně, PostgreSQL fallback (D21). */
export interface SearchPort {
  readonly driver: 'postgres' | 'elasticsearch';
  findCandidates(query: string, limit: number): Promise<readonly SearchCandidateRecord[]>;
}

export const SEARCH_PORT = Symbol('SEARCH_PORT');
