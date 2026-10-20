import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateListDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;
}

export class RenameListDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;
}

export class AddItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  rawText!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantityBase?: number;
}

export class UpdateItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantityBase?: number;
}

export class OptimizeListDto {
  /** Datum, ke kterému se počítají platné akce (spec §13.2). Default „dnes“ v Europe/Prague. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date musí být ve formátu YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxStores?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  tripPenaltyMinor?: number;

  /** FREE uživatel dostane 403 PREMIUM_REQUIRED (D18). */
  @IsOptional()
  @IsBoolean()
  includeVariantB?: boolean;
}
