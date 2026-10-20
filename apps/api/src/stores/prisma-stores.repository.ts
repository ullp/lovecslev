import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { NearbyStoresQuery, StoreNearbyView, StoresRepository } from './stores.types';

const EARTH_RADIUS_M = 6_371_000;

/**
 * F5: bounding-box prefilter + haversine v SQL (spec §9.3) — bez PostGIS.
 * Vrací max 100 prodejen seřazených podle vzdálenosti.
 */
@Injectable()
export class PrismaStoresRepository implements StoresRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findNearby(query: NearbyStoresQuery): Promise<readonly StoreNearbyView[]> {
    const rows = await this.prisma.$queryRaw<RawStoreRow[]>`
      WITH params AS (
        SELECT ${query.lat}::double precision AS lat,
               ${query.lng}::double precision AS lng,
               ${query.radiusKm}::double precision * 1000 AS radius_m,
               ${query.activeOn}::date AS active_on
      ),
      filtered AS (
        SELECT s."id",
               s."name",
               s."address",
               s."city",
               s."latitude"::double precision AS latitude,
               s."longitude"::double precision AS longitude,
               c."code" AS chain_code,
               c."name" AS chain_name,
               c."color_hex",
               EXISTS (
                 SELECT 1 FROM "leaflets" l
                 WHERE l."chain_id" = c."id"
                   AND l."valid_from" <= (SELECT active_on FROM params)
                   AND l."valid_to" >= (SELECT active_on FROM params)
               ) AS has_active_leaflet,
               ${EARTH_RADIUS_M} * 2 * asin(
                 sqrt(
                   power(sin(radians((SELECT lat FROM params) - s."latitude"::double precision) / 2), 2)
                   + cos(radians((SELECT lat FROM params)))
                     * cos(radians(s."latitude"::double precision))
                     * power(sin(radians((SELECT lng FROM params) - s."longitude"::double precision) / 2), 2)
                 )
               ) AS distance_m
        FROM "stores" s
        JOIN "chains" c ON c."id" = s."chain_id"
        WHERE s."is_active" = TRUE
          AND c."is_active" = TRUE
          AND s."latitude" BETWEEN (SELECT lat FROM params) - ((SELECT radius_m FROM params) / 111000.0)
                               AND (SELECT lat FROM params) + ((SELECT radius_m FROM params) / 111000.0)
          AND s."longitude" BETWEEN (SELECT lng FROM params) - ((SELECT radius_m FROM params) / (111000.0 * cos(radians((SELECT lat FROM params)))))
                                AND (SELECT lng FROM params) + ((SELECT radius_m FROM params) / (111000.0 * cos(radians((SELECT lat FROM params)))))
      )
      SELECT * FROM filtered
      WHERE distance_m <= (SELECT radius_m FROM params)
      ORDER BY distance_m ASC, chain_code ASC
      LIMIT 100
    `;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      chainCode: row.chain_code,
      chainName: row.chain_name,
      colorHex: row.color_hex,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      distanceMeters: Math.round(Number(row.distance_m)),
      hasActiveLeaflet: row.has_active_leaflet,
    }));
  }
}

interface RawStoreRow {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  chain_code: string;
  chain_name: string;
  color_hex: string;
  has_active_leaflet: boolean;
  distance_m: number;
}
