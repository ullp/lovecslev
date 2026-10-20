import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_RADIUS_KM, MAX_RADIUS_KM, StoresService } from './stores.service';

export class NearbyStoresQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(MAX_RADIUS_KM)
  radiusKm: number = DEFAULT_RADIUS_KM;

  /** Datum pro příznak `hasActiveLeaflet` (spec F5). */
  @IsOptional()
  @IsISO8601()
  activeOn?: string;
}

/** F5 — mapa obchodů (spec §13.2 `GET /v1/stores/nearby`). */
@Controller('v1/stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get('nearby')
  async nearby(@Query() query: NearbyStoresQueryDto) {
    const data = await this.stores.nearby({
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm,
      ...(query.activeOn === undefined ? {} : { activeOn: query.activeOn }),
    });

    return { data, meta: { radiusKm: query.radiusKm, total: data.length } };
  }
}
