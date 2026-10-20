import { Inject, Injectable } from '@nestjs/common';
import { DomainError, matchProduct, normalizeQuery, type ProductMatch } from '@slevari/shared';
import { CATALOG_REPOSITORY, SEARCH_PORT, type CatalogRepository, type SearchPort } from './catalog.repository';
import type {
  ChainView,
  LeafletDetail,
  LeafletSummary,
  ProductSearchResult,
  SearchCandidateRecord,
} from './catalog.types';

export interface SearchSuggestion {
  readonly productId: string;
  readonly name: string;
  readonly similarity: number;
}

export interface ProductSearchResponse {
  readonly products: readonly ProductSearchResult[];
  readonly meta: {
    readonly query: string;
    readonly normalizedQuery: string;
    readonly driver: 'postgres' | 'elasticsearch';
    readonly match: ProductMatch;
    readonly suggestions: readonly SearchSuggestion[];
  };
}

/** F1 + F2 nad katalogem (spec §5). */
@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository,
    @Inject(SEARCH_PORT) private readonly search: SearchPort,
  ) {}

  listChains(activeOn: string): Promise<readonly ChainView[]> {
    return this.repository.listChains(activeOn);
  }

  listLeaflets(activeOn: string, chainCode?: string): Promise<readonly LeafletSummary[]> {
    return this.repository.listLeaflets(activeOn, chainCode);
  }

  async getLeaflet(
    leafletId: string,
    query: { category?: string; page: number; pageSize: number },
  ): Promise<LeafletDetail> {
    const detail = await this.repository.getLeaflet(leafletId, query);
    if (detail === null) {
      throw new DomainError('NOT_FOUND', `Leták ${leafletId} neexistuje`, { leafletId });
    }
    return detail;
  }

  /**
   * F2: normalizace → kandidáti z SearchPortu → rozhodnutí `matchProduct` → nabídky.
   * „Nejlevnější“ řadí repository podle `unitPriceMinor` (spec §5 F2 pravidlo 4).
   */
  async searchProducts(query: string, limit: number, activeOn: string): Promise<ProductSearchResponse> {
    const normalizedQuery = normalizeQuery(query);
    if (normalizedQuery.length < 2) {
      throw new DomainError('VALIDATION_ERROR', 'Dotaz musí mít po normalizaci alespoň 2 znaky', {
        query,
      });
    }

    const candidates = await this.search.findCandidates(normalizedQuery, Math.max(limit * 5, 20));
    const match = matchProduct(normalizedQuery, candidates);

    const meta = {
      query,
      normalizedQuery,
      driver: this.search.driver,
      match,
      suggestions: match.status === 'UNRESOLVED' ? topSuggestions(candidates) : [],
    };

    if (match.productId === null) {
      return { products: [], meta };
    }

    const candidate = candidates.find((item) => item.productId === match.productId);
    if (candidate === undefined) {
      return { products: [], meta };
    }

    const offers = await this.repository.findOffers([candidate.productId], activeOn);
    const product: ProductSearchResult = {
      productId: candidate.productId,
      name: candidate.canonicalName,
      brand: candidate.brand,
      category: candidate.category,
      baseUnit: candidate.baseUnit,
      offers: offers.get(candidate.productId) ?? [],
    };

    return { products: [product], meta };
  }
}

function topSuggestions(candidates: readonly SearchCandidateRecord[]): readonly SearchSuggestion[] {
  return [...candidates]
    .sort((a, b) => b.similarity - a.similarity || (a.productId < b.productId ? -1 : 1))
    .slice(0, 3)
    .map((candidate) => ({
      productId: candidate.productId,
      name: candidate.canonicalName,
      similarity: Math.round(candidate.similarity * 100) / 100,
    }));
}
