import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@lovecslev/shared';
import { todayInPrague } from '../common/date';
import {
  STORES_REPOSITORY,
  type StoreNearbyView,
  type StoresRepository,
} from './stores.types';

export const DEFAULT_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 25;

export interface NearbyQueryInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm?: number;
  readonly activeOn?: string;
}

/** F5 — prodejny v okolí (spec §5 F5). */
@Injectable()
export class StoresService {
  constructor(@Inject(STORES_REPOSITORY) private readonly stores: StoresRepository) {}

  async nearby(input: NearbyQueryInput): Promise<readonly StoreNearbyView[]> {
    if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
      throw new DomainError('VALIDATION_ERROR', 'lat musí být v rozsahu -90..90', { lat: input.lat });
    }
    if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
      throw new DomainError('VALIDATION_ERROR', 'lng musí být v rozsahu -180..180', {
        lng: input.lng,
      });
    }

    const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) {
      throw new DomainError('VALIDATION_ERROR', `radiusKm musí být 0–${MAX_RADIUS_KM}`, {
        radiusKm,
      });
    }

    return this.stores.findNearby({
      lat: input.lat,
      lng: input.lng,
      radiusKm,
      activeOn: input.activeOn ?? todayInPrague(),
    });
  }
}
