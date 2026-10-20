import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAlertDto {
  @IsUUID()
  productId!: string;

  /** Prahová jednotková cena v haléřích (spec §6 P2). */
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  targetUnitPriceMinor!: number;

  /** Volitelné cílení na konkrétní řetězec. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  chainCode?: string;
}

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  token!: string;

  @IsIn(['IOS', 'ANDROID'])
  platform!: 'IOS' | 'ANDROID';
}
