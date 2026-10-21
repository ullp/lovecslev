import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { BaseUnit, PricingMode } from '@lovecslev/shared';

const BASE_UNITS: readonly BaseUnit[] = ['G', 'ML', 'PCS'];
const PRICING_MODES: readonly PricingMode[] = ['PACKAGE', 'WEIGHT'];

/** Položka nákupního seznamu (spec §9.10). `productId = null` = nerozpoznaná položka. */
export class OptimizerItemDto {
  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsNumber()
  @IsPositive()
  quantityBase!: number;

  @IsOptional()
  @IsString()
  rawText?: string;
}

/** Nabídka produktu v řetězci (spec §9.7) — už zredukovaná na nejnižší platnou akci. */
export class OfferDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  chainCode!: string;

  @IsInt()
  @Min(1)
  @Max(10_000_000)
  priceMinor!: number;

  @IsNumber()
  @IsPositive()
  packageAmount!: number;

  @IsIn(BASE_UNITS)
  baseUnit!: BaseUnit;

  @IsIn(PRICING_MODES)
  pricingMode!: PricingMode;
}

export class OptimizeRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OptimizerItemDto)
  items!: OptimizerItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => OfferDto)
  offers!: OfferDto[];

  /** Rozsah 1–5 hlídá doména (§11.1); DTO jen sanity-check, aby se testoval i doménový error. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxStores?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  tripPenaltyMinor?: number;
}
