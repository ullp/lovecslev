import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { BaseUnit } from '@slevari/shared';
import type { SearchCandidateRecord } from './catalog.types';
import type { SearchPort } from './catalog.repository';

interface CandidateRow {
  id: string;
  canonical_name: string;
  brand: string | null;
  category: string;
  base_unit: BaseUnit;
  aliases: string[] | null;
  score: number;
}

/**
 * PostgreSQL fallback vyhledávání (D21). Kandidáty hledá přes `word_similarity`
 * (pg_trgm), protože celořetězcová `similarity` u delších názvů padá pod 0,25
 * (naměřeno, spec §12.1). O shodě rozhoduje až `matchProduct` v doméně.
 */
@Injectable()
export class PostgresSearchAdapter implements SearchPort {
  readonly driver = 'postgres' as const;

  constructor(private readonly prisma: PrismaClient) {}

  async findCandidates(query: string, limit: number): Promise<readonly SearchCandidateRecord[]> {
    const rows = await this.prisma.$queryRaw<CandidateRow[]>`
      SELECT p."id",
             p."canonical_name",
             p."brand",
             p."category",
             p."base_unit",
             COALESCE(agg."aliases", ARRAY[]::text[]) AS aliases,
             GREATEST(
               word_similarity(${query}, p."search_text"),
               COALESCE(agg."alias_score", 0)
             ) AS score
      FROM "products" p
      LEFT JOIN LATERAL (
        SELECT array_agg(a."alias") AS "aliases",
               MAX(word_similarity(${query}, a."alias")) AS "alias_score"
        FROM "product_aliases" a
        WHERE a."product_id" = p."id"
      ) agg ON TRUE
      WHERE p."is_active" = TRUE
        AND (
          word_similarity(${query}, p."search_text") > 0.2
          OR COALESCE(agg."alias_score", 0) > 0.2
        )
      ORDER BY score DESC, p."id" ASC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      productId: row.id,
      canonicalName: row.canonical_name,
      brand: row.brand,
      category: row.category,
      baseUnit: row.base_unit,
      aliases: row.aliases ?? [],
      similarity: Number(row.score),
    }));
  }
}

/** Minimální rozhraní ES klienta — díky tomu jde adaptér testovat bez sítě. */
export interface ElasticHit {
  readonly _id: string;
  readonly _score?: number | null;
  readonly _source?: {
    readonly canonicalName?: string;
    readonly brand?: string | null;
    readonly category?: string;
    readonly baseUnit?: BaseUnit;
    readonly aliases?: readonly string[];
  };
}

export interface ElasticClientLike {
  search(params: {
    index: string;
    size: number;
    query: Record<string, unknown>;
  }): Promise<{ hits: { hits: readonly ElasticHit[] } }>;
}

/** Primární vyhledávání v Elasticsearch (D21). */
@Injectable()
export class ElasticSearchAdapter implements SearchPort {
  readonly driver = 'elasticsearch' as const;

  constructor(
    private readonly client: ElasticClientLike,
    private readonly index = 'products',
  ) {}

  async findCandidates(query: string, limit: number): Promise<readonly SearchCandidateRecord[]> {
    const response = await this.client.search({
      index: this.index,
      size: limit,
      query: {
        multi_match: {
          query,
          fields: ['canonicalName^3', 'brand^2', 'aliases'],
          fuzziness: 'AUTO',
        },
      },
    });

    return response.hits.hits.map((hit) => ({
      productId: hit._id,
      canonicalName: hit._source?.canonicalName ?? '',
      brand: hit._source?.brand ?? null,
      category: hit._source?.category ?? 'Ostatní',
      baseUnit: hit._source?.baseUnit ?? 'PCS',
      aliases: hit._source?.aliases ?? [],
      similarity: Math.min(1, hit._score ?? 0),
    }));
  }
}

/**
 * ES s automatickým fallbackem na PostgreSQL (D21, §13.4).
 * `driver` hlásí, který engine odpověď skutečně obsloužil (hlavička `X-Search-Fallback`).
 */
export class FallbackSearchPort implements SearchPort {
  private readonly logger = new Logger(FallbackSearchPort.name);
  private lastDriver: 'postgres' | 'elasticsearch';

  constructor(
    private readonly primary: SearchPort,
    private readonly fallback: SearchPort,
  ) {
    this.lastDriver = primary.driver;
  }

  get driver(): 'postgres' | 'elasticsearch' {
    return this.lastDriver;
  }

  async findCandidates(query: string, limit: number): Promise<readonly SearchCandidateRecord[]> {
    try {
      const candidates = await this.primary.findCandidates(query, limit);
      this.lastDriver = this.primary.driver;
      return candidates;
    } catch (error) {
      this.logger.warn(
        `Vyhledávání přes ${this.primary.driver} selhalo, přepínám na ${this.fallback.driver}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      const candidates = await this.fallback.findCandidates(query, limit);
      this.lastDriver = this.fallback.driver;
      return candidates;
    }
  }
}
