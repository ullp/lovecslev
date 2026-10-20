import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class LeafletsQueryDto {
  /** `YYYY-MM-DD`, default „dnes“ v Europe/Prague (spec §0.6). */
  @IsOptional()
  @Matches(ISO_DATE, { message: 'activeOn musí být ve formátu YYYY-MM-DD' })
  activeOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  chainCode?: string;
}

export class LeafletProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 20;
}

export class SearchQueryDto {
  @IsString()
  @MinLength(2, { message: 'Dotaz musí mít alespoň 2 znaky' })
  @MaxLength(100)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @IsOptional()
  @Matches(ISO_DATE, { message: 'activeOn musí být ve formátu YYYY-MM-DD' })
  activeOn?: string;
}
