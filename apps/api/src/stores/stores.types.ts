export interface StoreNearbyView {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly chainCode: string;
  readonly chainName: string;
  readonly colorHex: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly distanceMeters: number;
  /** Má řetězec aktuální leták k danému datu (spec F5 pravidlo 4). */
  readonly hasActiveLeaflet: boolean;
}

export interface NearbyStoresQuery {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly activeOn: string;
}

/** Port nad prodejnami (spec F5, §9.3). */
export interface StoresRepository {
  findNearby(query: NearbyStoresQuery): Promise<readonly StoreNearbyView[]>;
}

export const STORES_REPOSITORY = Symbol('STORES_REPOSITORY');
