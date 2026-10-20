import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Neplatný e-mail' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Heslo musí mít alespoň 8 znaků' })
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Neplatný e-mail' })
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  refreshToken!: string;
}
