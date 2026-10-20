import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PremiumGuard } from '../subscriptions/premium.guard';
import { AlertsService, PushTokensService } from './alerts.service';
import { CreateAlertDto, RegisterPushTokenDto } from './dto/alerts.dto';

/** P2 — hlídač cen (Premium) + registrace push tokenu (spec §13.2). */
@Controller('v1')
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly pushTokens: PushTokensService,
  ) {}

  @Get('alerts')
  @UseGuards(AuthGuard, PremiumGuard)
  async list(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.alerts.list(user.userId);
    return { data, meta: { total: data.length } };
  }

  @Post('alerts')
  @UseGuards(AuthGuard, PremiumGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAlertDto) {
    return {
      data: await this.alerts.create(user.userId, {
        productId: dto.productId,
        targetUnitPriceMinor: dto.targetUnitPriceMinor,
        ...(dto.chainCode === undefined ? {} : { chainCode: dto.chainCode }),
      }),
    };
  }

  @Delete('alerts/:id')
  @HttpCode(204)
  @UseGuards(AuthGuard, PremiumGuard)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.alerts.remove(user.userId, id);
  }

  @Post('devices/push-token')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async registerToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<void> {
    await this.pushTokens.register(user.userId, dto.token, dto.platform);
  }
}
