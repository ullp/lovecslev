import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PremiumGuard } from '../subscriptions/premium.guard';
import { AdvisorService } from './advisor.service';

export class AdvisorPlanDto {
  @IsString()
  @MinLength(10, { message: 'Popište nákup alespoň 10 znaky' })
  @MaxLength(500)
  freeText!: string;

  /** Volitelný rozpočet v haléřích. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(100_000_000)
  budgetMinor?: number;

  /** Datum platnosti akcí (D24) — default „dnes“ v Europe/Prague. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date musí být ve formátu YYYY-MM-DD' })
  date?: string;
}

/** P1 — AI nákupní poradce (Premium, spec §6 P1). */
@Controller('v1/advisor')
export class AdvisorController {
  constructor(private readonly advisor: AdvisorService) {}

  @Post('plan')
  @HttpCode(200)
  @UseGuards(AuthGuard, PremiumGuard)
  async plan(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdvisorPlanDto) {
    const result = await this.advisor.plan(user.userId, {
      freeText: dto.freeText,
      ...(dto.budgetMinor === undefined ? {} : { budgetMinor: dto.budgetMinor }),
      ...(dto.date === undefined ? {} : { date: dto.date }),
    });

    return { data: result, meta: result.meta };
  }
}
