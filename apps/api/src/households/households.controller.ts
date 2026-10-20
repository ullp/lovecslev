import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PremiumGuard } from '../subscriptions/premium.guard';
import { HouseholdsService } from './households.service';

export class CreateHouseholdDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;
}

export class InviteMemberDto {
  @IsEmail({}, { message: 'Neplatný e-mail' })
  @MaxLength(255)
  email!: string;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string;
}

/** P4 — domácnosti (spec §6 P4, §13.2). */
@Controller('v1/households')
@UseGuards(AuthGuard)
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Post()
  @UseGuards(PremiumGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHouseholdDto) {
    return { data: await this.households.create(user.userId, dto.name) };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.households.list(user.userId);
    return { data, meta: { total: data.length } };
  }

  @Post(':id/invitations')
  @UseGuards(PremiumGuard)
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return { data: await this.households.invite(user.userId, id, dto.email) };
  }

  /** Přijetí pozvánky — dostupné i pro FREE účet (přidává se do cizí Premium domácnosti). */
  @Post('invitations/accept')
  @HttpCode(200)
  async accept(@CurrentUser() user: AuthenticatedUser, @Body() dto: AcceptInvitationDto) {
    return { data: await this.households.accept(user.userId, user.email, dto.token) };
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @UseGuards(PremiumGuard)
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
  ): Promise<void> {
    await this.households.removeMember(user.userId, id, memberUserId);
  }
}
